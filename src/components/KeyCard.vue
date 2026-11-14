<script setup lang="ts">
import { ref } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import type { KeyPair, KeyPurpose } from '@/types/api'
import { formatDate, formatFingerprint } from '@/utils/format'

/** One key pair: fingerprint to compare, copy, and rotate behind a confirm. */
const props = defineProps<{
  purpose: KeyPurpose
  pair: KeyPair | null
  rotating?: boolean
}>()
const emit = defineEmits<{ rotate: [purpose: KeyPurpose] }>()

const TITLES: Record<KeyPurpose, string> = {
  ENCRYPTION: 'Encryption key',
  SIGNING: 'Signing key',
}
const PURPOSE_TEXT: Record<KeyPurpose, string> = {
  ENCRYPTION: 'Opens the keys people send you for records they share.',
  SIGNING: 'Signs your PDFs so others can check they came from you.',
}
const EMPTY_TEXT: Record<KeyPurpose, string> = {
  ENCRYPTION: 'No encryption key yet. One is created when you sign in.',
  SIGNING: 'No signing key yet. One is created the first time you sign a PDF.',
}

const confirming = ref(false)
const copied = ref(false)

async function copyFingerprint() {
  if (!props.pair) return
  await navigator.clipboard.writeText(formatFingerprint(props.pair.fingerprint))
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function rotate() {
  confirming.value = false
  emit('rotate', props.purpose)
}
</script>

<template>
  <article class="key-card" :aria-label="TITLES[purpose]">
    <header>
      <h3>{{ TITLES[purpose] }}</h3>
      <span v-if="pair" class="algo muted small">{{ pair.algorithm }}</span>
    </header>
    <p class="muted small">{{ PURPOSE_TEXT[purpose] }}</p>

    <template v-if="pair">
      <p class="label small">Fingerprint</p>
      <p class="key fingerprint" data-testid="fingerprint">
        {{ formatFingerprint(pair.fingerprint) }}
      </p>
      <p class="muted small">Created {{ formatDate(pair.created_at) }}</p>

      <div v-if="!confirming" class="row">
        <button class="secondary" @click="copyFingerprint">
          {{ copied ? 'Copied' : 'Copy fingerprint' }}
        </button>
        <AsyncButton
          variant="secondary"
          :loading="rotating"
          label="Make a new key"
          loading-label="Making a new key…"
          @click="confirming = true"
        />
      </div>
      <div v-else class="confirm" role="alert">
        <p class="small">
          Keys already sent to you with the old key still work. New keys will use the new one, and
          its fingerprint will be different.
        </p>
        <div class="row">
          <button @click="rotate">Make a new key</button>
          <button class="secondary" @click="confirming = false">Keep this one</button>
        </div>
      </div>
    </template>
    <p v-else class="notice info small">{{ EMPTY_TEXT[purpose] }}</p>
  </article>
</template>

<style scoped>
.key-card {
  padding: 1rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-sheet);
  background: var(--sheet);
}

header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
}

h3 {
  margin: 0;
}

.label {
  margin: 0.75rem 0 0.2rem;
  font-weight: 600;
}

.fingerprint {
  margin: 0 0 0.25rem;
  font-size: 1.05rem;
  letter-spacing: 0.04em;
  word-spacing: 0.2em;
  user-select: all;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.75rem;
}

.confirm p {
  margin: 0.75rem 0 0;
}
</style>
