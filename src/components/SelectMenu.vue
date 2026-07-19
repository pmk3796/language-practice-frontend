<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

export interface SelectOption {
  value: string
  label: string
  emoji?: string
  description?: string
}

const props = defineProps<{
  label?: string
  modelValue: string
  options: SelectOption[]
  disabled?: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const activeIndex = ref(-1)

const selected = computed(() => props.options.find((o) => o.value === props.modelValue))

function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    activeIndex.value = props.options.findIndex((o) => o.value === props.modelValue)
    // Defer so the click that opened us doesn't immediately close us.
    setTimeout(() => window.addEventListener('click', onOutside), 0)
  } else {
    close()
  }
}

function close() {
  open.value = false
  window.removeEventListener('click', onOutside)
}

function choose(value: string) {
  emit('update:modelValue', value)
  close()
}

function onOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) close()
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  if (!open.value) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      toggle()
    }
    return
  }
  if (e.key === 'Escape') {
    close()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, props.options.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const opt = props.options[activeIndex.value]
    if (opt) choose(opt.value)
  }
}

onBeforeUnmount(() => window.removeEventListener('click', onOutside))
</script>

<template>
  <div ref="root" class="select">
    <label v-if="label">{{ label }}</label>
    <button
      type="button"
      class="trigger"
      :class="{ open, disabled }"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click.stop="toggle"
      @keydown="onKeydown"
    >
      <span class="value">
        <span v-if="selected?.emoji" class="emoji">{{ selected.emoji }}</span>
        <span class="text">{{ selected?.label || 'Select…' }}</span>
      </span>
      <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <transition name="pop">
      <ul v-if="open" class="menu" role="listbox">
        <li v-for="(o, i) in options" :key="o.value">
          <button
            type="button"
            class="option"
            :class="{ selected: o.value === modelValue, active: i === activeIndex }"
            role="option"
            :aria-selected="o.value === modelValue"
            @click.stop="choose(o.value)"
            @mouseenter="activeIndex = i"
          >
            <span v-if="o.emoji" class="emoji">{{ o.emoji }}</span>
            <span class="body">
              <span class="olabel">{{ o.label }}</span>
              <span v-if="o.description" class="odesc">{{ o.description }}</span>
            </span>
            <span v-if="o.value === modelValue" class="check">✓</span>
          </button>
        </li>
      </ul>
    </transition>
  </div>
</template>

<style scoped>
.select {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 200px;
}

label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  background: linear-gradient(180deg, var(--panel-2), #1e2338);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 14px;
  color: var(--text);
  font-size: 15px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.08s ease;
}

.trigger:hover:not(.disabled) {
  border-color: rgba(108, 140, 255, 0.6);
}

.trigger:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(108, 140, 255, 0.28);
}

.trigger.open {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(108, 140, 255, 0.22);
}

.trigger.disabled {
  opacity: 0.55;
  cursor: default;
}

.value {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.value .text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.emoji {
  font-size: 18px;
  line-height: 1;
}

.chevron {
  color: var(--muted);
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.trigger.open .chevron {
  transform: rotate(180deg);
  color: var(--accent);
}

.menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 100%;
  width: max-content;
  max-width: 320px;
  max-height: 320px;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 6px;
  background: #1c2138;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  z-index: 30;
}

.option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 8px;
  padding: 9px 10px;
  color: var(--text);
  font-size: 15px;
  font-family: inherit;
  cursor: pointer;
}

.option.active {
  background: rgba(108, 140, 255, 0.18);
}

.option .body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.olabel {
  font-weight: 500;
}

.option.selected .olabel {
  color: var(--accent-2);
}

.odesc {
  color: var(--muted);
  font-size: 12px;
}

.check {
  color: var(--accent-2);
  font-weight: 700;
  flex-shrink: 0;
}

.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
  transform-origin: top;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
