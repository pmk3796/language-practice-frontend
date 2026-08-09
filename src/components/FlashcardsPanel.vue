<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePracticeStore } from '@/stores/practice'

const store = usePracticeStore()

const reviewing = ref(false)
const index = ref(0)
const revealed = ref(false)

// Review lowest-box (least-known) cards first.
const queue = computed(() => [...store.flashcards].sort((a, b) => a.box - b.box))
const current = computed(() => queue.value[index.value])

function startReview() {
  if (!store.flashcards.length) return
  reviewing.value = true
  index.value = 0
  revealed.value = false
}

function grade(known: boolean) {
  if (!current.value) return
  store.reviewFlashcard(current.value.id, known)
  next()
}

function next() {
  revealed.value = false
  if (index.value + 1 >= queue.value.length) {
    reviewing.value = false // finished the deck
  } else {
    index.value += 1
  }
}

// Leaving review if the deck empties (e.g. all cards deleted).
watch(
  () => store.flashcards.length,
  (n) => {
    if (n === 0) reviewing.value = false
  },
)
</script>

<template>
  <section class="panel">
    <header class="panel-head">
      <h2>Flashcards</h2>
      <span class="count">{{ store.flashcards.length }}</span>
    </header>

    <!-- Review mode -->
    <div v-if="reviewing && current" class="review">
      <div class="card" :class="{ revealed }" @click="revealed = !revealed">
        <div class="face front">{{ current.target }}</div>
        <div class="face back">{{ current.english }}</div>
        <div class="flip-hint">{{ revealed ? '' : 'tap to reveal' }}</div>
      </div>
      <div v-if="revealed" class="grade">
        <button class="again" @click="grade(false)">Again</button>
        <button class="known" @click="grade(true)">Got it</button>
      </div>
      <div class="progress">{{ index + 1 }} / {{ queue.length }}</div>
    </div>

    <!-- List mode -->
    <div v-else class="body">
      <p v-if="!store.flashcards.length" class="empty">
        Save words from the Translations panel, or drag across words in the conversation to save a phrase.
      </p>
      <template v-else>
        <button class="review-btn" @click="startReview">▶ Review {{ store.flashcards.length }} cards</button>
        <ul>
          <li v-for="card in store.flashcards" :key="card.id">
            <div class="pair">
              <span class="target">{{ card.target }}</span>
              <span class="en">{{ card.english }}</span>
            </div>
            <button class="del" title="Remove" @click="store.removeFlashcard(card.id)">✕</button>
          </li>
        </ul>
      </template>
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

/* Review */
.review {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.card {
  width: 100%;
  min-height: 130px;
  background: linear-gradient(160deg, var(--card-a), var(--card-b));
  border: 1px solid var(--border);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  padding: 16px;
}
.face {
  font-size: 24px;
  font-weight: 700;
}
.face.front {
  color: var(--accent-2);
}
.face.back {
  color: var(--text);
  font-size: 20px;
}
.card:not(.revealed) .back {
  display: none;
}
.flip-hint {
  color: var(--muted);
  font-size: 12px;
}
.grade {
  display: flex;
  gap: 10px;
  width: 100%;
}
.grade button {
  flex: 1;
  border: none;
  border-radius: 10px;
  padding: 10px;
  font-weight: 600;
  font-size: 15px;
}
.again {
  background: var(--danger-soft);
  color: var(--danger);
}
.known {
  background: var(--success-soft);
  color: var(--accent-2);
}
.progress {
  color: var(--muted);
  font-size: 13px;
}
</style>
