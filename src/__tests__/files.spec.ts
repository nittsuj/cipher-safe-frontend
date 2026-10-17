import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

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
