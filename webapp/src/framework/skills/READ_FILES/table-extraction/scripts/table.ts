/**
 * Convert table array to CSV
 */
export function tableToCsv(table: string[][]): string {
  return table.map(row => 
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma
      if (cell.includes(',') || cell.includes('"')) {
        return `"${cell.replace(/"/g, '""')}"`
      }
      return cell
    }).join(',')
  ).join('\n')
}

/**
 * Validate table structure
 */
export function validateTable(table: string[][]): { valid: boolean; errors: string[] } {
  const errors = []
  
  if (table.length < 2) {
    errors.push('Table must have at least 2 rows (header + data)')
  }
  
  const colCount = table[0]?.length || 0
  for (let i = 1; i < table.length; i++) {
    if (table[i].length !== colCount) {
      errors.push(`Row ${i} has ${table[i].length} columns, expected ${colCount}`)
    }
  }
  
  return { valid: errors.length === 0, errors }
}
