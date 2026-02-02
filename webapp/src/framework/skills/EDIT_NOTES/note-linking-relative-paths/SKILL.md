# Skill: Note Linking Relative Paths 🔗📁

## Purpose
Create bidirectional links between notes using relative paths. Build a knowledge graph that updates automatically.

## When to Use
- User types `[[Other Note]]` or `[[section#anchor]]`
- User asks "link this to my chapter 2 notes"
- User wants "show related notes"
- User needs "backlinks" (what links to this note)

## Input Contract
- `noteId`: string (required)
- `action`: 'create_link' | 'update_links' | 'show_graph' | 'find_backlinks'
- `targetNoteId`: string (optional, for explicit linking)
- `linkText`: string (optional, link display text)

## Workflow

### Step 1: Parse note content for links

**Wiki-style links**: `[[Note Name]]` or `[[Note Name#section]]`
```typescript
const linkPattern = /\[\[([^\]]+)\]\]/g
const links = []

let match
while ((match = linkPattern.exec(note.content)) !== null) {
  const linkText = match[1]
  const [noteName, anchor] = linkText.split('#')
  
  links.push({
    sourceNoteId: note.id,
    sourceSectionId: currentSectionId,
    targetNoteName: noteName.trim(),
    targetAnchor: anchor?.trim(),
    position: match.index
  })
}
```

**Markdown-style links**: `[Display Text](note://note-id#section-id)`
```typescript
const mdLinkPattern = /\[([^\]]+)\]\(note:\/\/([^)]+)\)/g

while ((match = mdLinkPattern.exec(note.content)) !== null) {
  const displayText = match[1]
  const [noteId, sectionId] = match[2].split('#')
  
  links.push({
    sourceNoteId: note.id,
    displayText,
    targetNoteId: noteId,
    targetSectionId: sectionId
  })
}
```

### Step 2: Resolve links to actual notes

```typescript
for (const link of links) {
  if (link.targetNoteId) {
    // Direct ID reference
    link.resolved = getNote(link.targetNoteId)
  } else if (link.targetNoteName) {
    // Name-based search
    const matches = findNotesByName(link.targetNoteName)
    if (matches.length === 1) {
      link.resolved = matches[0]
      link.targetNoteId = matches[0].id
    } else if (matches.length > 1) {
      link.ambiguous = true
      link.candidates = matches
    } else {
      link.broken = true
    }
  }
}
```

### Step 3: Update link registry

Maintain a global link graph:
```typescript
interface LinkGraph {
  nodes: {
    noteId: string
    noteName: string
    type: 'note' | 'section'
  }[]
  edges: {
    from: string  // noteId or sectionId
    to: string
    linkType: 'reference' | 'parent' | 'related'
    createdAt: number
  }[]
}

// Add new links
for (const link of links) {
  if (link.resolved && !link.broken) {
    linkGraph.edges.push({
      from: link.sourceNoteId,
      to: link.targetNoteId,
      linkType: 'reference',
      createdAt: Date.now()
    })
  }
}
```

### Step 4: Generate relative paths (for portability)

Instead of absolute IDs, use relative paths:
```typescript
function getRelativePath(fromNoteId: string, toNoteId: string) {
  const fromNote = getNote(fromNoteId)
  const toNote = getNote(toNoteId)
  
  // If both in same folder → just name
  if (fromNote.folder === toNote.folder) {
    return toNote.name
  }
  
  // Otherwise: ../folder/name
  const relativePath = calculateRelativePath(fromNote.path, toNote.path)
  return relativePath
}
```

### Step 5: Find backlinks (bidirectional)

For a given note, find all notes that link to it:
```typescript
function findBacklinks(noteId: string) {
  return linkGraph.edges
    .filter(edge => edge.to === noteId)
    .map(edge => {
      const sourceNote = getNote(edge.from)
      return {
        noteId: edge.from,
        noteName: sourceNote.name,
        linkType: edge.linkType
      }
    })
}
```

### Step 6: Visualize link graph (Mermaid)

```typescript
function generateLinkGraph(noteId: string, depth: number = 2) {
  const visited = new Set()
  const nodes = []
  const edges = []
  
  function traverse(currentId: string, currentDepth: number) {
    if (currentDepth > depth || visited.has(currentId)) return
    visited.add(currentId)
    
    const note = getNote(currentId)
    nodes.push(`${currentId}[${note.name}]`)
    
    // Outgoing links
    const outgoing = linkGraph.edges.filter(e => e.from === currentId)
    for (const edge of outgoing) {
      edges.push(`${edge.from} --> ${edge.to}`)
      traverse(edge.to, currentDepth + 1)
    }
  }
  
  traverse(noteId, 0)
  
  return `
graph LR
  ${nodes.join('\n  ')}
  ${edges.join('\n  ')}
`
}
```

### Step 7: Auto-update when notes renamed/moved

```typescript
function onNoteRenamed(noteId: string, oldName: string, newName: string) {
  // Find all links referencing old name
  const affectedNotes = findNotesLinkingTo(oldName)
  
  for (const note of affectedNotes) {
    // Update [[Old Name]] → [[New Name]]
    note.content = note.content.replace(
      new RegExp(`\\[\\[${escapeRegex(oldName)}\\]\\]`, 'g'),
      `[[${newName}]]`
    )
    
    saveNote(note)
  }
}
```

## Output Contract
```json
{
  "noteId": "note-123",
  "links": [
    {
      "targetNoteId": "note-456",
      "targetNoteName": "Chapter 2: Photosynthesis",
      "linkType": "reference",
      "resolved": true
    }
  ],
  "backlinks": [
    {
      "sourceNoteId": "note-789",
      "sourceNoteName": "Summary Notes"
    }
  ],
  "graph": "graph LR\n  note-123[Chapter 1]..."
}
```

## Atomic Tools Used
- `fileIO.getNote(noteId)`
- `fileIO.findNotesByName(name)`
- `transform.parseLinks(content)`
- `transform.resolveLink(linkText, context)`
- `transform.getRelativePath(from, to)`
- `fileIO.updateNote(noteId, updates)`
- `transform.generateMermaidGraph(linkGraph, noteId, depth)`

## Verification Rules
- All links must be resolvable or marked as broken
- Backlinks list must be up-to-date
- Relative paths must work across folders
- No circular link chains (warn)

## Error Handling
- If link ambiguous → show candidates, ask user to choose
- If link broken → highlight in yellow, suggest creating note
- If graph too large → limit depth or node count

## Estimated Tokens
~1000 tokens (link resolution + graph generation)

## Example Usage

**Scenario 1: Create link**
User types in "Chapter 1" note: "See [[Chapter 2]] for more details"
→ System finds "Chapter 2" note
→ Creates link
→ "Chapter 2" backlinks now shows "Chapter 1"

**Scenario 2: Show graph**
User clicks "Show related notes" on "Chapter 3"
→ Generates graph showing:
  - Chapter 1 → Chapter 2 → Chapter 3
  - Summary Notes → Chapter 3
→ User can click nodes to navigate

**Scenario 3: Rename note**
User renames "Chapter 2" → "Chapter 2: Cell Biology"
→ System auto-updates all links
→ [[Chapter 2]] becomes [[Chapter 2: Cell Biology]]
→ No broken links
