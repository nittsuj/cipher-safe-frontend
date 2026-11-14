<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import KeyEnvelopeCard from '@/components/KeyEnvelopeCard.vue'
import { requestsApi } from '@/api/cipherSafe'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { requestCategoryLabel } from '@/config/requests'
import { useFilesStore } from '@/stores/files'
import type { AccessRequest, ApproveResult } from '@/types/api'
import { categoryLabel } from '@/utils/format'

/**
 * Approve a request in two steps: pick what to share and for how long, then
 * hand out one key per item. The keys only live in this component's state and
 * are dropped when the dialog closes; "Show key again" asks the server.
 */
const props = defineProps<{ request: AccessRequest | null }>()
const emit = defineEmits<{ close: []; approved: [request: AccessRequest] }>()

const DURATIONS = [
  { hours: 1, label: '1 hour' },
  { hours: 24, label: '1 day' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '1 week' },
]

const files = useFilesStore()
const dialog = ref<HTMLDialogElement | null>(null)
const fileIds = ref<number[]>([])
const includeProfile = ref(false)
const hours = ref(24)
const result = ref<ApproveResult | null>(null)

const nothingChosen = computed(() => !fileIds.value.length && !includeProfile.value)

function reset() {
  fileIds.value = []
  includeProfile.value = props.request?.category === 'PROFILE'
  hours.value = 24
  result.value = null
  approve.error.value = ''
}

watch(
  () => props.request,
  (request) => {
    if (request) {
      reset()
      if (!files.items.length) void files.load()
      dialog.value?.showModal()
    } else {
      dialog.value?.close()
      result.value = null // forget the keys
    }
  },
)

const approve = useAsyncAction(async () => {
  if (!props.request) return
  result.value = await requestsApi.approve(props.request.id, {
    file_ids: fileIds.value,
    include_profile: includeProfile.value,
    expires_hours: hours.value,
  })
  emit('approved', result.value.request)
}, 'Could not approve the request.')

/** One card per granted item, named after its record (or "Your profile"). */
const cards = computed(() =>
  (result.value?.items ?? []).map((item) => ({
    ...item,
    title:
      item.kind === 'PROFILE'
        ? 'Your profile'
        : (files.items.find((f) => f.id === item.file_id)?.original_name ?? 'A record'),
  })),
)
</script>

<template>
  <dialog
    ref="dialog"
    class="approve"
    :aria-label="request ? `Approve ${request.requester}'s request` : 'Approve'"
    @close="emit('close')"
  >
    <template v-if="request">
      <header class="head">
        <h2>{{ result ? 'Send the keys' : `Share with ${request.requester}` }}</h2>
        <button class="secondary" aria-label="Close" @click="emit('close')">✕</button>
      </header>

      <form v-if="!result" class="body" @submit.prevent="approve.run()">
        <p class="muted small">
          They asked for: {{ requestCategoryLabel(request.category) }}
          <template v-if="request.message"> · “{{ request.message }}”</template>
        </p>

        <fieldset>
          <legend class="label">What to share</legend>
          <p v-if="files.loading" class="muted small">Loading your records…</p>
          <label v-for="file in files.items" :key="file.id" class="choice">
            <input v-model="fileIds" type="checkbox" :value="file.id" />
            <span>
              {{ file.original_name }}
              <span class="hint">{{ categoryLabel(file.category) }}</span>
            </span>
          </label>
          <label class="choice">
            <input v-model="includeProfile" type="checkbox" />
            <span>My profile <span class="hint">A copy of it as it is now</span></span>
          </label>
        </fieldset>

        <div class="field">
          <label for="approve-hours">Open for</label>
          <select id="approve-hours" v-model.number="hours">
            <option v-for="d in DURATIONS" :key="d.hours" :value="d.hours">{{ d.label }}</option>
          </select>
        </div>

        <p v-if="approve.error.value" class="notice error" role="alert">
          {{ approve.error.value }}
        </p>
        <AsyncButton
          type="submit"
          :loading="approve.loading.value"
          :disabled="nothingChosen"
          label="Approve and make keys"
          loading-label="Encrypting copies and keys…"
        />
      </form>

      <div v-else class="body">
        <p class="notice ok" role="status">
          Approved. Each item has its own key. Send every key to {{ request.requester }}; they need
          it to open that item.
        </p>
        <div class="cards">
          <KeyEnvelopeCard
            v-for="card in cards"
            :key="card.item_id"
            :title="card.title"
            :envelope="card.envelope"
            :recipient="request.requester"
            :fingerprint="result.recipient_fingerprint"
          />
        </div>
        <button @click="emit('close')">Done</button>
      </div>
    </template>
  </dialog>
</template>

<style scoped>
.approve {
  width: min(640px, 96vw);
  max-height: 90vh;
  padding: 0;
  border: none;
  border-radius: var(--radius-sheet);
  background: var(--sheet);
  color: var(--ink);
}

.approve::backdrop {
  background: rgb(23 48 42 / 55%);
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--line);
}

.head h2 {
  margin: 0;
}

.body {
  padding: 1rem 1.25rem 1.5rem;
}

fieldset {
  border: 0;
  padding: 0;
  margin: 0 0 1rem;
  display: grid;
  gap: 0.4rem;
}

.choice {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  margin: 0;
  padding: 0.45rem 0.6rem;
  border-radius: var(--radius-control);
  background: var(--sheet-2);
  font-weight: 600;
  cursor: pointer;
}

.choice input {
  width: auto;
  min-height: 0;
  margin-top: 0.3rem;
}

.choice .hint {
  display: inline;
  margin-left: 0.3rem;
}

.cards {
  display: grid;
  gap: 1rem;
  margin: 1rem 0;
}
</style>
