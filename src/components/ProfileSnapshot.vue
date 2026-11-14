<script setup lang="ts">
import { ref, watch } from 'vue'

import { PROFILE_GROUPS } from '@/config/profile'

/** Read-only view of a profile someone shared: a copy from when they approved. */
const props = defineProps<{ owner: string; fields: Record<string, string> | null }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)

watch(
  () => props.fields,
  (fields) => (fields ? dialog.value?.showModal() : dialog.value?.close()),
)
</script>

<template>
  <dialog ref="dialog" class="snapshot" :aria-label="`${owner}'s profile`" @close="emit('close')">
    <header class="head">
      <h2>{{ owner }}'s profile</h2>
      <button class="secondary" @click="emit('close')">Close</button>
    </header>
    <div v-if="fields" class="body">
      <p class="muted small">A copy from when {{ owner }} approved. It doesn't change later.</p>
      <section v-for="group in PROFILE_GROUPS" :key="group.title">
        <h3>{{ group.title }}</h3>
        <dl>
          <template v-for="field in group.fields" :key="field.name">
            <dt>{{ field.label }}</dt>
            <dd>{{ fields[field.name] || '—' }}</dd>
          </template>
        </dl>
      </section>
    </div>
  </dialog>
</template>

<style scoped>
.snapshot {
  width: min(560px, 96vw);
  max-height: 90vh;
  padding: 0;
  border: none;
  border-radius: var(--radius-sheet);
  background: var(--sheet);
  color: var(--ink);
}

.snapshot::backdrop {
  background: rgb(23 48 42 / 55%);
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--line);
}

.head h2 {
  margin: 0;
}

.body {
  padding: 1rem 1.25rem 1.5rem;
}

dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.3rem 1rem;
  margin: 0 0 1rem;
}

dt {
  color: var(--ink-2);
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
