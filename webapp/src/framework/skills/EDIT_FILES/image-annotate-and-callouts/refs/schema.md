# Minimal Schema - Image Annotate
```typescript
interface ImageAnnotateInput { fileId: string; annotations: Array<{ type: 'box' | 'arrow' | 'label'; position: object; text?: string; color?: string }> }
interface ImageAnnotateOutput { fileId: string; overlay: { id: string; blocks: object[] }; annotations: object[] }
```
