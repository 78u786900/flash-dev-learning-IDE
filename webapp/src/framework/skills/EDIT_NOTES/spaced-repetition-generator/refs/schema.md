# Minimal Schema - Spaced Repetition
```typescript
interface SpacedRepetitionInput { noteId: string; cardCount?: number; difficulty?: 'easy' | 'medium' | 'hard' }
interface SpacedRepetitionOutput { deck: { id: string; cards: Array<{ question: string; answer: string; nextReview: number }> }; schedule: Record<string, number> }
```
