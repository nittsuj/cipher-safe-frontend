<script setup lang="ts">
import { ref } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import { requestsApi } from '@/api/cipherSafe'
import { FormError } from '@/api/client'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { parseEnvelope } from '@/config/requests'

/**
 * Paste the key the owner sent. The `CSK1.<request>.<item>.` prefix is checked
 * here first, so a key for another item gets a clear message; the server then
 * checks the key itself and opens it with the user's private key.
 */
const props = defineProps<{ requestId: number; itemId: number; label: string }>()
const emit = defineEmits<{ redeemed: [] }>()

const text = ref('')

const redeem = useAsyncAction(async () => {
  const parsed = parseEnvelope(text.value)
  if (!parsed)
    throw new FormError("This doesn't look like a Cipher Safe key. Paste the whole text.")
  if (parsed.requestId !== props.requestId || parsed.itemId !== props.itemId)
    throw new FormError('This key is for another item. Check which item the owner sent it for.')
  await requestsApi.redeem(props.requestId, props.itemId, text.value.trim())
  text.value = ''
  emit('redeemed')
}, 'Could not use this key.')
</script>

<template>
  <form class="redeem" @submit.prevent="redeem.run()">
    <label :for="`redeem-${itemId}`" class="small">Key for {{ label }}</label>
    <textarea
      :id="`redeem-${itemId}`"
      v-model="text"
      class="key"
      rows="3"
      spellcheck="false"
      autocomplete="off"
      placeholder="CSK1…"
      required
    />
    <p v-if="redeem.error.value" class="notice error small" role="alert">
      {{ redeem.error.value }}
    </p>
    <AsyncButton
      type="submit"
      :loading="redeem.loading.value"
      :disabled="!text.trim()"
      label="Use key"
      loading-label="Opening with your private key…"
    />
  </form>
</template>

<style scoped>
.redeem textarea {
  width: 100%;
  font-size: 0.85rem;
  word-break: break-all;
}

.redeem {
  margin-top: 0.5rem;
}
</style>
