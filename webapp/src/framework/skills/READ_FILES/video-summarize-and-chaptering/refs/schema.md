# Input Schema

```typescript
interface VideoChapteringInput {
  fileId: string
  minChapterLength?: number  // seconds, default: 120
  maxChapters?: number       // default: 10
}
```

# Output Schema

```typescript
interface VideoChapteringOutput {
  chapters: Array<{
    index: number
    title: string
    start: number      // seconds
    end: number        // seconds
    summary: string    // 1-2 sentences
    keyPoints: string[]
    thumbnail?: string // data URL
  }>
  totalDuration: number
  totalChapters: number
}
```

# Chaptering Rules

- Minimum chapter: 120 seconds
- Maximum chapter: 600 seconds (10 minutes)
- Chapter title: max 60 characters
- Summary: 1-2 sentences max
