# Example 1: PDF File

## Input
```json
{
  "fileId": "file-123",
  "force": false
}
```

## File Content
- `lecture_notes.pdf` (20 pages)
- Table of contents on page 1
- 3 chapters

## Output
```json
{
  "file_id": "file-123",
  "type": "pdf",
  "mime": "application/pdf",
  "structure": {
    "type": "pdf",
    "pages": 20,
    "chapters": [
      { "title": "Chapter 1: Introduction", "page": 2 },
      { "title": "Chapter 2: Methodology", "page": 8 },
      { "title": "Chapter 3: Results", "page": 15 }
    ]
  },
  "chunks": [
    {
      "id": "chunk-1",
      "fileId": "file-123",
      "index": 0,
      "content": "Chapter 1: Introduction\n\nThis chapter introduces the fundamental concepts...",
      "type": "text",
      "metadata": { "page": 2 }
    },
    {
      "id": "chunk-2",
      "fileId": "file-123",
      "index": 1,
      "content": "The research methodology follows a quantitative approach...",
      "type": "text",
      "metadata": { "page": 8 }
    }
  ],
  "embeddingsReady": false,
  "indexedAt": 1738368000000
}
```

---

# Example 2: Code File (TypeScript)

## Input
```json
{
  "fileId": "file-456",
  "force": false
}
```

## File Content: `utils.ts`
```typescript
import { config } from './config'

export function calculateSum(a: number, b: number): number {
  return a + b
}

export class Calculator {
  multiply(x: number, y: number): number {
    return x * y
  }
}
```

## Output
```json
{
  "file_id": "file-456",
  "type": "code",
  "mime": "text/typescript",
  "structure": {
    "type": "code",
    "functions": [
      { "name": "calculateSum", "line": 3 },
      { "name": "Calculator.multiply", "line": 8 }
    ]
  },
  "chunks": [
    {
      "id": "chunk-1",
      "fileId": "file-456",
      "index": 0,
      "content": "import { config } from './config'\n\nexport function calculateSum(a: number, b: number): number {\n  return a + b\n}",
      "type": "code",
      "metadata": { "startLine": 1, "endLine": 5 }
    },
    {
      "id": "chunk-2",
      "fileId": "file-456",
      "index": 1,
      "content": "export class Calculator {\n  multiply(x: number, y: number): number {\n    return x * y\n  }\n}",
      "type": "code",
      "metadata": { "startLine": 7, "endLine": 11 }
    }
  ],
  "embeddingsReady": false,
  "indexedAt": 1738368000000
}
```

---

# Example 3: XLSX File

## Input
```json
{
  "fileId": "file-789",
  "force": false
}
```

## File Content: `sales_data.xlsx`
- Sheet1: "Q1 Sales" (100 rows)
- Sheet2: "Q2 Sales" (150 rows)

## Output
```json
{
  "file_id": "file-789",
  "type": "xlsx",
  "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "structure": {
    "type": "xlsx",
    "sheets": ["Q1 Sales", "Q2 Sales"]
  },
  "chunks": [
    {
      "id": "chunk-1",
      "fileId": "file-789",
      "index": 0,
      "content": "[{\"Product\":\"A\",\"Sales\":1000},{\"Product\":\"B\",\"Sales\":1500}]",
      "type": "table",
      "metadata": { "sheet": "Q1 Sales" }
    }
  ],
  "embeddingsReady": false,
  "indexedAt": 1738368000000
}
```
