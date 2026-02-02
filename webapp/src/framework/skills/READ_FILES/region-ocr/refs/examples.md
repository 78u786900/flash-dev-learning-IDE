# Example 1: Math Formula

## Input
```json
{
  "imageDataUrl": "data:image/png;base64,iVBORw0KG...",
  "bbox": {"x": 100, "y": 200, "w": 300, "h": 50},
  "mathMode": true
}
```

## Image Content
Formula: `E = mc²`

## Output
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

---

# Example 2: Chinese Text

## Input
```json
{
  "imageDataUrl": "data:image/png;base64,iVBORw0KG...",
  "language": "chi_tra"
}
```

## Image Content
Text: `光合作用是植物利用光能轉化為化學能的過程`

## Output
```json
{
  "text": "光合作用是植物利用光能轉化為化學能的過程",
  "confidence": 0.88,
  "language": "chi_tra"
}
```
