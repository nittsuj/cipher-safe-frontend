import type { Credentials } from '@/types/api'

/** Base URL for the API. Empty by default so the Vite dev proxy handles `/api`. */
const BASE = import.meta.env.VITE_API_BASE ?? ''

/** Supplies the credentials for every request; set by the auth store. */
let credentialsProvider: () => Partial<Credentials> = () => ({})

export function setCredentialsProvider(provider: () => Partial<Credentials>): void {
  credentialsProvider = provider
}

/**
 * Obtains a fresh access token using the stored refresh token, or null when the
 * session cannot be refreshed. Registered by the auth store.
 */
let tokenRefresher: (() => Promise<string | null>) | null = null

export function setTokenRefresher(refresher: (() => Promise<string | null>) | null): void {
  tokenRefresher = refresher
}

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, message: string, data: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/** Turn any thrown value into a display string. */
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

/** Append query parameters, skipping empty values and encoding correctly. */
export function withQuery(
  path: string,
  params: Record<string, string | number | undefined | null>,
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

interface RequestOptions {
  method?: string
  credentials?: Partial<Credentials>
  /** Skip auth handling; used by the auth endpoints themselves. */
  noAuth?: boolean
  json?: unknown
  form?: FormData
  signal?: AbortSignal
}

function resolveCredentials(options: RequestOptions): Partial<Credentials> {
  return options.credentials ?? credentialsProvider()
}

function buildHeaders(
  options: RequestOptions,
  credentials: Partial<Credentials>,
): Record<string, string> {
  const headers: Record<string, string> = {}
  if (credentials.access) headers['Authorization'] = `Bearer ${credentials.access}`
  if (credentials.password) headers['X-Cipher-Password'] = credentials.password
  if (options.json !== undefined) headers['Content-Type'] = 'application/json'
  return headers
}

/**
 * Fetch with the current credentials. On a 401 it refreshes the access token
 * once and retries, so an expired access token does not log the user out.
 */
async function fetchWithAuth(path: string, options: RequestOptions): Promise<Response> {
  const credentials = resolveCredentials(options)
  const method = options.method ?? (options.json !== undefined || options.form ? 'POST' : 'GET')
  let body: BodyInit | undefined
  if (options.json !== undefined) body = JSON.stringify(options.json)
  else if (options.form) body = options.form

  const doFetch = (creds: Partial<Credentials>) =>
    fetch(`${BASE}${path}`, {
      method,
      headers: buildHeaders(options, creds),
      body,
      signal: options.signal,
    })

  const response = await doFetch(credentials)
  const canRefresh = !options.noAuth && options.credentials === undefined && tokenRefresher
  if (response.status === 401 && canRefresh) {
    const access = await tokenRefresher!()
    if (access) return doFetch({ ...credentials, access })
  }
  return response
}

async function toApiError(response: Response): Promise<ApiError> {
  let data: unknown = null
  try {
    data = await response.clone().json()
  } catch {
    data = await response.clone().text().catch(() => null)
  }
  const message = extractMessage(data) ?? response.statusText ?? 'Request failed'
  return new ApiError(response.status, message, data)
}

function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return typeof data === 'string' ? data : null
  const record = data as Record<string, unknown>
  if (typeof record.detail === 'string') return record.detail
  for (const value of Object.values(record)) {
    if (typeof value === 'string') return value
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  }
  return null
}

/** Perform a JSON request and return the parsed body. */
export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetchWithAuth(path, options)
  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Perform a request and return the raw blob plus the server-provided filename. */
export async function requestBlob(
  path: string,
  options: RequestOptions = {},
): Promise<{ blob: Blob; filename: string | null }> {
  const response = await fetchWithAuth(path, options)
  if (!response.ok) throw await toApiError(response)

  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename="?([^";]+)"?/.exec(disposition)
  return { blob: await response.blob(), filename: match?.[1] ?? null }
}
