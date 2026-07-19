<script setup lang="ts">
import { usePracticeStore } from '@/stores/practice'

const store = usePracticeStore()
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
          <button
            class="add"
            :class="{ saved: store.isFlashcardSaved(t.target, t.english) }"
            :title="store.isFlashcardSaved(t.target, t.english) ? 'Remove from flashcards' : 'Add to flashcards'"
            @click="store.toggleFlashcard(t.target, t.english)"
          >
            {{ store.isFlashcardSaved(t.target, t.english) ? '✓' : '＋' }}
          </button>
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
.add {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  width: 26px;
  height: 26px;
  border-radius: 8px;
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}
.add:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.add.saved {
  border-color: var(--accent-2);
  color: var(--accent-2);
}
</style>
