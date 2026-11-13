<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import { sharesApi } from '@/api/cipherSafe'
import { useAsyncAction } from '@/composables/useAsyncAction'
import type { CreatedShare, FileShare } from '@/types/api'
import { formatUntil } from '@/utils/format'

/** "Share with a doctor": create a one-time key, list and revoke shares. */
const props = defineProps<{ fileId: number }>()

const shares = ref<FileShare[]>([])
const doctor = ref('')
const hours = ref(24)
const created = ref<CreatedShare | null>(null)
const copied = ref(false)

const loadShares = useAsyncAction(async () => {
  shares.value = await sharesApi.forFile(props.fileId)
}, 'Could not load shares.')

// A different record was opened: forget the previous one's key and shares.
watch(
  () => props.fileId,
  () => {
    shares.value = []
    created.value = null
    doctor.value = ''
    copied.value = false
    loadShares.run()
  },
  { immediate: true },
)

const share = useAsyncAction(async () => {
  created.value = await sharesApi.create(props.fileId, doctor.value.trim(), hours.value)
  copied.value = false
  doctor.value = ''
  await loadShares.run()
}, 'Could not share this record.')

const revoke = useAsyncAction(async (id: number) => {
  await sharesApi.revoke(id)
  if (created.value?.id === id) created.value = null
  await loadShares.run()
}, 'Could not stop sharing.')

async function copyKey() {
  if (!created.value) return
  await navigator.clipboard.writeText(created.value.share_key)
  copied.value = true
}

const activeShares = computed(() => shares.value.filter((s) => s.active))
</script>

<template>
  <section class="block">
    <h3>Share with a doctor</h3>
    <p class="muted small">
      The doctor gets a separate copy, locked with a one-time key. Send them the key yourself, by
      WhatsApp or in person. Without it they can't open anything.
    </p>

    <div v-if="created" class="key-card" role="status">
      <p class="small">
        Key for <strong>{{ created.doctor }}</strong
        >. This is the only time it's shown.
      </p>
      <p class="key share-key">{{ created.share_key }}</p>
      <button class="secondary" @click="copyKey">{{ copied ? 'Copied' : 'Copy key' }}</button>
    </div>

    <form class="share-form" @submit.prevent="share.run()">
      <div>
        <label for="doctor">Doctor's username</label>
        <input id="doctor" v-model="doctor" autocomplete="off" required />
      </div>
      <div>
        <label for="hours">Open for</label>
        <select id="hours" v-model.number="hours">
          <option :value="1">1 hour</option>
          <option :value="24">1 day</option>
          <option :value="72">3 days</option>
          <option :value="168">1 week</option>
        </select>
      </div>
      <AsyncButton
        type="submit"
        :loading="share.loading.value"
        :disabled="!doctor.trim()"
        label="Create key"
        loading-label="Locking copy…"
      />
    </form>
    <p v-if="share.error.value" class="notice error">{{ share.error.value }}</p>

    <ul v-if="activeShares.length" class="shares">
      <li v-for="item in activeShares" :key="item.id">
        <span>
          <strong>{{ item.doctor }}</strong>
          <span class="muted small">
            closes {{ formatUntil(item.expires_at) }}, opened {{ item.access_count }}×
          </span>
        </span>
        <button class="danger small" :disabled="revoke.loading.value" @click="revoke.run(item.id)">
          Stop sharing
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.block {
  padding: 1.25rem 0;
  border-top: 1px solid var(--line);
}

.share-form {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.75rem;
  align-items: end;
}

.key-card {
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
  background: var(--accent-soft);
  border-radius: var(--radius-sheet);
}

.share-key {
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  margin: 0.25rem 0 0.75rem;
  user-select: all;
}

.shares {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
}

.shares li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--line);
}

.shares li > span {
  display: flex;
  flex-direction: column;
}

button.small {
  min-height: 2.2rem;
  font-size: 0.9rem;
}

@media (max-width: 560px) {
  .share-form {
    grid-template-columns: 1fr 1fr;
  }

  .share-form > :first-child {
    grid-column: 1 / -1;
  }
}
</style>
