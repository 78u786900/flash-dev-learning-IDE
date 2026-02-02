# Canvas Overlay Authoring - Complete Structure

## Input Schema
```typescript
interface CanvasOverlayInput {
  attachedTo: {
    fileId?: string
    noteId?: string
    anchor: 'page' | 'slide' | 'global' | 'note-section'
    anchorRef: string
  }
  position: { x: number; y: number }
  size: { w: number; h: number }
  blocks: Array<{
    type: 'text' | 'markdown' | 'image' | 'code' | 'rendered'
    content?: string
    url?: string
    language?: string
    source?: string
  }>
  style?: {
    background?: 'transparent' | 'solid'
    border?: 'none' | 'thin' | 'highlight'
    opacity?: number
  }
}
```

## Output Schema
```typescript
interface CanvasOverlayOutput {
  overlay: {
    id: string
    attachedTo: object
    position: object
    size: object
    blocks: Array<{
      id: string
      type: string
      payload: object
    }>
  }
}
```

## Example
```json
{
  "overlay": {
    "id": "overlay-123",
    "attachedTo": {
      "fileId": "file-456",
      "anchor": "page",
      "anchorRef": "page:5"
    },
    "blocks": [
      {
        "type": "markdown",
        "payload": {"content": "## Explanation..."}
      }
    ]
  }
}
```
