<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import RequestRow from '@/components/RequestRow.vue'
import { useRequestsStore } from '@/stores/requests'
import type { RequestBox } from '@/types/api'

const store = useRequestsStore()
const box = ref<RequestBox>('incoming')

const TABS: { box: RequestBox; label: string }[] = [
  { box: 'incoming', label: 'Incoming' },
  { box: 'outgoing', label: 'Outgoing' },
]

const visible = computed(() => (box.value === 'incoming' ? store.incoming : store.outgoing))
const count = (tab: RequestBox) =>
  tab === 'incoming' ? store.incoming.length : store.outgoing.length

onMounted(() => store.load())
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>Requests</h1>
      <p class="lede">
        Ask someone for access to their records, or decide who may see yours. Nothing is shared
        until the owner approves and sends the key.
      </p>
    </header>

    <div class="tabs" role="tablist" aria-label="Requests">
      <button
        v-for="tab in TABS"
        :id="`tab-${tab.box}`"
        :key="tab.box"
        role="tab"
        :aria-selected="box === tab.box"
        aria-controls="request-list"
        :class="box === tab.box ? '' : 'secondary'"
        @click="box = tab.box"
      >
        {{ tab.label }} <span class="count">{{ count(tab.box) }}</span>
      </button>
    </div>

    <p v-if="store.error" class="notice error" role="alert">{{ store.error }}</p>

    <section id="request-list" role="tabpanel" :aria-labelledby="`tab-${box}`">
      <p v-if="store.loading && !visible.length" class="muted">Loading…</p>
      <div v-else-if="!visible.length" class="sheet">
        <h2>{{ box === 'incoming' ? 'No requests for your data' : "You haven't asked anyone" }}</h2>
        <p class="muted">
          {{
            box === 'incoming'
              ? 'When someone asks to see your records, it shows up here.'
              : 'Requests you send show up here with their status.'
          }}
        </p>
      </div>
      <ul v-else class="list">
        <RequestRow v-for="request in visible" :key="request.id" :request="request" :box="box" />
      </ul>
    </section>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.count {
  font-weight: 400;
  opacity: 0.75;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.75rem;
}
</style>
