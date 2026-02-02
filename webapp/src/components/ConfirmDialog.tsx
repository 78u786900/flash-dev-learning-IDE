import { useEffect } from 'react'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** When true, confirm button uses danger (red) style */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '確定',
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="ide-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ide-confirm-title"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="ide-confirm-dialog">
        <h2 id="ide-confirm-title" className="ide-confirm-title">{title}</h2>
        <p className="ide-confirm-message">{message}</p>
        <div className="ide-confirm-actions">
          <button
            type="button"
            className="ide-confirm-btn ide-confirm-cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`ide-confirm-btn ide-confirm-confirm ${danger ? 'ide-confirm-danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
