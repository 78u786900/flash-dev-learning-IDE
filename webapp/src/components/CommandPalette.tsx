interface CommandPaletteProps {
  onClose: () => void
  onNewAgent: () => void
  onShowTerminal: () => void
  onHideFiles: () => void
  onSearchFiles: () => void
  onOpenBrowser: () => void
  onMaximizeChat: () => void
}

const commands = [
  { label: 'New Agent', shortcut: 'Ctrl+Shift+L', action: 'onNewAgent' },
  { label: 'Show Terminal', shortcut: 'Ctrl+J', action: 'onShowTerminal' },
  { label: 'Hide Files', shortcut: 'Ctrl+B', action: 'onHideFiles' },
  { label: 'Search Files', shortcut: 'Ctrl+P', action: 'onSearchFiles' },
  { label: 'Open Browser', shortcut: 'Ctrl+Shift+B', action: 'onOpenBrowser' },
  { label: 'Maximize Chat', shortcut: 'Ctrl+Alt+E', action: 'onMaximizeChat' },
]

export function CommandPalette({
  onClose,
  onNewAgent,
  onShowTerminal,
  onHideFiles,
  onSearchFiles,
  onOpenBrowser,
  onMaximizeChat,
}: CommandPaletteProps) {
  const actions: Record<string, () => void> = {
    onNewAgent,
    onShowTerminal,
    onHideFiles,
    onSearchFiles,
    onOpenBrowser,
    onMaximizeChat,
  }

  const run = (action: string) => {
    actions[action]?.()
    onClose()
  }

  return (
    <>
      <div className="ide-overlay" onClick={onClose} aria-hidden />
      <div className="ide-command-palette" role="dialog">
        <input
          type="text"
          placeholder="Type a command..."
          autoFocus
          onKeyDown={e => e.key === 'Escape' && onClose()}
        />
        <div className="ide-command-list">
          {commands.map(cmd => (
            <div
              key={cmd.action}
              className="ide-command-item"
              onClick={() => run(cmd.action)}
            >
              {cmd.label}
              <kbd>{cmd.shortcut}</kbd>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
