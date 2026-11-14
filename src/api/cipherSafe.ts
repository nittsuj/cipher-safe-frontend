import type {
  AccessRequest,
  ApproveRequestBody,
  ApproveResult,
  Algorithm,
  AuthResponse,
  BenchmarkResult,
  RequestBox,
  Role,
  DownloadEvent,
  EnvelopeAgain,
  FileCategory,
  KeyPair,
  KeyPurpose,
  NewAccessRequest,
  PersonalData,
  PublicKey,
  StoredFile,
  TimingAnalysis,
  User,
} from '@/types/api'
import { requestBlob, requestJson, withQuery } from './client'

// Credentials are injected globally by the auth store (see api/client.ts), so
// these wrappers stay free of auth plumbing.

export const authApi = {
  register(username: string, password: string, role: Role = 'PATIENT'): Promise<AuthResponse> {
    return requestJson<AuthResponse>('/api/auth/register/', {
      method: 'POST',
      json: { username, password, role },
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

  /** Upload a record; with `sign` a PDF is signed with my signing key before it is encrypted. */
  upload(
    file: File,
    category: FileCategory,
    options: { sign?: boolean } = {},
  ): Promise<StoredFile> {
    const form = new FormData()
    form.append('file', file)
    form.append('category', category)
    if (options.sign) form.append('sign', 'true')
    return requestJson<StoredFile>('/api/files/', { method: 'POST', form })
  },

  /** Sign a stored PDF; every encrypted copy is replaced by the signed file. */
  sign(id: number): Promise<StoredFile> {
    return requestJson<StoredFile>(`/api/files/${id}/sign/`, { method: 'POST' })
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

  /** Decrypted bytes served inline, for the in-browser preview. */
  preview(id: number, algorithm: Algorithm = 'AES'): Promise<{ blob: Blob; filename: string | null }> {
    return requestBlob(withQuery(`/api/files/${id}/download/`, { algorithm, inline: 1 }))
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

export const keysApi = {
  /** My active key pairs. */
  list(): Promise<KeyPair[]> {
    return requestJson<KeyPair[]>('/api/me/keys/')
  },

  /** Return my pair for `purpose`, generating it the first time. Needs the password. */
  ensure(purpose: KeyPurpose): Promise<KeyPair> {
    return requestJson<KeyPair>('/api/me/keys/', {
      method: 'POST',
      json: { purpose, rotate: false },
    })
  },

  /** Replace my pair for `purpose` with a new one; the old one keeps working for keys already sent. */
  rotate(purpose: KeyPurpose): Promise<KeyPair> {
    return requestJson<KeyPair>('/api/me/keys/', {
      method: 'POST',
      json: { purpose, rotate: true },
    })
  },

  /** Someone else's public key (404 if they have none yet). */
  publicKey(username: string, purpose: KeyPurpose = 'ENCRYPTION'): Promise<PublicKey> {
    return requestJson<PublicKey>(
      withQuery(`/api/users/${encodeURIComponent(username)}/public-key/`, { purpose }),
    )
  },
}

export const requestsApi = {
  /** Ask a user for their data. No password needed: nothing is decrypted. */
  create(request: NewAccessRequest): Promise<AccessRequest> {
    return requestJson<AccessRequest>('/api/access-requests/', { method: 'POST', json: request })
  },

  /** Requests to me (`incoming`) or from me (`outgoing`), newest first. */
  list(box: RequestBox): Promise<AccessRequest[]> {
    return requestJson<AccessRequest[]>(withQuery('/api/access-requests/', { box }))
  },

  /** As the owner: refuse a pending request. */
  deny(id: number): Promise<AccessRequest> {
    return requestJson<AccessRequest>(`/api/access-requests/${id}/deny/`, { method: 'POST' })
  },

  /** As the requester: withdraw a pending request. */
  cancel(id: number): Promise<void> {
    return requestJson<void>(`/api/access-requests/${id}/`, { method: 'DELETE' })
  },

  /** As the owner: grant records and/or the profile. Returns one envelope per item. */
  approve(id: number, body: ApproveRequestBody): Promise<ApproveResult> {
    return requestJson<ApproveResult>(`/api/access-requests/${id}/approve/`, {
      method: 'POST',
      json: body,
    })
  },

  /** As the owner: the same envelope again, to resend it. */
  envelope(id: number, itemId: number): Promise<EnvelopeAgain> {
    return requestJson<EnvelopeAgain>(`/api/access-requests/${id}/items/${itemId}/envelope/`)
  },

  /** As the requester: enter the envelope the owner sent. */
  redeem(id: number, itemId: number, envelope: string): Promise<void> {
    return requestJson<void>(`/api/access-requests/${id}/items/${itemId}/redeem/`, {
      method: 'POST',
      json: { envelope },
    })
  },

  /** As the requester: a redeemed record, for preview. */
  openFile(id: number, itemId: number): Promise<{ blob: Blob; filename: string | null }> {
    return requestBlob(withQuery(`/api/access-requests/${id}/items/${itemId}/`, { inline: 1 }))
  },

  /** As the requester: a redeemed profile snapshot. */
  openProfile(id: number, itemId: number): Promise<Record<string, string>> {
    return requestJson<Record<string, string>>(`/api/access-requests/${id}/items/${itemId}/`)
  },

  /** As the owner: end approved access; every shared copy and key is deleted. */
  revoke(id: number): Promise<void> {
    return requestJson<void>(`/api/access-requests/${id}/`, { method: 'DELETE' })
  },
}
