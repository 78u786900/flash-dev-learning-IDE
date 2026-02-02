# Input Schema

```typescript
interface DetectFiletypeInput {
  fileId: string
  force?: boolean  // re-index even if already done
}
```

# Output Schema

```typescript
interface DetectFiletypeOutput {
  file_id: string
  type: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'audio' | 'video' | 'code' | 'text'
  mime: string
  structure: {
    type: string
    pages?: number
    slides?: number
    sheets?: string[]
    chapters?: Array<{ title: string; page: number }>
    functions?: Array<{ name: string; line: number }>
  }
  chunks: Array<{
    id: string
    fileId: string
    index: number
    content: string
    type: 'text' | 'image' | 'table' | 'code'
    metadata?: {
      page?: number
      slide?: number
      sheet?: string
      startLine?: number
      endLine?: number
    }
  }>
  embeddingsReady: boolean
  indexedAt: number
}
```

# File Type Detection Rules

## By Extension
- `.pdf` → pdf
- `.docx`, `.doc` → docx
- `.xlsx`, `.xls` → xlsx
- `.pptx`, `.ppt` → pptx
- `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg` → image
- `.mp3`, `.wav`, `.m4a`, `.ogg` → audio
- `.mp4`, `.webm`, `.mov`, `.avi` → video
- `.js`, `.ts`, `.tsx`, `.py`, `.java`, `.cpp`, `.go` → code
- `.txt`, `.md` → text

## By MIME Type (fallback)
- `application/pdf` → pdf
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → docx
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` → xlsx
- `application/vnd.openxmlformats-officedocument.presentationml.presentation` → pptx
- `image/*` → image
- `audio/*` → audio
- `video/*` → video
- `text/*` → text

## Chunking Rules

### Text Files (PDF, DOCX, TXT, MD)
- Max chunk size: 500 tokens (~2000 chars)
- Split by: paragraphs, then sentences
- Preserve: context (previous heading, page number)

### Code Files
- Max chunk size: 100 lines or 500 tokens
- Split by: functions, classes
- Preserve: imports, function signatures

### Spreadsheets
- Each cell range (e.g., A1:Z100) = 1 chunk
- Max 1000 cells per chunk

### Presentations
- Each slide = 1 chunk
- Include: slide title, content, notes
