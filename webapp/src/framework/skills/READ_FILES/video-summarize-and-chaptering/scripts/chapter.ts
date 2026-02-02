/**
 * Video Chaptering Helpers
 */

/**
 * Detect scene changes by comparing frames
 */
export function detectSceneChanges(
  frames: ImageData[],
  threshold: number = 0.3
): number[] {
  const changes: number[] = []
  
  for (let i = 1; i < frames.length; i++) {
    const diff = compareFrames(frames[i - 1], frames[i])
    if (diff > threshold) {
      changes.push(i)
    }
  }
  
  return changes
}

/**
 * Compare two frames and return difference score (0-1)
 */
function compareFrames(frame1: ImageData, frame2: ImageData): number {
  if (frame1.data.length !== frame2.data.length) return 1
  
  let totalDiff = 0
  const pixels = frame1.data.length / 4
  
  for (let i = 0; i < frame1.data.length; i += 4) {
    const r1 = frame1.data[i]
    const g1 = frame1.data[i + 1]
    const b1 = frame1.data[i + 2]
    
    const r2 = frame2.data[i]
    const g2 = frame2.data[i + 1]
    const b2 = frame2.data[i + 2]
    
    const pixelDiff = (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)) / (3 * 255)
    totalDiff += pixelDiff
  }
  
  return totalDiff / pixels
}

/**
 * Extract key phrase from text segment
 */
export function extractKeyPhrase(text: string, maxLength: number = 60): string {
  // Remove filler words
  const fillers = ['um', 'uh', 'like', 'you know', 'sort of', 'kind of']
  let cleaned = text
  fillers.forEach(filler => {
    cleaned = cleaned.replace(new RegExp(`\\b${filler}\\b`, 'gi'), '')
  })
  
  // Get first sentence
  const sentences = cleaned.split(/[.!?]+/)
  let title = sentences[0].trim()
  
  // Truncate if too long
  if (title.length > maxLength) {
    title = title.slice(0, maxLength - 3) + '...'
  }
  
  // Capitalize first letter
  if (title.length > 0) {
    title = title[0].toUpperCase() + title.slice(1)
  }
  
  return title || 'Chapter'
}

/**
 * Merge short chapters
 */
export function mergeShortChapters(
  chapters: Array<{ start: number; end: number; title: string }>,
  minLength: number
): Array<{ start: number; end: number; title: string }> {
  const merged: Array<{ start: number; end: number; title: string }> = []
  
  let i = 0
  while (i < chapters.length) {
    const current = chapters[i]
    const duration = current.end - current.start
    
    if (duration < minLength && i < chapters.length - 1) {
      // Merge with next chapter
      const next = chapters[i + 1]
      merged.push({
        start: current.start,
        end: next.end,
        title: `${current.title} & ${next.title}`
      })
      i += 2
    } else {
      merged.push(current)
      i++
    }
  }
  
  return merged
}

/**
 * Split long chapters
 */
export function splitLongChapters(
  chapters: Array<{ start: number; end: number; title: string }>,
  maxLength: number
): Array<{ start: number; end: number; title: string }> {
  const split: Array<{ start: number; end: number; title: string }> = []
  
  for (const chapter of chapters) {
    const duration = chapter.end - chapter.start
    
    if (duration > maxLength) {
      // Split into equal parts
      const parts = Math.ceil(duration / maxLength)
      const partDuration = duration / parts
      
      for (let i = 0; i < parts; i++) {
        split.push({
          start: chapter.start + i * partDuration,
          end: chapter.start + (i + 1) * partDuration,
          title: `${chapter.title} (Part ${i + 1})`
        })
      }
    } else {
      split.push(chapter)
    }
  }
  
  return split
}
