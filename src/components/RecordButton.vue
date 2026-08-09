<script setup lang="ts">
import { computed } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import { useRecorder } from '@/composables/useRecorder'

const store = usePracticeStore()
const { isRecording, isSupported, start, stop } = useRecorder()

const busy = computed(() => store.status === 'processing')

async function toggle() {
  if (busy.value) return

  if (isRecording.value) {
    const { blob, filename } = await stop()
    await store.submitRecording(blob, filename)
  } else {
    try {
      await start()
    } catch {
      store.errorMessage = 'Microphone access was denied.'
      store.errorCode = 'mic'
      store.status = 'error'
    }
  }
}

const isBillingError = computed(() => store.errorCode === 'insufficient_quota')
const isKeyError = computed(() => store.errorCode === 'invalid_api_key')

const label = computed(() => {
  if (busy.value) return 'Thinking…'
  if (isRecording.value) return 'Stop'
  return 'Speak'
})
</script>

<template>
  <!-- Archived sessions are read-only: no mic, just a note. -->
  <div v-if="store.isArchived" class="recorder archived">
    <div class="archived-badge">📁 Archived</div>
    <p class="hint">This conversation is finished and read-only. You can still review it and its recap.</p>
    <button class="review-recap" @click="store.viewRecap()">View recap</button>
  </div>

  <div v-else class="recorder">
    <div v-if="store.activeProfile" class="scenario-block">
      <div class="scenario">
        <span class="scenario-emoji">{{ store.activeProfile.emoji }}</span>
        {{ store.activeProfile.name }}
      </div>
      <p class="scenario-desc">{{ store.activeProfile.description }}</p>
    </div>
    <button
      class="mic"
      :class="{ recording: isRecording, busy }"
      :disabled="!isSupported || busy"
      @click="toggle"
    >
      <span v-if="busy" class="spinner" />
      <span v-else class="icon">{{ isRecording ? '■' : '🎙' }}</span>
    </button>
    <div class="label">{{ label }}</div>
    <p v-if="!isSupported" class="hint danger">Recording isn't supported in this browser.</p>

    <div v-else-if="store.status === 'error'" class="error-box" :class="{ billing: isBillingError }">
      <div class="error-head">
        <span class="badge">{{ isBillingError ? '💳 Billing' : isKeyError ? '🔑 API key' : '⚠️ Error' }}</span>
      </div>
      <p class="error-msg">{{ store.errorMessage }}</p>
      <a
        v-if="isBillingError"
        class="bill-link"
        href="https://platform.openai.com/account/billing/overview"
        target="_blank"
        rel="noopener"
      >
        Open OpenAI billing →
      </a>
      <p class="retry-hint">Tap the mic to try again once it's sorted.</p>
    </div>

    <p v-else class="hint">
      Tap, say something in
      <strong>{{ store.activeLanguage?.name || 'your language' }}</strong>, tap again.
    </p>
  </div>
</template>

<style scoped>
.recorder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  justify-content: center;
  height: 100%;
}

.scenario-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.scenario {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 14px;
  font-weight: 600;
}

.scenario-emoji {
  font-size: 16px;
}

.scenario-desc {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}

.archived-badge {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 14px;
  font-weight: 600;
}

.review-recap {
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 14px;
  font-weight: 600;
}

.mic {
  width: 108px;
  height: 108px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(145deg, var(--accent-grad-a), var(--accent-grad-b));
  color: var(--on-accent);
  font-size: 40px;
  box-shadow: 0 10px 30px var(--accent-glow);
  transition: transform 0.12s ease, box-shadow 0.2s ease;
  display: grid;
  place-items: center;
}

.mic:hover:not(:disabled) {
  transform: translateY(-2px);
}

.mic:disabled {
  cursor: default;
  opacity: 0.85;
}

.mic.recording {
  background: linear-gradient(145deg, #ff5d6c, #ff3b52);
  box-shadow: 0 0 0 0 rgba(255, 93, 108, 0.7);
  animation: pulse 1.4s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 93, 108, 0.5);
  }
  70% {
    box-shadow: 0 0 0 22px rgba(255, 93, 108, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 93, 108, 0);
  }
}

.spinner {
  width: 34px;
  height: 34px;
  border: 4px solid rgba(255, 255, 255, 0.35);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.label {
  font-size: 18px;
  font-weight: 600;
}

.hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  max-width: 220px;
}

.hint.danger {
  color: var(--danger);
}

.error-box {
  max-width: 260px;
  text-align: center;
  background: var(--danger-soft);
  border: 1px solid var(--danger);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.error-box.billing {
  background: var(--warn-soft);
  border-color: var(--warn);
}

.badge {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.error-msg {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text);
}

.bill-link {
  display: inline-block;
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 700;
  font-size: 13px;
  text-decoration: none;
  padding: 7px 12px;
  border-radius: 9px;
}

.bill-link:hover {
  filter: brightness(1.05);
}

.retry-hint {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}
</style>
