# Minimal Schema - PPTX Generate
```typescript
interface PptxGenerateInput { action: 'generate' | 'edit'; noteId?: string; outline?: string; parameters: { title: string; slideCount?: number } }
interface PptxGenerateOutput { fileId: string; fileName: string; slides: Array<{ slideNumber: number; title: string; bullets: string[] }>; totalSlides: number }
```
