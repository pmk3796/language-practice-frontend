<script setup lang="ts">
import { computed } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import SelectMenu, { type SelectOption } from '@/components/SelectMenu.vue'

const store = usePracticeStore()

const options = computed<SelectOption[]>(() =>
  store.profiles.map((p) => ({
    value: p.id,
    label: p.name,
    emoji: p.emoji,
    description: p.description,
  })),
)
</script>

<template>
  <SelectMenu
    label="Scenario"
    :model-value="store.draftProfile"
    :options="options"
    @update:model-value="store.setDraftProfile"
  />
</template>
