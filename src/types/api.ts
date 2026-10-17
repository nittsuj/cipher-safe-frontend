export const ALGORITHMS = ['AES', 'DES', 'RC4'] as const
export const MODES = ['CBC', 'CFB', 'OFB', 'CTR'] as const
export const FILE_CATEGORIES = [
  { value: 'ID_CARD', label: 'ID card image' },
  { value: 'DOCUMENT', label: 'PDF / DOC / XLS' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'OTHER', label: 'Other' },
] as const

export type Algorithm = (typeof ALGORITHMS)[number]
export type CipherMode = (typeof MODES)[number]
export type FileCategory = (typeof FILE_CATEGORIES)[number]['value']

/** Credentials attached to every request. Everything is held in memory only. */
export interface Credentials {
  access: string | null
  refresh: string | null
  password: string | null
}

export interface User {
  id: number
  username: string
  email: string
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
  supported_modes: CipherMode[]
  downloads: TimingRow[]
  encryptions: TimingRow[]
}

export interface BenchmarkResult {
  file: number
  algorithm: Algorithm
  mode: string
  runs: number
  ciphertext_size: number
  samples_ms: number[]
  min_ms: number
  max_ms: number
  mean_ms: number
}

export const PII_FIELDS: { name: string; label: string; type?: string }[] = [
  { name: 'full_name', label: 'Full name' },
  { name: 'national_id', label: 'National ID (NIK)' },
  { name: 'date_of_birth', label: 'Date of birth', type: 'date' },
  { name: 'address', label: 'Address' },
  { name: 'phone', label: 'Phone' },
  { name: 'email', label: 'Email', type: 'email' },
]
