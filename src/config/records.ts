/**
 * UI settings for records: how categories are named and which file types the
 * browser may preview. The API contract itself lives in `@/types/api`.
 */
import type { FileCategory } from '@/types/api'

export const FILE_CATEGORIES: readonly { value: FileCategory; label: string; hint: string }[] = [
  { value: 'ID_CARD', label: 'ID & insurance', hint: 'KTP, BPJS card' },
  { value: 'DOCUMENT', label: 'Medical document', hint: 'Lab result, referral, medication log' },
  { value: 'VIDEO', label: 'Medical video', hint: 'Ultrasound, echo, endoscopy' },
]

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

/** Whether a file is a PDF that can be signed: by its type, or a `.pdf` name. */
export function isPdf(file: { type?: string; name?: string } | null | undefined): boolean {
  if (!file) return false
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name ?? '')
}
