<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { usePracticeStore, wordKey } from '@/stores/practice'
import { fetchSpeech } from '@/api/client'
import { playAudio } from '@/lib/audio'
import type { ChatMessage, WordPair } from '@/types'

const store = usePracticeStore()

// Which message is currently (re)generating its audio.
const replayingId = ref<string | null>(null)

// Replay a message's audio. Uses the live blob URL if present; otherwise
// regenerates it on demand — so replay keeps working after a refresh, when the
// original blob URL is gone.
async function replay(message: ChatMessage) {
  if (message.audioUrl) {
    playAudio(message.audioUrl)
    return
  }
  const code = store.activeLanguage?.code
  if (!code || replayingId.value) return
  replayingId.value = message.id
  try {
    const url = await fetchSpeech(message.text, code, store.speed)
    message.audioUrl = url // cache on the message for the rest of this session
    playAudio(url)
  } catch {
    /* ignore a failed replay */
  } finally {
    replayingId.value = null
  }
}

// Flip an entire message at once: if every word is already showing English,
// flip them all back to the target language; otherwise flip them all to English.
function flipMessage(message: ChatMessage) {
  if (!message.words) return
  const allEnglish = message.words.every((_, i) => flipped[`${message.id}:${i}`])
  message.words.forEach((_, i) => {
    flipped[`${message.id}:${i}`] = !allEnglish
  })
}

// Saving/matching is by the foreign word (punctuation/case-insensitive) —
// handled centrally in the store.
function isSaved(word: WordPair): boolean {
  return store.isFlashcardSaved(word.target)
}

// ＋ adds the word to flashcards; ✓ (already saved) removes it.
function toggleFlashcard(word: WordPair): void {
  store.toggleFlashcard(word.target, word.english)
}

/**
 * Phrase selection.
 *
 * Drag across words (or click one, then shift-click another) to select a
 * contiguous run within a single message, so whole phrases can be saved —
 * not just single words. Dragging the words themselves rather than the small
 * ＋ chips keeps the hit targets large and survives line wrapping.
 */
interface PhraseSelection {
  messageId: string
  start: number
  end: number
}
const selection = ref<PhraseSelection | null>(null)
let anchor: { messageId: string; index: number } | null = null
let dragged = false
// Tracked explicitly rather than read from e.buttons, which isn't reliable
// across input types (trackpads, synthetic events, pen).
let pointerDown = false
// The click that sets an anchor also flips that word. If the click turns out to
// be the start of a shift-click phrase selection, we put the flip back.
let anchorFlipBefore = false

function setRange(messageId: string, a: number, b: number) {
  selection.value = { messageId, start: Math.min(a, b), end: Math.max(a, b) }
}

function onWordDown(messageId: string, index: number, e: MouseEvent) {
  // Shift-click extends from the last touched word — the no-drag alternative.
  if (e.shiftKey && anchor && anchor.messageId === messageId) {
    setRange(messageId, anchor.index, index)
    // Selecting a phrase shouldn't leave the anchor word flipped.
    flipped[`${messageId}:${anchor.index}`] = anchorFlipBefore
    dragged = true // suppress the flip that would otherwise follow
    return
  }
  anchor = { messageId, index }
  anchorFlipBefore = !!flipped[`${messageId}:${index}`]
  dragged = false
  pointerDown = true
  selection.value = null
}

function onWordEnter(messageId: string, index: number) {
  // Only while the pointer is held down and within the same message.
  if (!anchor || !pointerDown || anchor.messageId !== messageId) return
  if (index !== anchor.index) {
    dragged = true
    setRange(messageId, anchor.index, index)
  }
}

function onWordClick(messageId: string, index: number) {
  if (dragged) {
    dragged = false // it was a drag/shift-click, not a plain click
    return
  }
  toggleWord(messageId, index)
}

function isSelected(messageId: string, index: number): boolean {
  const sel = selection.value
  return !!sel && sel.messageId === messageId && index >= sel.start && index <= sel.end
}

const selectedWords = computed<WordPair[]>(() => {
  const sel = selection.value
  if (!sel) return []
  const msg = store.messages.find((m) => m.id === sel.messageId)
  return msg?.words?.slice(sel.start, sel.end + 1) ?? []
})
// Only offer the phrase action for a real multi-word run.
const hasPhrase = computed(() => selectedWords.value.length > 1)
const phraseTarget = computed(() => selectedWords.value.map((w) => w.target).join(' '))
const phraseEnglish = computed(() => selectedWords.value.map((w) => w.english).join(' '))
const phraseSaved = computed(() => store.isFlashcardSaved(phraseTarget.value))

function clearSelection() {
  selection.value = null
  anchor = null
}

function togglePhrase() {
  store.toggleFlashcard(phraseTarget.value, phraseEnglish.value)
  // The action is done — leaving the run highlighted reads as still-selected.
  clearSelection()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') clearSelection()
}
function onPointerUp() {
  pointerDown = false
}
// Clicking away from the words (or the phrase bar) drops the selection.
function onDocMouseDown(e: MouseEvent) {
  const el = e.target as HTMLElement | null
  if (el?.closest('.word') || el?.closest('.phrase-bar')) return
  clearSelection()
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('mouseup', onPointerUp)
  window.addEventListener('mousedown', onDocMouseDown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('mouseup', onPointerUp)
  window.removeEventListener('mousedown', onDocMouseDown)
})

/**
 * Saved multi-word phrases are underlined across the whole run.
 *
 * Matching ignores punctuation and case, so "certo, un caffè" and
 * "certo un caffè" are the same phrase.
 *
 * Overlapping runs are merged into one continuous underline rather than stacked
 * into separate lanes: there isn't enough room beneath a line of text for
 * several bars without them crowding each other and the row below. So a word
 * shows at most two marks — its own underline tight to the text, and one phrase
 * underline beneath it.
 */
interface PhraseRun {
  start: number
  end: number
}

const phraseRuns = computed<Record<string, PhraseRun[]>>(() => {
  // Only cards that are actually phrases; single words keep their own underline.
  const phrases = store.flashcards
    .map((c) => c.target.trim().split(/\s+/).map(wordKey).filter(Boolean))
    .filter((toks) => toks.length > 1)

  const byMessage: Record<string, PhraseRun[]> = {}
  if (!phrases.length) return byMessage

  for (const message of store.messages) {
    if (!message.words?.length) continue
    const toks = message.words.map((w) => wordKey(w.target))
    const found: { start: number; end: number }[] = []

    for (const phrase of phrases) {
      for (let i = 0; i + phrase.length <= toks.length; i++) {
        if (phrase.every((t, j) => t === toks[i + j])) {
          found.push({ start: i, end: i + phrase.length - 1 })
        }
      }
    }
    if (!found.length) continue

    // Merge runs that genuinely overlap. Runs that merely sit next to each
    // other stay separate, so two adjacent phrases don't read as one.
    found.sort((a, b) => a.start - b.start || a.end - b.end)
    const merged: PhraseRun[] = []
    for (const run of found) {
      const last = merged[merged.length - 1]
      if (last && run.start <= last.end) last.end = Math.max(last.end, run.end)
      else merged.push({ ...run })
    }
    byMessage[message.id] = merged
  }
  return byMessage
})

/** The phrase underline covering one word, if any (null when not in a run). */
function phraseMark(messageId: string, index: number): { last: boolean } | null {
  const run = (phraseRuns.value[messageId] ?? []).find(
    (r) => index >= r.start && index <= r.end,
  )
  return run ? { last: index === run.end } : null
}

// Tracks which assistant words are currently flipped to English, keyed by
// "messageId:wordIndex".
const flipped = reactive<Record<string, boolean>>({})
const listEl = ref<HTMLElement | null>(null)

function toggleWord(messageId: string, index: number) {
  const key = `${messageId}:${index}`
  flipped[key] = !flipped[key]
}

function displayWord(messageId: string, index: number, target: string, english: string) {
  return flipped[`${messageId}:${index}`] ? english : target
}

// Split a word into leading punctuation / core / trailing punctuation, so the
// saved-word underline can be drawn under the core only (not the period, etc.).
function splitWord(s: string): { lead: string; core: string; trail: string } {
  const lead = s.match(/^[\p{P}\p{S}\s]+/u)?.[0] ?? ''
  const trail = s.match(/[\p{P}\p{S}\s]+$/u)?.[0] ?? ''
  if (lead.length + trail.length >= s.length) return { lead: s, core: '', trail: '' }
  return { lead, core: s.slice(lead.length, s.length - trail.length), trail }
}

function wordParts(messageId: string, index: number, target: string, english: string) {
  return splitWord(displayWord(messageId, index, target, english))
}

// Keep the transcript scrolled to the latest message.
watch(
  () => store.messages.map((m) => m.text).join('|'),
  async () => {
    await nextTick()
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  },
)
</script>

<template>
  <section class="panel chat">
    <header class="panel-head">
      <h2>Conversation</h2>
      <button v-if="store.messages.length" class="ghost" @click="store.clearConversation()">Clear</button>
    </header>

    <div ref="listEl" class="messages">
      <p v-if="!store.messages.length" class="empty">
        Your conversation will appear here. Tap the mic and say hello 👋
      </p>

      <div v-for="message in store.messages" :key="message.id" class="row" :class="message.role">
        <div class="bubble">
          <!-- Actions pinned to a fixed side of the box (left for the assistant,
               right for you) so the flip button doesn't move when the text
               reflows on flip. -->
          <div
            v-if="!message.pending && ((message.words && message.words.length) || (message.role === 'assistant' && message.text) || (message.role === 'user' && message.audioUrl))"
            class="msg-actions"
          >
            <button
              v-if="message.words && message.words.length && !message.pending"
              class="act-btn"
              title="Translate the whole sentence"
              @click="flipMessage(message)"
            >
              ⇄
            </button>
            <button
              v-if="!message.pending && ((message.role === 'assistant' && message.text) || (message.role === 'user' && message.audioUrl))"
              class="act-btn"
              :disabled="replayingId === message.id"
              :title="message.role === 'user' ? 'Replay your recording' : 'Replay'"
              @click="replay(message)"
            >
              <span v-if="replayingId === message.id" class="spinner" />
              <span v-else>🔊</span>
            </button>
          </div>

          <!-- Messages with a word breakdown render word-by-word, so each word
               can be tapped to reveal its English translation or saved (＋). This
               applies to both the assistant's replies and your own messages. -->
          <div class="content">
          <template v-if="message.words && message.words.length">
            <span
              v-for="(word, i) in message.words"
              :key="i"
              class="word"
              :class="{
                flipped: flipped[`${message.id}:${i}`],
                saved: isSaved(word),
                picked: isSelected(message.id, i),
              }"
              :title="word.english"
              @mousedown="onWordDown(message.id, i, $event)"
              @mouseenter="onWordEnter(message.id, i)"
              @click="onWordClick(message.id, i)"
            >
              <span class="tok-lead">{{ wordParts(message.id, i, word.target, word.english).lead }}</span
              ><span class="tok-core">{{ wordParts(message.id, i, word.target, word.english).core }}</span
              ><span class="tok-trail">{{ wordParts(message.id, i, word.target, word.english).trail }}</span
              ><span
                v-if="phraseMark(message.id, i)"
                class="phrase-line"
                :class="{ bridge: !phraseMark(message.id, i)!.last }"
              />
              <button
                class="add-chip"
                :class="{ saved: isSaved(word) }"
                :title="isSaved(word) ? 'Remove from flashcards' : 'Add to flashcards'"
                @click.stop="toggleFlashcard(word)"
              >
                <span class="glyph">{{ isSaved(word) ? '✕' : '+' }}</span>
              </button>
            </span>
            <span v-if="message.pending" class="caret">▍</span>
          </template>

          <template v-else>
            {{ message.text }}<span v-if="message.pending" class="caret">▍</span>
          </template>
          </div>
        </div>
      </div>
    </div>
    <div v-if="hasPhrase" class="phrase-bar">
      <div class="phrase-text">
        <span class="phrase-target">{{ phraseTarget }}</span>
        <span class="phrase-en">{{ phraseEnglish }}</span>
      </div>
      <button class="phrase-add" :class="{ saved: phraseSaved }" @click="togglePhrase">
        {{ phraseSaved ? '✓ Saved' : '＋ Add phrase' }}
      </button>
      <button class="phrase-x" title="Clear selection" @click="clearSelection">✕</button>
    </div>

    <p v-else class="tip">
      Tip: tap a word to flip it, or drag across words (or shift-click) to save a whole phrase. Use
      <span class="flip-inline">⇄</span> to translate the line.
    </p>
  </section>
</template>

<style scoped>
.chat {
  grid-area: chat;
}

.messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}

.empty {
  color: var(--muted);
  margin: auto;
  text-align: center;
}

.row {
  display: flex;
}

.row.user {
  justify-content: flex-end;
}

.bubble {
  max-width: 78%;
  padding: 8px 12px;
  border-radius: 14px;
  line-height: 1.85;
  font-size: 16px;
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Assistant: actions on the left; you: actions on the right. */
.row.user .bubble {
  flex-direction: row-reverse;
}

.content {
  min-width: 0;
}

.row.user .bubble {
  background: var(--sent);
  color: var(--on-accent);
  border-bottom-right-radius: 4px;
}

.row.assistant .bubble {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-bottom-left-radius: 4px;
}

.phrase-line {
  position: absolute;
  left: 0;
  right: 0;
  /* Sits clearly below the single-word underline above it. */
  bottom: -4px;
  height: 3px;
  border-radius: 2px;
  background: var(--vocab-underline);
  pointer-events: none;
}
/* Words mid-run stretch past their own box to cover the space that separates
   them, so the phrase reads as one continuous underline. */
.phrase-line.bridge {
  right: -5px;
}

.word {
  cursor: pointer;
  /* These are interactive tokens, not prose — stop drag-select painting a
     native blue highlight on top of our own selection styling. */
  user-select: none;
  -webkit-user-select: none;
  padding: 1px 2px;
  border-radius: 5px;
  transition: background 0.12s ease;
  position: relative;
  display: inline-block;
}

.word:hover {
  background: var(--word-hover);
}

/* Your indigo bubble keeps its on-dark word tokens in both themes — main.css
   scopes them to .row.user, so no per-bubble rules are needed here. */

.add-chip {
  position: absolute;
  top: -9px;
  right: -7px;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  border: none;
  padding: 0;
  font-size: 11px;
  line-height: 1;
  display: none;
  align-items: center;
  justify-content: center;
  /* White chip so it stays legible on both the dark assistant bubble and the
     blue user bubble (which is the same colour as --accent). */
  background: var(--chip-bg);
  color: var(--chip-fg);
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
  transition: transform 0.12s ease, background 0.15s ease, color 0.15s ease,
    box-shadow 0.15s ease;
}

/* The badge is a hover-only action: ＋ to add on unsaved words, red ✕ to remove
   on saved ones. Saved state itself is shown by the underline, not the badge. */
.word:hover .add-chip {
  display: inline-flex;
}

.add-chip:hover {
  transform: scale(1.18);
}

.add-chip.saved {
  background: linear-gradient(145deg, #ff7a86, #ff4d5e);
  color: #fff;
  box-shadow: 0 2px 8px rgba(255, 77, 94, 0.5);
}

.add-chip .glyph {
  display: inline-flex;
}

.word.flipped {
  background: var(--flip-bg);
  color: var(--flip-fg);
}

/* While a run is selected the single-word ＋ chip would float over it. */
.word.picked .add-chip {
  display: none;
}

/* Words in the current phrase selection. */
.word.picked {
  background: var(--accent);
  color: var(--on-accent);
  border-radius: 0;
}
/* Round only the ends of the run so it reads as one continuous highlight. */
.word.picked:not(.picked + .picked) {
  border-top-left-radius: 5px;
  border-bottom-left-radius: 5px;
}
.word.picked:not(:has(+ .picked)) {
  border-top-right-radius: 5px;
  border-bottom-right-radius: 5px;
}

/* Saved words get a thick green underline under the core only (not the
   surrounding punctuation), as a clean, always-on indicator. */
.word.saved .tok-core {
  text-decoration: underline;
  text-decoration-color: var(--vocab-underline);
  text-decoration-thickness: 3px;
  text-underline-offset: 6px;
  text-decoration-skip-ink: none;
}

/* Actions pinned inside the bubble on a fixed side, stacked vertically so they
   stay put regardless of the message length or a flip reflowing the text. A
   faint separator divides them from the text. */
.msg-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 9px;
  border-right: 1px solid var(--divider);
}

/* You: actions are on the right, so the separator flips to their left. */
.row.user .msg-actions {
  padding-right: 0;
  border-right: none;
  padding-left: 9px;
  border-left: 1px solid var(--divider);
}

.act-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: var(--tint);
  border: 1px solid var(--divider);
  border-radius: 7px;
  color: inherit;
  font-size: 13px;
  line-height: 1;
}

.act-btn:hover:not(:disabled) {
  background: var(--tint-strong);
  border-color: var(--divider);
}

.act-btn:disabled {
  cursor: default;
}

.act-btn .spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--divider);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: act-spin 0.7s linear infinite;
}

@keyframes act-spin {
  to {
    transform: rotate(360deg);
  }
}

.caret {
  animation: blink 1s steps(2) infinite;
  color: var(--accent);
  margin-left: 1px;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.phrase-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  padding: 9px 12px;
  background: var(--panel-2);
  border: 1px solid var(--accent);
  border-radius: 11px;
}
.phrase-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.phrase-target {
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.phrase-en {
  color: var(--muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.phrase-add {
  flex-shrink: 0;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 9px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
}
.phrase-add:hover {
  filter: brightness(1.08);
}
.phrase-add.saved {
  background: var(--success-soft);
  color: var(--accent-2);
}
.phrase-x {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 13px;
  padding: 4px 6px;
  border-radius: 7px;
}
.phrase-x:hover {
  color: var(--text);
  background: var(--tint);
}

.tip {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.chip-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 10px;
  vertical-align: middle;
}

.flip-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 0 4px;
  font-size: 11px;
  vertical-align: middle;
}
</style>
