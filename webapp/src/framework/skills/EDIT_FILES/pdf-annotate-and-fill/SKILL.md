# Skill: PDF Annotate and Fill 🧾✍️

## Purpose
Add highlights, comments, fill form fields in PDF. Prefer overlays for non-destructive annotations. Only modify PDF when necessary (forms, signatures).

## When to Use
- User wants to "highlight this paragraph"
- User asks "add comment to this page"
- User needs to "fill form fields"
- User wants "annotate PDF"

## Input Contract
- `fileId`: string (required)
- `action`: 'highlight' | 'comment' | 'fill_form' | 'annotate_region'
- `page`: number (required)
- `bbox`: BoundingBox (optional, for highlights/regions)
- `text`: string (optional, comment text or form value)
- `color`: string (optional, highlight color, default: yellow)

## Workflow

### Step 1: Determine annotation type

#### A) Highlight (non-destructive → overlay)
- Create overlay attached to PDF page
- Use transparent yellow background
- Position overlay over text bbox
```typescript
const overlay = createHighlightOverlay({
  fileId,
  page,
  bbox,
  color: 'rgba(255, 255, 0, 0.3)'
})
```

#### B) Comment (non-destructive → overlay)
- Create overlay with comment bubble
- Position at bbox or page corner
- Allow user to move/resize
```typescript
const overlay = createTextOverlay(
  { fileId, anchor: 'page', anchorRef: `page:${page}` },
  text,
  { x: bbox.x, y: bbox.y },
  { w: 200, h: 100 }
)
overlay.style.border = 'thin'
overlay.style.backgroundColor = 'rgba(255, 250, 205, 0.95)'  // light yellow
```

#### C) Fill Form (destructive → modify PDF)
⚠️ This requires actual PDF modification
- Use pdf-lib to load PDF
- Find form field by name
- Set field value
- Save modified PDF as new version
```typescript
import { PDFDocument } from 'pdf-lib'

const pdfDoc = await PDFDocument.load(pdfBytes)
const form = pdfDoc.getForm()
const field = form.getTextField('fullName')
field.setText(text)

const modifiedPdfBytes = await pdfDoc.save()
// Create new version
await createVersion(fileId, modifiedPdfBytes, `Filled form field: ${fieldName}`, 'user')
```

#### D) Annotate Region (non-destructive → overlay)
- Draw arrow, circle, rectangle as overlay
- Use SVG for vector graphics
```typescript
const svgCode = `
<svg width="${bbox.w}" height="${bbox.h}">
  <rect x="0" y="0" width="${bbox.w}" height="${bbox.h}" 
        fill="none" stroke="red" stroke-width="3"/>
  <text x="10" y="20" fill="red">${text}</text>
</svg>
`
const overlay = createCodeOverlay(
  { fileId, anchor: 'page', anchorRef: `page:${page}` },
  'svg',
  svgCode,
  { x: bbox.x, y: bbox.y },
  { w: bbox.w, h: bbox.h }
)
```

### Step 2: Save annotation
- If overlay → add to overlays array
- If PDF modification → create new version + diff
- Log action in timeline

### Step 3: Update UI
- Re-render PDF page with overlays
- Show annotation list in sidebar
- Allow edit/delete annotations

## Output Contract
```json
{
  "action": "highlight",
  "page": 5,
  "bbox": {"x": 100, "y": 200, "w": 300, "h": 20},
  "overlay": {
    "id": "overlay-123",
    "type": "highlight",
    "color": "rgba(255, 255, 0, 0.3)"
  }
}
```

Or for form fill:
```json
{
  "action": "fill_form",
  "field": "studentName",
  "value": "Alice Wong",
  "versionId": "v3-form-456"
}
```

## Atomic Tools Used
- `fileIO.getPdfPage(fileId, page)`
- `overlay.createHighlight(fileId, page, bbox, color)`
- `overlay.createComment(fileId, page, text, position)`
- `overlay.createSvgAnnotation(fileId, page, svgCode, position)`
- `extract.getPdfFormFields(pdfBytes)`
- `transform.fillPdfForm(pdfBytes, fieldName, value)`
- `fileIO.createVersion(fileId, newContent, description)`

## Verification Rules
- Overlays: must have valid position within page bounds
- Form fill: field must exist in PDF
- Annotations: bbox must not exceed page dimensions

## Error Handling
- If page doesn't exist → return error
- If form field not found → list available fields
- If overlay creation fails → fallback to PDF comment (if supported)

## Estimated Tokens
~2000 tokens (annotation + optional form processing)

## Example Usage

**Scenario 1: Highlight text**
User selects paragraph on page 3
→ Creates yellow highlight overlay
→ User can see highlight without modifying PDF

**Scenario 2: Add comment**
User right-clicks page 7 → "Add comment"
→ Creates comment overlay with text input
→ Comment appears as sticky note

**Scenario 3: Fill form**
PDF has form field "studentID"
User types "12345"
→ PDF modified, new version created
→ Diff shows: `studentID: "" → "12345"`
