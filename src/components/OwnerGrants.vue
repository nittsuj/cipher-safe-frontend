<script setup lang="ts">
import { reactive } from 'vue'

import KeyEnvelopeCard from '@/components/KeyEnvelopeCard.vue'
import { requestsApi } from '@/api/cipherSafe'
import { getErrorMessage } from '@/api/client'
import type { AccessRequest, EnvelopeAgain, GrantedItemSummary } from '@/types/api'
import { categoryLabel } from '@/utils/format'

/**
 * As the owner: what you granted on an approved request, and the same key
 * again for each item. Keys are asked from the server each time and are only
 * kept while shown here.
 */
const props = defineProps<{ request: AccessRequest }>()

const shown = reactive<Record<number, EnvelopeAgain | undefined>>({})
const loading = reactive<Record<number, boolean>>({})
const errors = reactive<Record<number, string>>({})

function itemLabel(item: GrantedItemSummary) {
  return item.kind === 'PROFILE' ? 'Your profile' : categoryLabel(item.category ?? '')
}

async function toggle(item: GrantedItemSummary) {
  if (shown[item.item_id]) {
    shown[item.item_id] = undefined
    return
  }
  loading[item.item_id] = true
  errors[item.item_id] = ''
  try {
    shown[item.item_id] = await requestsApi.envelope(props.request.id, item.item_id)
  } catch (err) {
    errors[item.item_id] = getErrorMessage(err, 'Could not get the key.')
  } finally {
    loading[item.item_id] = false
  }
}
</script>

<template>
  <div class="granted">
    <p class="small"><strong>You shared</strong></p>
    <ul>
      <li v-for="item in request.items" :key="item.item_id">
        <div class="item">
          <span>
            {{ itemLabel(item) }}
            <span class="muted small">
              {{
                item.redeemed ? `key entered, opened ${item.access_count}×` : 'key not entered yet'
              }}
            </span>
          </span>
          <button class="secondary" :disabled="loading[item.item_id]" @click="toggle(item)">
            {{ shown[item.item_id] ? 'Hide key' : 'Show key again' }}
          </button>
        </div>
        <KeyEnvelopeCard
          v-if="shown[item.item_id]"
          :title="itemLabel(item)"
          :envelope="shown[item.item_id]!.envelope"
          :recipient="request.requester"
          :fingerprint="shown[item.item_id]!.recipient_fingerprint"
        />
        <p v-if="errors[item.item_id]" class="notice error small" role="alert">
          {{ errors[item.item_id] }}
        </p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.granted {
  flex-basis: 100%;
  border-top: 1px solid var(--line);
  padding-top: 0.5rem;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 0.4rem 0;
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.4rem;
}
</style>
