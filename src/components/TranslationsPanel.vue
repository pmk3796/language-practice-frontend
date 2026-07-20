<script setup lang="ts">
import { ref } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import { fetchSpeech } from '@/api/client'
import { playAudio } from '@/lib/audio'
import type { TranslationEntry } from '@/types'

const store = usePracticeStore()

// Which row is currently loading its audio (only one plays at a time).
const speakingId = ref<string | null>(null)

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
            <span class="target">{{ t.target }}</span>
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
              :class="{ saved: store.isFlashcardSaved(t.target, t.english) }"
              :title="store.isFlashcardSaved(t.target, t.english) ? 'Remove from flashcards' : 'Add to flashcards'"
              @click="store.toggleFlashcard(t.target, t.english)"
            >
              {{ store.isFlashcardSaved(t.target, t.english) ? '✓' : '＋' }}
            </button>
          </div>
        </li>
      </ul>
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
  color: var(--border);
}
.target {
  color: var(--accent-2);
  font-weight: 600;
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
