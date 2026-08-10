<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import { PALETTES, type ThemeChoice } from '@/stores/practice'
import LevelSelector from '@/components/LevelSelector.vue'

const store = usePracticeStore()

// Key management only exists in the desktop app (the browser build has no
// bridge, and its key lives in the backend's .env).
const desktop = (window as any).desktopAPI
const maskedKey = ref('')
const editingKey = ref(false)
const keyInput = ref('')
const keyBusy = ref(false)
const keyStatus = ref('')
const keyStatusKind = ref<'err' | 'ok' | 'busy' | ''>('')

/**
 * The values as they were when this dialog opened. Clicking through options to
 * compare them otherwise loses your starting point, so each row offers a way
 * back to where it was.
 */
const opened = ref({ theme: store.theme, palette: store.palette, speed: store.speed, level: store.level })
onMounted(() => {
  opened.value = { theme: store.theme, palette: store.palette, speed: store.speed, level: store.level }
})

const levelCode = (id: string) => store.levels.find((l) => l.id === id)?.code ?? id
const paletteName = (id: string) => PALETTES.find((p) => p.id === id)?.name ?? id
const themeName = (t: string) => (t === 'auto' ? 'Auto' : t === 'dark' ? 'Dark' : 'Light')

onMounted(async () => {
  if (!desktop) return
  try {
    maskedKey.value = (await desktop.getKeyInfo())?.masked || ''
  } catch {
    /* ignore */
  }
})

function startEditingKey() {
  editingKey.value = true
  keyInput.value = ''
  keyStatus.value = ''
  keyStatusKind.value = ''
}

function cancelEditingKey() {
  editingKey.value = false
  keyStatus.value = ''
  keyStatusKind.value = ''
}

async function saveKey() {
  const key = keyInput.value.trim()
  if (!key) {
    keyStatus.value = 'Paste your new key first.'
    keyStatusKind.value = 'err'
    return
  }
  keyBusy.value = true
  keyStatus.value = 'Checking your key…'
  keyStatusKind.value = 'busy'
  try {
    const check = await desktop.validateKey(key)
    if (!check.ok) {
      keyStatus.value = check.message
      keyStatusKind.value = 'err'
      return
    }
    const saved = await desktop.updateKey(key)
    if (!saved.ok) {
      keyStatus.value = saved.message
      keyStatusKind.value = 'err'
      return
    }
    maskedKey.value = saved.masked
    editingKey.value = false
    keyStatus.value = 'Key updated — it applies right away.'
    keyStatusKind.value = 'ok'
    // Clear any prior billing/auth error now that a good key is in place.
    if (store.errorCode === 'insufficient_quota' || store.errorCode === 'invalid_api_key') {
      store.status = 'idle'
      store.errorMessage = ''
      store.errorCode = ''
    }
  } catch {
    keyStatus.value = "Couldn't update the key. Please try again."
    keyStatusKind.value = 'err'
  } finally {
    keyBusy.value = false
  }
}

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
            <button v-if="store.theme !== opened.theme" class="undo" @click="store.setTheme(opened.theme)">
              ↩ back to {{ themeName(opened.theme) }}
            </button>
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

        <div class="row palette-row">
          <div class="row-label">
            <div class="name">Colour scheme</div>
            <div class="hint">Each scheme has its own light and dark</div>
            <button v-if="store.palette !== opened.palette" class="undo" @click="store.setPalette(opened.palette)">
              ↩ back to {{ paletteName(opened.palette) }}
            </button>
          </div>
          <div class="palettes">
            <button
              v-for="p in PALETTES"
              :key="p.id"
              class="palette"
              :class="{ on: store.palette === p.id }"
              :title="p.blurb"
              @click="store.setPalette(p.id)"
            >
              <span class="chips">
                <span v-for="(c, i) in p.swatch" :key="i" class="chip" :style="{ background: c }" />
              </span>
              <span class="pname">{{ p.name }}</span>
            </button>
          </div>
        </div>
      </section>

      <section v-if="store.levels.length" class="group">
        <h3>Practice</h3>
        <div class="row">
          <div class="row-label">
            <div class="name">Difficulty</div>
            <div class="hint">
              How your partner speaks in
              {{ store.activeLanguage?.name || 'this language' }} — saved per language
            </div>
            <button v-if="store.level !== opened.level" class="undo" @click="store.setLevel(opened.level)">
              ↩ back to {{ levelCode(opened.level) }}
            </button>
          </div>
          <LevelSelector compact />
        </div>
      </section>

      <section class="group">
        <h3>Voice</h3>
        <div class="row">
          <div class="row-label">
            <div class="name">Speaking speed</div>
            <div class="hint">How fast your practice partner talks</div>
            <button v-if="store.speed !== opened.speed" class="undo" @click="store.setSpeed(opened.speed)">
              ↩ back to {{ opened.speed === 'slow' ? 'Slow' : 'Normal' }}
            </button>
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

      <section v-if="desktop" class="group">
        <h3>OpenAI key</h3>

        <div v-if="!editingKey" class="row">
          <div class="row-label">
            <div class="name mono">{{ maskedKey || 'Not set' }}</div>
            <div class="hint">Used for transcription, replies and speech</div>
          </div>
          <button class="ghost" @click="startEditingKey">Change key</button>
        </div>

        <div v-else class="key-edit">
          <input
            v-model="keyInput"
            type="password"
            placeholder="sk-..."
            spellcheck="false"
            autocomplete="off"
            :disabled="keyBusy"
            @keydown.enter="saveKey"
          />
          <div class="key-actions">
            <button class="ghost" :disabled="keyBusy" @click="cancelEditingKey">Cancel</button>
            <button class="done" :disabled="keyBusy" @click="saveKey">
              {{ keyBusy ? 'Checking…' : 'Save key' }}
            </button>
          </div>
        </div>

        <p v-if="keyStatus" class="key-status" :class="keyStatusKind">{{ keyStatus }}</p>
      </section>

      <footer>
        <span class="privacy">🔒 Everything is stored on this device.</span>
        <div class="foot-actions">
          <!-- Only shown when something differs from the defaults, so its
               presence tells you at a glance that you've changed something. -->
          <button v-if="store.settingsChanged" class="reset" @click="store.resetSettings()">
            Reset to defaults
          </button>
          <button class="done" @click="store.closeSettings()">Done</button>
        </div>
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
/* Appears only on a row you've changed, naming the value you started from. */
.undo {
  display: inline-block;
  margin-top: 5px;
  background: transparent;
  border: none;
  padding: 0;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}
.undo:hover {
  text-decoration: underline;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
.ghost {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 14px;
}
.ghost:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.ghost:disabled {
  opacity: 0.5;
  cursor: default;
}
.key-edit {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.key-edit input {
  width: 100%;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  padding: 10px 12px;
  font-size: 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  outline: none;
}
.key-edit input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.key-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.key-status {
  margin: 10px 0 0;
  font-size: 12.5px;
  line-height: 1.45;
}
.key-status.err {
  color: var(--danger);
}
.key-status.ok {
  color: var(--accent-2);
}
.key-status.busy {
  color: var(--muted);
}

.palette-row {
  margin-top: 16px;
}
.palettes {
  display: flex;
  gap: 10px;
}
.palette {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 11px;
  padding: 9px 12px;
  color: var(--muted);
}
.palette:hover {
  color: var(--text);
}
.palette.on {
  border-color: var(--accent);
  color: var(--text);
  box-shadow: 0 0 0 2px var(--focus-ring);
}
.chips {
  display: inline-flex;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid var(--border);
}
.chips .chip {
  width: 16px;
  height: 16px;
}
.pname {
  font-size: 12.5px;
  font-weight: 600;
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
.foot-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.reset {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 13px;
}
.reset:hover {
  color: var(--text);
  border-color: var(--accent);
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
