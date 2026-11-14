<script setup lang="ts">
import { computed, ref } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { REQUEST_CATEGORIES, REQUEST_MESSAGE_MAX } from '@/config/requests'
import { useRequestsStore } from '@/stores/requests'
import type { RequestCategory } from '@/types/api'

/** Ask another user for access to their data. */
const emit = defineEmits<{ sent: [] }>()

const store = useRequestsStore()
const owner = ref('')
const message = ref('')
const category = ref<RequestCategory | ''>('')
const sentTo = ref('')

const remaining = computed(() => REQUEST_MESSAGE_MAX - message.value.length)

const ask = useAsyncAction(async () => {
  sentTo.value = ''
  const created = await store.ask({
    owner: owner.value.trim(),
    message: message.value.trim(),
    category: category.value,
  })
  sentTo.value = created.owner
  owner.value = ''
  message.value = ''
  category.value = ''
  emit('sent')
}, 'Could not send the request.')
</script>

<template>
  <form class="sheet ask" aria-labelledby="ask-title" @submit.prevent="ask.run()">
    <h2 id="ask-title">Ask for access</h2>
    <p class="muted small">
      Record names are hidden, so you can't pick a file. Say what you need; the owner chooses what
      to share.
    </p>

    <div class="grid">
      <div class="field">
        <label for="ask-owner">Their username</label>
        <input id="ask-owner" v-model="owner" autocomplete="off" required />
      </div>
      <div class="field">
        <label for="ask-category">
          What do you need?
          <span class="hint">Optional</span>
        </label>
        <select id="ask-category" v-model="category">
          <option value="">Anything</option>
          <option v-for="item in REQUEST_CATEGORIES" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
      </div>
      <div class="field wide">
        <label for="ask-message">
          Message
          <span class="hint">Optional</span>
        </label>
        <textarea
          id="ask-message"
          v-model="message"
          rows="3"
          :maxlength="REQUEST_MESSAGE_MAX"
          aria-describedby="ask-message-count"
          placeholder="For example: your latest lab results, for the check-up on Monday."
        />
        <span id="ask-message-count" class="hint" aria-live="polite">
          {{ remaining }} characters left
        </span>
      </div>
    </div>

    <p v-if="ask.error.value" class="notice error" role="alert">{{ ask.error.value }}</p>
    <p v-else-if="sentTo" class="notice ok" role="status">
      Request sent to {{ sentTo }}. You'll see their answer under Outgoing.
    </p>
    <AsyncButton
      type="submit"
      :loading="ask.loading.value"
      :disabled="!owner.trim()"
      label="Send request"
      loading-label="Sending…"
    />
  </form>
</template>

<style scoped>
.ask {
  margin-bottom: 1.5rem;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 1rem;
}

.wide {
  grid-column: 1 / -1;
}

@media (max-width: 620px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
