<script setup lang="ts">
import { usePracticeStore } from '@/stores/practice'

const store = usePracticeStore()
</script>

<template>
  <button class="gear" title="Settings" aria-label="Settings" @click="store.openSettings()">
    <!-- Inline SVG rather than the ⚙︎ glyph, which renders tiny and inconsistently. -->
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  </button>
</template>

<style scoped>
.gear {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: 11px;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.gear svg {
  width: 20px;
  height: 20px;
  /* Spin the icon, not the button — rotating the button turns its rounded
     square into a diamond. */
  transition: transform 0.3s ease;
}
.gear:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.gear:hover svg {
  transform: rotate(60deg);
}
</style>
