<script setup lang="ts">
import { usePracticeStore } from '@/stores/practice'
import type { ThemeChoice } from '@/stores/practice'

const store = usePracticeStore()

const THEMES: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'auto', label: 'Auto', icon: '🖥️' },
]
</script>

<template>
  <div class="overlay" @click.self="store.closeSettings()">
    <div class="sheet" role="dialog" aria-label="Settings">
      <header>
        <h2>Settings</h2>
        <button class="x" title="Close" @click="store.closeSettings()">✕</button>
      </header>

      <section class="group">
        <h3>Appearance</h3>
        <div class="row">
          <div class="row-label">
            <div class="name">Theme</div>
            <div class="hint cap">
              {{ store.theme === 'auto' ? 'Following your system setting' : 'Always ' + store.theme }}
            </div>
          </div>
          <div class="segmented">
            <button
              v-for="t in THEMES"
              :key="t.value"
              :class="{ on: store.theme === t.value }"
              @click="store.setTheme(t.value)"
            >
              <span class="ic">{{ t.icon }}</span>{{ t.label }}
            </button>
          </div>
        </div>
      </section>

      <section class="group">
        <h3>Voice</h3>
        <div class="row">
          <div class="row-label">
            <div class="name">Speaking speed</div>
            <div class="hint">How fast your practice partner talks</div>
          </div>
          <div class="segmented">
            <button :class="{ on: store.speed === 'slow' }" @click="store.setSpeed('slow')">
              <span class="ic">🐢</span>Slow
            </button>
            <button :class="{ on: store.speed === 'normal' }" @click="store.setSpeed('normal')">
              <span class="ic">⚡</span>Normal
            </button>
          </div>
        </div>
      </section>

      <footer>
        <span class="privacy">🔒 Everything is stored on this device.</span>
        <button class="done" @click="store.closeSettings()">Done</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 60;
}

.sheet {
  width: 100%;
  max-width: 520px;
  max-height: 88vh;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  padding: 20px 22px 16px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
header h2 {
  margin: 0;
  font-size: 19px;
}
.x {
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 16px;
  border-radius: 8px;
  padding: 4px 8px;
}
.x:hover {
  color: var(--text);
  background: var(--tint);
}

.group {
  padding: 14px 0;
  border-top: 1px solid var(--border);
}
.group h3 {
  margin: 0 0 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.name {
  font-size: 15px;
  font-weight: 600;
}
.hint {
  color: var(--muted);
  font-size: 12.5px;
  margin-top: 2px;
}
.hint.cap {
  text-transform: capitalize;
}

.segmented {
  display: inline-flex;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 3px;
  gap: 3px;
}
.segmented button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--muted);
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 14px;
}
.segmented button:hover {
  color: var(--text);
}
.segmented button.on {
  background: var(--accent);
  color: var(--on-accent);
}
.ic {
  font-size: 13px;
}

footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.privacy {
  color: var(--muted);
  font-size: 12px;
}
.done {
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 10px;
  padding: 9px 18px;
  font-size: 14px;
  font-weight: 600;
}
.done:hover {
  filter: brightness(1.08);
}
</style>
