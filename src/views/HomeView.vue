<script setup lang="ts">
import { usePracticeStore } from '@/stores/practice'
import SpeedSelector from '@/components/SpeedSelector.vue'
import SettingsButton from '@/components/SettingsButton.vue'
import RecordButton from '@/components/RecordButton.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import TranslationsPanel from '@/components/TranslationsPanel.vue'
import CorrectionsPanel from '@/components/CorrectionsPanel.vue'
import FlashcardsPanel from '@/components/FlashcardsPanel.vue'
import SessionRecap from '@/components/SessionRecap.vue'

const store = usePracticeStore()
</script>

<template>
  <div class="app">
    <header class="topbar">
      <button class="back" @click="store.leaveSession()">← Sessions</button>

      <div class="chips">
        <span v-if="store.activeProfile" class="chip">
          {{ store.activeProfile.emoji }} {{ store.activeProfile.name }}
        </span>
        <span v-if="store.activeLanguage" class="chip">
          {{ store.activeLanguage.flag }} {{ store.activeLanguage.name }}
        </span>
        <span v-if="store.isArchived" class="chip archived">📁 Archived</span>
      </div>

      <div class="right">
        <SpeedSelector />
        <SettingsButton />
        <button v-if="!store.isArchived" class="end" @click="store.endSession()">End &amp; recap</button>
        <button v-else class="end ghosted" @click="store.viewRecap()">View recap</button>
      </div>
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

    <SessionRecap v-if="store.showRecap" />
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
  gap: 16px;
  flex-wrap: wrap;
}

.back {
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 14px;
}
.back:hover {
  border-color: var(--accent);
}

.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 14px;
  font-weight: 600;
}
.chip.archived {
  color: var(--muted);
}

.right {
  margin-left: auto;
  display: flex;
  align-items: flex-end;
  gap: 16px;
}

.end {
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 14px;
  font-weight: 600;
}
.end:hover {
  filter: brightness(1.08);
}
.end.ghosted {
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
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
