# Minimal Schema - Codebase Map
```typescript
interface CodebaseMapInput { fileId: string; language?: string; maxDepth?: number }
interface CodebaseMapOutput { fileTree: string[]; totalFiles: number; dependencies: Record<string, string[]>; entryPoints: string[]; diagram: string }
```
