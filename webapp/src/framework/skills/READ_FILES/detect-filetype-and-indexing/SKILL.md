---
name: detect-filetype-and-indexing
description: Detect file type, extract structure (pages/slides/sheets), build searchable index. Use when user uploads a file, asks "what type is this", or wants to analyze/index a file.
version: "1.0.0"
---

# Skill: Detect File Type and Indexing 🗂️

## Purpose
Detect uploaded file type, extract internal structure (pages, slides, sheets, functions), build searchable index for faster future operations.

## When to Use
- New file upload/import
- File not yet indexed
- User asks "what type is this file?" or "analyze this file"

## Input Contract
- `fileId`: string (required)
- `force`: boolean (optional, re-index even if already done)

## Workflow

### Step 1: Detect MIME type and extension
- Read file headers
- Validate MIME type
- Map to internal type: `pdf | docx | xlsx | pptx | image | audio | video | code | text`

### Step 2: Extract structure based on type

#### PDF
- Use pdf.js to count pages
- Extract table of contents (if available)
- Build page index

#### DOCX
- Parse XML structure
- Extract headings → chapters
- Count paragraphs, images, tables

#### XLSX
- List all sheet names
- Count rows/cols per sheet
- Detect data types

#### PPTX
- Count slides
- Extract slide titles
- Detect master layout

#### Image
- Get dimensions (width × height)
- Detect format (JPEG, PNG, etc)

#### Audio/Video
- Extract duration (seconds)
- Get codec info
- Extract metadata (title, artist if available)

#### Code
- Detect language (by extension)
- Parse functions/classes (basic AST)
- Build dependency list (imports)

### Step 3: Chunk content (for semantic search)
- Split into logical chunks (pages, sections, slides, functions)
- Each chunk max 500 tokens
- Preserve context (include headers, line numbers)

### Step 4: Mark embeddings build (optional, not in MVP)
- Schedule embedding generation (future feature)
- For now: `embeddingsReady = false`

## Output Contract
Must return JSON:
```json
{
  "file_id": "uuid",
  "type": "pdf|docx|xlsx|...",
  "structure": {
    "pages": 10,
    "chapters": [{"title": "...", "page": 1}]
  },
  "chunks": [
    {"id": "chunk-1", "content": "...", "page": 1}
  ],
  "embeddingsReady": false
}
```

## Atomic Tools Used
- `fileIO.readFile(fileId)`
- `fileIO.detectMime(blob)`
- `extract.pdfStructure(blob)`
- `extract.docxStructure(blob)`
- `extract.xlsxSheets(blob)`
- `extract.pptxSlides(blob)`
- `extract.imageMetadata(blob)`
- `extract.mediaMetadata(blob)`
- `extract.codeAST(content, language)`

## Verification Rules
- Structure must contain at least one field (pages, sheets, slides, etc)
- Chunks must be non-empty array
- Each chunk must have `id`, `content`, `metadata`

## Error Handling
- If file corrupted → return error with partial structure
- If unsupported type → return generic structure with content preview
- If parsing fails → fallback to plain text chunking

## Estimated Tokens
~1000 tokens (structure analysis)

## Example Usage
User uploads `lecture_notes.pdf`
→ Skill detects 20 pages, builds 20 chunks
→ Returns structure with page index
→ File now ready for semantic search
