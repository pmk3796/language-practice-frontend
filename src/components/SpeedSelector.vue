<script setup lang="ts">
import { usePracticeStore } from '@/stores/practice'

const store = usePracticeStore()
</script>

<template>
  <div class="speed">
    <label>Voice speed</label>
    <div class="seg" role="group" aria-label="Voice speed">
      <button
        type="button"
        :class="{ active: store.speed === 'slow' }"
        :disabled="store.status === 'processing'"
        @click="store.setSpeed('slow')"
      >
        🐢 Slow
      </button>
      <button
        type="button"
        :class="{ active: store.speed === 'normal' }"
        :disabled="store.status === 'processing'"
        @click="store.setSpeed('normal')"
      >
        ⚡ Normal
      </button>
    </div>
  </div>
</template>

<style scoped>
.speed {
  display: flex;
  align-items: center;
  gap: 10px;
}

label {
  color: var(--muted);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.seg {
  display: inline-flex;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 3px;
  gap: 3px;
}

.seg button {
  background: transparent;
  border: none;
  color: var(--muted);
  border-radius: 7px;
  padding: 6px 12px;
  font-size: 14px;
}

.seg button.active {
  background: var(--accent);
  color: white;
}

.seg button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
