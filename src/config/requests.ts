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
