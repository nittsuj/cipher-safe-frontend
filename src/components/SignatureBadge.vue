<script setup lang="ts">
import { computed } from 'vue'

import { signatureDisplay } from '@/config/signatures'
import type { SignatureStatus } from '@/types/api'

const props = defineProps<{ status: SignatureStatus; signer?: string | null }>()
const display = computed(() => signatureDisplay(props.status, props.signer))
</script>

<template>
  <span class="badge" :data-tone="display.tone" role="status" :aria-label="display.text">
    <span class="icon" aria-hidden="true">{{ display.icon }}</span>
    {{ display.text }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.1rem 0.6rem;
  border: 1px solid var(--tone);
  border-radius: 99px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--tone);
}

.icon {
  font-weight: 700;
}

[data-tone='ok'] {
  --tone: var(--ok);
}

[data-tone='warn'] {
  --tone: var(--health);
}

[data-tone='bad'] {
  --tone: var(--danger);
}

[data-tone='neutral'] {
  --tone: var(--ink-2);
}
</style>
