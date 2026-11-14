import { afterEach, describe, expect, it, vi } from 'vitest'

import { keysApi } from '@/api/cipherSafe'
import type { KeyPair } from '@/types/api'
import { jsonResponse } from './helpers'

const pair: KeyPair = {
  purpose: 'ENCRYPTION',
  algorithm: 'RSA-3072',
  fingerprint: '3F:A1:00:FF',
  public_key_pem: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n',
  has_certificate: false,
  created_at: '2026-11-14T00:00:00Z',
}

/** Stub fetch, run `call`, and return the URL, method and parsed body it sent. */
async function sent(call: () => Promise<unknown>, body: unknown = pair) {
  const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(body))
  vi.stubGlobal('fetch', fetchMock)
  await call()
  const [url, init] = fetchMock.mock.calls[0]!
  return {
    url: String(url),
    method: init?.method,
    json: init?.body ? JSON.parse(String(init.body)) : undefined,
  }
}

describe('keysApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists my keys', async () => {
    expect(await sent(() => keysApi.list(), [pair])).toEqual({
      url: '/api/me/keys/',
      method: 'GET',
      json: undefined,
    })
  })

  it('ensures a key without rotating', async () => {
    expect(await sent(() => keysApi.ensure('ENCRYPTION'))).toEqual({
      url: '/api/me/keys/',
      method: 'POST',
      json: { purpose: 'ENCRYPTION', rotate: false },
    })
  })

  it('rotates a key', async () => {
    expect((await sent(() => keysApi.rotate('SIGNING'))).json).toEqual({
      purpose: 'SIGNING',
      rotate: true,
    })
  })

  it('looks up a public key, encoding the username', async () => {
    const request = await sent(() => keysApi.publicKey('dr ana'))
    expect(request.url).toBe('/api/users/dr%20ana/public-key/?purpose=ENCRYPTION')
    expect(request.method).toBe('GET')
  })
})
