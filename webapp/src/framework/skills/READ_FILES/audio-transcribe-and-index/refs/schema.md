# Input Schema

```typescript
interface AudioTranscribeInput {
  fileId: string
  timeRange?: {
    start: number  // seconds
    end: number    // seconds
  }
  language?: string  // default: auto-detect
  speakerDiarization?: boolean  // identify different speakers
}
```

# Output Schema

```typescript
interface AudioTranscribeOutput {
  transcript: string  // full transcript
  segments: Array<{
    start: number      // seconds
    end: number        // seconds
    text: string
    speaker?: string   // if diarization enabled
  }>
  duration: number     // total duration in seconds
  language: string
  confidence: number   // 0-1
  timestamps: Array<{
    time: number       // seconds
    label: string      // e.g., "Introduction", "Main Topic"
  }>
}
```

# Processing Rules

- Segment length: 30-60 seconds
- Minimum confidence: 0.5
- Speaker labels: "Speaker 1", "Speaker 2", etc.
- Timestamp format: seconds from start
