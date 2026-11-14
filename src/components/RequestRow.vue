<script setup lang="ts">
import { computed } from 'vue'

import { requestCategoryLabel, requestStatus } from '@/config/requests'
import type { AccessRequest, RequestBox } from '@/types/api'
import { formatDate, formatUntil } from '@/utils/format'

/** One access request in a list. Buttons go in the `actions` slot; messages in the default slot. */
const props = defineProps<{ request: AccessRequest; box: RequestBox }>()

const status = computed(() => requestStatus(props.request))
const otherUser = computed(() =>
  props.box === 'incoming' ? props.request.requester : props.request.owner,
)
</script>

<template>
  <li class="sheet request" :data-status="request.status">
    <div class="info">
      <p class="who">
        <strong>{{ box === 'incoming' ? `From ${otherUser}` : `To ${otherUser}` }}</strong>
        <span class="badge" :data-tone="status.tone">{{ status.label }}</span>
      </p>
      <p v-if="request.message" class="message">“{{ request.message }}”</p>
      <p class="muted small">
        Asks for: {{ requestCategoryLabel(request.category) }} · sent
        {{ formatDate(request.created_at) }}
        <template v-if="request.status === 'APPROVED' && request.expires_at && !request.expired">
          · access ends {{ formatUntil(request.expires_at) }}
        </template>
      </p>
    </div>
    <div class="actions">
      <slot name="actions" />
    </div>
    <slot />
  </li>
</template>

<style scoped>
.request {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.info p {
  margin: 0 0 0.3rem;
}

.who {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.message {
  overflow-wrap: anywhere;
}

.badge {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.05rem 0.55rem;
  border-radius: 99px;
  border: 1px solid currentColor;
}

.badge[data-tone='pending'] {
  color: var(--health);
  background: var(--health-soft);
}

.badge[data-tone='ok'] {
  color: var(--ok);
  background: var(--accent-soft);
}

.badge[data-tone='ended'] {
  color: var(--ink-2);
  background: var(--sheet-2);
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
