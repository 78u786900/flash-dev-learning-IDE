# Skill: XLSX Clean, Calc and Visualize 📊⚙️

## Purpose
Clean spreadsheet data, compute derived columns, generate charts via overlay rendering. Help students analyze data visually.

## When to Use
- User asks "clean this data"
- User wants to "calculate average for each row"
- User needs "create chart from this data"
- User wants to "visualize trends"

## Input Contract
- `fileId`: string (required)
- `sheet`: string (optional, sheet name, default: first sheet)
- `action`: 'clean' | 'calculate' | 'visualize' | 'pivot'
- `parameters`: object with action-specific params

## Workflow

### Step 1: Parse XLSX
```typescript
import * as XLSX from 'xlsx'

const arrayBuffer = await fetch(file.url).then(r => r.arrayBuffer())
const workbook = XLSX.read(arrayBuffer, { type: 'array' })
const sheetName = parameters.sheet || workbook.SheetNames[0]
const worksheet = workbook.Sheets[sheetName]
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
// data = [['Name', 'Age', 'Grade'], ['Alice', 12, 'A'], ...]
```

### Step 2: Apply action

#### A) Clean Data
Common cleaning operations:
- Remove empty rows
- Trim whitespace
- Fix data types (convert "123" string → 123 number)
- Remove duplicates
- Fill missing values

```typescript
function cleanData(data: any[][]) {
  return data
    .filter(row => row.some(cell => cell !== null && cell !== ''))  // remove empty
    .map(row => row.map(cell => 
      typeof cell === 'string' ? cell.trim() : cell  // trim
    ))
    .filter((row, index, self) => 
      index === self.findIndex(r => JSON.stringify(r) === JSON.stringify(row))  // dedupe
    )
}
```

#### B) Calculate Derived Columns
User specifies formula:
```typescript
{
  action: 'calculate',
  formula: 'SUM(B2:B10)',  // or custom function
  targetColumn: 'Total'
}
```

Compute new column:
```typescript
function addCalculatedColumn(data: any[][], formula: string, colName: string) {
  const headers = data[0]
  headers.push(colName)
  
  for (let i = 1; i < data.length; i++) {
    const result = evaluateFormula(formula, data[i], headers)
    data[i].push(result)
  }
  
  return data
}

function evaluateFormula(formula: string, row: any[], headers: string[]) {
  // Simple eval: SUM, AVERAGE, etc
  if (formula.startsWith('SUM(')) {
    const range = parseRange(formula)  // "B2:B10" → columns B
    return row.slice(range.start, range.end).reduce((a, b) => a + b, 0)
  }
  // More complex: use LLM
  const prompt = `Calculate: ${formula}\nRow data: ${JSON.stringify(row)}\nResult:`
  return await callGemini(prompt)
}
```

#### C) Visualize (Chart Generation)
Supported chart types:
- Line chart (trends over time)
- Bar chart (comparisons)
- Pie chart (proportions)
- Scatter plot (correlations)

```typescript
{
  action: 'visualize',
  chartType: 'bar',
  xColumn: 'Name',
  yColumn: 'Grade',
  title: 'Student Grades'
}
```

Generate Mermaid or Chart.js code:
```typescript
// Option A: Mermaid (simple)
const mermaidCode = `
pie title ${title}
${data.map(row => `"${row[xIdx]}" : ${row[yIdx]}`).join('\n')}
`

// Option B: Chart.js (more control)
const chartConfig = {
  type: 'bar',
  data: {
    labels: data.map(row => row[xIdx]),
    datasets: [{
      label: yColumn,
      data: data.map(row => row[yIdx])
    }]
  }
}
```

Create overlay with rendered chart:
```typescript
const overlay = createCodeOverlay(
  { fileId, anchor: 'sheet', anchorRef: `sheet:${sheetName}` },
  'mermaid',
  mermaidCode,
  { x: 500, y: 100 },
  { w: 400, h: 300 }
)

// Or render to SVG/PNG first
const chartSvg = await renderMermaid(mermaidCode)
const overlay = createImageOverlay(
  { fileId, anchor: 'sheet', anchorRef: `sheet:${sheetName}` },
  chartSvg,
  { x: 500, y: 100 },
  { w: 400, h: 300 }
)
```

#### D) Pivot Table
```typescript
{
  action: 'pivot',
  rows: 'Category',
  columns: 'Month',
  values: 'Sales',
  aggFunc: 'sum'
}
```

Generate pivot:
```typescript
function createPivot(data: any[][], config) {
  const pivot = {}
  // Group by row/col, aggregate values
  // Return new table structure
}
```

### Step 3: Save changes

**If data modified** (clean, calculate):
```typescript
// Create new worksheet
const newWs = XLSX.utils.aoa_to_sheet(cleanedData)
workbook.Sheets[sheetName] = newWs

// Save as new version
const newBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
const newBlob = new Blob([newBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

await createVersion(fileId, newBlob, `${action} on sheet ${sheetName}`, 'agent', 'xlsx-clean-calc-and-visualize')
```

**If chart created** (visualize):
```typescript
// No file modification, only overlay
await addOverlay(overlay)
```

## Output Contract
```json
{
  "action": "visualize",
  "sheet": "Sheet1",
  "overlay": {
    "id": "overlay-chart-456",
    "type": "rendered",
    "chartType": "bar",
    "title": "Student Grades"
  }
}
```

Or for clean/calculate:
```json
{
  "action": "clean",
  "sheet": "Sheet1",
  "versionId": "v4-xlsx-789",
  "changes": {
    "rowsRemoved": 5,
    "duplicatesRemoved": 2,
    "columnsAdded": 1
  }
}
```

## Atomic Tools Used
- `fileIO.getFileBlob(fileId)`
- `extract.parseXlsx(blob)`
- `transform.cleanData(data)`
- `transform.calculateColumn(data, formula)`
- `transform.generateChartCode(data, chartType)`
- `render.mermaidToSvg(code)`
- `overlay.createChartOverlay(fileId, sheet, chartSvg, position)`
- `fileIO.createXlsx(workbook)`
- `fileIO.createVersion(fileId, newBlob, description)`

## Verification Rules
- After clean: no empty rows
- After calculate: new column has values for all rows
- After visualize: chart renders correctly
- Chart data matches source data

## Error Handling
- If formula invalid → return error with suggestion
- If chart type not supported → list supported types
- If sheet not found → list available sheets

## Estimated Tokens
~2500 tokens (analysis + chart generation)

## Example Usage

**Scenario 1: Clean data**
Input: Spreadsheet with empty rows, duplicates
User: "clean this data"
→ Removes 10 empty rows
→ Removes 3 duplicates
→ Trims whitespace
→ Shows diff: "85 rows → 72 rows"

**Scenario 2: Calculate totals**
Input: Sales data with columns [Product, Q1, Q2, Q3, Q4]
User: "add Total column = sum of all quarters"
→ Adds "Total" column
→ Each row shows Q1+Q2+Q3+Q4

**Scenario 3: Visualize trends**
Input: Monthly sales data
User: "create line chart for sales trend"
→ Generates line chart overlay
→ Shows on top of spreadsheet
→ User can move/resize chart
