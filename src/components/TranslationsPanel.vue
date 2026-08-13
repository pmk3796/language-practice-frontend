<script setup lang="ts">
import { ref } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import { completeWordPair, fetchSpeech } from '@/api/client'
import { playAudio } from '@/lib/audio'
import type { TranslationEntry } from '@/types'

const store = usePracticeStore()

// Which row is currently loading its audio (only one plays at a time).
const speakingId = ref<string | null>(null)

/*
 * Saving a translation used to be all or nothing, so "with my coworkers → con i
 * miei colleghi" could only be kept whole — a sentence fragment, not vocabulary.
 * Every word is its own target now, matching the conversation, where tapping a
 * single word already works.
 */
const pendingWord = ref<string | null>(null)
const lookupError = ref('')

const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean)

async function toggleWord(t: TranslationEntry, word: string, key: string) {
  if (pendingWord.value) return
  lookupError.value = ''

  if (store.isFlashcardSaved(word)) {
    store.toggleFlashcard(word, '')
    return
  }

  // A one-word translation already has its English, so asking again would spend
  // a call to learn what the row is showing.
  if (wordsOf(t.target).length === 1) {
    store.toggleFlashcard(t.target, t.english)
    return
  }

  const lang = store.activeLanguage?.code
  if (!lang) return
  pendingWord.value = key
  try {
    const pair = await completeWordPair(lang, 'target', word, {
      phrase: t.target,
      english: t.english,
    })
    // The tapped word is the target, not whatever comes back: it is what the
    // learner saw, and keying the card to it is what keeps the underline honest.
    store.toggleFlashcard(word, pair.english)
  } catch (err) {
    lookupError.value = err instanceof Error ? err.message : 'Could not look that up.'
  } finally {
    pendingWord.value = null
  }
}

async function speak(t: TranslationEntry) {
  const code = store.activeLanguage?.code
  if (!code || speakingId.value) return
  speakingId.value = t.id
  try {
    const url = await fetchSpeech(t.target, code, store.speed)
    playAudio(url)
  } catch {
    /* silently ignore — a failed play shouldn't disrupt the session */
  } finally {
    speakingId.value = null
  }
}
</script>

<template>
  <section class="panel">
    <header class="panel-head">
      <h2>Translations</h2>
    </header>
    <div class="body">
      <p v-if="!store.translations.length" class="empty">
        When you use an English word, its {{ store.activeLanguage?.name || 'target-language' }} translation shows up here.
      </p>
      <ul v-else>
        <li v-for="t in store.translations" :key="t.id">
          <div class="pair">
            <span class="en">{{ t.english }}</span>
            <span class="arrow">→</span>
            <span class="target">
              <button
                v-for="(w, i) in wordsOf(t.target)"
                :key="i"
                class="word"
                :class="{
                  saved: store.isFlashcardSaved(w),
                  pending: pendingWord === `${t.id}:${i}`,
                }"
                :disabled="!!pendingWord"
                :title="store.isFlashcardSaved(w) ? `Remove “${w}”` : `Save “${w}” on its own`"
                @click="toggleWord(t, w, `${t.id}:${i}`)"
              >{{ w }}</button>
            </span>
          </div>
          <div class="row-actions">
            <button
              class="icon speak"
              :disabled="speakingId === t.id"
              title="Play pronunciation"
              @click="speak(t)"
            >
              <span v-if="speakingId === t.id" class="spinner" />
              <span v-else>🔊</span>
            </button>
            <button
              class="icon add"
              :class="{ saved: store.isFlashcardSaved(t.target) }"
              :title="
                store.isFlashcardSaved(t.target)
                  ? 'Remove the whole phrase'
                  : 'Save the whole phrase — or tap a single word'
              "
              @click="store.toggleFlashcard(t.target, t.english)"
            >
              {{ store.isFlashcardSaved(t.target) ? '✓' : '＋' }}
            </button>
          </div>
        </li>
      </ul>
      <p v-if="lookupError" class="note err">{{ lookupError }}</p>
      <p v-else-if="store.translations.length" class="note">
        Tap any word to save it on its own, or ＋ for the whole phrase.
      </p>
    </div>
  </section>
</template>

<style scoped>
.panel {
  grid-area: translations;
}
.body {
  flex: 1;
  overflow-y: auto;
}
.empty {
  color: var(--muted);
  font-size: 14px;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
}
.pair {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  min-width: 0;
}
.en {
  color: var(--muted);
}
.arrow {
  /* Was --border, i.e. the token chosen to be almost invisible — but this glyph
     is what says which way round the pair reads. */
  color: var(--muted);
}
.target {
  display: flex;
  flex-wrap: wrap;
  /* No gap: each word carries its own padding, and adding a gap on top of that
     spaced them wider apart than an ordinary space. */
  gap: 0;
  min-width: 0;
}
.word {
  background: transparent;
  border: none;
  padding: 1px 2px;
  border-radius: 5px;
  font: inherit;
  font-weight: 600;
  color: var(--accent-2);
}
.word:hover:not(:disabled) {
  background: var(--word-hover);
}
.word:disabled {
  cursor: default;
}
/* Same treatment saved words get in the conversation, so the two panels agree
   about what "already in your deck" looks like. */
.word.saved {
  text-decoration: underline;
  text-decoration-color: var(--vocab-underline);
  text-decoration-thickness: 3px;
  text-underline-offset: 5px;
  text-decoration-skip-ink: none;
}
.word.pending {
  opacity: 0.5;
}
.note {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 12px;
}
.note.err {
  color: var(--warn);
}
.row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  width: 26px;
  height: 26px;
  border-radius: 8px;
  font-size: 15px;
  line-height: 1;
}
.icon:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.icon:disabled {
  cursor: default;
}
.add.saved {
  border-color: var(--accent-2);
  color: var(--accent-2);
}
.spinner {
  width: 13px;
  height: 13px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
