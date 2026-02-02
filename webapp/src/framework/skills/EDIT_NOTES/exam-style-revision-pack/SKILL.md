# Skill: Exam Style Revision Pack 🎯📦

## Purpose
Generate comprehensive exam revision pack: definitions, typical questions, common mistakes, checkpoint quiz. Help students prepare systematically.

## When to Use
- User asks "create revision pack for exam"
- User wants "practice questions"
- User needs "exam preparation materials"
- Teacher wants to generate study guide

## Input Contract
- `noteId`: string (required)
- `examLevel`: 'primary' | 'secondary' | 'high_school' | 'university'
- `examType`: 'multiple_choice' | 'short_answer' | 'essay' | 'mixed'
- `topics`: string[] (optional, specific topics to focus on)
- `questionCount`: number (optional, default: 20)

## Workflow

### Step 1: Analyze note content

```typescript
const note = getNote(noteId)
const fullContent = note.sections.map(s => 
  `## ${s.title}\n\n${s.content}`
).join('\n\n')

// Extract key concepts
const prompt = `Analyze this content and identify key concepts for exam revision.

Content:
${fullContent}

Output JSON:
{
  "keyConcepts": ["concept1", "concept2", ...],
  "topics": [
    {
      "name": "Topic 1",
      "subtopics": ["subtopic1", "subtopic2"],
      "importance": "high|medium|low"
    }
  ],
  "difficulty": "easy|medium|hard"
}

Analysis:`

const analysis = JSON.parse(await callGemini(prompt))
```

### Step 2: Generate definitions list

```typescript
const prompt = `Create a glossary of key terms from this content.
For each term:
- Clear definition (1-2 sentences)
- Example usage (if applicable)
- Related terms

Content:
${fullContent}

Format (JSON):
[
  {
    "term": "Photosynthesis",
    "definition": "The process by which plants convert light energy into chemical energy.",
    "example": "Plants use photosynthesis to produce glucose from CO2 and water.",
    "relatedTerms": ["chlorophyll", "chloroplast", "glucose"]
  }
]

Definitions:`

const definitions = JSON.parse(await callGemini(prompt))
```

### Step 3: Generate typical exam questions

```typescript
const prompt = `Generate ${questionCount} typical exam questions for ${examLevel} level.

Content:
${fullContent}

Question types:
- Multiple choice (4 options, 1 correct)
- Short answer (2-3 sentences expected)
- Application problems (apply concepts to scenarios)
- Comparison questions (compare/contrast concepts)

Each question should:
- Test understanding, not just recall
- Have clear, unambiguous answer
- Include difficulty level
- Include mark allocation
- Include answer key

Format (JSON):
[
  {
    "type": "multiple_choice",
    "question": "Which organelle is responsible for photosynthesis?",
    "options": ["A. Mitochondria", "B. Chloroplast", "C. Nucleus", "D. Ribosome"],
    "correctAnswer": "B",
    "explanation": "Chloroplasts contain chlorophyll...",
    "difficulty": "easy",
    "marks": 1,
    "topic": "Cell Biology"
  }
]

Questions:`

const questions = JSON.parse(await callGemini(prompt))
```

### Step 4: Identify common mistakes

```typescript
const prompt = `Based on this content, identify common mistakes students make in exams.

Content:
${fullContent}

For each mistake:
- What the mistake is
- Why students make it
- How to avoid it
- Correct approach

Format (JSON):
[
  {
    "mistake": "Confusing photosynthesis with respiration",
    "reason": "Both involve glucose, but opposite processes",
    "howToAvoid": "Remember: photosynthesis = energy IN (from light), respiration = energy OUT (as ATP)",
    "correctConcept": "Photosynthesis produces glucose; respiration breaks it down"
  }
]

Common Mistakes:`

const mistakes = JSON.parse(await callGemini(prompt))
```

### Step 5: Create checkpoint quiz

Short quiz to test readiness:
```typescript
const prompt = `Create a 10-question checkpoint quiz.
Mix of question types, covering all main topics.
Include answer key and explanations.

Content:
${fullContent}

Format (JSON):
{
  "title": "Chapter 3 Checkpoint Quiz",
  "duration": 15,
  "totalMarks": 10,
  "questions": [...]
}

Quiz:`

const quiz = JSON.parse(await callGemini(prompt))
```

### Step 6: Generate study schedule

```typescript
function generateStudySchedule(topics: any[], examDate: Date): object {
  const now = Date.now()
  const daysUntilExam = Math.floor((examDate.getTime() - now) / 86400000)
  
  const schedule = []
  const topicsPerDay = Math.ceil(topics.length / daysUntilExam)
  
  for (let day = 0; day < daysUntilExam; day++) {
    const date = new Date(now + day * 86400000).toISOString().split('T')[0]
    const dayTopics = topics.slice(day * topicsPerDay, (day + 1) * topicsPerDay)
    
    schedule.push({
      date,
      day: day + 1,
      topics: dayTopics.map(t => t.name),
      tasks: [
        `Review notes on ${dayTopics[0]?.name}`,
        `Practice 5 questions`,
        `Quiz yourself on key terms`
      ],
      estimatedTime: '1-2 hours'
    })
  }
  
  return schedule
}
```

### Step 7: Compile revision pack

```typescript
interface RevisionPack {
  id: string
  noteId: string
  title: string
  
  // Sections
  definitions: Definition[]
  questions: ExamQuestion[]
  commonMistakes: CommonMistake[]
  checkpointQuiz: Quiz
  studySchedule: StudyDay[]
  
  // Metadata
  examLevel: string
  totalQuestions: number
  estimatedStudyTime: number  // hours
  createdAt: number
}

const pack: RevisionPack = {
  id: `pack-${Date.now()}`,
  noteId,
  title: `${note.name} - Exam Revision Pack`,
  definitions,
  questions,
  commonMistakes: mistakes,
  checkpointQuiz: quiz,
  studySchedule: schedule,
  examLevel,
  totalQuestions: questions.length,
  estimatedStudyTime: Math.ceil(questions.length / 10) + 2,  // rough estimate
  createdAt: Date.now()
}
```

### Step 8: Export as PDF/Markdown (optional)

```typescript
function exportToPdf(pack: RevisionPack): string {
  const markdown = `
# ${pack.title}

## 📚 Key Definitions
${pack.definitions.map(d => `
### ${d.term}
**Definition:** ${d.definition}
${d.example ? `**Example:** ${d.example}` : ''}
`).join('\n')}

## ❓ Practice Questions
${pack.questions.map((q, i) => `
### Question ${i + 1} (${q.marks} mark${q.marks > 1 ? 's' : ''})
${q.question}
${q.type === 'multiple_choice' ? q.options.join('\n') : ''}

**Answer:** ${q.correctAnswer}
**Explanation:** ${q.explanation}
`).join('\n')}

## ⚠️ Common Mistakes
${pack.commonMistakes.map((m, i) => `
${i + 1}. **${m.mistake}**
   - Why: ${m.reason}
   - Avoid: ${m.howToAvoid}
`).join('\n')}

## 🎯 Checkpoint Quiz
${pack.checkpointQuiz.questions.map((q, i) => `
${i + 1}. ${q.question}
`).join('\n')}

## 📅 Study Schedule
${pack.studySchedule.map(day => `
**Day ${day.day} (${day.date})**
- Topics: ${day.topics.join(', ')}
- Time: ${day.estimatedTime}
`).join('\n')}
`
  
  // Convert markdown to PDF using library
  return convertMarkdownToPdf(markdown)
}
```

## Output Contract
```json
{
  "pack": {
    "id": "pack-123",
    "noteId": "note-456",
    "title": "Biology Chapter 3 - Exam Revision Pack",
    "definitions": [
      {
        "term": "Photosynthesis",
        "definition": "...",
        "example": "...",
        "relatedTerms": [...]
      }
    ],
    "questions": [
      {
        "type": "multiple_choice",
        "question": "...",
        "options": [...],
        "correctAnswer": "B",
        "marks": 1
      }
    ],
    "commonMistakes": [
      {
        "mistake": "...",
        "howToAvoid": "..."
      }
    ],
    "checkpointQuiz": {
      "title": "Checkpoint Quiz",
      "questions": [...]
    },
    "studySchedule": [
      {
        "day": 1,
        "date": "2026-02-10",
        "topics": ["Cell Structure"],
        "tasks": [...]
      }
    ],
    "totalQuestions": 20,
    "estimatedStudyTime": 6
  }
}
```

## Atomic Tools Used
- `fileIO.getNote(noteId)`
- `transform.analyzeContent(content)`
- `transform.generateDefinitions(content)`
- `transform.generateQuestions(content, type, count)`
- `transform.identifyMistakes(content)`
- `transform.generateQuiz(content)`
- `transform.createStudySchedule(topics, examDate)`
- `fileIO.saveRevisionPack(pack)`
- `transform.exportToPdf(pack)`

## Verification Rules
- All questions have correct answers
- Definitions are clear and accurate
- Common mistakes are realistic
- Study schedule is feasible (not too intense)
- Checkpoint quiz covers all topics

## Error Handling
- If LLM generates invalid questions → regenerate with stricter prompt
- If too few definitions → lower threshold for inclusion
- If schedule too compressed → extend or reduce topics per day

## Estimated Tokens
~4000 tokens (comprehensive generation)

## Example Usage

**Scenario 1: Pre-exam preparation**
User: "create revision pack for my biology exam next week"
→ Generates 20 practice questions
→ Lists 15 key definitions
→ Identifies 5 common mistakes
→ Creates 7-day study schedule

**Scenario 2: Practice session**
User opens revision pack
→ Reviews definitions (5 min)
→ Attempts 5 practice questions (15 min)
→ Checks answers and reads explanations
→ Takes checkpoint quiz to assess readiness

**Scenario 3: Teacher use**
Teacher generates pack for whole chapter
→ Exports as PDF
→ Shares with students
→ Students have structured study guide
