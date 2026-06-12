'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const IOH = {
  red:    '#ED1C24',
  border: '#E8E8EA',
  charcoal: '#4D4D4F',
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  if (totalPages <= 1) return null

  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  // Build page list with ellipsis for large ranges
  const pages: (number | 'ellipsis')[] = []
  const windowSize = 1
  for (let p = 1; p <= totalPages; p++) {
    if (
      p === 1 ||
      p === totalPages ||
      (p >= currentPage - windowSize && p <= currentPage + windowSize)
    ) {
      pages.push(p)
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis')
    }
  }

  const btnBase: React.CSSProperties = {
    minWidth: 32, height: 32, borderRadius: 9,
    border: `1.5px solid ${IOH.border}`,
    background: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, color: IOH.charcoal,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.15s', padding: '0 4px',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
      <div style={{ fontSize: 12, color: '#aaa', fontWeight: 600 }}>
        Menampilkan {start}–{end} dari {totalItems}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{ ...btnBase, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}
        >
          <ChevronLeft size={14} />
        </button>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} style={{ fontSize: 12, color: '#ccc', padding: '0 2px' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{
                ...btnBase,
                background: p === currentPage ? IOH.red : '#fff',
                borderColor: p === currentPage ? IOH.red : IOH.border,
                color: p === currentPage ? '#fff' : IOH.charcoal,
              }}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          style={{ ...btnBase, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}