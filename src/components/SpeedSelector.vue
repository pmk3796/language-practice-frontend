<script setup lang="ts">
import { usePracticeStore } from '@/stores/practice'

const store = usePracticeStore()
</script>

<template>
  <div class="field">
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
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
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
  padding: 7px 14px;
  font-size: 14px;
}

.seg button.active {
  background: var(--accent);
  color: var(--on-accent);
}

.seg button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
