# Input Schema

```typescript
interface SemanticSearchInput {
  query: string
  fileIds?: string[]
  selection?: SelectionContext
  maxResults?: number  // default: 5
}
```

# Output Schema

```typescript
interface SemanticSearchOutput {
  query: string
  results: Array<{
    file_id: string
    file_name: string
    location: string  // "page:5", "line:120", "slide:3"
    quote: string
    confidence: number  // 0-1
    context?: string  // surrounding text
  }>
  totalMatches: number
  searchTime: number  // ms
}
```

# Search Rules

- Minimum confidence: 0.5
- Quote max length: 200 chars
- Context: ±2 sentences around match
- Deduplicate: same file + same page = 1 result
