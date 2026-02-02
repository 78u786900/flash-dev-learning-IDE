# Minimal Schema - Note Linking
```typescript
interface NoteLinkingInput { noteId: string; action: 'create_link' | 'show_graph' | 'find_backlinks'; targetNoteId?: string }
interface NoteLinkingOutput { noteId: string; links: Array<{ targetNoteId: string; targetNoteName: string }>; backlinks: object[]; graph?: string }
```
