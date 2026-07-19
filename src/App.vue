<script setup lang="ts">
import { onMounted } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import HomeView from '@/views/HomeView.vue'

const store = usePracticeStore()

onMounted(() => {
  store.loadLanguages().catch(() => {
    // Non-fatal: the selector just won't populate if the backend is down.
  })
})
</script>

<template>
  <HomeView />
</template>
