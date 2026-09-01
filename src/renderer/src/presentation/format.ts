/** Number formatting for the interface. French conventions, no logic. */

export const formatBytes = (bytes: number): string =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} Go`
    : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} Mo`
      : `${Math.max(1, Math.round(bytes / 1024))} Ko`

export const formatDuration = (seconds: number | null): string => {
  if (seconds === null) return '—'
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`
}
