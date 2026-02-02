# LaTeX Render and Verify - Complete Structure

## Input Schema
```typescript
interface LatexRenderInput {
  noteId: string
  sectionId?: string
  latexSource?: string
  action: 'render' | 'verify' | 'correct'
}
```

## Output Schema
```typescript
interface LatexRenderOutput {
  noteId: string
  latexBlocks: Array<{
    type: 'inline' | 'display'
    source: string
    rendered: string  // HTML or SVG
    valid: boolean
    sectionId: string
    error?: string
  }>
  errors: Array<{
    source: string
    error: string
    suggested?: string
    sectionId: string
  }>
}
```

## Verification Rules
- Balanced braces: `{...}`
- `\frac` requires 2 arguments
- `\sqrt` requires 1 argument
- No unknown commands

## Example
```json
{
  "noteId": "note-123",
  "latexBlocks": [
    {
      "type": "inline",
      "source": "E = mc^2",
      "rendered": "<span class='katex'>...</span>",
      "valid": true,
      "sectionId": "s1"
    }
  ],
  "errors": []
}
```
