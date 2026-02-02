# Skill: Image Annotate and Callouts 🖼️📌

## Purpose
Add bounding boxes, arrows, labels as overlays on images. Non-destructive annotations using overlay canvas.

## When to Use
- User asks "label this diagram"
- User wants to "add arrows pointing to parts"
- User needs to "highlight regions"
- User wants to "annotate image with callouts"

## Input Contract
- `fileId`: string (required)
- `annotations`: array of annotation objects

Annotation object:
```typescript
{
  type: 'box' | 'arrow' | 'label' | 'circle' | 'highlight',
  position: { x: number, y: number },
  size?: { w: number, h: number },
  target?: { x: number, y: number },  // for arrows
  text?: string,  // for labels
  color?: string,
  style?: { thickness: number, dashed: boolean }
}
```

## Workflow

### Step 1: Load image
```typescript
const img = new Image()
img.src = file.url
await img.decode()

const { width, height } = img
```

### Step 2: Create overlay canvas
```typescript
const overlay = {
  id: `overlay-annotate-${Date.now()}`,
  attachedTo: {
    fileId,
    anchor: 'global',
    anchorRef: 'global'
  },
  layer: 10,
  position: { x: 0, y: 0 },
  size: { w: width, h: height },
  style: {
    background: 'transparent',
    border: 'none',
    opacity: 1.0
  },
  blocks: []
}
```

### Step 3: Generate SVG for each annotation

#### A) Bounding Box
```svg
<rect x="${x}" y="${y}" width="${w}" height="${h}" 
      fill="none" stroke="${color}" stroke-width="3"/>
```

#### B) Arrow
```svg
<defs>
  <marker id="arrowhead" markerWidth="10" markerHeight="10" 
          refX="5" refY="5" orient="auto">
    <polygon points="0 0, 10 5, 0 10" fill="${color}"/>
  </marker>
</defs>
<line x1="${position.x}" y1="${position.y}" 
      x2="${target.x}" y2="${target.y}"
      stroke="${color}" stroke-width="3" marker-end="url(#arrowhead)"/>
```

#### C) Label (callout box)
```svg
<rect x="${x}" y="${y}" width="120" height="40" 
      fill="rgba(255,255,255,0.9)" stroke="${color}" stroke-width="2" rx="5"/>
<text x="${x+10}" y="${y+25}" font-size="14" fill="#333">${text}</text>
```

#### D) Circle (highlight region)
```svg
<circle cx="${x}" cy="${y}" r="${radius}" 
        fill="none" stroke="${color}" stroke-width="3"/>
```

#### E) Highlight (semi-transparent overlay)
```svg
<rect x="${x}" y="${y}" width="${w}" height="${h}" 
      fill="${color}" opacity="0.3"/>
```

### Step 4: Combine all annotations into one SVG
```typescript
const svgCode = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${annotations.map(a => generateSvgForAnnotation(a)).join('\n')}
</svg>
`

const block: OverlayBlock = {
  id: `block-${Date.now()}`,
  type: 'code',
  payload: {
    language: 'svg',
    source: svgCode,
    renderMode: 'static'
  },
  createdAt: Date.now(),
  updatedAt: Date.now()
}

overlay.blocks.push(block)
```

### Step 5: Render SVG overlay
- SVG code → rendered as inline image
- Overlay positioned on top of original image
- User can toggle annotations on/off

### Step 6: (Optional) Export annotated image
If user wants to save:
```typescript
// Draw original image + SVG overlay to canvas
const canvas = document.createElement('canvas')
canvas.width = width
canvas.height = height
const ctx = canvas.getContext('2d')

ctx.drawImage(img, 0, 0)

// Render SVG on top
const svgImg = new Image()
svgImg.src = 'data:image/svg+xml;base64,' + btoa(svgCode)
await svgImg.decode()
ctx.drawImage(svgImg, 0, 0)

// Export
const annotatedPng = canvas.toDataURL('image/png')
```

## Output Contract
```json
{
  "fileId": "file-img-456",
  "overlay": {
    "id": "overlay-annotate-123",
    "blocks": [
      {
        "type": "code",
        "payload": {
          "language": "svg",
          "source": "<svg>...</svg>"
        }
      }
    ]
  },
  "annotations": [
    {
      "type": "arrow",
      "position": {"x": 100, "y": 200},
      "target": {"x": 250, "y": 300},
      "text": "Mitochondria",
      "color": "red"
    }
  ]
}
```

## Atomic Tools Used
- `fileIO.getFileBlob(fileId)`
- `overlay.createCanvas(fileId, size)`
- `transform.generateSvgBox(bbox, color)`
- `transform.generateSvgArrow(from, to, color)`
- `transform.generateSvgLabel(position, text, color)`
- `render.svgToDataUrl(svgCode)`
- `overlay.addBlock(overlayId, block)`

## Verification Rules
- All positions within image bounds
- Text labels readable (font size >= 12px)
- Colors have sufficient contrast
- Arrows point to valid targets

## Error Handling
- If position out of bounds → clip to image edges
- If text too long → truncate or wrap
- If color invalid → default to black

## Estimated Tokens
~1500 tokens (SVG generation)

## Example Usage

**Scenario 1: Label cell diagram**
User uploads cell diagram image
User: "label the mitochondria, nucleus, and ribosomes"
→ Agent detects 3 regions
→ Adds arrows + labels
→ Overlay shows annotations

**Scenario 2: Highlight important parts**
User has diagram of water cycle
User: "highlight evaporation and condensation"
→ Adds semi-transparent yellow boxes
→ User can adjust position/size

**Scenario 3: Add callout boxes**
User has product photo
User: "add callout explaining each feature"
→ Adds 4 callout boxes with arrows
→ Each points to specific feature
