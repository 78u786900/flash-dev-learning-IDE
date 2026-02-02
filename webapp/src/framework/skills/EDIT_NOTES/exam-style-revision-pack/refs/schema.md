# Minimal Schema - Exam Revision Pack
```typescript
interface ExamRevisionInput { noteId: string; examLevel: string; examType: string; questionCount?: number }
interface ExamRevisionOutput { pack: { id: string; definitions: object[]; questions: object[]; commonMistakes: object[]; checkpointQuiz: object; studySchedule: object[] } }
```
