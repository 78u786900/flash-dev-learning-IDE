/**
 * Canvas Overlay - Creation Helpers
 */

/**
 * Generate unique overlay ID
 */
export function generateOverlayId(): string {
  return `overlay-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Generate unique block ID
 */
export function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Validate attachment target
 */
export function validateAttachment(attachedTo: any, files: any[], notes: any[]): {
  valid: boolean
  error?: string
} {
  if (attachedTo.fileId) {
    const file = files.find(f => f.id === attachedTo.fileId)
    if (!file) {
      return { valid: false, error: 'File not found' }
    }
    
    // Validate anchor
    if (attachedTo.anchor === 'page') {
      const pageNum = parseInt(attachedTo.anchorRef.split(':')[1])
      if (file.metadata.pages && pageNum > file.metadata.pages) {
        return { valid: false, error: 'Page out of range' }
      }
    }
  }
  
  if (attachedTo.noteId) {
    const note = notes.find(n => n.id === attachedTo.noteId)
    if (!note) {
      return { valid: false, error: 'Note not found' }
    }
  }
  
  return { valid: true }
}

/**
 * Validate position within bounds
 */
export function validatePosition(
  position: { x: number; y: number },
  size: { w: number; h: number },
  containerSize: { w: number; h: number }
): { valid: boolean; adjusted?: { x: number; y: number } } {
  if (position.x + size.w > containerSize.w || position.y + size.h > containerSize.h) {
    // Auto-adjust
    return {
      valid: false,
      adjusted: {
        x: Math.min(position.x, containerSize.w - size.w),
        y: Math.min(position.y, containerSize.h - size.h)
      }
    }
  }
  
  return { valid: true }
}
