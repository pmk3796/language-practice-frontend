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

    <!-- Page language scope: only languages you've actually practised. Filters
         everything below (history now, flashcards later). -->
    <div v-if="store.practisedLanguages.length" class="scope">
      <button class="pill" :class="{ active: store.homeLanguage === 'all' }" @click="store.setHomeLanguage('all')">
        🌐 All languages
      </button>
      <button
        v-for="lang in store.practisedLanguages"
        :key="lang.code"
        class="pill"
        :class="{ active: store.homeLanguage === lang.code }"
        @click="store.setHomeLanguage(lang.code)"
      >
        {{ lang.flag }} {{ lang.name }}
      </button>
    </div>

    <section class="starter">
      <h2>Start a conversation</h2>
      <div class="pickers">
        <ProfileSelector />
        <!-- 'all' mode: pick any language. Scoped mode: language is fixed. -->
        <LanguageSelector v-if="store.homeLanguage === 'all'" />
        <div v-else-if="store.homeLanguageInfo" class="field locked">
          <label>Language</label>
          <span class="chip">{{ store.homeLanguageInfo.flag }} {{ store.homeLanguageInfo.name }}</span>
        </div>
      </div>
      <p v-if="store.draftProfileInfo && store.newSessionLanguageInfo" class="preview">
        {{ store.draftProfileInfo.emoji }} You'll talk with a
        <strong>{{ store.draftProfileInfo.name }}</strong> in
        <strong>{{ store.newSessionLanguageInfo.name }}</strong> — {{ store.draftProfileInfo.description }}.
      </p>
      <button class="start" :disabled="!store.languages.length" @click="store.startSession()">
        Start conversation →
      </button>
    </section>

    <!-- Flashcards: scoped to the selected language, or a per-language list. -->
    <section
      v-if="store.languagesWithDecks.length"
      class="flashcards"
    >
      <h3>Flashcards</h3>

      <!-- Specific language scope: that deck's summary + review. -->
      <template v-if="store.homeLanguageInfo">
        <div class="deck-row solo">
          <div class="deck-info">
            <span class="deck-count">{{ store.deckStats(store.homeLanguage).total }} cards</span>
            <span v-if="store.deckStats(store.homeLanguage).needsPractice" class="deck-need">
              🎯 {{ store.deckStats(store.homeLanguage).needsPractice }} need practice
            </span>
          </div>
          <button
            class="review-btn"
            :disabled="!store.deckStats(store.homeLanguage).total"
            @click="store.startReview(store.homeLanguage)"
          >
            Review →
          </button>
        </div>
      </template>

      <!-- All languages: a compact grid of deck cards (the whole card reviews). -->
      <template v-else>
        <div class="deck-grid">
          <button
            v-for="lang in store.languagesWithDecks"
            :key="lang.code"
            class="deck-card"
            @click="store.startReview(lang.code)"
          >
            <div class="deck-head">
              <span class="flag">{{ lang.flag }}</span>
              <span class="deck-name">{{ lang.name }}</span>
            </div>
            <div class="deck-stats">
              <span>{{ store.deckStats(lang.code).total }} cards</span>
              <span v-if="store.deckStats(lang.code).needsPractice" class="deck-need">
                🎯 {{ store.deckStats(lang.code).needsPractice }}
              </span>
            </div>
            <span class="review-cue">Review →</span>
          </button>
        </div>
      </template>
    </section>

    <section class="history">
      <h3>
        Saved conversations
        <span v-if="store.homeLanguageInfo" class="scoped">· {{ store.homeLanguageInfo.name }}</span>
      </h3>
      <p v-if="!store.filteredSessions.length" class="empty">
        <template v-if="store.homeLanguageInfo">
          No {{ store.homeLanguageInfo.name }} conversations yet. Start one above.
        </template>
        <template v-else>
          No conversations yet. Start one above — each is saved here so you can review it later.
        </template>
      </p>
      <ul v-else>
        <li v-for="s in store.filteredSessions" :key="s.id" class="row">
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
  gap: 24px;
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

.scope {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pill {
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 600;
}
.pill:hover {
  color: var(--text);
}
.pill.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.starter,
.history,
.flashcards {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 22px;
}

.flashcards h3 {
  margin: 0 0 14px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.deck-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}
.deck-card {
  text-align: left;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.08s ease;
}
.deck-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}
.deck-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.deck-head .flag {
  font-size: 22px;
}
.deck-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--muted);
}
.review-cue {
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
}
.deck-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
}
.deck-row.solo {
  background: transparent;
  border: none;
  padding: 0;
}
.deck-lang {
  display: flex;
  align-items: center;
  gap: 12px;
}
.deck-lang .flag {
  font-size: 22px;
}
.deck-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.deck-name {
  font-weight: 600;
  font-size: 15px;
}
.deck-sub,
.deck-count {
  color: var(--muted);
  font-size: 13px;
}
.deck-count {
  font-size: 15px;
  color: var(--text);
  font-weight: 600;
}
.deck-need {
  color: var(--warn);
}
.review-btn {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}
.review-btn:hover:not(:disabled) {
  filter: brightness(1.08);
}
.review-btn:disabled {
  opacity: 0.5;
  cursor: default;
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

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.locked .chip {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 15px;
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
.history h3 .scoped {
  color: var(--accent);
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
