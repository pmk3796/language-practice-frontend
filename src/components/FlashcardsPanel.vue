<script setup lang="ts">
import { computed } from 'vue'
import { usePracticeStore } from '@/stores/practice'

const store = usePracticeStore()

/*
 * This panel used to run its own cut-down review inside the column: no way out
 * except finishing every card, no schedule, no direction, no spoken answers. It
 * predated the review screen and had quietly become a worse copy of it, so the
 * button now opens the real one — which also means there is a way back.
 */
const stats = computed(() => store.deckStats(store.activeLangCode))

const reviewLabel = computed(() =>
  stats.value.due ? `▶ Review ${stats.value.due} due` : '▶ Review deck',
)
</script>

<template>
  <section class="panel">
    <header class="panel-head">
      <h2>Flashcards</h2>
      <span class="count">{{ store.sessionFlashcards.length }}</span>
    </header>

    <div class="body">
      <button v-if="stats.total" class="review-btn" @click="store.startReview(store.activeLangCode)">
        {{ reviewLabel }}
      </button>

      <p v-if="!store.sessionFlashcards.length" class="empty">
        Words you save in this conversation appear here.
        <template v-if="stats.total">
          Your {{ stats.total }}-card deck is behind the review button.
        </template>
      </p>
      <ul v-else>
        <li v-for="card in store.sessionFlashcards" :key="card.id">
          <div class="pair">
            <span class="target">{{ card.target }}</span>
            <span class="en">{{ card.english }}</span>
          </div>
          <button class="del" title="Remove" @click="store.removeFlashcard(card.id)">✕</button>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.panel {
  grid-area: flashcards;
}
.count {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 13px;
  color: var(--muted);
}
.body {
  flex: 1;
  overflow-y: auto;
}
.empty {
  color: var(--muted);
  font-size: 14px;
}
.review-btn {
  width: 100%;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 10px;
  padding: 10px;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 7px 10px;
}
.pair {
  display: flex;
  flex-direction: column;
}
.target {
  color: var(--accent-2);
  font-weight: 600;
}
.en {
  color: var(--muted);
  font-size: 13px;
}
.del {
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 14px;
}
.del:hover {
  color: var(--danger);
}
</style>
