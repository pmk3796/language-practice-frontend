<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import { playAudio } from '@/lib/audio'
import type { WordPair } from '@/types'

const store = usePracticeStore()

// Is this word already in the flashcard deck? (matches the store's dedup rule)
function isSaved(word: WordPair): boolean {
  return store.flashcards.some(
    (c) =>
      c.target.toLowerCase() === word.target.toLowerCase() &&
      c.english.toLowerCase() === word.english.toLowerCase(),
  )
}

// ＋ adds the word to flashcards; ✓ (already saved) removes it.
function toggleFlashcard(word: WordPair): void {
  const existing = store.flashcards.find(
    (c) =>
      c.target.toLowerCase() === word.target.toLowerCase() &&
      c.english.toLowerCase() === word.english.toLowerCase(),
  )
  if (existing) store.removeFlashcard(existing.id)
  else store.addFlashcard(word.target, word.english)
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
          <!-- Assistant messages render word-by-word so each can be tapped to
               reveal its English translation. -->
          <template v-if="message.role === 'assistant' && message.words && message.words.length">
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

          <button
            v-if="message.role === 'assistant' && message.audioUrl"
            class="replay"
            title="Replay"
            @click="playAudio(message.audioUrl!)"
          >
            🔊
          </button>
        </div>
      </div>
    </div>
    <p class="tip">
      Tip: tap a word to flip {{ store.activeLanguage?.name || 'the language' }} ↔ English, or hover it and click
      <span class="chip-inline">＋</span> to save it to Flashcards.
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
  background: var(--accent);
  color: #fff;
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

.replay {
  background: transparent;
  border: none;
  font-size: 15px;
  margin-left: 6px;
  opacity: 0.7;
}

.replay:hover {
  opacity: 1;
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
</style>
