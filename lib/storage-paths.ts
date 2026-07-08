export function slugify(input?: string | null): string {
  return (input || 'unknown')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'unknown'
}

/** "2026-07-15" -> "2026-07". Fallback dipakai kalau primary null/kosong. */
export function monthKeyFrom(primary?: string | null, fallback?: string | null): string {
  const d = primary || fallback || new Date().toISOString().slice(0, 10)
  return d.slice(0, 7)
}

export function buildReceiptFolder(opts: {
  role: string
  ownerName: string
  branchName?: string | null
  monthKey: string
}): string {
  if (opts.role === 'cse') {
    return `cse/${slugify(opts.branchName)}/${slugify(opts.ownerName)}/${opts.monthKey}`
  }
  return `driver/${slugify(opts.ownerName)}/${opts.monthKey}`
}