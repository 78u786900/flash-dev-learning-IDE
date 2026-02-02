# Skill: DOCX Restructure and Rewrite 📄🔁

## Purpose
Rewrite document with tone/length control, reorder sections, add citations. Generate diff preview before applying changes.

## When to Use
- User asks "rewrite this in simpler language"
- User wants to "expand this section to 500 words"
- User needs to "change tone to formal"
- User wants to "reorder sections"

## Input Contract
- `fileId`: string (required)
- `action`: 'rewrite' | 'expand' | 'simplify' | 'reorder' | 'add_citations'
- `targetSection`: string (optional, section index or "full document")
- `parameters`: object with action-specific params

For `rewrite`:
```typescript
{
  tone: 'formal' | 'casual' | 'academic' | 'simple',
  targetLength?: number,  // words
  preserveFormatting: boolean
}
```

For `reorder`:
```typescript
{
  newOrder: number[]  // [2, 1, 3] = move section 2 to first
}
```

## Workflow

### Step 1: Parse DOCX
```typescript
import mammoth from 'mammoth'

const arrayBuffer = await fetch(file.url).then(r => r.arrayBuffer())
const result = await mammoth.extractRawText({ arrayBuffer })
const text = result.value

// Or for HTML (preserve formatting):
const htmlResult = await mammoth.convertToHtml({ arrayBuffer })
const html = htmlResult.value
```

### Step 2: Identify sections
- Split by headings (# Heading 1, ## Heading 2)
- Or split by paragraphs if no headings
- Map each section to line numbers

### Step 3: Apply transformation

#### A) Rewrite with LLM
```typescript
const prompt = `Rewrite the following text.
Requirements:
- Tone: ${parameters.tone}
- Target length: ${parameters.targetLength} words (current: ${currentLength})
- Preserve key information
- Use ${language} language

Original text:
${sectionText}

Rewritten text:`

const rewritten = await callGemini(prompt)
```

#### B) Expand
```typescript
const prompt = `Expand this text to approximately ${targetLength} words.
- Add examples where appropriate
- Add explanations for complex terms
- Maintain coherence
- Use ${language} language

Original (${currentLength} words):
${text}

Expanded version:`

const expanded = await callGemini(prompt)
```

#### C) Simplify
```typescript
const prompt = `Simplify this text for ${gradeLevel} students.
- Use simple vocabulary
- Short sentences (max 15 words)
- Explain jargon
- Keep main ideas

Complex text:
${text}

Simplified version:`

const simplified = await callGemini(prompt)
```

#### D) Reorder sections
```typescript
const reordered = parameters.newOrder.map(index => sections[index])
const newText = reordered.join('\n\n')
```

#### E) Add citations
```typescript
// Detect claims that need citations
const claims = detectUncitedClaims(text)

// Generate citation suggestions
const prompt = `For each claim, suggest an appropriate citation format (APA).
Claims:
${claims.join('\n')}

Citations:`

const citations = await callGemini(prompt)

// Insert [citation] markers
const textWithCitations = insertCitations(text, citations)
```

### Step 4: Rebuild DOCX
```typescript
import { Document, Packer, Paragraph, TextRun } from 'docx'

const doc = new Document({
  sections: [{
    children: newParagraphs.map(p => 
      new Paragraph({ children: [new TextRun(p)] })
    )
  }]
})

const blob = await Packer.toBlob(doc)
```

### Step 5: Create version and diff
```typescript
const oldText = await extractText(file.url)
const newText = await extractText(newBlobUrl)
const diff = generateDiff(oldText, newText)

await createVersion(fileId, blob, 
  `${action}: ${parameters.tone || parameters.newOrder}`,
  'agent',
  'docx-restructure-and-rewrite'
)
```

### Step 6: Preview diff before applying
- Show side-by-side comparison
- Highlight added (green), removed (red), changed (yellow)
- Ask user to confirm

## Output Contract
```json
{
  "action": "rewrite",
  "versionId": "v5-doc-789",
  "diff": {
    "summary": {
      "linesAdded": 12,
      "linesRemoved": 8,
      "percentChange": 18.5
    },
    "preview": "- Old sentence\n+ New sentence"
  },
  "wordCount": {
    "before": 350,
    "after": 420
  },
  "changes": [
    "Rewrote introduction (formal tone)",
    "Expanded section 2 with examples"
  ]
}
```

## Atomic Tools Used
- `fileIO.getFileBlob(fileId)`
- `extract.parseDocx(blob)`
- `transform.rewriteText(text, tone, targetLength)`
- `transform.reorderSections(sections, newOrder)`
- `transform.generateDiff(oldText, newText)`
- `fileIO.createDocx(paragraphs)`
- `fileIO.createVersion(fileId, newBlob, description)`

## Verification Rules
- Word count within ±10% of target (if specified)
- Headings preserved (unless reorder)
- No broken formatting
- Diff must be reviewable

## Error Handling
- If DOCX parsing fails → try plain text extraction
- If LLM output too short/long → retry with adjusted prompt
- If reorder indices invalid → return error with valid range

## Estimated Tokens
~3000 tokens (rewrite + diff generation)

## Example Usage

**Scenario 1: Simplify for students**
Input: Academic paper (grade 12)
User: "rewrite in simple language for grade 8"
→ Rewrites with simpler vocabulary
→ Shortens sentences
→ Adds explanations

**Scenario 2: Expand essay**
Input: 200-word draft
User: "expand to 500 words with examples"
→ Adds 2-3 examples per section
→ Elaborates on key points
→ Maintains original structure

**Scenario 3: Change tone**
Input: Casual notes
User: "make it formal for submission"
→ Removes contractions ("don't" → "do not")
→ Uses formal vocabulary
→ Adds transitions
