<script setup lang="ts">
import { usePracticeStore } from '@/stores/practice'

const store = usePracticeStore()
</script>

<template>
  <section class="panel">
    <header class="panel-head">
      <h2>Corrections</h2>
    </header>
    <div class="body">
      <p v-if="!store.corrections.length" class="empty">
        Grammar fixes for what you say will appear here. Mistakes are how you learn 💪
      </p>
      <ul v-else>
        <li v-for="c in store.corrections" :key="c.id">
          <div class="sentence">{{ c.correctedSentence }}</div>
          <div v-if="c.explanation" class="why">{{ c.explanation }}</div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.panel {
  grid-area: corrections;
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
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-left: 3px solid var(--warn);
  border-radius: 10px;
  padding: 8px 12px;
}
.sentence {
  font-weight: 600;
  font-size: 15px;
}
.why {
  color: var(--muted);
  font-size: 13px;
  margin-top: 4px;
}
</style>
