/**
 * In-memory stand-in for the Django backend, used only by the MSW mock mode
 * (`npm run dev:mock`). Nothing here is real cryptography: "ciphertext" is the
 * plaintext XOR-ed with a pseudo-random keystream so it looks like noise, and
 * timings are synthetic. State lives in memory and resets on page reload.
 */
import type {
  AccessRequest,
  Algorithm,
  DownloadEvent,
  FileCategory,
  FileCiphertext,
  KeyPair,
  KeyPurpose,
  Role,
  StoredFile,
} from '@/types/api'
import { ALGORITHMS } from '@/types/api'

/** Mode the backend uses for each cipher (core.crypto.MODE_FOR). */
export const MODE_FOR: Record<Algorithm, string> = { AES: 'GCM', DES: 'CTR', RC4: '' }

export interface MockUser {
  id: number
  username: string
  password: string
  role: Role
  date_joined: string
}

export interface MockFile {
  id: number
  owner: number
  category: FileCategory
  name: string
  contentType: string
  data: Uint8Array
  created_at: string
  ciphertexts: FileCiphertext[]
}

export interface MockRequest extends Omit<
  AccessRequest,
  'requester' | 'owner' | 'expired' | 'items'
> {
  requester: number
  owner: number
}

export interface MockGrant {
  id: number
  request: number
  kind: 'FILE' | 'PROFILE'
  /** The record id for a FILE item. */
  file: number | null
  /** Profile fields at approval time, for a PROFILE item. */
  snapshot: Record<string, string> | null
  /** What the owner sends. In the real API it holds the item key encrypted for the requester. */
  envelope: string
  redeemed: boolean
  access_count: number
}

export interface MockProfile {
  fields: Record<string, string>
  updated_at: string
}

let nextId = 1
const id = () => nextId++
const now = () => new Date().toISOString()

export const db = {
  users: [] as MockUser[],
  files: [] as MockFile[],
  downloads: [] as (DownloadEvent & { owner: number })[],
  /** Active key pair per user and purpose; rotated pairs are dropped (no data uses them here). */
  keyPairs: new Map<string, KeyPair>(),
  /** Access requests, newest first. `requester` / `owner` are user ids. */
  requests: [] as MockRequest[],
  /** Items granted on approved requests. */
  grants: [] as MockGrant[],
  profiles: new Map<number, MockProfile>(),
  /** access/refresh token -> user id */
  tokens: new Map<string, number>(),
}

// ---------------------------------------------------------------- helpers

/** Random value in [min, max), rounded to 3 decimals like the backend. */
function between(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 1000) / 1000
}

/** Rough per-MB cipher cost, so the charts keep the expected ordering. */
const CIPHER_MS_PER_MB: Record<Algorithm, number> = { AES: 4, DES: 28, RC4: 9 }

/** Synthetic timings: PBKDF2 (600k rounds) dominates, cipher scales with size. */
export function fakeTimings(algorithm: Algorithm, size: number) {
  const mb = Math.max(size, 1) / 1_048_576
  const key_derivation_ms = between(280, 420)
  const cipher_ms =
    Math.round((CIPHER_MS_PER_MB[algorithm] * mb + between(0.05, 0.4)) * 1000) / 1000
  // AES-GCM authenticates inside the cipher; DES and RC4 pay for an HMAC.
  const mac_ms = algorithm === 'AES' ? 0 : Math.round((1.5 * mb + between(0.02, 0.1)) * 1000) / 1000
  return {
    key_derivation_ms,
    cipher_ms,
    mac_ms,
    total_ms: Math.round((key_derivation_ms + cipher_ms + mac_ms) * 1000) / 1000,
  }
}

/** Looks-random bytes standing in for a ciphertext (NOT encryption). */
export function scramble(data: Uint8Array, algorithm: Algorithm): Uint8Array {
  let state = algorithm.charCodeAt(0) * 2654435761
  const out = new Uint8Array(data.length + (algorithm === 'AES' ? 16 : 0))
  for (let i = 0; i < out.length; i++) {
    state = (state * 1103515245 + 12345) >>> 0
    out[i] = ((data[i] ?? 0) ^ (state >>> 16)) & 0xff
  }
  return out
}

export function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ------------------------------------------------------------- operations

export function createUser(username: string, password: string, role: Role): MockUser {
  const user = { id: id(), username, password, role, date_joined: now() }
  db.users.push(user)
  return user
}

export function issueTokens(user: MockUser) {
  const access = `mock-access-${user.id}-${randomKey()}`
  const refresh = `mock-refresh-${user.id}-${randomKey()}`
  db.tokens.set(access, user.id)
  db.tokens.set(refresh, user.id)
  return { access, refresh }
}

export function addFile(
  owner: number,
  category: FileCategory,
  name: string,
  contentType: string,
  data: Uint8Array,
): MockFile {
  const file: MockFile = {
    id: id(),
    owner,
    category,
    name,
    contentType,
    data,
    created_at: now(),
    ciphertexts: ALGORITHMS.map((algorithm) => ({
      algorithm,
      mode: MODE_FOR[algorithm],
      ciphertext_size: data.length + (algorithm === 'AES' ? 16 : 0),
      ...fakeTimings(algorithm, data.length),
    })),
  }
  db.files.unshift(file)
  return file
}

export function serializeFile(file: MockFile): StoredFile {
  return {
    id: file.id,
    category: file.category,
    original_name: file.name,
    content_type: file.contentType,
    plaintext_size: file.data.length,
    created_at: file.created_at,
    ciphertexts: file.ciphertexts,
  }
}

export function logDownload(file: MockFile, algorithm: Algorithm) {
  const timings = fakeTimings(algorithm, file.data.length)
  db.downloads.unshift({
    id: id(),
    owner: file.owner,
    file: file.id,
    original_name: file.name,
    algorithm,
    success: true,
    bytes_out: file.data.length,
    ...timings,
    created_at: now(),
  })
  return timings
}

const keyPairId = (userId: number, purpose: KeyPurpose) => `${userId}:${purpose}`

export function activeKeyPair(userId: number, purpose: KeyPurpose): KeyPair | undefined {
  return db.keyPairs.get(keyPairId(userId, purpose))
}

/** A fake RSA-3072 pair: random fingerprint and a placeholder PEM. No real keys. */
export function createKeyPair(userId: number, purpose: KeyPurpose): KeyPair {
  const digest = crypto.getRandomValues(new Uint8Array(32))
  const pair: KeyPair = {
    purpose,
    algorithm: 'RSA-3072',
    fingerprint: Array.from(digest, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':'),
    public_key_pem: `-----BEGIN PUBLIC KEY-----\n${randomKey()}${randomKey()}\n-----END PUBLIC KEY-----\n`,
    has_certificate: false,
    created_at: now(),
  }
  db.keyPairs.set(keyPairId(userId, purpose), pair)
  return pair
}

export function addRequest(
  requester: MockUser,
  owner: MockUser,
  message: string,
  category: MockRequest['category'],
): MockRequest {
  const request: MockRequest = {
    id: id(),
    requester: requester.id,
    owner: owner.id,
    message,
    category,
    status: 'PENDING',
    created_at: now(),
    decided_at: null,
    expires_at: null,
  }
  db.requests.unshift(request)
  return request
}

export function serializeRequest(request: MockRequest): AccessRequest {
  const name = (userId: number) => db.users.find((u) => u.id === userId)?.username ?? '?'
  return {
    ...request,
    requester: name(request.requester),
    owner: name(request.owner),
    expired: request.expires_at !== null && new Date(request.expires_at) <= new Date(),
    items: db.grants
      .filter((g) => g.request === request.id)
      .map((g) => ({
        item_id: g.id,
        kind: g.kind,
        category: db.files.find((f) => f.id === g.file)?.category ?? null,
        redeemed: g.redeemed,
        access_count: g.access_count,
      })),
  }
}

/** A fake envelope: same `CSK1.<request>.<item>.<key>` shape and length as the real one. */
function fakeEnvelope(requestId: number, itemId: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(384)) // an RSA-3072 ciphertext's size
  const key = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `CSK1.${requestId}.${itemId}.${key}`
}

export function addGrant(request: MockRequest, file: MockFile | null): MockGrant {
  const itemId = id()
  const grant: MockGrant = {
    id: itemId,
    request: request.id,
    kind: file ? 'FILE' : 'PROFILE',
    file: file?.id ?? null,
    snapshot: file ? null : { ...(db.profiles.get(request.owner)?.fields ?? {}) },
    envelope: fakeEnvelope(request.id, itemId),
    redeemed: false,
    access_count: 0,
  }
  db.grants.push(grant)
  return grant
}

// ------------------------------------------------------------------- seed

export const DEMO_PATIENT = { username: 'patient', password: 'patient-password' }
export const DEMO_DOCTOR = { username: 'doctor', password: 'doctor-password' }

function seed() {
  const patient = createUser(DEMO_PATIENT.username, DEMO_PATIENT.password, 'PATIENT')
  const doctor = createUser(DEMO_DOCTOR.username, DEMO_DOCTOR.password, 'DOCTOR')
  // The demo doctor already has an encryption key, like after a first sign-in.
  createKeyPair(doctor.id, 'ENCRYPTION')
  // An incoming request waiting for the demo patient, so the Requests page isn't empty.
  addRequest(doctor, patient, 'Your latest lab results, for the check-up on Monday.', 'DOCUMENT')

  db.profiles.set(patient.id, {
    updated_at: now(),
    fields: {
      full_name: 'Siti Rahmawati',
      date_of_birth: '1990-04-12',
      national_id: '3171234567890001',
      bpjs_number: '0001234567890',
      phone: '081234567890',
      emergency_contact: 'Budi (husband) 081298765432',
      address: 'Jl. Melati No. 5, Jakarta Selatan',
      blood_type: 'O+',
      allergies: 'Penicillin',
      chronic_conditions: 'Type 2 diabetes',
      current_medications: 'Metformin 500 mg, twice daily',
    },
  })

  const text = (s: string) => new TextEncoder().encode(s)
  addFile(
    patient.id,
    'DOCUMENT',
    'lab-result-hba1c.txt',
    'text/plain',
    text(
      'Laboratorium Klinik\nPatient: Siti Rahmawati\nHbA1c: 7.1 %\nFasting glucose: 132 mg/dL\n',
    ),
  )
  addFile(
    patient.id,
    'DOCUMENT',
    'referral-letter.txt',
    'text/plain',
    text(
      'Puskesmas Kebayoran\nReferral to: RSUD Pasar Minggu, internal medicine\nReason: diabetes follow-up\n',
    ),
  )
}

seed()
