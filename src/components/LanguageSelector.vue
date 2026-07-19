<script setup lang="ts">
import { usePracticeStore } from '@/stores/practice'

const store = usePracticeStore()
</script>

<template>
  <div class="selector">
    <label for="lang">Practising</label>
    <select
      id="lang"
      :value="store.language"
      :disabled="store.status === 'processing'"
      @change="store.setLanguage(($event.target as HTMLSelectElement).value)"
    >
      <option v-for="lang in store.languages" :key="lang.code" :value="lang.code">
        {{ lang.flag }} {{ lang.name }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.selector {
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

select {
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 15px;
  outline: none;
}

select:disabled {
  opacity: 0.6;
}
</style>
