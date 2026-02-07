import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { storageApi } from '../api/client'
import type { CloudStorageSummary } from './StorageUsageIndicator'

export interface VerifyStorageResult {
  match: boolean
  driveReachable: boolean
  details: { notesMatch: boolean; timelineMatch: boolean; chatMatch: boolean; overlaysMatch: boolean; filesMatch: boolean }
  driveCounts: { notes: number; timeline: number; chatThreads: number; totalMessages: number; overlaysKeys: number; filesCount: number }
  clientCounts: { notes: number; timeline: number; chatThreads: number; totalMessages: number; overlaysKeys: number; filesCount: number }
}

interface LoginButtonProps {
  className?: string
  onVerifyStorage?: () => Promise<VerifyStorageResult | null>
}

const GOOGLE_DRIVE_URL = 'https://drive.google.com/drive/my-drive'

export function LoginButton({ className, onVerifyStorage }: LoginButtonProps) {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [cloudSummary, setCloudSummary] = useState<CloudStorageSummary | null>(null)
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [verifyResult, setVerifyResult] = useState<VerifyStorageResult | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Reset verify state when dropdown closes
  useEffect(() => {
    if (!dropdownOpen) {
      setVerifyStatus('idle')
      setVerifyResult(null)
    }
  }, [dropdownOpen])

  // Fetch cloud storage summary when dropdown opens and user is authenticated
  useEffect(() => {
    if (dropdownOpen && isAuthenticated) {
      storageApi.getSummary().then((s) => {
        if (s && s.ok !== false) {
          setCloudSummary({
            notesCount: s.notesCount,
            timelineCount: s.timelineCount,
            chatThreadsCount: s.chatThreadsCount,
            totalMessages: s.totalMessages,
            filesCount: s.filesCount,
            overlaysCount: s.overlaysCount,
            storageQuota: s.storageQuota ?? null,
          })
        } else {
          setCloudSummary(null)
        }
      })
    } else {
      setCloudSummary(null)
    }
  }, [dropdownOpen, isAuthenticated])

  const openDrive = () => {
    window.open(GOOGLE_DRIVE_URL, '_blank', 'noopener,noreferrer')
    setDropdownOpen(false)
  }

  const runVerify = async () => {
    if (!onVerifyStorage) return
    setVerifyStatus('running')
    setVerifyResult(null)
    try {
      const r = await onVerifyStorage()
      setVerifyStatus('done')
      setVerifyResult(r ?? null)
    } catch {
      setVerifyStatus('error')
    }
  }

  if (isLoading) {
    return (
      <div className={`login-button-container ${className || ''}`}>
        <span className="login-status loading">載入中...</span>
      </div>
    )
  }

  if (isAuthenticated && user) {
    return (
      <div className={`login-button-container ${className || ''}`} ref={dropdownRef}>
        <button
          type="button"
          className="user-info-btn"
          onClick={() => setDropdownOpen(o => !o)}
          title="點擊展開選單"
          aria-expanded={dropdownOpen}
          aria-haspopup="true"
        >
          {user.picture && (
            <img
              src={user.picture}
              alt={user.name}
              className="user-avatar"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="user-name" title={user.email}>{user.name}</span>
          <span className={`user-dropdown-chevron ${dropdownOpen ? 'open' : ''}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>
        {dropdownOpen && (
          <div className="login-dropdown">
            <div className="login-dropdown-header">
              <span className="login-dropdown-email">{user.email}</span>
            </div>
            {/* Cloud storage visualization */}
            <div className="login-dropdown-storage">
              <div className="login-dropdown-storage-title">雲端儲存狀態</div>
              {cloudSummary ? (
                <div className="login-dropdown-storage-grid">
                  <div className="login-dropdown-storage-item">
                    <span className="login-dropdown-storage-value">{cloudSummary.notesCount}</span>
                    <span className="login-dropdown-storage-label">筆記</span>
                  </div>
                  <div className="login-dropdown-storage-item">
                    <span className="login-dropdown-storage-value">{cloudSummary.filesCount}</span>
                    <span className="login-dropdown-storage-label">檔案</span>
                  </div>
                  <div className="login-dropdown-storage-item">
                    <span className="login-dropdown-storage-value">{cloudSummary.chatThreadsCount}</span>
                    <span className="login-dropdown-storage-label">對話</span>
                  </div>
                  <div className="login-dropdown-storage-item">
                    <span className="login-dropdown-storage-value">{cloudSummary.totalMessages}</span>
                    <span className="login-dropdown-storage-label">訊息</span>
                  </div>
                </div>
              ) : (
                <div className="login-dropdown-storage-loading">載入中…</div>
              )}
            </div>
            {onVerifyStorage && (
              <button
                type="button"
                className="login-dropdown-item"
                onClick={runVerify}
                disabled={verifyStatus === 'running'}
                title="比較目前顯示嘅數據同 Google Drive 上面嘅數據是否一致"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 12l2 2 4-4" />
                  <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
                {verifyStatus === 'running' ? '驗證中…' : '驗證儲存'}
              </button>
            )}
            {verifyStatus === 'done' && verifyResult && (
              <div className="login-dropdown-verify-result">
                {verifyResult.match ? (
                  <span className="login-dropdown-verify-ok">✓ 數據一致</span>
                ) : (
                  <div className="login-dropdown-verify-diff">
                    <span className="login-dropdown-verify-warn">✗ 不一致</span>
                    <span className="login-dropdown-verify-details">
                      {[
                        !verifyResult.details.notesMatch && `筆記`,
                        !verifyResult.details.timelineMatch && `時間線`,
                        !verifyResult.details.chatMatch && `對話`,
                        !verifyResult.details.overlaysMatch && `畫布備註`,
                        !verifyResult.details.filesMatch && `檔案`
                      ].filter(Boolean).join('、')}
                    </span>
                    <span className="login-dropdown-verify-counts">
                      顯示：{verifyResult.clientCounts.notes} 筆記 · {verifyResult.clientCounts.chatThreads} 對話 · {verifyResult.clientCounts.filesCount} 檔案 · Drive：{verifyResult.driveCounts.notes} 筆記 · {verifyResult.driveCounts.chatThreads} 對話 · {verifyResult.driveCounts.filesCount} 檔案
                    </span>
                  </div>
                )}
              </div>
            )}
            {verifyStatus === 'error' && (
              <div className="login-dropdown-verify-result">
                <span className="login-dropdown-verify-warn">驗證失敗</span>
              </div>
            )}
            <button
              type="button"
              className="login-dropdown-item"
              onClick={openDrive}
              title="在 Google Drive 入面，此 app 嘅數據存喺隱藏嘅 app data 資料夾，一般介面睇唔到"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              開啟 Google Drive
            </button>
            <button
              type="button"
              className="login-dropdown-item login-dropdown-item--danger"
              onClick={() => { logout(); setDropdownOpen(false) }}
            >
              登出
            </button>
          </div>
        )}
      </div>
    )
  }

  // Disabled for main branch release; re-enable when cloud sync is ready
  const googleLoginDisabled = true

  return (
    <div className={`login-button-container ${className || ''}`}>
      <button 
        className="btn-login"
        onClick={googleLoginDisabled ? undefined : login}
        disabled={googleLoginDisabled}
        title={googleLoginDisabled ? '雲端登入暫停使用' : undefined}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        以 Google 登入
      </button>
    </div>
  )
}

// Styles to be added to index.css
export const loginButtonStyles = `
.login-button-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-info-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--surface);
  border-radius: 16px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.user-info-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border);
}

.user-dropdown-chevron {
  display: flex;
  transition: transform 0.2s;
}

.user-dropdown-chevron.open {
  transform: rotate(180deg);
}

.login-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 200px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  overflow: hidden;
}

.login-dropdown-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-dim);
}

.login-dropdown-email {
  word-break: break-all;
}

.login-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: none;
  border: none;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.login-dropdown-item:hover {
  background: var(--surface-hover);
}

.login-dropdown-item--danger:hover {
  background: rgba(220, 53, 69, 0.15);
  color: #ff6b6b;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--surface);
  border-radius: 16px;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.user-name {
  font-size: 12px;
  color: var(--text);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.login-status {
  font-size: 12px;
  color: var(--text-dim);
}

.login-status.loading {
  opacity: 0.7;
}

.btn-login {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.btn-login:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
}

.btn-login svg {
  flex-shrink: 0;
}

.btn-logout {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-dim);
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.btn-logout:hover {
  background: var(--danger-bg);
  color: var(--danger);
  border-color: var(--danger);
}
`
