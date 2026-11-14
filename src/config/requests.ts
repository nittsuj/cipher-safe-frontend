/**
 * UI settings for access requests: status labels and badge tones, and the
 * category hints a requester can choose. The API contract is in `@/types/api`.
 */
import { FILE_CATEGORIES } from '@/config/records'
import type { AccessRequest, RequestCategory, RequestStatus } from '@/types/api'

/** Badge tone; each maps to a colour in the page CSS. Text is always shown too. */
export type StatusTone = 'pending' | 'ok' | 'ended'

export const REQUEST_STATUSES: Record<RequestStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: 'Waiting', tone: 'pending' },
  APPROVED: { label: 'Approved', tone: 'ok' },
  DENIED: { label: 'Denied', tone: 'ended' },
  CANCELLED: { label: 'Cancelled', tone: 'ended' },
  REVOKED: { label: 'Access stopped', tone: 'ended' },
}

/** Label and tone for a request; approved access that has run out shows as expired. */
export function requestStatus(request: Pick<AccessRequest, 'status' | 'expired'>): {
  label: string
  tone: StatusTone
} {
  if (request.status === 'APPROVED' && request.expired) return { label: 'Expired', tone: 'ended' }
  return REQUEST_STATUSES[request.status]
}

/** Categories a requester can hint at: the record categories, plus the profile. */
export const REQUEST_CATEGORIES: readonly { value: RequestCategory; label: string }[] = [
  ...FILE_CATEGORIES.map(({ value, label }) => ({ value, label })),
  { value: 'PROFILE', label: 'Profile' },
]

export function requestCategoryLabel(category: RequestCategory | ''): string {
  return REQUEST_CATEGORIES.find((item) => item.value === category)?.label ?? 'Anything'
}

/** Longest message the backend accepts. */
export const REQUEST_MESSAGE_MAX = 500

/** Prefix of every envelope: `CSK1.<request id>.<item id>.<key>`. */
export const ENVELOPE_PREFIX = 'CSK1'

/**
 * Read the request and item ids from a pasted envelope, ignoring spaces and
 * line breaks that chat apps add. `null` if it isn't an envelope. The key part
 * is only checked for its characters; the server does the real check.
 */
export function parseEnvelope(text: string): { requestId: number; itemId: number } | null {
  const parts = text.replace(/\s+/g, '').split('.')
  if (parts.length !== 4 || parts[0] !== ENVELOPE_PREFIX) return null
  const [, request, item, key] = parts as [string, string, string, string]
  if (!/^\d+$/.test(request) || !/^\d+$/.test(item) || !/^[A-Za-z0-9_-]+$/.test(key)) return null
  return { requestId: Number(request), itemId: Number(item) }
}

/** The message an owner sends with a key, for WhatsApp, email or the share sheet. */
export function envelopeMessage(itemTitle: string, envelope: string): string {
  return (
    `Here is the Cipher Safe key for "${itemTitle}". ` +
    `Open Cipher Safe, go to Requests, Outgoing, and paste it under Enter key:\n\n${envelope}`
  )
}

/** Links that open WhatsApp or the mail app with the key filled in. */
export function envelopeShareLinks(itemTitle: string, envelope: string) {
  const text = envelopeMessage(itemTitle, envelope)
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    email: `mailto:?subject=${encodeURIComponent(`Cipher Safe key: ${itemTitle}`)}&body=${encodeURIComponent(text)}`,
  }
}
