/**
 * MSW request handlers that mimic the Cipher Safe Django API closely enough to
 * click through every screen without a backend: same URLs, status codes,
 * error bodies and download headers. See `db.ts` for the (fake) data.
 */
import {
  delay,
  http,
  HttpResponse,
  type DefaultBodyType,
  type HttpResponseResolver,
  type StrictRequest,
} from 'msw'

import type { Algorithm, FileCategory, KeyPurpose, Role } from '@/types/api'
import { FILE_CATEGORIES, PREVIEWABLE_TYPES } from '@/config/records'
import { REQUEST_CATEGORIES } from '@/config/requests'
import { ALGORITHMS } from '@/types/api'
import {
  activeKeyPair,
  addRequest,
  addFile,
  addGrant,
  isSignablePdf,
  markSigned,
  createKeyPair,
  createUser,
  db,
  fakeTimings,
  issueTokens,
  logDownload,
  MODE_FOR,
  scramble,
  serializeFile,
  serializeRequest,
  signatureCheck,
  type MockGrant,
  type MockRequest,
  type MockUser,
} from './db'

/** Matches both same-origin `/api/...` and a `VITE_API_BASE` origin. */
const api = (path: string) => `*/api${path}`

type Req = StrictRequest<DefaultBodyType>

// ----------------------------------------------------------- error helpers

class HttpError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(String(body.detail ?? status))
  }
}

const detail = (status: number, message: string) => new HttpError(status, { detail: message })

/** Wrap a handler so thrown `HttpError`s become DRF-style JSON responses. */
function guard(resolver: HttpResponseResolver): HttpResponseResolver {
  return async (info) => {
    await delay(120) // feel like a network round trip
    try {
      return await resolver(info)
    } catch (error) {
      if (error instanceof HttpError) return HttpResponse.json(error.body, { status: error.status })
      throw error
    }
  }
}

// ------------------------------------------------------------ auth helpers

function currentUser(request: Req): MockUser {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/, '')
  const userId = token?.startsWith('mock-access-') ? db.tokens.get(token) : undefined
  const user = db.users.find((u) => u.id === userId)
  if (!user) throw detail(401, 'Authentication credentials were not provided.')
  return user
}

/** The user as the API returns it, without the password. */
function publicUser(user: MockUser) {
  return { id: user.id, username: user.username, role: user.role, date_joined: user.date_joined }
}

function requireRole(request: Req, role: Role): MockUser {
  const user = currentUser(request)
  if (user.role !== role) throw detail(403, 'You do not have permission to perform this action.')
  return user
}

/** Same rule as the backend: the cipher password must match the login password. */
function requirePassword(request: Req, user: MockUser): void {
  const password = request.headers.get('X-Cipher-Password')
  if (!password) throw new HttpError(400, { password: 'This operation requires the password.' })
  if (password !== user.password) throw detail(403, 'Incorrect password.')
}

function patientWithPassword(request: Req): MockUser {
  const user = requireRole(request, 'PATIENT')
  requirePassword(request, user)
  return user
}

function algorithmParam(request: Req): Algorithm {
  const value = (new URL(request.url).searchParams.get('algorithm') ?? 'AES').toUpperCase()
  if (!(ALGORITHMS as readonly string[]).includes(value)) {
    throw new HttpError(400, { algorithm: `Unsupported algorithm: ${value}` })
  }
  return value as Algorithm
}

function ownFile(user: MockUser, id: string | readonly string[] | undefined) {
  const file = db.files.find((f) => f.id === Number(id) && f.owner === user.id)
  if (!file) throw detail(404, 'No StoredFile matches the given query.')
  return file
}

const wantsInline = (request: Req) =>
  ['1', 'true'].includes(new URL(request.url).searchParams.get('inline') ?? '')

function contentDisposition(attachment: boolean, filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')
  return `${attachment ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=utf-8''${encodeURIComponent(filename)}`
}

/** Mirrors `file_response()` in core/views.py. */
function fileResponse(data: Uint8Array, contentType: string, filename: string, inline: boolean) {
  const previewable = inline && (PREVIEWABLE_TYPES as readonly string[]).includes(contentType)
  return new HttpResponse(data.slice().buffer as ArrayBuffer, {
    headers: {
      'Content-Type': previewable ? contentType : 'application/octet-stream',
      'Content-Disposition': contentDisposition(!previewable, filename),
      'X-Content-Type': contentType,
      'Cache-Control': 'no-store',
    },
  })
}

/** Mirrors `certificate_response()`: a `.cer` download, 404 without a signing key.
 * The bytes are a placeholder, not a real certificate. */
function certificateResponse(user: MockUser) {
  const pair = activeKeyPair(user.id, 'SIGNING')
  if (!pair) throw detail(404, 'No signing certificate yet.')
  const body = new TextEncoder().encode(
    `Mock certificate for ${user.username}\n${pair.fingerprint}\n`,
  )
  return new HttpResponse(body.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pkix-cert',
      'Content-Disposition': contentDisposition(true, `cipher-safe-${user.username}.cer`),
    },
  })
}

function stats(values: number[]) {
  return {
    min_ms: Math.min(...values),
    max_ms: Math.max(...values),
    mean_ms: values.reduce((a, b) => a + b, 0) / values.length,
  }
}

/** A request the user takes part in; anyone else gets 404, like the backend. */
function requestFor(user: MockUser, id: string | readonly string[] | undefined): MockRequest {
  const request = db.requests.find(
    (r) => r.id === Number(id) && (r.requester === user.id || r.owner === user.id),
  )
  if (!request) throw detail(404, 'No AccessRequest matches the given query.')
  return request
}

/** A request where the user is the owner: outsiders 404, the requester 403. */
function ownedRequest(user: MockUser, id: string | readonly string[] | undefined): MockRequest {
  const request = requestFor(user, id)
  if (request.owner !== user.id) throw detail(403, 'Only the owner can do this.')
  return request
}

/** An item of an approved, unexpired request; 404 otherwise, like the backend. */
function liveGrant(
  request: MockRequest,
  itemId: string | readonly string[] | undefined,
): MockGrant {
  const ended = request.expires_at !== null && new Date(request.expires_at) <= new Date()
  if (request.status !== 'APPROVED' || ended) throw detail(404, 'This access has ended.')
  const grant = db.grants.find((g) => g.id === Number(itemId) && g.request === request.id)
  if (!grant) throw detail(404, 'Not found.')
  return grant
}

/** Same rule as the backend: only a pending request can be decided. */
function decide(request: MockRequest, status: MockRequest['status']) {
  if (request.status !== 'PENDING')
    throw detail(409, `This request is already ${request.status.toLowerCase()}.`)
  request.status = status
  request.decided_at = new Date().toISOString()
}

// ---------------------------------------------------------------- handlers

export const handlers = [
  // ----- auth
  http.post(
    api('/auth/register/'),
    guard(async ({ request }) => {
      const body = (await request.json()) as { username?: string; password?: string; role?: Role }
      const username = body.username?.trim() ?? ''
      const errors: Record<string, string[]> = {}
      if (!username) errors.username = ['This field may not be blank.']
      else if (db.users.some((u) => u.username === username))
        errors.username = ['A user with that username already exists.']
      if (!body.password || body.password.length < 8)
        errors.password = ['This password is too short. It must contain at least 8 characters.']
      if (Object.keys(errors).length) return HttpResponse.json(errors, { status: 400 })

      const user = createUser(
        username,
        body.password!,
        body.role === 'DOCTOR' ? 'DOCTOR' : 'PATIENT',
      )
      return HttpResponse.json({ user: publicUser(user), ...issueTokens(user) }, { status: 201 })
    }),
  ),

  http.post(
    api('/auth/login/'),
    guard(async ({ request }) => {
      const body = (await request.json()) as { username?: string; password?: string }
      const user = db.users.find(
        (u) => u.username === body.username && u.password === body.password,
      )
      if (!user) throw detail(401, 'Invalid username or password.')
      return HttpResponse.json({ user: publicUser(user), ...issueTokens(user) })
    }),
  ),

  http.post(
    api('/auth/refresh/'),
    guard(async ({ request }) => {
      const { refresh } = (await request.json()) as { refresh?: string }
      const user = db.users.find((u) => u.id === db.tokens.get(refresh ?? ''))
      if (!refresh?.startsWith('mock-refresh-') || !user)
        throw detail(401, 'Token is invalid or expired')
      db.tokens.delete(refresh)
      return HttpResponse.json(issueTokens(user))
    }),
  ),

  http.post(
    api('/auth/logout/'),
    guard(async ({ request }) => {
      currentUser(request)
      const { refresh } = (await request.json()) as { refresh?: string }
      if (refresh) db.tokens.delete(refresh)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    api('/me/'),
    guard(({ request }) => {
      return HttpResponse.json(publicUser(currentUser(request)))
    }),
  ),

  // ----- key pairs (any role)
  http.get(
    api('/me/keys/'),
    guard(({ request }) => {
      const user = currentUser(request)
      const purposes: KeyPurpose[] = ['ENCRYPTION', 'SIGNING']
      return HttpResponse.json(purposes.flatMap((p) => activeKeyPair(user.id, p) ?? []))
    }),
  ),

  http.post(
    api('/me/keys/'),
    guard(async ({ request }) => {
      const user = currentUser(request)
      requirePassword(request, user)
      const body = (await request.json()) as { purpose?: string; rotate?: boolean }
      if (body.purpose !== 'ENCRYPTION' && body.purpose !== 'SIGNING')
        throw new HttpError(400, { purpose: [`"${body.purpose}" is not a valid choice.`] })
      const existing = activeKeyPair(user.id, body.purpose)
      if (existing && !body.rotate) return HttpResponse.json(existing)
      await delay(400) // RSA-3072 generation takes a moment
      return HttpResponse.json(createKeyPair(user.id, body.purpose), { status: 201 })
    }),
  ),

  http.get(
    api('/users/:username/public-key/'),
    guard(({ request, params }) => {
      currentUser(request)
      const purpose = (
        new URL(request.url).searchParams.get('purpose') ?? 'ENCRYPTION'
      ).toUpperCase()
      if (purpose !== 'ENCRYPTION' && purpose !== 'SIGNING')
        throw new HttpError(400, { purpose: 'Must be one of ENCRYPTION, SIGNING.' })
      const owner = db.users.find((u) => u.username === params.username)
      const pair = owner && activeKeyPair(owner.id, purpose)
      if (!owner || !pair) throw detail(404, 'Not found.')
      const { algorithm, fingerprint, public_key_pem } = pair
      return HttpResponse.json({
        username: owner.username,
        purpose,
        algorithm,
        fingerprint,
        public_key_pem,
      })
    }),
  ),

  http.get(
    api('/me/keys/certificate/'),
    guard(({ request }) => {
      const user = currentUser(request)
      return certificateResponse(user)
    }),
  ),

  http.get(
    api('/users/:username/certificate/'),
    guard(({ request, params }) => {
      currentUser(request)
      const owner = db.users.find((u) => u.username === params.username)
      if (!owner) throw detail(404, 'Not found.')
      return certificateResponse(owner)
    }),
  ),

  // ----- access requests (any role)
  http.get(
    api('/access-requests/'),
    guard(({ request }) => {
      const user = currentUser(request)
      const box = (new URL(request.url).searchParams.get('box') ?? 'incoming').toLowerCase()
      if (box !== 'incoming' && box !== 'outgoing')
        throw new HttpError(400, { box: 'Must be incoming or outgoing.' })
      const mine = db.requests.filter((r) =>
        box === 'incoming' ? r.owner === user.id : r.requester === user.id,
      )
      return HttpResponse.json(mine.map(serializeRequest))
    }),
  ),

  http.post(
    api('/access-requests/'),
    guard(async ({ request }) => {
      const user = currentUser(request)
      const body = (await request.json()) as { owner?: string; message?: string; category?: string }
      const owner = db.users.find((u) => u.username === body.owner?.trim())
      if (!owner) throw new HttpError(400, { owner: ['No user with that username.'] })
      if (owner.id === user.id)
        throw new HttpError(400, { owner: ["You can't request your own data."] })
      const category = body.category ?? ''
      if (category && !REQUEST_CATEGORIES.some((c) => c.value === category))
        throw new HttpError(400, { category: [`"${category}" is not a valid choice.`] })
      if ((body.message ?? '').length > 500)
        throw new HttpError(400, {
          message: ['Ensure this field has no more than 500 characters.'],
        })
      const pending = db.requests.some(
        (r) => r.requester === user.id && r.owner === owner.id && r.status === 'PENDING',
      )
      if (pending)
        throw new HttpError(400, { owner: ['You already have a pending request to this user.'] })
      const created = addRequest(
        user,
        owner,
        body.message ?? '',
        category as MockRequest['category'],
      )
      return HttpResponse.json(serializeRequest(created), { status: 201 })
    }),
  ),

  http.post(
    api('/access-requests/:id/deny/'),
    guard(({ request, params }) => {
      const user = currentUser(request)
      const accessRequest = requestFor(user, params.id)
      if (accessRequest.owner !== user.id) throw detail(403, 'Only the owner can deny a request.')
      decide(accessRequest, 'DENIED')
      return HttpResponse.json(serializeRequest(accessRequest))
    }),
  ),

  http.delete(
    api('/access-requests/:id/'),
    guard(({ request, params }) => {
      const user = currentUser(request)
      const accessRequest = requestFor(user, params.id)
      if (accessRequest.requester === user.id) decide(accessRequest, 'CANCELLED')
      else if (accessRequest.status === 'PENDING')
        throw detail(403, 'Only the requester can cancel a request; deny it instead.')
      else if (accessRequest.status !== 'APPROVED')
        throw detail(409, `This request is already ${accessRequest.status.toLowerCase()}.`)
      else {
        // Revoke: every shared copy and key goes.
        db.grants = db.grants.filter((g) => g.request !== accessRequest.id)
        accessRequest.status = 'REVOKED'
        accessRequest.decided_at = new Date().toISOString()
      }
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // ----- approving, redeeming and opening granted items
  http.post(
    api('/access-requests/:id/approve/'),
    guard(async ({ request, params }) => {
      const user = currentUser(request)
      requirePassword(request, user)
      const accessRequest = ownedRequest(user, params.id)
      const body = (await request.json()) as {
        file_ids?: number[]
        include_profile?: boolean
        expires_hours?: number
      }
      const ids = body.file_ids ?? []
      const files = db.files.filter((f) => f.owner === user.id && ids.includes(f.id))
      if (new Set(ids).size !== ids.length)
        throw new HttpError(400, { file_ids: ['A record is listed twice.'] })
      if (files.length !== ids.length)
        throw new HttpError(400, { file_ids: ['Every record must be one of yours.'] })
      if (!ids.length && !body.include_profile)
        throw new HttpError(400, {
          non_field_errors: ['Choose at least one record or the profile.'],
        })
      const hours = body.expires_hours ?? 24
      if (!Number.isInteger(hours) || hours < 1 || hours > 168)
        throw new HttpError(400, { expires_hours: ['Ensure this value is between 1 and 168.'] })
      const requester = db.users.find((u) => u.id === accessRequest.requester)!
      const requesterKey = activeKeyPair(requester.id, 'ENCRYPTION')
      if (!requesterKey)
        throw detail(
          409,
          `${requester.username} has no encryption key yet. Ask them to open Cipher Safe once.`,
        )
      if (accessRequest.status !== 'PENDING')
        throw detail(409, `This request is already ${accessRequest.status.toLowerCase()}.`)

      await delay(300) // decrypting, re-encrypting and wrapping keys takes a moment
      const grants = [...files, ...(body.include_profile ? [null] : [])].map((file) =>
        addGrant(accessRequest, file),
      )
      const now = new Date()
      accessRequest.status = 'APPROVED'
      accessRequest.decided_at = now.toISOString()
      accessRequest.expires_at = new Date(now.getTime() + hours * 3_600_000).toISOString()
      return HttpResponse.json({
        request: serializeRequest(accessRequest),
        recipient_fingerprint: requesterKey.fingerprint,
        items: grants.map((g) => ({
          item_id: g.id,
          kind: g.kind,
          file_id: g.file,
          category: db.files.find((f) => f.id === g.file)?.category ?? null,
          envelope: g.envelope,
        })),
      })
    }),
  ),

  http.get(
    api('/access-requests/:id/items/:itemId/envelope/'),
    guard(({ request, params }) => {
      const user = currentUser(request)
      requirePassword(request, user)
      const grant = liveGrant(ownedRequest(user, params.id), params.itemId)
      const requester = db.requests.find((r) => r.id === grant.request)!.requester
      return HttpResponse.json({
        item_id: grant.id,
        kind: grant.kind,
        envelope: grant.envelope,
        recipient_fingerprint: activeKeyPair(requester, 'ENCRYPTION')?.fingerprint ?? '',
      })
    }),
  ),

  http.post(
    api('/access-requests/:id/items/:itemId/redeem/'),
    guard(async ({ request, params }) => {
      const user = currentUser(request)
      requirePassword(request, user)
      const accessRequest = requestFor(user, params.id)
      if (accessRequest.requester !== user.id) throw detail(403, 'Only the requester can do this.')
      const grant = liveGrant(accessRequest, params.itemId)
      const { envelope = '' } = (await request.json()) as { envelope?: string }
      const compact = envelope.replace(/\s+/g, '')
      const parts = compact.split('.')
      if (parts.length !== 4 || parts[0] !== 'CSK1')
        throw new HttpError(400, { envelope: ["This doesn't look like a Cipher Safe key."] })
      if (Number(parts[1]) !== accessRequest.id || Number(parts[2]) !== grant.id)
        throw new HttpError(400, { envelope: ['This key belongs to another item.'] })
      if (compact !== grant.envelope) throw detail(403, 'This key is not for this item.')
      grant.redeemed = true
      return HttpResponse.json({ item_id: grant.id, kind: grant.kind, redeemed: true })
    }),
  ),

  http.get(
    api('/access-requests/:id/items/:itemId/'),
    guard(({ request, params }) => {
      const user = currentUser(request)
      requirePassword(request, user)
      const accessRequest = requestFor(user, params.id)
      if (accessRequest.requester !== user.id) throw detail(403, 'Only the requester can do this.')
      const grant = liveGrant(accessRequest, params.itemId)
      if (!grant.redeemed) throw detail(403, 'Enter the key the owner sent you first.')
      grant.access_count += 1
      if (grant.kind === 'PROFILE') return HttpResponse.json(grant.snapshot ?? {})
      const file = db.files.find((f) => f.id === grant.file)
      if (!file) throw detail(404, 'Not found.')
      return fileResponse(file.data, file.contentType, file.name, wantsInline(request))
    }),
  ),

  http.get(
    api('/access-requests/:id/items/:itemId/signature/'),
    guard(({ request, params }) => {
      const user = currentUser(request)
      requirePassword(request, user)
      const accessRequest = requestFor(user, params.id)
      if (accessRequest.requester !== user.id) throw detail(403, 'Only the requester can do this.')
      const grant = liveGrant(accessRequest, params.itemId)
      if (!grant.redeemed) throw detail(403, 'Enter the key the owner sent you first.')
      // Checking doesn't count as an access.
      const file = grant.kind === 'FILE' ? db.files.find((f) => f.id === grant.file) : undefined
      if (!file || !isSignablePdf(file.contentType, file.data))
        throw new HttpError(400, { file: 'Only PDFs have signatures.' })
      const owner = db.users.find((u) => u.id === accessRequest.owner)!
      return HttpResponse.json(signatureCheck(file, owner.username))
    }),
  ),

  // ----- patient profile
  http.get(
    api('/me/personal-data/'),
    guard(({ request }) => {
      const user = patientWithPassword(request)
      const algorithm = algorithmParam(request)
      const profile = db.profiles.get(user.id)
      return HttpResponse.json({
        algorithm,
        updated_at: profile?.updated_at ?? new Date().toISOString(),
        fields: profile?.fields ?? {},
      })
    }),
  ),

  http.put(
    api('/me/personal-data/'),
    guard(async ({ request }) => {
      const user = patientWithPassword(request)
      const incoming = (await request.json()) as Record<string, string>
      const previous = db.profiles.get(user.id)?.fields ?? {}
      const profile = { fields: { ...previous, ...incoming }, updated_at: new Date().toISOString() }
      db.profiles.set(user.id, profile)
      return HttpResponse.json(profile)
    }),
  ),

  // ----- files
  http.get(
    api('/files/'),
    guard(({ request }) => {
      const user = patientWithPassword(request)
      const category = new URL(request.url).searchParams.get('category')?.toUpperCase()
      const files = db.files.filter(
        (f) => f.owner === user.id && (!category || f.category === category),
      )
      return HttpResponse.json(files.map(serializeFile))
    }),
  ),

  http.post(
    api('/files/'),
    guard(async ({ request }) => {
      const user = patientWithPassword(request)
      const form = await request.formData()
      const file = form.get('file')
      const category = String(form.get('category') ?? '').toUpperCase() as FileCategory
      const errors: Record<string, string[]> = {}
      if (!(file instanceof File)) errors.file = ['No file was submitted.']
      if (!FILE_CATEGORIES.some((c) => c.value === category))
        errors.category = [`"${category}" is not a valid choice.`]
      if (Object.keys(errors).length) return HttpResponse.json(errors, { status: 400 })

      const upload = file as File
      const data = new Uint8Array(await upload.arrayBuffer())
      const contentType = upload.type || 'application/octet-stream'
      const sign = form.get('sign') === 'true'
      if (sign && !isSignablePdf(contentType, data))
        throw new HttpError(400, { file: ['Only PDF files can be signed.'] })
      const stored = addFile(user.id, category, upload.name, contentType, data)
      if (sign) markSigned(stored)
      return HttpResponse.json(serializeFile(stored), { status: 201 })
    }),
  ),

  http.post(
    api('/files/:id/sign/'),
    guard(async ({ request, params }) => {
      const user = patientWithPassword(request)
      const file = ownFile(user, params.id)
      if (!isSignablePdf(file.contentType, file.data))
        throw new HttpError(400, { file: ['Only PDF files can be signed.'] })
      if (file.signedAt) throw detail(409, 'This PDF is already signed in Cipher Safe.')
      await delay(300) // signing and re-encrypting three copies takes a moment
      markSigned(file)
      return HttpResponse.json(serializeFile(file))
    }),
  ),

  http.get(
    api('/files/:id/signature/'),
    guard(({ request, params }) => {
      const user = patientWithPassword(request)
      const file = ownFile(user, params.id)
      if (!isSignablePdf(file.contentType, file.data))
        throw new HttpError(400, { file: 'Only PDFs have signatures.' })
      return HttpResponse.json({ ...signatureCheck(file, user.username), signed_at: file.signedAt })
    }),
  ),

  http.get(
    api('/files/:id/'),
    guard(({ request, params }) => {
      const user = patientWithPassword(request)
      return HttpResponse.json(serializeFile(ownFile(user, params.id)))
    }),
  ),

  http.delete(
    api('/files/:id/'),
    guard(({ request, params }) => {
      const user = requireRole(request, 'PATIENT')
      const file = ownFile(user, params.id)
      db.files = db.files.filter((f) => f !== file)
      db.grants = db.grants.filter((g) => g.file !== file.id)
      db.downloads = db.downloads.filter((d) => d.file !== file.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    api('/files/:id/download/'),
    guard(({ request, params }) => {
      const user = patientWithPassword(request)
      const file = ownFile(user, params.id)
      const algorithm = algorithmParam(request)
      const timings = logDownload(file, algorithm)
      const response = fileResponse(file.data, file.contentType, file.name, wantsInline(request))
      response.headers.set('X-Cipher-Algorithm', algorithm)
      response.headers.set('X-Cipher-Decrypt-Ms', timings.total_ms.toFixed(3))
      return response
    }),
  ),

  http.get(
    api('/files/:id/ciphertext/'),
    guard(({ request, params }) => {
      const user = patientWithPassword(request)
      const file = ownFile(user, params.id)
      const algorithm = algorithmParam(request)
      const dot = file.name.lastIndexOf('.')
      const [stem, ext] =
        dot > 0 ? [file.name.slice(0, dot), file.name.slice(dot)] : [file.name, '']
      return new HttpResponse(scramble(file.data, algorithm).buffer as ArrayBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': contentDisposition(true, `${stem}.${algorithm}-encrypted${ext}`),
          'Cache-Control': 'no-store',
        },
      })
    }),
  ),

  http.get(
    api('/files/:id/benchmark/'),
    guard(async ({ request, params }) => {
      const user = patientWithPassword(request)
      const file = ownFile(user, params.id)
      const algorithm = algorithmParam(request)
      const rawRuns = Number(new URL(request.url).searchParams.get('runs') ?? 5)
      if (!Number.isInteger(rawRuns)) throw new HttpError(400, { runs: 'Must be an integer.' })
      const runs = Math.max(1, Math.min(rawRuns, 50))

      const samples = Array.from({ length: runs }, () => fakeTimings(algorithm, file.data.length))
      const samples_ms = samples.map((s) => s.total_ms)
      const cipher_samples_ms = samples.map((s) => s.cipher_ms + s.mac_ms)
      await delay(Math.min(runs * 40, 1500)) // a benchmark should take a moment
      return HttpResponse.json({
        file: file.id,
        algorithm,
        mode: MODE_FOR[algorithm],
        runs,
        ciphertext_size:
          file.ciphertexts.find((c) => c.algorithm === algorithm)?.ciphertext_size ?? 0,
        samples_ms,
        ...stats(samples_ms),
        cipher_samples_ms,
        cipher_mean_ms: stats(cipher_samples_ms).mean_ms,
      })
    }),
  ),

  // ----- analysis
  http.get(
    api('/analysis/timings/'),
    guard(({ request }) => {
      const user = requireRole(request, 'PATIENT')
      const downloads = ALGORITHMS.flatMap((algorithm) => {
        const rows = db.downloads.filter((d) => d.owner === user.id && d.algorithm === algorithm)
        return rows.length
          ? [{ algorithm, runs: rows.length, ...stats(rows.map((r) => r.total_ms)) }]
          : []
      })
      const owned = db.files.filter((f) => f.owner === user.id)
      const encryptions = ALGORITHMS.flatMap((algorithm) => {
        const rows = owned.flatMap((f) => f.ciphertexts.filter((c) => c.algorithm === algorithm))
        if (!rows.length) return []
        return [
          {
            algorithm,
            files: rows.length,
            ...stats(rows.map((r) => r.total_ms)),
            mean_ciphertext_size: rows.reduce((a, r) => a + r.ciphertext_size, 0) / rows.length,
          },
        ]
      })
      return HttpResponse.json({
        supported_algorithms: ALGORITHMS,
        modes: MODE_FOR,
        downloads,
        encryptions,
      })
    }),
  ),

  http.get(
    api('/analysis/downloads/'),
    guard(({ request }) => {
      const user = patientWithPassword(request)
      return HttpResponse.json(
        db.downloads
          .filter((d) => d.owner === user.id)
          .map((event) => ({ ...event, owner: undefined })),
      )
    }),
  ),
]
