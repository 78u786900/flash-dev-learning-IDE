# Minimal Schema - DOCX Rewrite
```typescript
interface DocxRewriteInput { fileId: string; action: 'rewrite' | 'expand' | 'simplify'; parameters: { tone?: string; targetLength?: number } }
interface DocxRewriteOutput { versionId: string; diff: { summary: object }; wordCount: { before: number; after: number } }
```
