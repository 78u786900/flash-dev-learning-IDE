# Skill: Spaced Repetition Generator 🔁🗓️

## Purpose
Generate flashcards from notes with spaced repetition schedule. Help students memorize effectively using proven SRS algorithms.

## When to Use
- User asks "create flashcards from this note"
- User wants "make quiz cards for review"
- User needs "spaced repetition schedule"
- User studying for exam

## Input Contract
- `noteId`: string (required)
- `sectionIds`: string[] (optional, specific sections)
- `cardCount`: number (optional, target number of cards, default: 10)
- `difficulty`: 'easy' | 'medium' | 'hard' (optional, affects scheduling)

## Workflow

### Step 1: Extract content from notes

```typescript
const note = getNote(noteId)
const sections = sectionIds
  ? note.sections.filter(s => sectionIds.includes(s.id))
  : note.sections

const fullContent = sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n')
```

### Step 2: Generate flashcards using LLM

```typescript
const prompt = `Generate ${cardCount} flashcards from the following content.

Content:
${fullContent}

Requirements:
- Each card has a clear question and concise answer
- Mix of card types: definition, concept, application, example
- Questions should test understanding, not just recall
- Answers should be 1-3 sentences max
- Use simple language for students

Format (JSON):
[
  {
    "question": "What is photosynthesis?",
    "answer": "The process by which plants convert light energy into chemical energy.",
    "type": "definition",
    "tags": ["biology", "cells"]
  },
  ...
]

Flashcards:`

const response = await callGemini(prompt)
const cards = JSON.parse(response)
```

### Step 3: Process and validate cards

```typescript
interface Flashcard {
  id: string
  noteId: string
  sectionId: string
  question: string
  answer: string
  type: 'definition' | 'concept' | 'application' | 'example' | 'comparison'
  tags: string[]
  difficulty: number  // 0-1 (system-determined or user-set)
  
  // SRS fields
  interval: number      // days until next review
  easeFactor: number    // how easy the card is (2.5 default)
  repetitions: number   // number of times reviewed
  nextReview: number    // timestamp
  lastReview: number    // timestamp
  
  createdAt: number
}

const flashcards: Flashcard[] = cards.map(card => ({
  id: `card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  noteId,
  sectionId: sections[0].id,  // associate with first section
  ...card,
  difficulty: difficulty === 'hard' ? 0.7 : difficulty === 'easy' ? 0.3 : 0.5,
  
  // Initialize SRS values
  interval: 1,           // review tomorrow
  easeFactor: 2.5,
  repetitions: 0,
  nextReview: Date.now() + 86400000,  // tomorrow
  lastReview: Date.now(),
  
  createdAt: Date.now()
}))
```

### Step 4: Implement Spaced Repetition Algorithm (SM-2)

```typescript
function updateCard(card: Flashcard, quality: number): Flashcard {
  // quality: 0-5 (0=complete blackout, 5=perfect response)
  
  if (quality < 3) {
    // Failed: reset interval to 1 day
    return {
      ...card,
      interval: 1,
      repetitions: 0,
      nextReview: Date.now() + 86400000,
      lastReview: Date.now()
    }
  }
  
  // Passed
  let newInterval: number
  let newRepetitions = card.repetitions + 1
  let newEaseFactor = card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  
  // Ease factor must be >= 1.3
  if (newEaseFactor < 1.3) newEaseFactor = 1.3
  
  if (newRepetitions === 1) {
    newInterval = 1  // 1 day
  } else if (newRepetitions === 2) {
    newInterval = 6  // 6 days
  } else {
    newInterval = Math.round(card.interval * newEaseFactor)
  }
  
  return {
    ...card,
    interval: newInterval,
    easeFactor: newEaseFactor,
    repetitions: newRepetitions,
    nextReview: Date.now() + (newInterval * 86400000),
    lastReview: Date.now()
  }
}
```

### Step 5: Generate review schedule

```typescript
function getReviewSchedule(cards: Flashcard[], days: number = 30): object {
  const schedule = {}
  
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() + i * 86400000).toISOString().split('T')[0]
    schedule[date] = cards.filter(card => {
      const reviewDate = new Date(card.nextReview).toISOString().split('T')[0]
      return reviewDate === date
    }).length
  }
  
  return schedule
}
```

### Step 6: Create flashcard deck entity

```typescript
interface FlashcardDeck {
  id: string
  noteId: string
  name: string
  cards: Flashcard[]
  totalCards: number
  newCards: number       // never reviewed
  reviewCards: number    // due for review
  learnedCards: number   // interval >= 21 days
  createdAt: number
  updatedAt: number
}

const deck: FlashcardDeck = {
  id: `deck-${Date.now()}`,
  noteId,
  name: `${note.name} - Flashcards`,
  cards: flashcards,
  totalCards: flashcards.length,
  newCards: flashcards.length,
  reviewCards: 0,
  learnedCards: 0,
  createdAt: Date.now(),
  updatedAt: Date.now()
}
```

### Step 7: Render flashcard UI

Simple flip card interface:
```typescript
function FlashcardUI({ card, onRate }) {
  const [showAnswer, setShowAnswer] = useState(false)
  
  return (
    <div className="flashcard" onClick={() => setShowAnswer(!showAnswer)}>
      {!showAnswer ? (
        <div className="card-front">
          <h3>Question</h3>
          <p>{card.question}</p>
        </div>
      ) : (
        <div className="card-back">
          <h3>Answer</h3>
          <p>{card.answer}</p>
          <div className="rating-buttons">
            <button onClick={() => onRate(1)}>Again (1 day)</button>
            <button onClick={() => onRate(3)}>Hard (3 days)</button>
            <button onClick={() => onRate(4)}>Good (6 days)</button>
            <button onClick={() => onRate(5)}>Easy (14 days)</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

## Output Contract
```json
{
  "deck": {
    "id": "deck-123",
    "noteId": "note-456",
    "name": "Biology Chapter 3 - Flashcards",
    "totalCards": 15,
    "newCards": 15,
    "cards": [
      {
        "id": "card-001",
        "question": "What is the powerhouse of the cell?",
        "answer": "Mitochondria",
        "type": "definition",
        "tags": ["biology", "cell"],
        "nextReview": 1738454400000,
        "interval": 1
      }
    ]
  },
  "schedule": {
    "2026-02-02": 15,
    "2026-02-08": 10,
    "2026-02-15": 5
  }
}
```

## Atomic Tools Used
- `fileIO.getNote(noteId)`
- `transform.generateFlashcards(content, count)`
- `transform.calculateSRSSchedule(card, quality)`
- `fileIO.saveDeck(deck)`
- `fileIO.loadDeck(deckId)`
- `fileIO.updateCard(cardId, updates)`

## Verification Rules
- Each card has non-empty question and answer
- Question is actually a question (ends with ?)
- Answer is concise (< 200 chars)
- No duplicate questions
- SRS intervals reasonable (1-365 days)

## Error Handling
- If LLM generates malformed JSON → retry with stricter prompt
- If too few cards generated → lower quality threshold
- If card too complex → suggest manual editing

## Estimated Tokens
~2500 tokens (card generation + scheduling)

## Example Usage

**Scenario 1: Generate from notes**
User: "create flashcards from my chapter 3 notes"
→ Generates 15 cards
→ Mix of definitions, concepts, examples
→ Schedule: 15 cards tomorrow, then spreading out

**Scenario 2: Daily review**
User opens app next day
→ Shows "15 cards due for review"
→ User reviews each card, rates difficulty
→ System adjusts intervals based on performance
→ Tomorrow: only 8 cards due (7 learned)

**Scenario 3: Track progress**
After 1 month:
→ 80% of cards have interval >= 7 days
→ Only 3 cards still at 1-day interval (difficult)
→ User sees progress chart
