<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { requestsApi } from '@/api/cipherSafe'
import { getErrorMessage } from '@/api/client'

import ApproveDialog from '@/components/ApproveDialog.vue'
import AskAccessForm from '@/components/AskAccessForm.vue'
import GrantedItems from '@/components/GrantedItems.vue'
import MyKeys from '@/components/MyKeys.vue'
import OwnerGrants from '@/components/OwnerGrants.vue'
import RequestRow from '@/components/RequestRow.vue'
import { useAuthStore } from '@/stores/auth'
import { useRequestsStore } from '@/stores/requests'
import type { AccessRequest, RequestBox } from '@/types/api'

const store = useRequestsStore()
const auth = useAuthStore()
const box = ref<RequestBox>('incoming')

const TABS: { box: RequestBox; label: string }[] = [
  { box: 'incoming', label: 'Incoming' },
  { box: 'outgoing', label: 'Outgoing' },
]

const visible = computed(() => (box.value === 'incoming' ? store.incoming : store.outgoing))
const count = (tab: RequestBox) =>
  tab === 'incoming' ? store.incoming.length : store.outgoing.length

/** The request whose deny/cancel is waiting for confirmation, and errors per row. */
const confirmingId = ref<number | null>(null)
const approving = ref<AccessRequest | null>(null)
const busyId = ref<number | null>(null)
const rowErrors = ref<Record<number, string>>({})

async function act(request: AccessRequest, action: 'deny' | 'cancel' | 'revoke') {
  busyId.value = request.id
  rowErrors.value = { ...rowErrors.value, [request.id]: '' }
  try {
    const decidedAt = new Date().toISOString()
    if (action === 'deny') store.replace(await requestsApi.deny(request.id))
    else if (action === 'cancel') {
      await requestsApi.cancel(request.id)
      store.replace({ ...request, status: 'CANCELLED', decided_at: decidedAt })
    } else {
      await requestsApi.revoke(request.id)
      store.replace({ ...request, status: 'REVOKED', decided_at: decidedAt, items: [] })
    }
    confirmingId.value = null
  } catch (err) {
    const fallback = {
      deny: 'Could not deny the request.',
      cancel: 'Could not cancel it.',
      revoke: 'Could not stop access.',
    }[action]
    rowErrors.value = { ...rowErrors.value, [request.id]: getErrorMessage(err, fallback) }
    await store.load() // it may have changed meanwhile, e.g. cancelled by the other person
  } finally {
    busyId.value = null
  }
}

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

    <AskAccessForm @sent="box = 'outgoing'" />

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
        <RequestRow v-for="request in visible" :key="request.id" :request="request" :box="box">
          <template v-if="request.status === 'PENDING'" #actions>
            <div v-if="confirmingId === request.id" class="confirm" role="alert">
              <p class="small">
                {{
                  box === 'incoming'
                    ? `Deny ${request.requester}'s request? They can ask again later.`
                    : `Cancel your request to ${request.owner}?`
                }}
              </p>
              <div class="row">
                <button
                  class="danger"
                  :disabled="busyId === request.id"
                  @click="act(request, box === 'incoming' ? 'deny' : 'cancel')"
                >
                  {{ box === 'incoming' ? 'Deny' : 'Cancel request' }}
                </button>
                <button class="secondary" @click="confirmingId = null">Keep it</button>
              </div>
            </div>
            <template v-else-if="box === 'incoming'">
              <button @click="approving = request">Approve</button>
              <button class="secondary" @click="confirmingId = request.id">Deny</button>
            </template>
            <button v-else class="secondary" @click="confirmingId = request.id">
              Cancel request
            </button>
          </template>
          <template
            v-else-if="box === 'incoming' && request.status === 'APPROVED' && !request.expired"
            #actions
          >
            <div v-if="confirmingId === request.id" class="confirm" role="alert">
              <p class="small">
                Stop {{ request.requester }}'s access now? Every copy shared with them and its key
                is deleted. The keys you sent stop working.
              </p>
              <div class="row">
                <button
                  class="danger"
                  :disabled="busyId === request.id"
                  @click="act(request, 'revoke')"
                >
                  Stop access
                </button>
                <button class="secondary" @click="confirmingId = null">Keep it</button>
              </div>
            </div>
            <button v-else class="danger" @click="confirmingId = request.id">Stop access</button>
          </template>
          <OwnerGrants
            v-if="
              box === 'incoming' &&
              request.status === 'APPROVED' &&
              !request.expired &&
              request.items.length
            "
            :request="request"
          />
          <GrantedItems
            v-if="
              box === 'outgoing' &&
              request.status === 'APPROVED' &&
              !request.expired &&
              request.items.length
            "
            :request="request"
            @changed="store.load()"
          />
          <p v-if="rowErrors[request.id]" class="notice error small" role="alert">
            {{ rowErrors[request.id] }}
          </p>
        </RequestRow>
      </ul>
    </section>

    <!-- Patients see My keys on their Profile page; doctors have no Profile, so
         their key and its fingerprint (for owners to compare) live here. -->
    <MyKeys v-if="auth.isDoctor" :purposes="['ENCRYPTION']" />

    <ApproveDialog :request="approving" @close="approving = null" @approved="store.replace" />
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

.confirm p {
  margin: 0 0 0.5rem;
}

.row {
  display: flex;
  gap: 0.5rem;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.75rem;
}
</style>
