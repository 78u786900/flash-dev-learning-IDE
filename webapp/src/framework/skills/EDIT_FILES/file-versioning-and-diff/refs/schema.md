# File Versioning - Complete Structure

## Input Schema
```typescript
interface FileVersioningInput {
  fileId: string
  newContent: Blob | string
  changeDescription: string
  changedBy: 'user' | 'agent'
  skillName?: string
}
```

## Output Schema
```typescript
interface FileVersioningOutput {
  versionId: string
  previousVersion: string
  diff: {
    html: string
    text: string
    summary: {
      linesAdded: number
      linesRemoved: number
      linesChanged: number
      percentChange: number
    }
  }
  changeDescription: string
  timestamp: number
}
```

## Versioning Rules
- Keep last 10 versions
- Always keep version 1 (original)
- Generate diff for text files
- For binary: compare size + checksum

## Example
```json
{
  "versionId": "v4-file-123",
  "previousVersion": "v3-file-123",
  "diff": {
    "summary": {
      "linesAdded": 8,
      "linesRemoved": 5,
      "percentChange": 12.3
    }
  },
  "changeDescription": "Expanded section 2"
}
```
