import { useState, useEffect, useRef, useCallback } from 'react'
import {
  saveApiKey,
  loadAllApiKeys,
  maskKey,
  type ApiKeyProvider,
} from '../storage/apiKeyStore'

const PROVIDERS: { id: ApiKeyProvider; label: string; placeholder: string }[] = [
  { id: 'google', label: 'Google (Gemini)', placeholder: 'AIza...' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
]

interface ApiKeyButtonProps {
  onKeysChange?: (keys: Record<ApiKeyProvider, string>) => void
}

export function ApiKeyButton({ onKeysChange }: ApiKeyButtonProps) {
  const [open, setOpen] = useState(false)
  const [keys, setKeys] = useState<Record<ApiKeyProvider, string>>({
    google: '',
    openai: '',
    anthropic: '',
  })
  const [editing, setEditing] = useState<ApiKeyProvider | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Load keys on mount
  useEffect(() => {
    loadAllApiKeys().then((loaded) => {
      setKeys(loaded)
      onKeysChange?.(loaded)
    })
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setEditing(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSave = useCallback(
    async (provider: ApiKeyProvider) => {
      setSaving(true)
      await saveApiKey(provider, editValue)
      const updated = await loadAllApiKeys()
      setKeys(updated)
      onKeysChange?.(updated)
      setEditing(null)
      setEditValue('')
      setSaving(false)
    },
    [editValue, onKeysChange]
  )

  const handleClear = useCallback(
    async (provider: ApiKeyProvider) => {
      await saveApiKey(provider, '')
      const updated = await loadAllApiKeys()
      setKeys(updated)
      onKeysChange?.(updated)
    },
    [onKeysChange]
  )

  const hasAnyKey = keys.google || keys.openai || keys.anthropic

  return (
    <div className="apikey-button-container" ref={ref}>
      <button
        type="button"
        className={`apikey-trigger ${hasAnyKey ? 'apikey-trigger--active' : ''}`}
        onClick={() => {
          setOpen((o) => !o)
          setEditing(null)
        }}
        title="API Keys"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      </button>

      {open && (
        <div className="apikey-dropdown">
          <div className="apikey-dropdown-header">API Keys</div>
          <div className="apikey-dropdown-hint">
            加密儲存於本地瀏覽器，不會上傳
          </div>
          {PROVIDERS.map((p) => (
            <div key={p.id} className="apikey-provider">
              <div className="apikey-provider-label">{p.label}</div>
              {editing === p.id ? (
                <div className="apikey-edit-row">
                  <input
                    type="password"
                    className="apikey-input"
                    placeholder={p.placeholder}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave(p.id)
                      if (e.key === 'Escape') {
                        setEditing(null)
                        setEditValue('')
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="apikey-save-btn"
                    onClick={() => handleSave(p.id)}
                    disabled={saving}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="apikey-cancel-btn"
                    onClick={() => {
                      setEditing(null)
                      setEditValue('')
                    }}
                  >
                    ✗
                  </button>
                </div>
              ) : keys[p.id] ? (
                <div className="apikey-value-row">
                  <span className="apikey-masked">{maskKey(keys[p.id])}</span>
                  <button
                    type="button"
                    className="apikey-edit-btn"
                    onClick={() => {
                      setEditing(p.id)
                      setEditValue(keys[p.id])
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="apikey-clear-btn"
                    onClick={() => handleClear(p.id)}
                  >
                    ✗
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="apikey-add-btn"
                  onClick={() => {
                    setEditing(p.id)
                    setEditValue('')
                  }}
                >
                  + 設定 Key
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
