# Skill: LaTeX Render and Verify 🧮✅

## Purpose
Render LaTeX formulas, verify symbols/structure consistency, highlight errors. Essential for math/science notes.

## When to Use
- User types LaTeX in notes: `$E = mc^2$` or `$$\int_0^\infty...$$`
- User asks "render this formula"
- User wants "check LaTeX errors"
- User pastes math from OCR (need correction)

## Input Contract
- `noteId`: string (required)
- `sectionId`: string (optional, specific section)
- `latexSource`: string (optional, or auto-detect from content)
- `action`: 'render' | 'verify' | 'correct'

## Workflow

### Step 1: Extract LaTeX from content
```typescript
const note = getNote(noteId)
const sections = sectionId 
  ? [note.sections.find(s => s.id === sectionId)]
  : note.sections

const latexBlocks = []

for (const section of sections) {
  // Inline math: $...$
  const inline = section.content.match(/\$([^$]+)\$/g)
  if (inline) {
    latexBlocks.push(...inline.map(m => ({
      type: 'inline',
      source: m.slice(1, -1),  // remove $ $
      sectionId: section.id
    })))
  }
  
  // Display math: $$...$$
  const display = section.content.match(/\$\$([^$]+)\$\$/g)
  if (display) {
    latexBlocks.push(...display.map(m => ({
      type: 'display',
      source: m.slice(2, -2),  // remove $$ $$
      sectionId: section.id
    })))
  }
}
```

### Step 2: Render LaTeX

**Option A: KaTeX (fast, client-side)**
```typescript
import katex from 'katex'

for (const block of latexBlocks) {
  try {
    const html = katex.renderToString(block.source, {
      displayMode: block.type === 'display',
      throwOnError: false
    })
    block.rendered = html
    block.valid = true
  } catch (error) {
    block.error = error.message
    block.valid = false
  }
}
```

**Option B: MathJax** (more features, slower)
```typescript
import MathJax from 'mathjax'

const rendered = await MathJax.tex2svg(block.source)
block.rendered = rendered.outerHTML
```

### Step 3: Verify LaTeX structure

Common errors to check:
- Unmatched braces: `{...` missing `}`
- Unknown commands: `\invalidcommand`
- Missing arguments: `\frac{x}` missing denominator
- Nested errors: `\sqrt{\frac{1}` incomplete

```typescript
function verifyLatex(source: string) {
  const errors = []
  
  // Check balanced braces
  let braceDepth = 0
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '{') braceDepth++
    if (source[i] === '}') braceDepth--
    if (braceDepth < 0) errors.push('Unmatched closing brace at position ' + i)
  }
  if (braceDepth > 0) errors.push('Unclosed braces')
  
  // Check required arguments
  const commands = {
    '\\frac': 2,      // \frac{num}{denom}
    '\\sqrt': 1,      // \sqrt{x}
    '\\sum': 0,       // \sum_{}^{}
    '\\int': 0        // \int_{}^{}
  }
  
  for (const [cmd, argCount] of Object.entries(commands)) {
    const regex = new RegExp(`\\${cmd}`, 'g')
    let match
    while ((match = regex.exec(source)) !== null) {
      // Check if followed by correct number of {...}
      const after = source.slice(match.index + cmd.length)
      const args = after.match(/^\{[^}]*\}/g) || []
      if (args.length < argCount) {
        errors.push(`${cmd} missing arguments at position ${match.index}`)
      }
    }
  }
  
  return { valid: errors.length === 0, errors }
}
```

### Step 4: Auto-correct common errors (optional)

If `action = 'correct'`:
```typescript
const prompt = `Correct LaTeX syntax errors.
Original:
${block.source}

Common issues:
- Fix unmatched braces
- Complete missing arguments
- Replace unknown commands with valid alternatives

Corrected LaTeX (output only the formula):`

const corrected = await callGemini(prompt)
block.corrected = corrected
```

### Step 5: Create overlay with rendered math

For each LaTeX block:
```typescript
// Replace $...$ with rendered HTML/SVG
const overlay = {
  id: `overlay-latex-${Date.now()}`,
  attachedTo: {
    noteId,
    anchor: 'note-section',
    anchorRef: `section:${block.sectionId}`
  },
  layer: 5,
  position: { x: 0, y: 0 },  // inline with text
  size: { w: 'auto', h: 'auto' },
  style: {
    background: 'transparent',
    border: 'none',
    opacity: 1.0
  },
  blocks: [{
    id: `block-${Date.now()}`,
    type: 'rendered',
    payload: {
      format: 'html',
      artifactUrl: `data:text/html,${encodeURIComponent(block.rendered)}`
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  }]
}
```

Or simpler: just render inline using KaTeX CSS
```typescript
// Replace in section.content
section.content = section.content.replace(
  /\$([^$]+)\$/g,
  (match, latex) => `<span class="katex">${katex.renderToString(latex)}</span>`
)
```

## Output Contract
```json
{
  "noteId": "note-123",
  "latexBlocks": [
    {
      "type": "inline",
      "source": "E = mc^2",
      "rendered": "<span>...</span>",
      "valid": true,
      "sectionId": "s1"
    },
    {
      "type": "display",
      "source": "\\int_0^\\infty e^{-x^2} dx",
      "rendered": "<svg>...</svg>",
      "valid": true,
      "sectionId": "s2"
    }
  ],
  "errors": [
    {
      "source": "\\frac{x}",
      "error": "Missing argument",
      "suggested": "\\frac{x}{y}",
      "sectionId": "s3"
    }
  ]
}
```

## Atomic Tools Used
- `fileIO.getNote(noteId)`
- `transform.extractLatex(content)`
- `render.katexToHtml(latex)`
- `render.mathjaxToSvg(latex)`
- `transform.verifyLatex(latex)`
- `transform.correctLatex(latex)`
- `overlay.createMathOverlay(noteId, section, rendered, position)`

## Verification Rules
- All LaTeX blocks must render without throwing
- Errors clearly highlighted in UI
- Rendered math matches source intent
- No visual glitches (overlapping text)

## Error Handling
- If KaTeX fails → try MathJax
- If both fail → show source with error message
- If too many errors → suggest re-checking source

## Estimated Tokens
~1500 tokens (verification + optional correction)

## Example Usage

**Scenario 1: Auto-render math notes**
User types in note: "The quadratic formula is $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$"
→ Automatically renders as beautiful math
→ No manual "render" button needed

**Scenario 2: Error detection**
User pastes from OCR: "$\int_0^\infty e^(-x^2) dx$" (missing braces)
→ System detects error: `-x^2` should be `{-x^2}`
→ Highlights in red
→ Offers correction

**Scenario 3: Complex equations**
User writes multi-line display math:
```
$$
\begin{aligned}
f(x) &= ax^2 + bx + c \\
f'(x) &= 2ax + b
\end{aligned}
$$
```
→ Renders as aligned equations
→ Verifies `\begin` and `\end` match
