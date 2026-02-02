# Input Schema

```typescript
interface RegionOCRInput {
  imageDataUrl: string  // base64 image
  bbox?: { x: number; y: number; w: number; h: number }
  language?: string  // default: "eng+chi_tra"
  mathMode?: boolean  // default: false
}
```

# Output Schema

```typescript
interface RegionOCROutput {
  text: string
  latex?: string  // if mathMode
  confidence: number  // 0-1
  bbox?: { x: number; y: number; w: number; h: number }
  language: string
  warnings?: string[]
}
```

# OCR Correction Rules

## Math Symbols
- `O` (letter) → `0` (zero) if in equation
- `l` (lowercase L) → `1` (one) if in equation
- `x` (letter) → `×` (multiply) if between numbers
- `^` → superscript in LaTeX

## Common Errors
- `rn` → `m`
- `vv` → `w`
- `cl` → `d`
