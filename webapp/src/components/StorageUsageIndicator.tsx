import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { storageApi, driveApi } from '../api/client'

const APP_STORAGE_KEYS = [
  'learning_ide_notes',
  'learning_ide_timeline',
  'learning_ide_chat',
  'learning_ide_canvas_overlays',
]

const APPROX_LOCAL_BUDGET_BYTES = 5 * 1024 * 1024 // 5MB

export interface CloudStorageSummary {
  notesCount: number
  timelineCount: number
  chatThreadsCount: number
  totalMessages: number
  filesCount: number
  overlaysCount: number
  storageQuota: { limit: number; usage: number } | null
}

export function StorageUsageIndicator() {
  const { isAuthenticated } = useAuth()
  const [usageBytes, setUsageBytes] = useState<number | null>(null)
  const [cloudLinked, setCloudLinked] = useState(false)
  const [cloudSummary, setCloudSummary] = useState<CloudStorageSummary | null>(null)
  const [cloudVerifyDone, setCloudVerifyDone] = useState(false)

  // Local storage bytes
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
            bytes += (key.length + value.length) * 2
          }
        } catch {
          /* ignore */
        }
      }
      setUsageBytes(bytes)
    }
    calc()
    const interval = window.setInterval(calc, 5000)
    return () => window.clearInterval(interval)
  }, [])

  // Verify cloud link and fetch summary when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setCloudLinked(false)
      setCloudSummary(null)
      setCloudVerifyDone(false)
      return
    }
    setCloudVerifyDone(false)
    let cancelled = false
    driveApi.verify().then((res) => {
      if (cancelled) return
      setCloudVerifyDone(true)
      if (res.ok) {
        setCloudLinked(true)
        storageApi.getSummary().then((s) => {
          if (cancelled || !s) return
          setCloudSummary({
            notesCount: s.notesCount,
            timelineCount: s.timelineCount,
            chatThreadsCount: s.chatThreadsCount,
            totalMessages: s.totalMessages,
            filesCount: s.filesCount,
            overlaysCount: s.overlaysCount,
            storageQuota: s.storageQuota ?? null,
          })
        })
      } else {
        setCloudLinked(false)
        setCloudSummary(null)
      }
    })
    return () => { cancelled = true }
  }, [isAuthenticated])

  // Cloud mode: show Cloud Storage with percentage and total Drive quota
  if (isAuthenticated && cloudLinked && cloudSummary) {
    const q = cloudSummary.storageQuota
    const fillPercent =
      q && q.limit > 0
        ? Math.min(100, Math.max(0, Math.round((q.usage / q.limit) * 100)))
        : null
    const percentDisplay = fillPercent != null ? `${fillPercent}%` : null
    const limitGb = q ? (q.limit / (1024 ** 3)).toFixed(0) : null
    const usedGb = q ? (q.usage / (1024 ** 3)).toFixed(2) : null

    const cloudLabel =
      percentDisplay != null && limitGb != null
        ? `${percentDisplay} / ${limitGb}GB`
        : limitGb != null
          ? ` / ${limitGb}GB`
          : '已同步'

    const title = [
      `雲端儲存：${cloudSummary.notesCount} 筆記、${cloudSummary.filesCount} 檔案、${cloudSummary.chatThreadsCount} 對話，共 ${cloudSummary.totalMessages} 則訊息`,
      usedGb != null && limitGb != null ? `使用 ${usedGb} / ${limitGb} GB` : null,
    ]
      .filter(Boolean)
      .join(' · ')

    return (
      <div
        className="ide-storage-indicator ide-storage-indicator--cloud"
        title={title}
      >
        <div className="ide-storage-bar">
          <div
            className="ide-storage-bar-fill ide-storage-bar-fill--cloud"
            style={{ width: `${fillPercent ?? 0}%` }}
          />
        </div>
        <span className="ide-storage-label">
          Cloud Storage
          <span className="ide-storage-cloud-data">{cloudLabel}</span>
        </span>
      </div>
    )
  }

  // Verifying cloud (authenticated, verify not done yet)
  if (isAuthenticated && !cloudVerifyDone) {
    return (
      <div className="ide-storage-indicator" title="驗證 Google Drive 連線中…">
        <div className="ide-storage-bar">
          <div className="ide-storage-bar-fill ide-storage-bar-fill--empty ide-storage-bar-fill--pulse" />
        </div>
        <span className="ide-storage-label">
          <span className="ide-storage-mode">驗證中…</span>
        </span>
      </div>
    )
  }

  // Local mode (not authenticated, or cloud verify failed)
  if (usageBytes == null) {
    return (
      <div className="ide-storage-indicator" title="本地儲存狀態（localStorage）">
        <div className="ide-storage-bar">
          <div className="ide-storage-bar-fill ide-storage-bar-fill--empty" />
        </div>
        <span className="ide-storage-label">
          Local storage
          <span className="ide-storage-mode">
            {isAuthenticated && cloudVerifyDone && !cloudLinked
              ? ' · Drive 連線失敗'
              : !isAuthenticated
                ? ' · Local only'
                : ''}
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
      title={`本地儲存：約 ${usedMb.toFixed(2)} MB / ${budgetMb.toFixed(0)} MB`}
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
          {isAuthenticated && cloudVerifyDone && !cloudLinked
            ? ' · Drive 連線失敗'
            : !isAuthenticated
              ? ' · Local only'
              : ''}
        </span>
      </span>
    </div>
  )
}

