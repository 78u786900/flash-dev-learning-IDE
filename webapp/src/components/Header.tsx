import { LoginButton } from './LoginButton'
import { StorageUsageIndicator } from './StorageUsageIndicator'

interface HeaderProps {
  onToggleLock: () => void
  onOpenCommand: () => void
  onOpenTimer: () => void
  fullscreenLock: boolean
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function Header({
  onToggleLock,
  onOpenCommand,
  onOpenTimer,
  fullscreenLock,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: HeaderProps) {
  return (
    <header className="ide-header">
      <nav className="ide-header-menu">
        <span>File</span>
        <span>Edit</span>
        <span>Selection</span>
        <span>View</span>
        <span>Go</span>
        <span>Run</span>
        <span>Terminal</span>
        <span>Help</span>
      </nav>
      <span className="ide-header-title">flash.dev</span>
      <div className="ide-header-actions">
        <StorageUsageIndicator />
        <LoginButton />
        <button
          type="button"
          className="ide-header-undo"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <svg
            className="ide-header-undo-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M10 5H6m0 0 3-3M6 5l3 3M6 5h6a6 6 0 0 1 0 12h-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="ide-header-redo"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <svg
            className="ide-header-redo-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M14 5h4m0 0-3-3m3 3-3 3m3-3h-6a6 6 0 0 0 0 12h3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button type="button" className="btn-timer" onClick={onOpenTimer} title="Grinding Timer">
          ⏱️ Timer
        </button>
        <button
          type="button"
          className="btn-lock"
          onClick={onToggleLock}
          title={fullscreenLock ? '離開沉浸模式' : '沉浸式全屏 Lock Down'}
        >
          {fullscreenLock ? '🔓 離開全屏' : '🔒 全屏專注'}
        </button>
        <button type="button" onClick={onOpenCommand} title="Command Palette (Ctrl+P)">
          ⌘ Command
        </button>
      </div>
    </header>
  )
}
