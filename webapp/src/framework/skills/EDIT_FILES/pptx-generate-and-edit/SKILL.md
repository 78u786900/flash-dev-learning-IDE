# Skill: PPTX Generate and Edit 📽️✨

## Purpose
Create/modify slides from notes or outlines. Generate speaker notes. Help students prepare presentations.

## When to Use
- User asks "create slides from this note"
- User wants to "add speaker notes"
- User needs to "generate presentation outline"
- User wants to "edit slide content"

## Input Contract
- `action`: 'generate' | 'edit' | 'add_notes' | 'reorder'
- `fileId`: string (optional, for editing existing PPTX)
- `noteId`: string (optional, source note for generation)
- `outline`: string (optional, text outline)
- `parameters`: object with action-specific params

For `generate`:
```typescript
{
  title: string,
  slideCount: number,
  template: 'simple' | 'academic' | 'colorful',
  includeImages: boolean
}
```

## Workflow

### Step 1: Parse source content

**From note**:
```typescript
const note = getNote(noteId)
const sections = note.sections

// Each section → 1 slide
const slides = sections.map((section, i) => ({
  slideNumber: i + 1,
  title: section.title,
  content: splitIntoBullets(section.content),
  speakerNotes: generateSpeakerNotes(section.content)
}))
```

**From outline**:
```typescript
const lines = outline.split('\n')
let slides = []
let currentSlide = null

for (const line of lines) {
  if (line.startsWith('# ')) {
    // Main slide
    if (currentSlide) slides.push(currentSlide)
    currentSlide = { title: line.slice(2), bullets: [] }
  } else if (line.startsWith('- ')) {
    // Bullet point
    currentSlide.bullets.push(line.slice(2))
  }
}
if (currentSlide) slides.push(currentSlide)
```

### Step 2: Generate slide content

For each slide, use LLM to refine:
```typescript
const prompt = `Create a presentation slide.
Title: ${slide.title}
Content (raw): ${slide.content}

Requirements:
- 3-5 bullet points max
- Each bullet < 15 words
- Clear and concise
- Parallel structure

Output only the bullet points:`

const bullets = await callGemini(prompt)
slide.bullets = bullets.split('\n').filter(b => b.trim())
```

### Step 3: Generate speaker notes
```typescript
const prompt = `Generate speaker notes for this slide.
Slide title: ${slide.title}
Bullets:
${slide.bullets.join('\n')}

Speaker notes should:
- Expand on each bullet
- Add examples
- Include transitions
- 50-100 words total

Speaker notes:`

slide.speakerNotes = await callGemini(prompt)
```

### Step 4: Build PPTX

```typescript
import pptxgen from 'pptxgenjs'

const pres = new pptxgen()

for (const slide of slides) {
  const pptxSlide = pres.addSlide()
  
  // Title
  pptxSlide.addText(slide.title, {
    x: 0.5,
    y: 0.5,
    fontSize: 24,
    bold: true,
    color: '363636'
  })
  
  // Bullets
  pptxSlide.addText(slide.bullets, {
    x: 1,
    y: 1.5,
    fontSize: 18,
    bullet: true
  })
  
  // Speaker notes
  pptxSlide.addNotes(slide.speakerNotes)
}

// Save
const pptxBlob = await pres.write('blob')
```

### Step 5: Create file entity (if new)
```typescript
if (action === 'generate') {
  const fileEntity = {
    id: `file-${Date.now()}`,
    name: `${parameters.title || 'Presentation'}.pptx`,
    type: 'pptx',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    url: URL.createObjectURL(pptxBlob),
    size: pptxBlob.size,
    addedAt: Date.now(),
    version: 1,
    versions: [{...}],
    index: {
      structure: { slides: slides.length },
      embeddingsReady: false
    }
  }
}
```

Or create new version (if editing):
```typescript
await createVersion(fileId, pptxBlob, 
  `${action}: updated ${slides.length} slides`,
  'agent',
  'pptx-generate-and-edit'
)
```

### Step 6: Generate outline map
```typescript
const outline = slides.map((s, i) => ({
  slideNumber: i + 1,
  title: s.title,
  bulletCount: s.bullets.length
}))
```

## Output Contract
```json
{
  "action": "generate",
  "fileId": "file-pptx-123",
  "fileName": "Biology Chapter 3.pptx",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Introduction to Photosynthesis",
      "bullets": [
        "Process that converts light energy to chemical energy",
        "Occurs in chloroplasts of plant cells",
        "Requires water, CO2, and sunlight"
      ],
      "speakerNotes": "Begin by explaining..."
    }
  ],
  "totalSlides": 8
}
```

## Atomic Tools Used
- `fileIO.getNote(noteId)`
- `transform.sectionToSlide(section)`
- `transform.outlineToSlides(outline)`
- `transform.generateBullets(content)`
- `transform.generateSpeakerNotes(bullets)`
- `fileIO.createPptx(slides)`
- `fileIO.createVersion(fileId, pptxBlob, description)`

## Verification Rules
- Each slide has title (max 60 chars)
- Each slide has 2-6 bullets
- Each bullet < 20 words
- Speaker notes 50-150 words per slide
- Total slides 5-20 (reasonable range)

## Error Handling
- If outline empty → return error
- If too many slides (>30) → warn and truncate
- If content too short → suggest combining slides

## Estimated Tokens
~3500 tokens (slide generation + speaker notes)

## Example Usage

**Scenario 1: Generate from notes**
Input: Note with 5 sections on "Cell Biology"
User: "create slides from this note"
→ Generates 5 slides (1 per section)
→ Each slide has 3-4 bullets
→ Includes speaker notes
→ Downloadable PPTX

**Scenario 2: Add speaker notes**
Input: Existing PPTX (10 slides, no notes)
User: "add speaker notes to all slides"
→ Reads each slide
→ Generates appropriate notes
→ Updates PPTX, creates version

**Scenario 3: Reorder slides**
Input: PPTX with slides [Intro, Conclusion, Body]
User: "reorder: intro, body, conclusion"
→ Reorders to [1, 3, 2]
→ Creates new version
