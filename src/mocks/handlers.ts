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

import type { Algorithm, FileCategory, FileShare, ReceivedShare, Role } from '@/types/api'
import { FILE_CATEGORIES, PREVIEWABLE_TYPES } from '@/config/records'
import { ALGORITHMS } from '@/types/api'
import {
  addFile,
  addShare,
  createUser,
  db,
  fakeTimings,
  issueTokens,
  logDownload,
  MODE_FOR,
  scramble,
  serializeFile,
  shareIsActive,
  type MockShare,
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

function serializeShare(share: MockShare): FileShare {
  return {
    id: share.id,
    file: share.file,
    doctor: db.users.find((u) => u.id === share.doctor)?.username ?? '?',
    created_at: share.created_at,
    expires_at: share.expires_at,
    active: shareIsActive(share),
    access_count: share.access_count,
    last_accessed_at: share.last_accessed_at,
  }
}

function stats(values: number[]) {
  return {
    min_ms: Math.min(...values),
    max_ms: Math.max(...values),
    mean_ms: values.reduce((a, b) => a + b, 0) / values.length,
  }
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
      const stored = addFile(
        user.id,
        category,
        upload.name,
        upload.type || 'application/octet-stream',
        data,
      )
      return HttpResponse.json(serializeFile(stored), { status: 201 })
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
      db.shares = db.shares.filter((s) => s.file !== file.id)
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

  // ----- sharing (patient side)
  http.get(
    api('/files/:id/shares/'),
    guard(({ request, params }) => {
      const user = requireRole(request, 'PATIENT')
      const file = ownFile(user, params.id)
      return HttpResponse.json(db.shares.filter((s) => s.file === file.id).map(serializeShare))
    }),
  ),

  http.post(
    api('/files/:id/shares/'),
    guard(async ({ request, params }) => {
      const user = patientWithPassword(request)
      const file = ownFile(user, params.id)
      const body = (await request.json()) as { doctor?: string; expires_hours?: number }
      const doctor = db.users.find((u) => u.username === body.doctor && u.role === 'DOCTOR')
      if (!doctor) throw new HttpError(400, { doctor: ['No doctor with that username.'] })
      const hours = body.expires_hours ?? 24
      if (!Number.isInteger(hours) || hours < 1 || hours > 168)
        throw new HttpError(400, { expires_hours: ['Ensure this value is between 1 and 168.'] })
      const share = addShare(file, doctor, hours)
      return HttpResponse.json({ ...serializeShare(share), share_key: share.key }, { status: 201 })
    }),
  ),

  http.delete(
    api('/shares/:id/'),
    guard(({ request, params }) => {
      const user = requireRole(request, 'PATIENT')
      const share = db.shares.find(
        (s) =>
          s.id === Number(params.id) &&
          db.files.some((f) => f.id === s.file && f.owner === user.id),
      )
      if (!share) throw detail(404, 'No FileShare matches the given query.')
      share.revoked = true
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // ----- sharing (doctor side)
  http.get(
    api('/shares/received/'),
    guard(({ request }) => {
      const doctor = requireRole(request, 'DOCTOR')
      const received: ReceivedShare[] = db.shares
        .filter((s) => s.doctor === doctor.id && shareIsActive(s))
        .flatMap((s) => {
          const file = db.files.find((f) => f.id === s.file)
          if (!file) return []
          return [
            {
              id: s.id,
              patient: db.users.find((u) => u.id === file.owner)?.username ?? '?',
              category: file.category,
              plaintext_size: file.data.length,
              created_at: s.created_at,
              expires_at: s.expires_at,
              access_count: s.access_count,
            },
          ]
        })
      return HttpResponse.json(received)
    }),
  ),

  http.get(
    api('/shares/received/:id/open/'),
    guard(({ request, params }) => {
      const doctor = requireRole(request, 'DOCTOR')
      const share = db.shares.find((s) => s.id === Number(params.id) && s.doctor === doctor.id)
      if (!share || !shareIsActive(share)) throw detail(404, 'Not found.')
      const key = request.headers.get('X-Share-Key')?.trim()
      if (!key) throw new HttpError(400, { share_key: 'Enter the share key the patient sent you.' })
      if (key !== share.key) throw detail(403, 'Wrong share key.')
      const file = db.files.find((f) => f.id === share.file)
      if (!file) throw detail(404, 'Not found.')
      share.access_count += 1
      share.last_accessed_at = new Date().toISOString()
      return fileResponse(file.data, file.contentType, file.name, wantsInline(request))
    }),
  ),
]
