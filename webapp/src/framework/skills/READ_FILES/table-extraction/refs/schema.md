# Table Extraction - Schema & Examples

## Input Schema
```typescript
interface TableExtractionInput {
  fileId: string
  page?: number
  bbox?: { x: number; y: number; w: number; h: number }
  hasHeader?: boolean  // default: true
}
```

## Output Schema
```typescript
interface TableExtractionOutput {
  table: string[][]
  csv: string
  headers: string[]
  rows: number
  confidence: number
}
```

## Example
```json
{
  "table": [
    ["Name", "Math", "Science"],
    ["Alice", "95", "88"],
    ["Bob", "87", "92"]
  ],
  "csv": "Name,Math,Science\nAlice,95,88\nBob,87,92",
  "headers": ["Name", "Math", "Science"],
  "rows": 2,
  "confidence": 0.91
}
```
