/**
 * Audio Transcription Helpers
 */

/**
 * Parse timestamps from transcript
 */
export function parseTimestamps(transcript: string): Array<{
  start: number
  end: number
  text: string
}> {
  const segments: Array<{ start: number; end: number; text: string }> = []
  
  // Format: [00:00] text [00:32] text
  const regex = /\[(\d{2}):(\d{2})\]\s*([^\[]+)/g
  let match
  let lastTimestamp = 0
  
  while ((match = regex.exec(transcript)) !== null) {
    const minutes = parseInt(match[1], 10)
    const seconds = parseInt(match[2], 10)
    const timestamp = minutes * 60 + seconds
    const text = match[3].trim()
    
    if (lastTimestamp > 0) {
      segments[segments.length - 1].end = timestamp
    }
    
    segments.push({
      start: timestamp,
      end: timestamp,  // will be updated in next iteration
      text
    })
    
    lastTimestamp = timestamp
  }
  
  return segments
}

/**
 * Segment long transcript into chunks
 */
export function segmentTranscript(
  transcript: string,
  maxSegmentLength: number = 60  // seconds
): Array<{ start: number; end: number; text: string }> {
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim())
  const segments = []
  
  let currentSegment = {
    start: 0,
    end: 0,
    text: ''
  }
  
  const wordsPerSecond = 2.5  // average speaking rate
  
  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length
    const sentenceDuration = sentenceWords / wordsPerSecond
    
    if (currentSegment.end - currentSegment.start + sentenceDuration > maxSegmentLength && currentSegment.text) {
      segments.push({ ...currentSegment })
      currentSegment = {
        start: currentSegment.end,
        end: currentSegment.end + sentenceDuration,
        text: sentence.trim()
      }
    } else {
      currentSegment.text += (currentSegment.text ? '. ' : '') + sentence.trim()
      currentSegment.end += sentenceDuration
    }
  }
  
  if (currentSegment.text) {
    segments.push(currentSegment)
  }
  
  return segments
}

/**
 * Detect topic boundaries in transcript
 */
export function detectTopicBoundaries(segments: Array<{ text: string }>): number[] {
  const boundaries: number[] = []
  
  // Simple heuristic: detect transition phrases
  const transitionPhrases = [
    'now let\'s move on',
    'next topic',
    'in conclusion',
    'moving forward',
    'another important point'
  ]
  
  for (let i = 0; i < segments.length; i++) {
    const text = segments[i].text.toLowerCase()
    for (const phrase of transitionPhrases) {
      if (text.includes(phrase)) {
        boundaries.push(i)
        break
      }
    }
  }
  
  return boundaries
}

/**
 * Format duration as HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Build search index from segments
 */
export function buildSearchIndex(segments: Array<{ start: number; end: number; text: string }>): Map<string, number[]> {
  const index = new Map<string, number[]>()
  
  segments.forEach((segment) => {
    const words = segment.text.toLowerCase().split(/\s+/)
    words.forEach(word => {
      const cleaned = word.replace(/[^\w]/g, '')
      if (cleaned.length > 2) {
        if (!index.has(cleaned)) {
          index.set(cleaned, [])
        }
        index.get(cleaned)!.push(segment.start)
      }
    })
  })
  
  return index
}
