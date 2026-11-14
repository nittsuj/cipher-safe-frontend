import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { requestsApi } from '@/api/cipherSafe'
import { getErrorMessage } from '@/api/client'
import type { AccessRequest, NewAccessRequest } from '@/types/api'

/**
 * Access requests: the ones sent to me (incoming) and by me (outgoing).
 * Shared by the Requests page and the nav badge for pending incoming requests.
 */
export const useRequestsStore = defineStore('requests', () => {
  const incoming = ref<AccessRequest[]>([])
  const outgoing = ref<AccessRequest[]>([])
  const loading = ref(false)
  const error = ref('')

  const pendingIncoming = computed(
    () => incoming.value.filter((r) => r.status === 'PENDING').length,
  )

  async function load() {
    loading.value = true
    error.value = ''
    try {
      const [inbox, sent] = await Promise.all([
        requestsApi.list('incoming'),
        requestsApi.list('outgoing'),
      ])
      incoming.value = inbox
      outgoing.value = sent
    } catch (err) {
      error.value = getErrorMessage(err, 'Could not load your requests.')
    } finally {
      loading.value = false
    }
  }

  /** Ask for access; throws so the form can show the server's message. */
  async function ask(request: NewAccessRequest): Promise<AccessRequest> {
    const created = await requestsApi.create(request)
    outgoing.value = [created, ...outgoing.value]
    return created
  }

  function replace(updated: AccessRequest) {
    incoming.value = incoming.value.map((r) => (r.id === updated.id ? updated : r))
    outgoing.value = outgoing.value.map((r) => (r.id === updated.id ? updated : r))
  }

  function clear() {
    incoming.value = []
    outgoing.value = []
    error.value = ''
  }

  return { incoming, outgoing, loading, error, pendingIncoming, load, ask, replace, clear }
})
