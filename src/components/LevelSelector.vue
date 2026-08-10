<script setup lang="ts">
import { computed } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import SelectMenu, { type SelectOption } from '@/components/SelectMenu.vue'

const store = usePracticeStore()

const options = computed<SelectOption[]>(() =>
  store.levels.map((l) => ({ value: l.id, label: `${l.code} · ${l.name}`, description: l.blurb })),
)
</script>

<template>
  <SelectMenu
    label="Your level"
    :model-value="store.level"
    :options="options"
    @update:model-value="store.setLevel"
  />
</template>
