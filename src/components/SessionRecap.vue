<script setup lang="ts">
import { computed } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import type { WordPair } from '@/types'

const store = usePracticeStore()

const recap = computed(() => store.activeSession?.recap ?? null)

function isSaved(w: WordPair): boolean {
  return store.isFlashcardSaved(w.target, w.english)
}

function toggleWord(w: WordPair) {
  store.toggleFlashcard(w.target, w.english)
}

function addAll() {
  recap.value?.vocab.forEach((w) => store.addFlashcard(w.target, w.english))
}
</script>

<template>
  <div class="overlay" @click.self="store.hideRecap()">
    <div class="card">
      <header>
        <h2>Session recap</h2>
        <button class="x" @click="store.hideRecap()">✕</button>
      </header>

      <div v-if="store.recapLoading" class="state">
        <span class="spinner" />
        <p>Reviewing your conversation…</p>
      </div>

      <div v-else-if="store.recapError" class="state error">
        <p>{{ store.recapError }}</p>
        <button class="retry" @click="store.endSession()">Try again</button>
      </div>

      <div v-else-if="recap" class="body">
        <p class="summary">{{ recap.summary }}</p>

        <div class="cols">
          <div v-if="recap.strengths.length" class="col">
            <h3>✅ What went well</h3>
            <ul>
              <li v-for="(item, i) in recap.strengths" :key="i">{{ item }}</li>
            </ul>
          </div>
          <div v-if="recap.focusAreas.length" class="col">
            <h3>🎯 To review</h3>
            <ul>
              <li v-for="(item, i) in recap.focusAreas" :key="i">{{ item }}</li>
            </ul>
          </div>
        </div>

        <div v-if="recap.vocab.length" class="vocab">
          <div class="vocab-head">
            <h3>Key vocabulary</h3>
            <button class="add-all" @click="addAll">Add all to flashcards</button>
          </div>
          <div class="chips">
            <button
              v-for="(w, i) in recap.vocab"
              :key="i"
              class="chip"
              :class="{ saved: isSaved(w) }"
              @click="toggleWord(w)"
            >
              <strong>{{ w.target }}</strong> · {{ w.english }}
              <span class="mark">{{ isSaved(w) ? '✓' : '＋' }}</span>
            </button>
          </div>
        </div>

        <button class="done" @click="store.finishRecap()">Done →</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(6, 8, 16, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 50;
}

.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 22px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
header h2 {
  margin: 0;
  font-size: 20px;
}
.x {
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 18px;
}
.x:hover {
  color: var(--text);
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 30px 0;
  color: var(--muted);
}
.state.error p {
  color: var(--danger);
}
.retry {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
  font-weight: 600;
}
.spinner {
  width: 30px;
  height: 30px;
  border: 4px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.summary {
  margin: 0 0 18px;
  font-size: 16px;
  line-height: 1.6;
}

.cols {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.col {
  flex: 1;
  min-width: 200px;
}
.col h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
.col ul {
  margin: 0;
  padding-left: 18px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

.vocab {
  margin-bottom: 20px;
}
.vocab-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.vocab-head h3 {
  margin: 0;
  font-size: 14px;
}
.add-all {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12px;
}
.add-all:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 14px;
  color: var(--text);
}
.chip .mark {
  margin-left: 4px;
  color: var(--muted);
}
.chip.saved {
  border-color: var(--accent-2);
}
.chip.saved .mark {
  color: var(--accent-2);
}

.done {
  width: 100%;
  background: linear-gradient(145deg, var(--accent), #4a6bff);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 12px;
  font-size: 16px;
  font-weight: 700;
}
</style>
