import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const APP_STORAGE_KEYS = [
  'learning_ide_notes',
  'learning_ide_timeline',
  'learning_ide_chat',
  'learning_ide_canvas_overlays',
]

// Rough budget for our app's data in localStorage (notes/chat/overlays).
// Browsers通常俾每個 origin 幾 MB～十幾 MB，本 app 實際用量遠低於呢個數。
const APPROX_LOCAL_BUDGET_BYTES = 5 * 1024 * 1024 // 5MB

export function StorageUsageIndicator() {
  const { isAuthenticated } = useAuth()
  const [usageBytes, setUsageBytes] = useState<number | null>(null)

  useEffect(() => {
    const calc = () => {
      if (typeof window === 'undefined' || !window.localStorage) {
        setUsageBytes(null)
        return
      }
      let bytes = 0
      for (const key of APP_STORAGE_KEYS) {
        try {
          const value = window.localStorage.getItem(key)
          if (value != null) {
            // Rough UTF-16 size: 2 bytes per char + key length
            bytes += (key.length + value.length) * 2
          }
        } catch {
          // ignore storage errors
        }
      }
      setUsageBytes(bytes)
    }

    calc()
    const interval = window.setInterval(calc, 5000)
    return () => window.clearInterval(interval)
  }, [])

  if (usageBytes == null) {
    return (
      <div className="ide-storage-indicator" title="本地儲存狀態（localStorage）">
        <div className="ide-storage-bar">
          <div className="ide-storage-bar-fill ide-storage-bar-fill--empty" />
        </div>
        <span className="ide-storage-label">
          Local storage
          <span className="ide-storage-mode">
            {isAuthenticated ? 'Local + Google Drive' : 'Local only'}
          </span>
        </span>
      </div>
    )
  }

  const ratio = Math.max(0, Math.min(usageBytes / APPROX_LOCAL_BUDGET_BYTES, 1))
  const percent = Math.round(ratio * 100)
  const usedMb = usageBytes / (1024 * 1024)
  const budgetMb = APPROX_LOCAL_BUDGET_BYTES / (1024 * 1024)

  return (
    <div
      className="ide-storage-indicator"
      title={`本地儲存（只計呢個 app 嘅 notes/chat）：約 ${usedMb.toFixed(
        2,
      )} MB / ${budgetMb.toFixed(0)} MB`}
    >
      <div className="ide-storage-bar">
        <div
          className={
            'ide-storage-bar-fill' +
            (percent >= 80 ? ' ide-storage-bar-fill--warn' : '')
          }
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="ide-storage-label">
        Local {usedMb.toFixed(2)} / {budgetMb.toFixed(0)} MB
        <span className="ide-storage-percent">{percent}%</span>
        <span className="ide-storage-mode">
          {isAuthenticated ? 'Local + Google Drive' : 'Local only'}
        </span>
      </span>
    </div>
  )
}

