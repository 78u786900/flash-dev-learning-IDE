/**
 * File Versioning - Diff Generation
 */

/**
 * Generate diff between two text contents
 */
export function generateDiff(oldContent: string, newContent: string): any {
  // Simple line-by-line diff
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  
  const added = []
  const removed = []
  const changed = []
  
  let linesAdded = 0
  let linesRemoved = 0
  
  // Simple algorithm: compare line by line
  const maxLen = Math.max(oldLines.length, newLines.length)
  
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i]
    const newLine = newLines[i]
    
    if (!oldLine && newLine) {
      added.push({ line: i + 1, content: newLine })
      linesAdded++
    } else if (oldLine && !newLine) {
      removed.push({ line: i + 1, content: oldLine })
      linesRemoved++
    } else if (oldLine !== newLine) {
      changed.push({ line: i + 1, old: oldLine, new: newLine })
    }
  }
  
  const totalLines = oldLines.length
  const percentChange = ((linesAdded + linesRemoved) / totalLines) * 100
  
  return {
    added,
    removed,
    changed,
    summary: {
      linesAdded,
      linesRemoved,
      linesChanged: changed.length,
      percentChange: Math.round(percentChange * 10) / 10
    }
  }
}

/**
 * Format diff as text
 */
export function diffToText(diff: any): string {
  let text = ''
  
  for (const item of diff.removed) {
    text += `- ${item.content}\n`
  }
  
  for (const item of diff.added) {
    text += `+ ${item.content}\n`
  }
  
  return text
}

/**
 * Create version ID
 */
export function createVersionId(fileId: string, versionNumber: number): string {
  return `v${versionNumber}-${fileId}`
}
