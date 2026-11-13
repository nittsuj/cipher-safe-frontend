<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import FilePreview from '@/components/FilePreview.vue'
import { sharesApi } from '@/api/cipherSafe'
import { getErrorMessage } from '@/api/client'
import { useAsyncAction } from '@/composables/useAsyncAction'
import type { ReceivedShare } from '@/types/api'
import { categoryLabel, formatBytes, formatDay, formatUntil } from '@/utils/format'

const shares = ref<ReceivedShare[]>([])
const keys = reactive<Record<number, string>>({})
const errors = reactive<Record<number, string>>({})
const opening = ref<number | null>(null)

const load = useAsyncAction(async () => {
  shares.value = await sharesApi.received()
}, 'Could not load shared records.')

const preview = ref({
  open: false,
  title: '',
  blob: null as Blob | null,
  filename: null as string | null,
})

async function open(share: ReceivedShare) {
  errors[share.id] = ''
  opening.value = share.id
  try {
    const result = await sharesApi.open(share.id, keys[share.id] ?? '')
    preview.value = {
      open: true,
      title: result.filename ?? `Record from ${share.patient}`,
      blob: result.blob,
      filename: result.filename,
    }
    share.access_count += 1
  } catch (err) {
    errors[share.id] = getErrorMessage(err, 'Could not open this record.')
  } finally {
    opening.value = null
  }
}

onMounted(() => load.run())
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>Shared with me</h1>
      <p class="lede">
        Records patients have shared with you. Type the key the patient gave you to open one. Each
        share closes on its own after the time the patient chose.
      </p>
    </header>

    <p v-if="load.error.value" class="notice error" role="alert">{{ load.error.value }}</p>
    <p v-else-if="load.loading.value && !shares.length" class="muted">Loading…</p>

    <div v-else-if="!shares.length" class="sheet">
      <h2>Nothing shared yet</h2>
      <p class="muted">
        Ask the patient to share a record with your username. It appears here as soon as they do.
      </p>
      <button class="secondary" @click="load.run()">Check again</button>
    </div>

    <ul v-else class="list">
      <li v-for="share in shares" :key="share.id" class="sheet item" :data-cat="share.category">
        <div class="info">
          <span class="cat">{{ categoryLabel(share.category) }}</span>
          <h2>From {{ share.patient }}</h2>
          <p class="muted small">
            {{ formatBytes(share.plaintext_size) }}, shared {{ formatDay(share.created_at) }}, closes
            {{ formatUntil(share.expires_at) }}
          </p>
        </div>
        <form class="unlock" @submit.prevent="open(share)">
          <label :for="`key-${share.id}`">Share key</label>
          <div class="unlock-row">
            <input
              :id="`key-${share.id}`"
              v-model="keys[share.id]"
              class="key"
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
              autocomplete="off"
              spellcheck="false"
              :aria-invalid="Boolean(errors[share.id])"
              required
            />
            <AsyncButton
              type="submit"
              :loading="opening === share.id"
              :disabled="!keys[share.id]"
              label="Open"
              loading-label="Opening…"
            />
          </div>
          <p v-if="errors[share.id]" class="err small" role="alert">{{ errors[share.id] }}</p>
        </form>
      </li>
    </ul>

    <FilePreview
      :open="preview.open"
      :title="preview.title"
      :blob="preview.blob"
      :filename="preview.filename"
      @close="preview.open = false"
    />
  </div>
</template>

<style scoped>
.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1rem;
}

.item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 1.5rem;
  align-items: center;
  border-left: 5px solid var(--cat);
}

[data-cat='ID_CARD'] {
  --cat: var(--tab-id);
}

[data-cat='DOCUMENT'] {
  --cat: var(--tab-doc);
}

[data-cat='VIDEO'] {
  --cat: var(--tab-video);
}

.cat {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--cat);
}

.info h2 {
  margin: 0.1rem 0 0.2rem;
}

.info p {
  margin: 0;
}

.unlock-row {
  display: flex;
  gap: 0.6rem;
}

.unlock-row input {
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.err {
  color: var(--danger);
  margin: 0.35rem 0 0;
}

@media (max-width: 720px) {
  .item {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
