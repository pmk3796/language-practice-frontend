<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import { usePracticeStore } from '@/stores/practice'
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
              :class="{ flipped: flipped[`${message.id}:${i}`], saved: isSaved(word) }"
              :title="word.english"
              @click="toggleWord(message.id, i)"
            >
              <span class="tok-lead">{{ wordParts(message.id, i, word.target, word.english).lead }}</span
              ><span class="tok-core">{{ wordParts(message.id, i, word.target, word.english).core }}</span
              ><span class="tok-trail">{{ wordParts(message.id, i, word.target, word.english).trail }}</span>
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
    <p class="tip">
      Tip: tap a word to flip it, or use <span class="flip-inline">⇄</span> to translate the whole line. Hover a
      word and click <span class="chip-inline">＋</span> to save it to Flashcards.
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
  line-height: 1.55;
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
  background: var(--accent);
  color: white;
  border-bottom-right-radius: 4px;
}

.row.assistant .bubble {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-bottom-left-radius: 4px;
}

.word {
  cursor: pointer;
  padding: 1px 2px;
  border-radius: 5px;
  transition: background 0.12s ease;
  position: relative;
  display: inline-block;
}

.word:hover {
  background: rgba(108, 140, 255, 0.25);
}

/* Your bubble is blue, so the blue hover is invisible there — use a light tint. */
.row.user .word:hover {
  background: rgba(255, 255, 255, 0.28);
}

/* Green clashes with the blue bubble: flip reads via a light highlight (white
   text), and the saved underline switches to a warm amber that suits the blue. */
.row.user .word.flipped {
  background: rgba(255, 255, 255, 0.26);
  color: #fff;
}

.row.user .word.saved .tok-core {
  text-decoration-color: var(--warn);
}

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
  background: #fff;
  color: var(--accent);
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
  background: rgba(74, 214, 160, 0.22);
  color: var(--accent-2);
}

/* Saved words get a thick green underline under the core only (not the
   surrounding punctuation), as a clean, always-on indicator. */
.word.saved .tok-core {
  text-decoration: underline;
  text-decoration-color: var(--accent-2);
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
  border-right: 1px solid rgba(255, 255, 255, 0.15);
}

/* You: actions are on the right, so the separator flips to their left. */
.row.user .msg-actions {
  padding-right: 0;
  border-right: none;
  padding-left: 9px;
  border-left: 1px solid rgba(255, 255, 255, 0.28);
}

.act-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 7px;
  color: inherit;
  font-size: 13px;
  line-height: 1;
}

.act-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.34);
}

.act-btn:disabled {
  cursor: default;
}

.act-btn .spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.35);
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
  color: #fff;
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
