import { ref } from 'vue'
import { defineStore } from 'pinia'

import { filesApi } from '@/api/cipherSafe'
import { getErrorMessage } from '@/api/client'
import type { Algorithm, BenchmarkResult, FileCategory, StoredFile } from '@/types/api'

/**
 * Owns the file domain: the list, per-file benchmark results and the state of
 * the in-flight operation. Views stay presentational and just call actions.
 */
export const useFilesStore = defineStore('files', () => {
  const items = ref<StoredFile[]>([])
  const benchmarks = ref<Record<number, BenchmarkResult>>({})
  const loading = ref(false)
  const uploading = ref(false)
  const busyFileId = ref<number | null>(null)
  const error = ref('')

  /** Run an action, clearing the previous error and mapping failures to a message. */
  async function run<T>(fallback: string, action: () => Promise<T>): Promise<T | undefined> {
    error.value = ''
    try {
      return await action()
    } catch (err) {
      error.value = getErrorMessage(err, fallback)
      return undefined
    }
  }

  async function load(): Promise<void> {
    loading.value = true
    try {
      await run('Could not load files.', async () => {
        items.value = await filesApi.list()
      })
    } finally {
      loading.value = false
    }
  }

  async function upload(
    file: File,
    category: FileCategory,
  ): Promise<StoredFile | undefined> {
    uploading.value = true
    try {
      return await run('Upload failed.', async () => {
        const created = await filesApi.upload(file, category)
        await load()
        return created
      })
    } finally {
      uploading.value = false
    }
  }

  async function remove(id: number): Promise<boolean> {
    const removed = await run('Delete failed.', async () => {
      await filesApi.remove(id)
      delete benchmarks.value[id]
      items.value = items.value.filter((file) => file.id !== id)
      return true
    })
    return removed ?? false
  }

  async function benchmark(id: number, algorithm: Algorithm, runs = 10): Promise<void> {
    busyFileId.value = id
    try {
      await run('Benchmark failed.', async () => {
        benchmarks.value[id] = await filesApi.benchmark(id, algorithm, runs)
      })
    } finally {
      busyFileId.value = null
    }
  }

  function download(id: number, algorithm: Algorithm) {
    busyFileId.value = id
    return run('Download failed.', () => filesApi.download(id, algorithm)).finally(() => {
      busyFileId.value = null
    })
  }

  function downloadCiphertext(id: number, algorithm: Algorithm) {
    busyFileId.value = id
    return run('Download failed.', () => filesApi.downloadCiphertext(id, algorithm)).finally(() => {
      busyFileId.value = null
    })
  }

  return {
    items,
    benchmarks,
    loading,
    uploading,
    busyFileId,
    error,
    load,
    upload,
    remove,
    benchmark,
    download,
    downloadCiphertext,
  }
})
