# Skill: Code Transform and Diagram 💻✂️

## Purpose
Refactor code, extract snippets, generate flowchart/diagram as overlay. Help students understand code visually.

## When to Use
- User asks "refactor this function"
- User wants "flowchart for this algorithm"
- User needs "extract this logic into separate function"
- User wants "visualize code flow"

## Input Contract
- `fileId`: string (required)
- `action`: 'refactor' | 'extract' | 'diagram' | 'explain'
- `selection`: SelectionContext (optional, specific code region)
- `parameters`: object with action-specific params

For `refactor`:
```typescript
{
  target: 'simplify' | 'optimize' | 'modernize',
  preserveLogic: boolean
}
```

For `extract`:
```typescript
{
  newFunctionName: string,
  startLine: number,
  endLine: number
}
```

For `diagram`:
```typescript
{
  diagramType: 'flowchart' | 'sequence' | 'class' | 'dependency',
  level: 'function' | 'file' | 'module'
}
```

## Workflow

### Step 1: Parse code
```typescript
const code = selection.text || await fileIO.readFile(fileId)
const language = detectLanguage(file.name)  // .js, .py, .java

// Simple AST parsing (or use proper parser)
const ast = parseCode(code, language)
```

### Step 2: Apply transformation

#### A) Refactor
```typescript
const prompt = `Refactor this ${language} code.
Target: ${parameters.target}
Requirements:
- Preserve logic exactly
- Improve readability
- Follow best practices
- Add comments if needed

Original code:
${code}

Refactored code:`

const refactored = await callGemini(prompt)
```

#### B) Extract Function
```typescript
const selectedCode = code.split('\n').slice(startLine - 1, endLine).join('\n')

const prompt = `Extract this code into a separate function.
Function name: ${newFunctionName}
Original code:
${selectedCode}

Output:
1. The new function definition
2. The function call to replace the original code

Format:
// New function:
[function code]

// Replacement:
[function call]
`

const result = await callGemini(prompt)
const [newFunction, replacement] = parseExtraction(result)

// Apply changes
const newCode = replaceLines(code, startLine, endLine, replacement)
const fullCode = `${newFunction}\n\n${newCode}`
```

#### C) Generate Diagram

**Flowchart** (for algorithms):
```typescript
const prompt = `Analyze this ${language} function and generate a Mermaid flowchart.
Code:
${code}

Output Mermaid syntax only (start with 'flowchart TD')`

const mermaidCode = await callGemini(prompt)

// Example output:
// flowchart TD
//   A[Start] --> B{Check condition}
//   B -->|Yes| C[Do action]
//   B -->|No| D[Skip]
//   C --> E[End]
//   D --> E
```

**Sequence Diagram** (for interactions):
```typescript
// For async functions, API calls, event handlers
const prompt = `Generate a Mermaid sequence diagram for this code.
Show the flow of function calls and data.

Code:
${code}

Mermaid syntax:`

const mermaidCode = await callGemini(prompt)

// Example:
// sequenceDiagram
//   User->>+API: fetchData()
//   API->>+DB: query()
//   DB-->>-API: results
//   API-->>-User: data
```

**Class Diagram** (for OOP):
```typescript
// Parse class structure
const classes = extractClasses(code)

const mermaidCode = `
classDiagram
${classes.map(cls => `
  class ${cls.name} {
    ${cls.properties.join('\n    ')}
    ${cls.methods.join('\n    ')}
  }
`).join('\n')}
`
```

**Dependency Graph**:
```typescript
// Parse imports
const deps = extractDependencies(code)

const mermaidCode = `
graph LR
  ${deps.map(d => `${d.from} --> ${d.to}`).join('\n  ')}
`
```

#### D) Explain Code
```typescript
const prompt = `Explain this ${language} code step by step.
Use simple language for students.

Code:
${code}

Explanation (numbered steps):`

const explanation = await callGemini(prompt)
```

### Step 3: Create output

**If code modified** (refactor, extract):
```typescript
await createVersion(fileId, newCode, 
  `${action}: ${parameters.target || newFunctionName}`,
  'agent',
  'code-transform-and-diagram'
)
```

**If diagram generated**:
```typescript
const overlay = createCodeOverlay(
  { fileId, anchor: 'global', anchorRef: 'global' },
  'mermaid',
  mermaidCode,
  { x: 500, y: 50 },
  { w: 400, h: 600 }
)

await addOverlay(overlay)
```

**If explanation**:
```typescript
const overlay = createTextOverlay(
  { fileId, anchor: 'global', anchorRef: 'global' },
  explanation,
  { x: 500, y: 50 },
  { w: 400, h: 400 }
)

await addOverlay(overlay)
```

## Output Contract
```json
{
  "action": "diagram",
  "diagramType": "flowchart",
  "overlay": {
    "id": "overlay-diagram-789",
    "blocks": [
      {
        "type": "code",
        "payload": {
          "language": "mermaid",
          "source": "flowchart TD\n  A[Start]..."
        }
      }
    ]
  }
}
```

Or for refactor:
```json
{
  "action": "refactor",
  "versionId": "v5-code-123",
  "diff": {
    "linesChanged": 15,
    "improvements": [
      "Simplified nested if statements",
      "Extracted repeated logic into helper function",
      "Added type hints"
    ]
  }
}
```

## Atomic Tools Used
- `fileIO.readFile(fileId)`
- `extract.parseCode(code, language)`
- `extract.extractClasses(code)`
- `extract.extractDependencies(code)`
- `transform.refactorCode(code, target)`
- `transform.extractFunction(code, range, name)`
- `transform.generateFlowchart(code)`
- `render.mermaidToSvg(mermaidCode)`
- `overlay.createDiagramOverlay(fileId, diagram, position)`
- `fileIO.createVersion(fileId, newCode, description)`

## Verification Rules
- Refactored code must compile/run
- Extracted function has correct signature
- Diagram syntax valid (Mermaid)
- Explanation covers all major steps

## Error Handling
- If refactor breaks logic → rollback, show error
- If diagram too complex → simplify or split
- If language not supported → show text explanation only

## Estimated Tokens
~3000 tokens (code analysis + diagram generation)

## Example Usage

**Scenario 1: Generate flowchart**
User uploads `sort_algorithm.py` (bubble sort)
User: "create flowchart"
→ Analyzes nested loops + conditions
→ Generates Mermaid flowchart
→ Shows as overlay next to code

**Scenario 2: Refactor for clarity**
User has complex nested if-else
User: "simplify this code"
→ Rewrites using guard clauses
→ Extracts conditions into variables
→ Shows diff: 25 lines → 15 lines

**Scenario 3: Extract helper function**
User selects lines 45-60 (validation logic)
User: "extract as validateInput function"
→ Creates new function
→ Replaces selection with function call
→ Updates imports if needed
