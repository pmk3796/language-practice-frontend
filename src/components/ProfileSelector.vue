<script setup lang="ts">
import { usePracticeStore } from '@/stores/practice'

const store = usePracticeStore()
</script>

<template>
  <div class="profile">
    <label for="profile">Scenario</label>
    <div class="control">
      <select
        id="profile"
        :value="store.profile"
        :disabled="store.status === 'processing'"
        @change="store.setProfile(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="p in store.profiles" :key="p.id" :value="p.id">
          {{ p.emoji }} {{ p.name }}
        </option>
      </select>
      <span v-if="store.activeProfile" class="desc">{{ store.activeProfile.description }}</span>
    </div>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  gap: 10px;
}

label {
  color: var(--muted);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.control {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

select {
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 15px;
  outline: none;
}

select:disabled {
  opacity: 0.6;
}

.desc {
  color: var(--muted);
  font-size: 11px;
  padding-left: 2px;
}
</style>
