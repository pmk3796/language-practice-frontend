<script setup lang="ts">
import LanguageSelector from '@/components/LanguageSelector.vue'
import RecordButton from '@/components/RecordButton.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import TranslationsPanel from '@/components/TranslationsPanel.vue'
import CorrectionsPanel from '@/components/CorrectionsPanel.vue'
import FlashcardsPanel from '@/components/FlashcardsPanel.vue'
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <span class="logo">🗣️</span>
        <div>
          <h1>Language Practice</h1>
          <p>Speak, get corrected, build vocabulary.</p>
        </div>
      </div>
      <LanguageSelector />
    </header>

    <main class="grid">
      <div class="panel record-panel">
        <RecordButton />
      </div>
      <TranslationsPanel />
      <CorrectionsPanel />
      <ChatPanel />
      <FlashcardsPanel />
    </main>
  </div>
</template>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 18px;
  gap: 16px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo {
  font-size: 34px;
}

.brand h1 {
  margin: 0;
  font-size: 22px;
}

.brand p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: 1.1fr 1.6fr;
  grid-template-areas:
    'record translations corrections'
    'chat chat flashcards';
}

.record-panel {
  grid-area: record;
}

/* Panels share a look; :deep reaches the .panel roots inside child components. */
.grid :deep(.panel) {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.grid :deep(.panel-head) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.grid :deep(.panel-head h2) {
  margin: 0;
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.grid :deep(.ghost) {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
}

.grid :deep(.ghost:hover) {
  color: var(--text);
  border-color: var(--accent);
}

@media (max-width: 900px) {
  .app {
    height: auto;
  }
  .grid {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    grid-template-areas:
      'record'
      'chat'
      'translations'
      'corrections'
      'flashcards';
  }
  .grid :deep(.panel) {
    min-height: 260px;
  }
}
</style>
