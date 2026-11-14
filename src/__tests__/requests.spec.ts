import { afterEach, describe, expect, it, vi } from 'vitest'

import { requestsApi } from '@/api/cipherSafe'
import {
  REQUEST_STATUSES,
  envelopeMessage,
  envelopeShareLinks,
  parseEnvelope,
  requestCategoryLabel,
  requestStatus,
} from '@/config/requests'
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

describe('requestsApi: approving and opening', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('approves with the chosen items and duration', async () => {
    const body = { file_ids: [3, 9], include_profile: true, expires_hours: 24 }
    expect(await sent(() => requestsApi.approve(7, body))).toEqual({
      url: '/api/access-requests/7/approve/',
      method: 'POST',
      json: body,
    })
  })

  it('shows an envelope again and redeems one', async () => {
    expect((await sent(() => requestsApi.envelope(7, 21))).url).toBe(
      '/api/access-requests/7/items/21/envelope/',
    )
    expect(await sent(() => requestsApi.redeem(7, 21, 'CSK1.7.21.abc'))).toEqual({
      url: '/api/access-requests/7/items/21/redeem/',
      method: 'POST',
      json: { envelope: 'CSK1.7.21.abc' },
    })
  })

  it('opens a record inline and revokes', async () => {
    const opened = await sent(() => requestsApi.openFile(7, 21), new Response('data'))
    expect(opened.url).toBe('/api/access-requests/7/items/21/?inline=1')
    const revoke = await sent(() => requestsApi.revoke(7), new Response(null, { status: 204 }))
    expect(revoke).toMatchObject({ url: '/api/access-requests/7/', method: 'DELETE' })
  })
})

describe('parseEnvelope', () => {
  it('reads the request and item ids', () => {
    expect(parseEnvelope('CSK1.7.21.Zm9v_bar-baz')).toEqual({ requestId: 7, itemId: 21 })
  })

  it('ignores spaces and line breaks from chat apps', () => {
    expect(parseEnvelope('  CSK1.7.21.Zm9v\nYmFy \r\n')).toEqual({ requestId: 7, itemId: 21 })
  })

  it('rejects anything else', () => {
    for (const text of [
      '',
      'hello',
      'CSK2.7.21.abc',
      'CSK1.x.21.abc',
      'CSK1.7.21.',
      'CSK1.7.21.a.b',
      'CSK1.7.21.a+b',
    ]) {
      expect(parseEnvelope(text)).toBeNull()
    }
  })
})

describe('sharing a key outside the app', () => {
  const envelope = 'CSK1.7.21.Zm9v_bar-baz'

  it('puts the whole envelope in the message', () => {
    const message = envelopeMessage('lab.pdf', envelope)
    expect(message).toContain('"lab.pdf"')
    expect(message.endsWith(envelope)).toBe(true)
  })

  it('builds WhatsApp and email links that carry the exact envelope', () => {
    const links = envelopeShareLinks('lab & scan.pdf', envelope)
    const whatsapp = new URL(links.whatsapp)
    expect(whatsapp.origin).toBe('https://wa.me')
    expect(whatsapp.searchParams.get('text')).toBe(envelopeMessage('lab & scan.pdf', envelope))

    expect(links.email.startsWith('mailto:?subject=')).toBe(true)
    const body = new URLSearchParams(links.email.slice('mailto:?'.length)).get('body')
    expect(body).toBe(envelopeMessage('lab & scan.pdf', envelope))
  })
})
