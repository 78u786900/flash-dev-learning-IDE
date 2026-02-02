interface StatusBarProps {
  projectName: string
  progress: number
  errors: number
  warnings: number
}

export function StatusBar({ projectName, progress, errors, warnings }: StatusBarProps) {
  return (
    <footer className="ide-status">
      <div className="ide-status-left">
        <span>{projectName}</span>
        <span>{errors} errors</span>
        <span>{warnings} warnings</span>
      </div>
      <div className="ide-status-right">
        <div className="ide-status-progress">
          <span>{progress}%</span>
          <div className="bar">
            <div className="fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <span>Cursor Tab</span>
        <span>A Autocomplete</span>
      </div>
    </footer>
  )
}
