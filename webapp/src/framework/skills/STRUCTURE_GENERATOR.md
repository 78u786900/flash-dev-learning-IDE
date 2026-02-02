# Skill Structure Generator 🏗️

This document provides templates for quickly generating complete skill structures.

## Complete Structure Template

```
<skill-name>/
├── SKILL.md          ✅ Already complete
├── refs/
│   ├── schema.md     📋 Input/Output schemas
│   └── examples.md   📝 Example inputs/outputs
└── scripts/
    └── <name>.ts     💻 Deterministic code
```

---

## Schema Template (`refs/schema.md`)

```markdown
# Input Schema

\`\`\`typescript
interface <SkillName>Input {
  // Required fields
  field1: type
  
  // Optional fields
  field2?: type
}
\`\`\`

# Output Schema

\`\`\`typescript
interface <SkillName>Output {
  // Required output
  result: type
  
  // Metadata
  confidence?: number
  timestamp: number
}
\`\`\`

# Processing Rules

- Rule 1: Description
- Rule 2: Description
- Rule 3: Description
```

---

## Examples Template (`refs/examples.md`)

```markdown
# Example 1: <Scenario Name>

## Input
\`\`\`json
{
  "field1": "value1",
  "field2": "value2"
}
\`\`\`

## Expected Output
\`\`\`json
{
  "result": "...",
  "confidence": 0.95
}
\`\`\`

---

# Example 2: <Another Scenario>

## Input
\`\`\`json
{ ... }
\`\`\`

## Expected Output
\`\`\`json
{ ... }
\`\`\`
```

---

## Script Template (`scripts/<name>.ts`)

```typescript
/**
 * <Skill Name> - Deterministic Helper Functions
 */

/**
 * Main processing function
 */
export function process<Something>(input: any): any {
  // Implementation
  return result
}

/**
 * Validation function
 */
export function validate<Something>(data: any): { valid: boolean; errors: string[] } {
  const errors = []
  
  // Validation logic
  
  return { valid: errors.length === 0, errors }
}

/**
 * Helper function 1
 */
export function helper1(param: any): any {
  // Implementation
}

/**
 * Helper function 2
 */
export function helper2(param: any): any {
  // Implementation
}
```

---

## Priority Skills (Complete Structure Required)

### High Priority (MVP Phase 1-2):
1. ✅ detect-filetype-and-indexing
2. ✅ semantic-search-in-files
3. ✅ region-ocr
4. ✅ table-extraction (partial)
5. ⏳ file-versioning-and-diff
6. ⏳ canvas-overlay-authoring
7. ⏳ latex-render-and-verify

### Medium Priority (MVP Phase 3):
8. audio-transcribe-and-index
9. code-transform-and-diagram
10. note-linking-relative-paths

### Lower Priority (Post-MVP):
11-19. Remaining skills

---

## Auto-Generation Script

For skills without complex deterministic logic, the `scripts/` folder can contain:

**Minimal Script** (`scripts/helpers.ts`):
```typescript
/**
 * Generic helper functions for <Skill Name>
 */

export function formatOutput(data: any): any {
  return {
    ...data,
    timestamp: Date.now()
  }
}

export function validateInput(input: any): boolean {
  return input !== null && input !== undefined
}
```

This is sufficient for skills that primarily use LLM calls.

---

## Next Steps

1. ✅ Complete refs/ + scripts/ for top 7 MVP skills
2. ⏸️ Other skills: minimal structure (refs/schema.md only)
3. 🚀 Proceed to Router + Atomic Tools implementation
