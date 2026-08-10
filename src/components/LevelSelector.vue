<script setup lang="ts">
import { computed } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import SelectMenu, { type SelectOption } from '@/components/SelectMenu.vue'

/**
 * `compact` renders the six levels as a segmented control instead of a dropdown.
 * Used inside the Settings sheet, where a popover would extend past the sheet's
 * scrollable box and make the whole dialog scroll.
 */
const props = defineProps<{ compact?: boolean }>()

const store = usePracticeStore()

const options = computed<SelectOption[]>(() =>
  store.levels.map((l) => ({ value: l.id, label: `${l.code} · ${l.name}`, description: l.blurb })),
)
</script>

<template>
  <div v-if="props.compact" class="levels" role="group" aria-label="Your level">
    <button
      v-for="l in store.levels"
      :key="l.id"
      :class="{ on: store.level === l.id }"
      :title="`${l.name} — ${l.blurb}`"
      @click="store.setLevel(l.id)"
    >
      {{ l.code }}
    </button>
  </div>

  <SelectMenu
    v-else
    label="Your level"
    :model-value="store.level"
    :options="options"
    @update:model-value="store.setLevel"
  />
</template>

<style scoped>
.levels {
  display: inline-flex;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
}
.levels button {
  background: transparent;
  border: none;
  color: var(--muted);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 13px;
  font-weight: 600;
}
.levels button:hover {
  color: var(--text);
}
.levels button.on {
  background: var(--accent);
  color: var(--on-accent);
}
</style>
