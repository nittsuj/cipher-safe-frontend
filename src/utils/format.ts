import { FILE_CATEGORIES } from '@/config/records'

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`
}

export function formatMs(ms: number): string {
  return `${ms < 10 ? ms.toFixed(2) : ms.toFixed(1)} ms`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "in 23 h" / "in 3 days" until a future date; "expired" once past. */
export function formatUntil(iso: string): string {
  const hours = (new Date(iso).getTime() - Date.now()) / 3_600_000
  if (hours <= 0) return 'expired'
  if (hours < 1) return `in ${Math.max(1, Math.round(hours * 60))} min`
  if (hours < 48) return `in ${Math.round(hours)} h`
  return `in ${Math.round(hours / 24)} days`
}

/** Display name of a record category, from the single list in `@/config/records`. */
export function categoryLabel(value: string): string {
  return FILE_CATEGORIES.find((c) => c.value === value)?.label ?? value
}
