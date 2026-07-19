<script setup lang="ts">
import { usePracticeStore } from '@/stores/practice'

const store = usePracticeStore()
</script>

<template>
  <div class="field">
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

select {
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 15px;
  outline: none;
  min-width: 150px;
}

select:disabled {
  opacity: 0.6;
}
</style>
