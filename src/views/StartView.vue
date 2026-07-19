<script setup lang="ts">
import { usePracticeStore } from '@/stores/practice'
import LanguageSelector from '@/components/LanguageSelector.vue'
import ProfileSelector from '@/components/ProfileSelector.vue'
import type { Session } from '@/types'

const store = usePracticeStore()

function turnCount(s: Session): number {
  return s.messages.filter((m) => m.role === 'user').length
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="lobby">
    <header class="brand">
      <span class="logo">🗣️</span>
      <div>
        <h1>Language Practice</h1>
        <p>Low-pressure speaking practice — pick who you want to talk to.</p>
      </div>
    </header>

    <section class="starter">
      <h2>Start a conversation</h2>
      <div class="pickers">
        <ProfileSelector />
        <LanguageSelector />
      </div>
      <p v-if="store.draftProfileInfo && store.draftLanguageInfo" class="preview">
        {{ store.draftProfileInfo.emoji }} You'll talk with a
        <strong>{{ store.draftProfileInfo.name }}</strong> in
        <strong>{{ store.draftLanguageInfo.name }}</strong> — {{ store.draftProfileInfo.description }}.
      </p>
      <button class="start" :disabled="!store.languages.length" @click="store.startSession()">
        Start conversation →
      </button>
    </section>

    <section class="history">
      <h3>Saved conversations</h3>
      <p v-if="!store.sortedSessions.length" class="empty">
        No conversations yet. Start one above — each is saved here so you can review it later.
      </p>
      <ul v-else>
        <li v-for="s in store.sortedSessions" :key="s.id" class="row">
          <button class="open" @click="store.openSession(s.id)">
            <span class="emoji">{{ store.profileInfo(s.profile)?.emoji || '💬' }}</span>
            <span class="main">
              <span class="title">
                {{ store.profileInfo(s.profile)?.name || 'Conversation' }} ·
                {{ store.languageInfo(s.language)?.flag }}
                {{ store.languageInfo(s.language)?.name || s.language }}
              </span>
              <span class="sub">
                {{ formatDate(s.createdAt) }} · {{ turnCount(s) }} turns
                <span v-if="s.endedAt" class="tag done">✓ recap</span>
                <span v-else class="tag active">active</span>
              </span>
            </span>
          </button>
          <button class="del" title="Delete" @click="store.deleteSession(s.id)">✕</button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.lobby {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 20px 60px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}
.logo {
  font-size: 38px;
}
.brand h1 {
  margin: 0;
  font-size: 24px;
}
.brand p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.starter,
.history {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 22px;
}

.starter h2 {
  margin: 0 0 16px;
  font-size: 18px;
}

.pickers {
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.preview {
  margin: 16px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}

.preview strong {
  color: var(--text);
}

.start {
  margin-top: 18px;
  background: linear-gradient(145deg, var(--accent), #4a6bff);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 13px 22px;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 8px 24px rgba(76, 108, 255, 0.35);
}

.start:disabled {
  opacity: 0.5;
  cursor: default;
  box-shadow: none;
}

.history h3 {
  margin: 0 0 14px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.empty {
  color: var(--muted);
  font-size: 14px;
  margin: 0;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.open {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  color: var(--text);
}

.open:hover {
  border-color: var(--accent);
}

.emoji {
  font-size: 22px;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.title {
  font-weight: 600;
  font-size: 15px;
}

.sub {
  color: var(--muted);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag {
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 600;
}
.tag.done {
  background: rgba(74, 214, 160, 0.18);
  color: var(--accent-2);
}
.tag.active {
  background: rgba(108, 140, 255, 0.2);
  color: var(--accent);
}

.del {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--muted);
  padding: 0 14px;
  font-size: 14px;
}
.del:hover {
  color: var(--danger);
  border-color: var(--danger);
}
</style>
