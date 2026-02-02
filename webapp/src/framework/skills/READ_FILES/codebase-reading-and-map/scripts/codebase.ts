/**
 * Codebase Analysis Helpers
 */

/**
 * Scan directory recursively
 */
export function scanDirectory(
  files: Array<{ path: string; content: string }>,
  maxDepth: number
): string[] {
  return files
    .filter(f => {
      const depth = f.path.split('/').length
      return depth <= maxDepth
    })
    .map(f => f.path)
    .filter(path => !shouldIgnore(path))
}

/**
 * Check if path should be ignored
 */
function shouldIgnore(path: string): boolean {
  const ignorePatterns = [
    'node_modules',
    '.git',
    'build',
    'dist',
    '.next',
    'coverage',
    '.DS_Store'
  ]
  
  return ignorePatterns.some(pattern => path.includes(pattern))
}

/**
 * Parse imports from code
 */
export function parseImports(content: string, language: string): string[] {
  const imports: string[] = []
  
  if (language === 'typescript' || language === 'javascript') {
    // import { x } from 'module'
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1])
    }
    
    // require('module')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1])
    }
  } else if (language === 'python') {
    // import module / from module import x
    const pyImportRegex = /(?:import|from)\s+([\w.]+)/g
    let match
    while ((match = pyImportRegex.exec(content)) !== null) {
      imports.push(match[1])
    }
  }
  
  return imports
}

/**
 * Count lines of code (excluding comments and empty lines)
 */
export function countLOC(content: string): number {
  const lines = content.split('\n')
  let loc = 0
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
      loc++
    }
  }
  
  return loc
}

/**
 * Generate Mermaid dependency graph
 */
export function generateDependencyGraph(
  dependencies: Record<string, string[]>
): string {
  const lines = ['graph LR']
  const nodeIds = new Map<string, string>()
  let nodeCounter = 0
  
  // Create node IDs
  for (const file of Object.keys(dependencies)) {
    const id = String.fromCharCode(65 + nodeCounter++)  // A, B, C, ...
    const name = file.split('/').pop() || file
    nodeIds.set(file, id)
    lines.push(`  ${id}[${name}]`)
  }
  
  // Create edges
  for (const [file, deps] of Object.entries(dependencies)) {
    const fromId = nodeIds.get(file)
    for (const dep of deps) {
      if (dep.startsWith('.')) {
        // Relative import
        const toId = nodeIds.get(dep) || nodeIds.get(resolvePath(file, dep))
        if (toId) {
          lines.push(`  ${fromId} --> ${toId}`)
        }
      }
    }
  }
  
  return lines.join('\n')
}

function resolvePath(from: string, to: string): string {
  const fromParts = from.split('/').slice(0, -1)
  const toParts = to.split('/')
  
  for (const part of toParts) {
    if (part === '..') {
      fromParts.pop()
    } else if (part !== '.') {
      fromParts.push(part)
    }
  }
  
  return fromParts.join('/')
}
