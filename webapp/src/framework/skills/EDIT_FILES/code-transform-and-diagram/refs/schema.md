# Minimal Schema - Code Diagram
```typescript
interface CodeDiagramInput { fileId: string; action: 'refactor' | 'extract' | 'diagram'; parameters: { diagramType?: 'flowchart' | 'sequence' | 'class' } }
interface CodeDiagramOutput { action: string; versionId?: string; overlay?: { id: string } }
```
