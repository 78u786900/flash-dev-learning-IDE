/**
 * LaTeX Verification Helpers
 */

/**
 * Extract LaTeX blocks from content
 */
export function extractLatex(content: string): Array<{
  type: 'inline' | 'display'
  source: string
  startIndex: number
  endIndex: number
}> {
  const blocks = []
  
  // Inline: $...$
  const inlineRegex = /\$([^$]+)\$/g
  let match
  while ((match = inlineRegex.exec(content)) !== null) {
    blocks.push({
      type: 'inline' as const,
      source: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length
    })
  }
  
  // Display: $$...$$
  const displayRegex = /\$\$([^$]+)\$\$/g
  while ((match = displayRegex.exec(content)) !== null) {
    blocks.push({
      type: 'display' as const,
      source: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length
    })
  }
  
  return blocks
}

/**
 * Verify LaTeX syntax
 */
export function verifyLatex(source: string): { valid: boolean; errors: string[] } {
  const errors = []
  
  // Check balanced braces
  let braceDepth = 0
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '{') braceDepth++
    if (source[i] === '}') braceDepth--
    if (braceDepth < 0) {
      errors.push(`Unmatched closing brace at position ${i}`)
    }
  }
  if (braceDepth > 0) {
    errors.push('Unclosed braces')
  }
  
  // Check required arguments
  const commands: Record<string, number> = {
    '\\frac': 2,
    '\\sqrt': 1,
    '\\binom': 2
  }
  
  for (const [cmd, argCount] of Object.entries(commands)) {
    const regex = new RegExp(`\\${cmd.slice(1)}`, 'g')
    let match
    while ((match = regex.exec(source)) !== null) {
      const after = source.slice(match.index + cmd.length)
      const args = (after.match(/\{[^}]*\}/g) || []).length
      if (args < argCount) {
        errors.push(`${cmd} missing arguments (expected ${argCount}, got ${args})`)
      }
    }
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Auto-correct common LaTeX errors
 */
export function correctLatexErrors(source: string): string {
  let corrected = source
  
  // Add missing braces for superscripts/subscripts
  corrected = corrected.replace(/\^(\d)/g, '^{$1}')
  corrected = corrected.replace(/_(\d)/g, '_{$1}')
  
  // Fix common typos
  corrected = corrected.replace(/\\fract/g, '\\frac')
  corrected = corrected.replace(/\\beginn/g, '\\begin')
  
  return corrected
}
