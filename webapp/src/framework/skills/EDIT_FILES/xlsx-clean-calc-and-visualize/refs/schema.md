# Minimal Schema - XLSX Visualize
```typescript
interface XlsxVisualizeInput { fileId: string; sheet?: string; action: 'clean' | 'calculate' | 'visualize'; parameters: object }
interface XlsxVisualizeOutput { action: string; sheet: string; versionId?: string; overlay?: { id: string } }
```
