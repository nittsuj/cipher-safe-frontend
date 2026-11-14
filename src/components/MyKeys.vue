<script setup lang="ts">
import { onMounted, ref } from 'vue'

import KeyCard from '@/components/KeyCard.vue'
import { keysApi } from '@/api/cipherSafe'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useAuthStore } from '@/stores/auth'
import type { KeyPair, KeyPurpose } from '@/types/api'

/** "My keys": the user's key pairs, public parts only. */
const PURPOSES: KeyPurpose[] = ['ENCRYPTION', 'SIGNING']

const pairs = ref<Partial<Record<KeyPurpose, KeyPair>>>({})
const rotatingPurpose = ref<KeyPurpose | null>(null)

const auth = useAuthStore()

const load = useAsyncAction(async () => {
  // Right after sign-in the encryption key may still be being made; wait for
  // it so the card doesn't briefly say there is none.
  await auth.ensureEncryptionKey()
  const list = await keysApi.list()
  pairs.value = Object.fromEntries(list.map((pair) => [pair.purpose, pair]))
}, 'Could not load your keys.')

const rotate = useAsyncAction(async (purpose: KeyPurpose) => {
  rotatingPurpose.value = purpose
  try {
    pairs.value = { ...pairs.value, [purpose]: await keysApi.rotate(purpose) }
  } finally {
    rotatingPurpose.value = null
  }
}, 'Could not make a new key.')

onMounted(() => load.run())
</script>

<template>
  <section class="sheet my-keys" aria-labelledby="my-keys-title">
    <h2 id="my-keys-title">My keys</h2>
    <p class="muted small">
      Your fingerprint lets people check a key really came from you. Compare the first and last
      groups when someone sends you a key. Your private keys never leave the server, and they are
      locked with your password.
    </p>

    <p v-if="load.error.value || rotate.error.value" class="notice error" role="alert">
      {{ load.error.value || rotate.error.value }}
    </p>
    <p v-if="load.loading.value" class="muted">Loading your keys…</p>
    <div v-else class="cards">
      <KeyCard
        v-for="purpose in PURPOSES"
        :key="purpose"
        :purpose="purpose"
        :pair="pairs[purpose] ?? null"
        :rotating="rotatingPurpose === purpose"
        @rotate="rotate.run"
      />
    </div>
  </section>
</template>

<style scoped>
.my-keys {
  margin-top: 1.5rem;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}
</style>
