<script setup lang="ts">
import { onMounted } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import StartView from '@/views/StartView.vue'
import HomeView from '@/views/HomeView.vue'

const store = usePracticeStore()

onMounted(() => {
  // Non-fatal: the selectors just won't populate if the backend is down.
  store.loadLanguages().catch(() => {})
  store.loadProfiles().catch(() => {})
})
</script>

<template>
  <HomeView v-if="store.activeSession" />
  <StartView v-else />
</template>
