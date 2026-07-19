<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import { playAudio } from '@/lib/audio'
import type { ChatMessage, WordPair } from '@/types'

const store = usePracticeStore()

// Flip an entire message at once: if every word is already showing English,
// flip them all back to the target language; otherwise flip them all to English.
function flipMessage(message: ChatMessage) {
  if (!message.words) return
  const allEnglish = message.words.every((_, i) => flipped[`${message.id}:${i}`])
  message.words.forEach((_, i) => {
    flipped[`${message.id}:${i}`] = !allEnglish
  })
}

// Saving/matching is punctuation-insensitive — handled centrally in the store.
function isSaved(word: WordPair): boolean {
  return store.isFlashcardSaved(word.target, word.english)
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
          <!-- Messages with a word breakdown render word-by-word, so each word
               can be tapped to reveal its English translation or saved (＋). This
               applies to both the assistant's replies and your own messages. -->
          <div class="content">
          <template v-if="message.words && message.words.length">
            <span
              v-for="(word, i) in message.words"
              :key="i"
              class="word"
              :class="{ flipped: flipped[`${message.id}:${i}`] }"
              :title="word.english"
              @click="toggleWord(message.id, i)"
            >
              {{ displayWord(message.id, i, word.target, word.english) }}
              <button
                class="add-chip"
                :class="{ saved: isSaved(word) }"
                :title="isSaved(word) ? 'Remove from flashcards' : 'Add to flashcards'"
                @click.stop="toggleFlashcard(word)"
              >
                {{ isSaved(word) ? '✓' : '+' }}
              </button>
            </span>
            <span v-if="message.pending" class="caret">▍</span>
          </template>

          <template v-else>
            {{ message.text }}<span v-if="message.pending" class="caret">▍</span>
          </template>
          </div>
        </div>

        <!-- A tab attached to the end of the bubble (in the empty horizontal
             space) with a fixed sentence-flip toggle. -->
        <div
          v-if="(message.words && message.words.length && !message.pending) || (message.role === 'assistant' && message.audioUrl)"
          class="ext"
        >
          <button
            v-if="message.words && message.words.length && !message.pending"
            class="ext-btn"
            title="Translate the whole sentence"
            @click="flipMessage(message)"
          >
            ⇄
          </button>
          <button
            v-if="message.role === 'assistant' && message.audioUrl"
            class="ext-btn"
            title="Replay"
            @click="playAudio(message.audioUrl!)"
          >
            🔊
          </button>
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
  align-items: center;
  gap: 6px;
}

.row.user {
  justify-content: flex-end;
}

/* On your (right-aligned) messages, the tab sits to the LEFT of the bubble. */
.row.user .bubble {
  order: 2;
}
.row.user .ext {
  order: 1;
}

.bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 14px;
  line-height: 1.55;
  font-size: 16px;
  position: relative;
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

.add-chip {
  position: absolute;
  top: -8px;
  right: -6px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: none;
  padding: 0;
  font-size: 10px;
  line-height: 1;
  display: none;
  align-items: center;
  justify-content: center;
  /* White chip so it stays legible on both the dark assistant bubble and the
     blue user bubble (which is the same colour as --accent). */
  background: #fff;
  color: var(--accent);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

/* Show the ＋ on hover, but keep a ✓ visible for words already saved. */
.word:hover .add-chip {
  display: inline-flex;
}

.add-chip.saved {
  display: inline-flex;
  background: var(--accent-2);
  color: #0f1220;
}

.add-chip:hover {
  filter: brightness(1.12);
}

.word.flipped {
  background: rgba(74, 214, 160, 0.22);
  color: var(--accent-2);
}

/* A tab attached beside the bubble, matching its style, holding the fixed
   flip/replay controls. Lives in the empty horizontal space, so it costs no
   vertical room and never overlaps the text. */
.ext {
  flex-shrink: 0;
  align-self: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
}

.row.user .ext {
  background: var(--accent);
  border-color: transparent;
  color: #fff;
}

.ext-btn {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 14px;
  line-height: 1;
  padding: 5px 7px;
  border-radius: 8px;
  opacity: 0.85;
}

.ext-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.16);
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
