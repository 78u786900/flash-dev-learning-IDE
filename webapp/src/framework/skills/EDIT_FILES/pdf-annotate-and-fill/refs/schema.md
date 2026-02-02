# Minimal Schema - PDF Annotate
```typescript
interface PdfAnnotateInput { fileId: string; action: 'highlight' | 'comment' | 'fill_form'; page: number; bbox?: object; text?: string; color?: string }
interface PdfAnnotateOutput { action: string; page: number; overlay?: { id: string; type: string } }
```
