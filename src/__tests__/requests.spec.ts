import { afterEach, describe, expect, it, vi } from 'vitest'

import { requestsApi } from '@/api/cipherSafe'
import { REQUEST_STATUSES, requestCategoryLabel, requestStatus } from '@/config/requests'
import type { RequestStatus } from '@/types/api'
import { jsonResponse } from './helpers'

async function sent(call: () => Promise<unknown>, response: Response = jsonResponse({})) {
  const fetchMock = vi.fn<typeof fetch>(async () => response)
  vi.stubGlobal('fetch', fetchMock)
  await call()
  const [url, init] = fetchMock.mock.calls[0]!
  return {
    url: String(url),
    method: init?.method,
    json: init?.body ? JSON.parse(String(init.body)) : undefined,
  }
}

describe('requestsApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('creates a request', async () => {
    const request = { owner: 'doctor', message: 'Check-up', category: 'DOCUMENT' as const }
    expect(await sent(() => requestsApi.create(request))).toEqual({
      url: '/api/access-requests/',
      method: 'POST',
      json: request,
    })
  })

  it('lists one box', async () => {
    const request = await sent(() => requestsApi.list('outgoing'), jsonResponse([]))
    expect(request.url).toBe('/api/access-requests/?box=outgoing')
    expect(request.method).toBe('GET')
  })

  it('denies and cancels', async () => {
    expect(await sent(() => requestsApi.deny(7))).toMatchObject({
      url: '/api/access-requests/7/deny/',
      method: 'POST',
    })
    const cancel = await sent(() => requestsApi.cancel(7), new Response(null, { status: 204 }))
    expect(cancel).toMatchObject({ url: '/api/access-requests/7/', method: 'DELETE' })
  })
})

describe('request status labels', () => {
  it('has a text label for every status', () => {
    const statuses: RequestStatus[] = ['PENDING', 'APPROVED', 'DENIED', 'CANCELLED', 'REVOKED']
    for (const status of statuses) expect(REQUEST_STATUSES[status].label).not.toBe('')
  })

  it('shows approved access that ran out as expired', () => {
    expect(requestStatus({ status: 'APPROVED', expired: false })).toEqual({
      label: 'Approved',
      tone: 'ok',
    })
    expect(requestStatus({ status: 'APPROVED', expired: true })).toEqual({
      label: 'Expired',
      tone: 'ended',
    })
  })

  it('names categories, including the profile and no hint', () => {
    expect(requestCategoryLabel('PROFILE')).toBe('Profile')
    expect(requestCategoryLabel('DOCUMENT')).toBe('Medical document')
    expect(requestCategoryLabel('')).toBe('Anything')
  })
})
