interface HeaderProps {
  onToggleLock: () => void
  onOpenCommand: () => void
  onOpenTimer: () => void
  fullscreenLock: boolean
}

export function Header({ onToggleLock, onOpenCommand, onOpenTimer, fullscreenLock }: HeaderProps) {
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
      <div className="ide-header-nav">
        <button type="button" aria-label="Back">‹</button>
        <button type="button" aria-label="Forward">›</button>
      </div>
      <span className="ide-header-title">learning_IDE</span>
      <div className="ide-header-actions">
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
