import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useAuthStore } from '../stores/auth'
import { jsonResponse } from './helpers'

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('stores the tokens, user and password in memory on login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>(async () =>
        jsonResponse({
          user: { id: 1, username: 'alice', email: '', date_joined: '2026-01-01T00:00:00Z' },
          access: 'acc-123',
          refresh: 'ref-123',
        }),
      ),
    )

    const auth = useAuthStore()
    await auth.login('alice', 'SuperSecret123!')

    expect(auth.access).toBe('acc-123')
    expect(auth.refresh).toBe('ref-123')
    expect(auth.user?.username).toBe('alice')
    expect(auth.password).toBe('SuperSecret123!')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.credentials).toEqual({
      access: 'acc-123',
      refresh: 'ref-123',
      password: 'SuperSecret123!',
    })
    vi.unstubAllGlobals()
  })

  it('sends the Bearer and X-Cipher-Password headers on crypto calls', async () => {
    const fetchMock = vi.fn<() => Promise<Response>>(async () =>
      jsonResponse({ algorithm: 'AES', updated_at: '', fields: {} }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const auth = useAuthStore()
    auth.access = 'acc-123'
    auth.password = 'SuperSecret123!'

    const { personalDataApi } = await import('../api/cipherSafe')
    await personalDataApi.get('AES')

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer acc-123')
    expect(headers['X-Cipher-Password']).toBe('SuperSecret123!')
    vi.unstubAllGlobals()
  })

  it('refreshes the access token on a 401 and retries the request once', async () => {
    const fetchMock = vi.fn<() => Promise<Response>>()
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ access: 'acc-456', refresh: 'ref-456' }))
      .mockResolvedValueOnce(jsonResponse({ algorithm: 'AES', updated_at: '', fields: {} }))
    vi.stubGlobal('fetch', fetchMock)

    const auth = useAuthStore()
    auth.access = 'acc-123'
    auth.refresh = 'ref-123'
    auth.password = 'SuperSecret123!'

    const { personalDataApi } = await import('../api/cipherSafe')
    await personalDataApi.get('AES')

    expect(auth.access).toBe('acc-456')
    expect(auth.refresh).toBe('ref-456')
    const [, retryInit] = fetchMock.mock.calls[2] as unknown as [string, RequestInit]
    expect((retryInit.headers as Record<string, string>)['Authorization']).toBe('Bearer acc-456')
    vi.unstubAllGlobals()
  })

  it('clears the session on logout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>(async () => new Response(null, { status: 204 })),
    )

    const auth = useAuthStore()
    auth.access = 'acc-123'
    auth.refresh = 'ref-123'
    auth.password = 'SuperSecret123!'
    auth.user = { id: 1, username: 'alice', email: '', date_joined: '' }

    await auth.logout()

    expect(auth.access).toBeNull()
    expect(auth.refresh).toBeNull()
    expect(auth.password).toBeNull()
    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    vi.unstubAllGlobals()
  })
})
