# Skill: Region OCR 🖼️🔤

## Purpose
Extract text from selected image region using OCR. Post-correct common errors (especially math symbols). Return editable text with confidence score.

## When to Use
- User selects region on image/PDF with bounding box
- User asks "extract text from this" or "OCR this region"
- User wants to copy text from screenshot

## Input Contract
- `imageDataUrl`: string (required, base64 image)
- `bbox`: BoundingBox (optional, if not provided → OCR whole image)
- `language`: string (optional, default: "eng+chi_tra")
- `mathMode`: boolean (optional, default: false)

## Workflow

### Step 1: Crop image to bbox (if provided)
- Use canvas API to extract region
- Ensure minimum size (20×20 pixels)
- Resize if too large (max 2000×2000)

### Step 2: Preprocess image
- Convert to grayscale
- Increase contrast (optional)
- Denoise (optional, if confidence low)

### Step 3: Call OCR API
**Option A: Gemini Vision API** (recommended for MVP)
```typescript
const prompt = mathMode 
  ? "Extract all text and mathematical formulas from this image. Output LaTeX for math symbols."
  : "Extract all text from this image, preserving layout and structure."

const result = await callGeminiVision(imageDataUrl, prompt)
```

**Option B: Tesseract.js** (fallback, client-side)
```typescript
const result = await Tesseract.recognize(imageDataUrl, language)
```

### Step 4: Post-correction (for math mode)
Common OCR errors in math:
- `O` (letter O) → `0` (zero)
- `l` (lowercase L) → `1` (one)
- `x` (letter x) → `×` (multiplication)
- `^` (caret) → superscript in LaTeX
- Detect fractions, square roots, integrals

Use pattern matching + LLM to fix errors:
```typescript
if (mathMode) {
  correctedText = await correctMathSymbols(rawText, imageDataUrl)
}
```

### Step 5: Compute confidence score
- Gemini Vision: assume 0.85-0.95
- Tesseract: use built-in confidence
- If multiple words unrecognized → lower confidence

### Step 6: Format output
```json
{
  "text": "E = mc²",
  "latex": "E = mc^2",
  "confidence": 0.92,
  "bbox": {"x": 100, "y": 200, "w": 300, "h": 50},
  "language": "eng",
  "warnings": ["Detected math symbols, verify LaTeX"]
}
```

## Output Contract
Must include:
- `text`: extracted text (plain)
- `confidence`: 0-1 score
- `latex`: (if mathMode) LaTeX representation

## Atomic Tools Used
- `fileIO.cropImage(imageDataUrl, bbox)`
- `ocr.preprocessImage(imageDataUrl)`
- `ocr.callGeminiVision(imageDataUrl, prompt)`
- `ocr.callTesseract(imageDataUrl, language)` (fallback)
- `transform.correctMathSymbols(text, context)`

## Verification Rules
- Text must be non-empty (unless image truly blank)
- Confidence must be >= 0.3 (warn if lower)
- If mathMode → verify LaTeX syntax

## Error Handling
- If image too small/blurry → return low confidence + warning
- If OCR fails → try preprocessing + retry
- If still fails → return "Unable to extract text, image quality too low"

## Estimated Tokens
~1500 tokens (OCR call + post-correction)

## Example Usage
**User**: Selects region with formula `∫₀^∞ e^(-x²) dx = √π/2`
**Output**:
```json
{
  "text": "∫₀^∞ e^(-x²) dx = √π/2",
  "latex": "\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}",
  "confidence": 0.88,
  "mathMode": true
}
```
