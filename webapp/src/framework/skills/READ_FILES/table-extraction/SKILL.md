# Skill: Table Extraction 📊

## Purpose
Extract tables from PDF/image to structured data (CSV/JSON). Detect rows, columns, headers, and normalize output.

## When to Use
- User asks "extract table from this PDF"
- User wants to "convert table to spreadsheet"
- User needs data from table for analysis

## Input Contract
- `fileId`: string (required)
- `page`: number (optional, if PDF)
- `bbox`: BoundingBox (optional, specific table region)
- `hasHeader`: boolean (optional, default: true)

## Workflow

### Step 1: Detect table region(s)
If bbox provided:
- Extract that region only
Else:
- Scan page/image for table-like structures
- Look for: grid lines, aligned text, repeated patterns

### Step 2: Extract table structure
**For PDF** (use pdf.js + custom table parser):
- Detect grid lines (horizontal + vertical)
- Group text by cells (bounding box intersection)
- Order by row/col position

**For Image** (use Gemini Vision):
```typescript
const prompt = `Extract the table from this image as JSON.
Format: {
  "headers": ["col1", "col2", ...],
  "rows": [["val1", "val2", ...], ...]
}
Preserve all data accurately.`
const result = await callGeminiVision(imageDataUrl, prompt)
```

### Step 3: Parse and normalize
- Trim whitespace from cells
- Detect data types (number, text, date)
- Handle merged cells (span multiple rows/cols)
- Handle empty cells

### Step 4: Identify headers
If `hasHeader = true`:
- First row = headers
- Rest = data rows
Else:
- Generate generic headers: "Column A", "Column B", etc

### Step 5: Convert to formats
**JSON**:
```json
{
  "headers": ["Name", "Age", "Grade"],
  "rows": [
    ["Alice", "12", "A"],
    ["Bob", "13", "B+"]
  ]
}
```

**CSV**:
```csv
Name,Age,Grade
Alice,12,A
Bob,13,B+
```

### Step 6: Validate output
- Check row consistency (all rows same length)
- Check data types (warn if mixed types in column)
- Compute confidence based on structure quality

## Output Contract
Must include:
- `table`: array of arrays (or JSON)
- `csv`: CSV string
- `headers`: array of column names
- `rows`: number of data rows
- `confidence`: 0-1 score

## Atomic Tools Used
- `fileIO.getPdfPage(fileId, page)`
- `fileIO.cropImage(imageDataUrl, bbox)`
- `extract.detectTableRegions(pageImage)`
- `extract.parseTableStructure(region)`
- `ocr.callGeminiVision(imageDataUrl, prompt)`
- `transform.tableToCsv(table)`
- `transform.validateTable(table)`

## Verification Rules
- All rows must have same number of columns
- At least 2 rows (header + 1 data row)
- Confidence >= 0.6 (warn if lower → manual review)

## Error Handling
- If no table detected → return error "No table found in region"
- If malformed table → return partial result + warning
- If text too messy → return raw OCR text + suggestion

## Estimated Tokens
~2000 tokens (Gemini Vision call + parsing)

## Example Usage
**User**: Selects table in PDF showing student grades
**Input**: Page 5, bbox {x: 100, y: 200, w: 400, h: 300}
**Output**:
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
