export const ALGORITHMS = ['AES', 'DES', 'RC4'] as const
export const FILE_CATEGORIES = [
  { value: 'ID_CARD', label: 'ID & insurance', hint: 'KTP, BPJS card' },
  { value: 'DOCUMENT', label: 'Medical document', hint: 'Lab result, referral, medication log' },
  { value: 'VIDEO', label: 'Medical video', hint: 'Ultrasound, echo, endoscopy' },
] as const

export type Role = 'PATIENT' | 'DOCTOR'

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

/**
 * The patient profile. `health` marks UU PDP Art. 4(2) / GDPR Art. 9 health
 * data; everything is encrypted either way.
 */
export interface ProfileField {
  name: string
  label: string
  kind?: 'text' | 'date' | 'textarea' | 'blood' | 'digits' | 'tel'
  digits?: number
  placeholder?: string
  health?: boolean
}

export const PROFILE_GROUPS: { title: string; health?: boolean; fields: ProfileField[] }[] = [
  {
    title: 'Identity',
    fields: [
      { name: 'full_name', label: 'Full name' },
      { name: 'date_of_birth', label: 'Date of birth', kind: 'date' },
      { name: 'national_id', label: 'NIK', kind: 'digits', digits: 16 },
      { name: 'bpjs_number', label: 'BPJS Kesehatan number', kind: 'digits', digits: 13 },
    ],
  },
  {
    title: 'Contact',
    fields: [
      { name: 'phone', label: 'Phone', kind: 'tel', placeholder: '08xx' },
      { name: 'emergency_contact', label: 'Emergency contact', placeholder: 'Name and phone' },
      { name: 'address', label: 'Address', kind: 'textarea' },
    ],
  },
  {
    title: 'Medical',
    health: true,
    fields: [
      { name: 'blood_type', label: 'Blood type', kind: 'blood', health: true },
      { name: 'allergies', label: 'Allergies', kind: 'textarea', placeholder: 'e.g. penicillin', health: true },
      { name: 'chronic_conditions', label: 'Chronic conditions', kind: 'textarea', health: true },
      { name: 'current_medications', label: 'Current medications', kind: 'textarea', health: true },
    ],
  },
]

export const PII_FIELDS: ProfileField[] = PROFILE_GROUPS.flatMap((group) => group.fields)

/** Types the browser may render in the preview. Anything else (HTML, SVG...)
 * could run script, so it is offered as a download only. */
export const PREVIEWABLE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'text/plain',
] as const

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

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

/** One bar in an algorithm comparison chart. */
export interface BarRow {
  algorithm: Algorithm
  value: number
  /** Extra values for the tooltip and table view (e.g. min / max). */
  details?: { label: string; value: string }[]
}
