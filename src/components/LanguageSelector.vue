<script setup lang="ts">
import { computed } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import SelectMenu, { type SelectOption } from '@/components/SelectMenu.vue'

const store = usePracticeStore()

const options = computed<SelectOption[]>(() =>
  store.languages.map((l) => ({ value: l.code, label: l.name, emoji: l.flag })),
)
</script>

<template>
  <SelectMenu
    label="Practising"
    :model-value="store.draftLanguage"
    :options="options"
    @update:model-value="store.setDraftLanguage"
  />
</template>
