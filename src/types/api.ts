export const ALGORITHMS = ['AES', 'DES', 'RC4'] as const
/** Mode used by the server for each cipher (fixed; not chosen per upload). */
export const MODE_FOR: Record<(typeof ALGORITHMS)[number], string> = {
  AES: 'CTR',
  DES: 'CTR',
  RC4: '',
}
export const FILE_CATEGORIES = [
  { value: 'ID_CARD', label: 'Identity / insurance card (KTP, BPJS)' },
  { value: 'DOCUMENT', label: 'Medical document (lab result, referral, medication log)' },
  { value: 'VIDEO', label: 'Medical video (ultrasound, echo, endoscopy)' },
] as const

export type Algorithm = (typeof ALGORITHMS)[number]
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
  samples_ms: number[]
  min_ms: number
  max_ms: number
  mean_ms: number
}

/**
 * The patient profile. `health` marks UU PDP Art. 4(2) / GDPR Art. 9 health
 * data; everything is encrypted either way.
 */
export const PII_FIELDS: { name: string; label: string; type?: string; health?: boolean }[] = [
  { name: 'full_name', label: 'Full name' },
  { name: 'national_id', label: 'NIK (16 digits)' },
  { name: 'bpjs_number', label: 'BPJS Kesehatan number (13 digits)' },
  { name: 'date_of_birth', label: 'Date of birth', type: 'date' },
  { name: 'address', label: 'Address' },
  { name: 'phone', label: 'Phone' },
  { name: 'emergency_contact', label: 'Emergency contact' },
  { name: 'blood_type', label: 'Blood type (e.g. O+)', health: true },
  { name: 'allergies', label: 'Allergies', health: true },
  { name: 'chronic_conditions', label: 'Chronic conditions', health: true },
  { name: 'current_medications', label: 'Current medications', health: true },
]
