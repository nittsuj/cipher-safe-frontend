export const ALGORITHMS = ['AES', 'DES', 'RC4'] as const

export type Role = 'PATIENT' | 'DOCTOR'

export type Algorithm = (typeof ALGORITHMS)[number]
export type FileCategory = 'ID_CARD' | 'DOCUMENT' | 'VIDEO'

/** Credentials attached to every request. Everything is held in memory only. */
export interface Credentials {
  access: string | null
  refresh: string | null
  password: string | null
}

export interface User {
  id: number
  username: string
  role: Role
  date_joined: string
}

export interface AuthResponse {
  user: User
  access: string
  refresh: string
}

export interface FileCiphertext {
  algorithm: Algorithm
  mode: string
  ciphertext_size: number
  key_derivation_ms: number
  cipher_ms: number
  mac_ms: number
  total_ms: number
}

export interface StoredFile {
  id: number
  category: FileCategory
  original_name: string
  content_type: string
  plaintext_size: number
  created_at: string
  ciphertexts: FileCiphertext[]
}

export interface PersonalData {
  algorithm?: Algorithm
  updated_at: string
  fields: Record<string, string>
}

export interface DownloadEvent {
  id: number
  file: number
  original_name: string
  algorithm: Algorithm
  success: boolean
  bytes_out: number
  key_derivation_ms: number
  cipher_ms: number
  mac_ms: number
  total_ms: number
  created_at: string
}

export interface TimingRow {
  algorithm: Algorithm
  runs?: number
  files?: number
  min_ms: number
  max_ms: number
  mean_ms: number
  mean_ciphertext_size?: number
}

export interface TimingAnalysis {
  supported_algorithms: Algorithm[]
  modes: Record<Algorithm, string>
  downloads: TimingRow[]
  encryptions: TimingRow[]
}

export interface BenchmarkResult {
  file: number
  algorithm: Algorithm
  mode: string
  runs: number
  ciphertext_size: number
  /** Full decrypt per run, including key setup. */
  samples_ms: number[]
  min_ms: number
  max_ms: number
  mean_ms: number
  /** Cipher + integrity check per run, without key setup. */
  cipher_samples_ms: number[]
  cipher_mean_ms: number
}

export interface FileShare {
  id: number
  file: number
  doctor: string
  created_at: string
  expires_at: string
  active: boolean
  access_count: number
  last_accessed_at: string | null
}

export interface CreatedShare extends FileShare {
  /** Shown once; the server does not keep it. */
  share_key: string
}

export interface ReceivedShare {
  id: number
  patient: string
  category: FileCategory
  plaintext_size: number
  created_at: string
  expires_at: string
  access_count: number
}

/** One bar in an algorithm comparison chart. */
export interface BarRow {
  algorithm: Algorithm
  value: number
  /** Extra values for the tooltip and table view (e.g. min / max). */
  details?: { label: string; value: string }[]
}
