export const ALGORITHMS = ['AES', 'DES', 'RC4'] as const

export type Role = 'PATIENT' | 'DOCTOR'

export type Algorithm = (typeof ALGORITHMS)[number]
export type FileCategory = 'ID_CARD' | 'DOCUMENT' | 'VIDEO'

/** Where an access request is in its life. Expiry is the separate `expired` flag. */
export type RequestStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED' | 'REVOKED'

/** What a requester may hint at: a record category, or the profile. */
export type RequestCategory = FileCategory | 'PROFILE'

/** What a key pair is for: receiving shared-record keys, or signing PDFs. */
export type KeyPurpose = 'ENCRYPTION' | 'SIGNING'

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

/** One bar in an algorithm comparison chart. */
export interface BarRow {
  algorithm: Algorithm
  value: number
  /** Extra values for the tooltip and table view (e.g. min / max). */
  details?: { label: string; value: string }[]
}

/** One of my RSA key pairs. Only public parts; the private key never leaves the server. */
export interface KeyPair {
  purpose: KeyPurpose
  algorithm: string
  /** SHA-256 of the public key, `AB:CD:...`. */
  fingerprint: string
  public_key_pem: string
  has_certificate: boolean
  created_at: string
}

/** Another user's public key, as anyone signed in may look it up. */
export interface PublicKey {
  username: string
  purpose: KeyPurpose
  algorithm: string
  fingerprint: string
  public_key_pem: string
}

/** One user asking for another user's data. Says nothing about the owner's records. */
export interface AccessRequest {
  id: number
  requester: string
  owner: string
  message: string
  /** Empty string when no hint was given. */
  category: RequestCategory | ''
  status: RequestStatus
  created_at: string
  decided_at: string | null
  expires_at: string | null
  expired: boolean
  /** What was granted; empty until approved and after revocation. Never names or content. */
  items: GrantedItemSummary[]
}

export type GrantKind = 'FILE' | 'PROFILE'

export interface GrantedItemSummary {
  item_id: number
  kind: GrantKind
  /** Record category; `null` for a profile snapshot. */
  category: FileCategory | null
  redeemed: boolean
  access_count: number
}

export interface ApproveRequestBody {
  file_ids: number[]
  include_profile: boolean
  expires_hours: number
}

/** One granted item and its envelope: the item key, encrypted for the requester. */
export interface GrantedEnvelope {
  item_id: number
  kind: GrantKind
  /** The granted record; `null` for the profile. */
  file_id: number | null
  category: FileCategory | null
  envelope: string
}

export interface ApproveResult {
  request: AccessRequest
  /** The requester's encryption-key fingerprint, to compare with them. */
  recipient_fingerprint: string
  items: GrantedEnvelope[]
}

export interface EnvelopeAgain {
  item_id: number
  kind: GrantKind
  envelope: string
  recipient_fingerprint: string
}

export interface NewAccessRequest {
  owner: string
  message?: string
  category?: RequestCategory | ''
}

export type RequestBox = 'incoming' | 'outgoing'
