import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { filesApi } from '../api/cipherSafe'
import { isPdf } from '../config/records'
import { useFilesStore } from '../stores/files'
import type { StoredFile } from '../types/api'
import { jsonResponse } from './helpers'

const sampleFile: StoredFile = {
  id: 1,
  category: 'DOCUMENT',
  original_name: 'report.pdf',
  content_type: 'application/pdf',
  plaintext_size: 100,
  created_at: '2026-01-01T00:00:00Z',
  ciphertexts: [],
  signed: false,
  signed_at: null,
}

describe('files store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('loads the file list', async () => {
    vi.stubGlobal('fetch', vi.fn<() => Promise<Response>>(async () => jsonResponse([sampleFile])))

    const store = useFilesStore()
    await store.load()

    expect(store.items).toHaveLength(1)
    expect(store.items[0]?.original_name).toBe('report.pdf')
    expect(store.error).toBe('')
    vi.unstubAllGlobals()
  })

  it('records an error message when loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>(async () =>
        jsonResponse({ detail: 'Boom' }, 500),
      ),
    )

    const store = useFilesStore()
    await store.load()

    expect(store.items).toHaveLength(0)
    expect(store.error).toBe('Boom')
    vi.unstubAllGlobals()
  })

  it('removes a file from the list', async () => {
    vi.stubGlobal('fetch', vi.fn<() => Promise<Response>>(async () => new Response(null, { status: 204 })))

    const store = useFilesStore()
    store.items = [sampleFile]
    const ok = await store.remove(1)

    expect(ok).toBe(true)
    expect(store.items).toHaveLength(0)
    vi.unstubAllGlobals()
  })
})

describe('signing PDFs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  async function formSent(sign: boolean) {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse(sampleFile, 201),
    )
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['%PDF-1.7'], 'report.pdf', { type: 'application/pdf' })
    await filesApi.upload(file, 'DOCUMENT', { sign })
    vi.unstubAllGlobals()
    return fetchMock.mock.calls[0]![1]!.body as FormData
  }

  it('sends sign=true only when signing was asked for', async () => {
    expect((await formSent(true)).get('sign')).toBe('true')
    expect((await formSent(false)).has('sign')).toBe(false)
  })

  it('signs a stored PDF and updates it in the list', async () => {
    const signed = { ...sampleFile, signed: true, signed_at: '2026-01-02T00:00:00Z' }
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse(signed),
    )
    vi.stubGlobal('fetch', fetchMock)
    const store = useFilesStore()
    store.items = [sampleFile]
    await store.sign(1)
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/files/1/sign/')
    expect(fetchMock.mock.calls[0]![1]!.method).toBe('POST')
    expect(store.items[0]!.signed).toBe(true)
    vi.unstubAllGlobals()
  })

  it('recognises PDFs by type or name', () => {
    expect(isPdf({ type: 'application/pdf', name: 'a' })).toBe(true)
    expect(isPdf({ type: '', name: 'Lab Result.PDF' })).toBe(true)
    expect(isPdf({ type: 'image/png', name: 'scan.png' })).toBe(false)
    expect(isPdf(null)).toBe(false)
  })
})
