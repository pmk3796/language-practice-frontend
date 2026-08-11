<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import { fetchSpeech, transcribeAudio } from '@/api/client'
import { useRecorder } from '@/composables/useRecorder'
import { checkSpoken } from '@/lib/spoken'
import { playAudio } from '@/lib/audio'
import type { Flashcard } from '@/types'

const store = usePracticeStore()

const langInfo = computed(() => store.languageInfo(store.reviewLanguage || ''))

// --- Filters ---------------------------------------------------------------
const needsPracticeOnly = ref(false)
const selectedTopics = ref<string[]>([])
const selectedPos = ref<string[]>([])
const sortBy = ref<'struggling' | 'recent' | 'stale'>('struggling')

const availableTopics = computed(() =>
  [...new Set(store.reviewDeck.map((c) => c.topic).filter(Boolean) as string[])].sort(),
)
const availablePos = computed(
  () => [...new Set(store.reviewDeck.map((c) => c.partOfSpeech).filter(Boolean) as string[])],
)

function toggle(list: string[], value: string) {
  const i = list.indexOf(value)
  if (i >= 0) list.splice(i, 1)
  else list.push(value)
}

const filtered = computed<Flashcard[]>(() => {
  let cards = [...store.reviewDeck]
  if (needsPracticeOnly.value) cards = cards.filter(store.needsPractice)
  if (selectedTopics.value.length)
    cards = cards.filter((c) => c.topic && selectedTopics.value.includes(c.topic))
  if (selectedPos.value.length)
    cards = cards.filter((c) => c.partOfSpeech && selectedPos.value.includes(c.partOfSpeech))

  if (sortBy.value === 'recent') cards.sort((a, b) => b.createdAt - a.createdAt)
  else if (sortBy.value === 'stale')
    cards.sort((a, b) => (a.lastReviewedAt ?? 0) - (b.lastReviewedAt ?? 0))
  else cards.sort((a, b) => (a.box ?? 1) - (b.box ?? 1)) // struggling first
  return cards
})

const anyFilter = computed(
  () => needsPracticeOnly.value || selectedTopics.value.length > 0 || selectedPos.value.length > 0,
)
function clearFilters() {
  needsPracticeOnly.value = false
  selectedTopics.value = []
  selectedPos.value = []
}

// --- Run state -------------------------------------------------------------
type Phase = 'setup' | 'running' | 'done'
const phase = ref<Phase>('setup')
const queue = ref<Flashcard[]>([])
// Which side each queued card leads with. Fixed when the run starts so a card
// can't flip direction under you mid-review (matters for 'mixed').
const leadsWithTarget = ref<boolean[]>([])
const index = ref(0)
const revealed = ref(false)
const gotIt = ref(0)
const missed = ref(0)

const current = computed(() => queue.value[index.value])
const showTarget = computed(() => leadsWithTarget.value[index.value] ?? true)
const frontText = computed(() =>
  showTarget.value ? current.value?.target : current.value?.english,
)
const backText = computed(() =>
  showTarget.value ? current.value?.english : current.value?.target,
)

function start() {
  if (!filtered.value.length) return
  queue.value = filtered.value.slice()
  const dir = store.reviewDirection
  leadsWithTarget.value = queue.value.map(() =>
    dir === 'mixed' ? Math.random() < 0.5 : dir === 'target',
  )
  index.value = 0
  revealed.value = false
  spoken.value = null
  gotIt.value = 0
  missed.value = 0
  phase.value = 'running'
}

function grade(known: boolean) {
  const card = current.value
  const code = store.reviewLanguage
  if (!card || !code) return
  store.gradeCard(code, card.id, known)
  known ? gotIt.value++ : missed.value++
  revealed.value = false
  spoken.value = null
  if (index.value + 1 >= queue.value.length) phase.value = 'done'
  else index.value++
}

// --- Speaking the answer ---------------------------------------------------
/**
 * Only offered when the card is asking for the target language. Saying an
 * English word you already know proves nothing, so there's no mic in that
 * direction.
 */
const canSpeakAnswer = computed(() => !showTarget.value)
const { isRecording, isSupported: micSupported, start: startRec, stop: stopRec } = useRecorder()
const checking = ref(false)
const spoken = ref<{ heard: string; correct: boolean } | null>(null)

async function toggleSpeak() {
  const code = store.reviewLanguage
  if (!code || checking.value) return
  if (!isRecording.value) {
    spoken.value = null
    try {
      await startRec()
    } catch {
      /* mic denied — the reveal path still works */
    }
    return
  }
  const { blob, filename } = await stopRec()
  checking.value = true
  try {
    const heard = await transcribeAudio(blob, filename, code)
    const result = checkSpoken(heard, current.value?.target ?? '')
    spoken.value = result
    revealed.value = true
    // Getting it right is the reward moment — bank it and move on.
    if (result.correct) setTimeout(() => grade(true), 1100)
  } catch {
    spoken.value = { heard: '', correct: false }
    revealed.value = true
  } finally {
    checking.value = false
  }
}

// --- Audio -----------------------------------------------------------------
const speaking = ref(false)
async function speak(text: string) {
  const code = store.reviewLanguage
  if (!code || speaking.value) return
  speaking.value = true
  try {
    playAudio(await fetchSpeech(text, code, store.speed))
  } catch {
    /* ignore */
  } finally {
    speaking.value = false
  }
}
</script>

<template>
  <div class="review">
    <header class="topbar">
      <button class="back" @click="store.exitReview()">← Home</button>
      <div class="title">
        <span class="flag">{{ langInfo?.flag }}</span>
        {{ langInfo?.name }} flashcards
        <span class="count">{{ store.reviewDeck.length }} cards</span>
      </div>
      <div class="tagging" v-if="store.tagging">Categorising…</div>
    </header>

    <!-- SETUP: configure the run -->
    <section v-if="phase === 'setup'" class="setup">
      <div class="setup-card">
        <!-- Which side leads: recognition (target first) vs production (English first). -->
        <div class="field">
          <span class="flabel">Show first</span>
          <div class="segmented">
            <button
              :class="{ on: store.reviewDirection === 'target' }"
              @click="store.setReviewDirection('target')"
            >
              {{ langInfo?.name || 'Target' }}
            </button>
            <button
              :class="{ on: store.reviewDirection === 'english' }"
              @click="store.setReviewDirection('english')"
            >
              English
            </button>
            <button
              :class="{ on: store.reviewDirection === 'mixed' }"
              @click="store.setReviewDirection('mixed')"
            >
              Mixed
            </button>
          </div>
        </div>

        <div class="divider" />

        <!-- Sort: single choice (connected segments). -->
        <div class="field">
          <span class="flabel">Sort by</span>
          <div class="segmented">
            <button :class="{ on: sortBy === 'struggling' }" @click="sortBy = 'struggling'">Struggling first</button>
            <button :class="{ on: sortBy === 'recent' }" @click="sortBy = 'recent'">Recently added</button>
            <button :class="{ on: sortBy === 'stale' }" @click="sortBy = 'stale'">Not reviewed lately</button>
          </div>
        </div>

        <div class="divider" />

        <!-- Filters: optional multi-select toggles. -->
        <div class="filters-head">
          <span class="flabel">Filters</span>
          <span class="optional">optional</span>
          <button v-if="anyFilter" class="clear" @click="clearFilters">Clear</button>
        </div>

        <div class="field">
          <span class="flabel sub">Focus</span>
          <div class="chips">
            <button class="chip" :class="{ on: needsPracticeOnly }" @click="needsPracticeOnly = !needsPracticeOnly">
              🎯 Needs practice
            </button>
          </div>
        </div>

        <div class="field" v-if="availableTopics.length">
          <span class="flabel sub">Category</span>
          <div class="chips">
            <button
              v-for="t in availableTopics"
              :key="t"
              class="chip"
              :class="{ on: selectedTopics.includes(t) }"
              @click="toggle(selectedTopics, t)"
            >
              {{ t }}
            </button>
          </div>
        </div>

        <div class="field" v-if="availablePos.length">
          <span class="flabel sub">Part of speech</span>
          <div class="chips">
            <button
              v-for="p in availablePos"
              :key="p"
              class="chip"
              :class="{ on: selectedPos.includes(p) }"
              @click="toggle(selectedPos, p)"
            >
              {{ p }}
            </button>
          </div>
        </div>

        <p v-if="store.tagging && !availableTopics.length" class="hint">
          Categories will appear once the AI finishes tagging your cards…
        </p>

        <div class="setup-footer">
          <span class="match">
            Reviewing <strong>{{ filtered.length }}</strong> of {{ store.reviewDeck.length }}
          </span>
          <button class="start" :disabled="!filtered.length" @click="start">
            Review {{ filtered.length }} card{{ filtered.length === 1 ? '' : 's' }} →
          </button>
        </div>
      </div>
    </section>

    <!-- RUNNING: one card at a time -->
    <section v-else-if="phase === 'running' && current" class="runner">
      <div class="progress">{{ index + 1 }} / {{ queue.length }}</div>

      <div class="card" :class="{ revealed }" @click="revealed = !revealed">
        <button
          v-if="showTarget || revealed"
          class="say"
          title="Pronounce"
          :disabled="speaking"
          @click.stop="speak(current.target)"
        >
          <span v-if="speaking" class="spinner" />
          <span v-else>🔊</span>
        </button>
        <div class="front" :class="{ english: !showTarget }">{{ frontText }}</div>
        <div v-if="revealed" class="answer">
          <div class="en" :class="{ target: !showTarget }">{{ backText }}</div>
          <div v-if="spoken" class="spoken-result" :class="{ good: spoken.correct }">
            <template v-if="spoken.correct">✓ You said “{{ spoken.heard }}”</template>
            <template v-else-if="spoken.heard">You said “{{ spoken.heard }}”</template>
            <template v-else>Didn't catch that</template>
          </div>
          <div class="meta">
            <span v-if="current.topic" class="tag">{{ current.topic }}</span>
            <span v-if="current.partOfSpeech" class="tag pos">{{ current.partOfSpeech }}</span>
          </div>
        </div>
        <div v-else class="flip-hint">
          tap to reveal<template v-if="canSpeakAnswer && micSupported"> · or say it below</template>
        </div>
      </div>

      <button
        v-if="canSpeakAnswer && micSupported && !spoken"
        class="say-answer"
        :class="{ recording: isRecording }"
        :disabled="checking"
        @click="toggleSpeak"
      >
        <span v-if="checking" class="spinner" />
        <template v-else-if="isRecording">■ Stop &amp; check</template>
        <template v-else>🎤 Say it in {{ langInfo?.name || 'the language' }}</template>
      </button>

      <div v-if="revealed" class="grade">
        <button class="missed" @click="grade(false)">Missed</button>
        <button class="known" @click="grade(true)">Got it</button>
      </div>
      <div v-else class="grade-placeholder" />
    </section>

    <!-- DONE: summary -->
    <section v-else-if="phase === 'done'" class="done">
      <div class="done-emoji">🎉</div>
      <h2>Nice work!</h2>
      <p>You reviewed {{ queue.length }} card{{ queue.length === 1 ? '' : 's' }} — {{ gotIt }} got it, {{ missed }} to practise again.</p>
      <div class="done-actions">
        <button class="secondary" @click="phase = 'setup'">Change filters</button>
        <button class="start" @click="store.exitReview()">Done</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.review {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 18px;
  gap: 18px;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 16px;
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
.title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
}
.flag {
  font-size: 20px;
}
.count {
  color: var(--muted);
  font-size: 13px;
  font-weight: 400;
}
.tagging {
  margin-left: auto;
  color: var(--muted);
  font-size: 13px;
}

/* Setup */
.setup {
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow-y: auto;
}
.setup-card {
  width: 100%;
  max-width: 640px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Each control is a row: fixed-width label on the left, control on the right. */
.field {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.flabel {
  width: 96px;
  flex-shrink: 0;
  padding-top: 8px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.09em;
}
.flabel.sub {
  text-transform: none;
  letter-spacing: normal;
  font-size: 13px;
  font-weight: 500;
}

.divider {
  height: 1px;
  background: var(--border);
  margin: 2px 0;
}

.filters-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filters-head .flabel {
  width: auto;
  padding-top: 0;
}
.optional {
  color: var(--muted);
  font-size: 11px;
  font-style: italic;
  opacity: 0.8;
}
.clear {
  margin-left: auto;
  background: transparent;
  border: none;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}
.clear:hover {
  text-decoration: underline;
}

/* Single-choice: connected segments so it reads as "pick one". */
.segmented {
  display: inline-flex;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 3px;
  gap: 3px;
  flex-wrap: wrap;
}
.segmented button {
  background: transparent;
  border: none;
  color: var(--muted);
  border-radius: 8px;
  padding: 7px 13px;
  font-size: 14px;
}
.segmented button:hover {
  color: var(--text);
}
.segmented button.on {
  background: var(--accent);
  color: var(--on-accent);
}

/* Optional filters: outline pills that fill when selected. */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: 999px;
  padding: 7px 13px;
  font-size: 14px;
}
.chip:hover {
  color: var(--text);
  border-color: var(--accent);
}
.chip.on {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}
.hint {
  color: var(--muted);
  font-size: 13px;
  margin: 0;
}

.setup-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}
.match {
  color: var(--muted);
  font-size: 14px;
}
.match strong {
  color: var(--text);
}

.start {
  background: linear-gradient(145deg, var(--accent-grad-a), var(--accent-grad-b));
  color: var(--on-accent);
  border: none;
  border-radius: 12px;
  padding: 13px 22px;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 8px 24px var(--accent-glow);
}
.start:disabled {
  opacity: 0.5;
  box-shadow: none;
  cursor: default;
}

/* Runner */
.runner {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
}
.progress {
  color: var(--muted);
  font-size: 14px;
}
.card {
  position: relative;
  width: min(560px, 92vw);
  min-height: 240px;
  background: linear-gradient(160deg, var(--card-a), var(--card-b));
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  cursor: pointer;
  padding: 30px;
  /* It's a flip control, not selectable prose — clicking to flip was selecting
     the text and showing a highlighted box. */
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.say {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--tint);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.say:hover:not(:disabled) {
  background: var(--tint-strong);
}
.front {
  font-size: 34px;
  font-weight: 700;
  color: var(--accent-2);
  text-align: center;
  transition: font-size 0.18s ease, color 0.18s ease;
}
/* Once revealed, the prompt steps back so the answer — the thing being
   learned — is the largest thing on the card. */
.card.revealed .front {
  font-size: 19px;
  font-weight: 600;
  color: var(--muted);
}
.card.revealed .front.english {
  color: var(--muted);
}
/* The target language stays green wherever it sits; English is plain text. */
.front.english {
  color: var(--text);
}
.en.target {
  color: var(--accent-2);
  font-weight: 700;
}
.answer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.en {
  font-size: 34px;
  font-weight: 700;
  line-height: 1.25;
  text-align: center;
}
.meta {
  display: flex;
  gap: 8px;
}
.tag {
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
}
.tag.pos {
  background: var(--success-soft);
  color: var(--accent-2);
}
.flip-hint {
  color: var(--muted);
  font-size: 13px;
}
.say-answer {
  width: min(560px, 92vw);
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 12px;
  padding: 13px;
  font-size: 15px;
  font-weight: 600;
}
.say-answer:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.say-answer.recording {
  background: var(--danger-soft);
  border-color: var(--danger);
  color: var(--danger);
}
.say-answer:disabled {
  cursor: default;
}
.spoken-result {
  font-size: 14px;
  color: var(--danger);
}
.spoken-result.good {
  color: var(--accent-2);
  font-weight: 600;
}

.grade {
  display: flex;
  gap: 12px;
  width: min(560px, 92vw);
}
.grade button {
  flex: 1;
  border: none;
  border-radius: 12px;
  padding: 14px;
  font-weight: 700;
  font-size: 16px;
}
.missed {
  background: var(--danger-soft);
  color: var(--danger);
}
.known {
  background: var(--success-soft);
  color: var(--accent-2);
}
.grade-placeholder {
  height: 52px;
}
.spinner {
  width: 15px;
  height: 15px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Done */
.done {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}
.done-emoji {
  font-size: 48px;
}
.done h2 {
  margin: 0;
}
.done p {
  color: var(--muted);
  margin: 0 0 12px;
}
.done-actions {
  display: flex;
  gap: 12px;
}
.secondary {
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 12px;
  padding: 13px 20px;
  font-size: 15px;
}
.secondary:hover {
  border-color: var(--accent);
}
</style>
