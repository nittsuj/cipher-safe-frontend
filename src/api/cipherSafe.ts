import type {
  Algorithm,
  AuthResponse,
  BenchmarkResult,
  DownloadEvent,
  FileCategory,
  PersonalData,
  StoredFile,
  TimingAnalysis,
  User,
} from '@/types/api'
import { requestBlob, requestJson, withQuery } from './client'

// Credentials are injected globally by the auth store (see api/client.ts), so
// these wrappers stay free of auth plumbing.

export const authApi = {
  register(username: string, password: string): Promise<AuthResponse> {
    return requestJson<AuthResponse>('/api/auth/register/', {
      method: 'POST',
      json: { username, password },
      noAuth: true,
    })
  },

  login(username: string, password: string): Promise<AuthResponse> {
    return requestJson<AuthResponse>('/api/auth/login/', {
      method: 'POST',
      json: { username, password },
      noAuth: true,
    })
  },

  refresh(refresh: string): Promise<{ access: string; refresh: string }> {
    return requestJson<{ access: string; refresh: string }>('/api/auth/refresh/', {
      method: 'POST',
      json: { refresh },
      noAuth: true,
    })
  },

  logout(refresh: string): Promise<void> {
    return requestJson<void>('/api/auth/logout/', { method: 'POST', json: { refresh } })
  },

  me(): Promise<User> {
    return requestJson<User>('/api/me/')
  },
}

export const personalDataApi = {
  get(algorithm: Algorithm): Promise<PersonalData> {
    return requestJson<PersonalData>(withQuery('/api/me/personal-data/', { algorithm }))
  },

  update(fields: Record<string, string>): Promise<PersonalData> {
    return requestJson<PersonalData>('/api/me/personal-data/', { method: 'PUT', json: fields })
  },
}

export const filesApi = {
  list(category?: FileCategory): Promise<StoredFile[]> {
    return requestJson<StoredFile[]>(withQuery('/api/files/', { category }))
  },

  get(id: number): Promise<StoredFile> {
    return requestJson<StoredFile>(`/api/files/${id}/`)
  },

  upload(file: File, category: FileCategory): Promise<StoredFile> {
    const form = new FormData()
    form.append('file', file)
    form.append('category', category)
    return requestJson<StoredFile>('/api/files/', { method: 'POST', form })
  },

  remove(id: number): Promise<void> {
    return requestJson<void>(`/api/files/${id}/`, { method: 'DELETE' })
  },

  download(
    id: number,
    algorithm: Algorithm,
  ): Promise<{ blob: Blob; filename: string | null }> {
    return requestBlob(withQuery(`/api/files/${id}/download/`, { algorithm }))
  },

  /** The stored copy as-is (ciphertext), to show that it is encrypted. */
  downloadCiphertext(
    id: number,
    algorithm: Algorithm,
  ): Promise<{ blob: Blob; filename: string | null }> {
    return requestBlob(withQuery(`/api/files/${id}/ciphertext/`, { algorithm }))
  },

  benchmark(id: number, algorithm: Algorithm, runs: number): Promise<BenchmarkResult> {
    return requestJson<BenchmarkResult>(
      withQuery(`/api/files/${id}/benchmark/`, { algorithm, runs }),
    )
  },
}

export const analysisApi = {
  timings(): Promise<TimingAnalysis> {
    return requestJson<TimingAnalysis>('/api/analysis/timings/')
  },

  downloads(): Promise<DownloadEvent[]> {
    return requestJson<DownloadEvent[]>('/api/analysis/downloads/')
  },
}
