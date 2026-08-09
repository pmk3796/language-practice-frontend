<script setup lang="ts">
import { onMounted } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import StartView from '@/views/StartView.vue'
import HomeView from '@/views/HomeView.vue'
import ReviewView from '@/views/ReviewView.vue'
import SettingsModal from '@/components/SettingsModal.vue'

const store = usePracticeStore()

onMounted(() => {
  // Non-fatal: the selectors just won't populate if the backend is down.
  store.loadLanguages().catch(() => {})
  store.loadProfiles().catch(() => {})
})
</script>

<template>
  <ReviewView v-if="store.reviewLanguage" />
  <HomeView v-else-if="store.activeSession" />
  <StartView v-else />

  <!-- Global so it's reachable from every view. -->
  <SettingsModal v-if="store.showSettings" />
</template>
