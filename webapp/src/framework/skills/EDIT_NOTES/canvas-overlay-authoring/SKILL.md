# Skill: Canvas Overlay Authoring 🧠🖍️

## Purpose
Create rich overlays with multi-block content (text/markdown/code/rendered). The core skill for adding explanations, diagrams, annotations anywhere.

## When to Use
- User asks "add explanation overlay here"
- User wants to "annotate this with diagram"
- User needs "add comment with code example"
- Any time agent wants to add visual content without modifying original

## Input Contract
- `attachedTo`: OverlayAttachment (fileId or noteId + anchor)
- `position`: { x: number, y: number }
- `size`: { w: number, h: number }
- `blocks`: array of OverlayBlock specs
- `style`: OverlayStyle (optional)

Block spec:
```typescript
{
  type: 'text' | 'markdown' | 'image' | 'code' | 'rendered',
  content?: string,        // for text/markdown
  url?: string,            // for image
  language?: string,       // for code
  source?: string          // for code
}
```

## Workflow

### Step 1: Validate attachment target

```typescript
function validateAttachment(attachedTo: OverlayAttachment) {
  if (attachedTo.fileId) {
    const file = getFile(attachedTo.fileId)
    if (!file) throw new Error('File not found')
    
    // Validate anchor
    if (attachedTo.anchor === 'page') {
      const pageNum = parseInt(attachedTo.anchorRef.split(':')[1])
      if (pageNum > file.metadata.pages) throw new Error('Page out of range')
    }
  }
  
  if (attachedTo.noteId) {
    const note = getNote(attachedTo.noteId)
    if (!note) throw new Error('Note not found')
    
    if (attachedTo.anchor === 'note-section') {
      const sectionId = attachedTo.anchorRef.split(':')[1]
      if (!note.sections.find(s => s.id === sectionId)) {
        throw new Error('Section not found')
      }
    }
  }
}
```

### Step 2: Create overlay entity

```typescript
const overlay: Overlay = {
  id: `overlay-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  attachedTo,
  layer: 10,  // default layer
  position,
  size,
  style: style || {
    background: 'solid',
    border: 'thin',
    opacity: 0.95,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#ccc'
  },
  blocks: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  metadata: {
    createdBy: 'agent',
    skillName: 'canvas-overlay-authoring'
  }
}
```

### Step 3: Process each block

```typescript
for (const blockSpec of blocks) {
  const block: OverlayBlock = {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: blockSpec.type,
    payload: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  
  switch (blockSpec.type) {
    case 'text':
    case 'markdown':
      block.payload.content = blockSpec.content
      break
    
    case 'image':
      block.payload.url = blockSpec.url
      break
    
    case 'code':
      block.payload.language = blockSpec.language
      block.payload.source = blockSpec.source
      block.payload.renderMode = 'static'
      block.payload.runPolicy = 'render_only'
      break
    
    case 'rendered':
      // For pre-rendered content (e.g. Mermaid → SVG)
      if (blockSpec.language === 'mermaid') {
        const svg = await renderMermaid(blockSpec.source)
        block.payload.format = 'svg'
        block.payload.artifactUrl = `data:image/svg+xml;base64,${btoa(svg)}`
        block.payload.sourceBlockId = `code-block-id`
      }
      break
  }
  
  overlay.blocks.push(block)
}
```

### Step 4: Render overlay in UI

**React component** (simplified):
```typescript
function OverlayRenderer({ overlay }: { overlay: Overlay }) {
  return (
    <div
      className="overlay-canvas"
      style={{
        position: 'absolute',
        left: overlay.position.x,
        top: overlay.position.y,
        width: overlay.size.w,
        height: overlay.size.h,
        zIndex: overlay.layer,
        backgroundColor: overlay.style.backgroundColor,
        border: overlay.style.border === 'thin' ? '1px solid ' + overlay.style.borderColor : 'none',
        opacity: overlay.style.opacity
      }}
    >
      {overlay.blocks.map(block => (
        <OverlayBlock key={block.id} block={block} />
      ))}
    </div>
  )
}

function OverlayBlock({ block }: { block: OverlayBlock }) {
  switch (block.type) {
    case 'text':
      return <div>{block.payload.content}</div>
    
    case 'markdown':
      return <ReactMarkdown>{block.payload.content}</ReactMarkdown>
    
    case 'image':
      return <img src={block.payload.url} alt="" />
    
    case 'code':
      return <SyntaxHighlighter language={block.payload.language}>
        {block.payload.source}
      </SyntaxHighlighter>
    
    case 'rendered':
      if (block.payload.format === 'svg') {
        return <img src={block.payload.artifactUrl} alt="" />
      }
      return <div dangerouslySetInnerHTML={{ __html: block.payload.artifactUrl }} />
  }
}
```

### Step 5: Enable drag & resize

```typescript
import Draggable from 'react-draggable'
import { Resizable } from 'react-resizable'

function EditableOverlay({ overlay, onUpdate }) {
  return (
    <Draggable
      position={{ x: overlay.position.x, y: overlay.position.y }}
      onStop={(e, data) => {
        onUpdate({ ...overlay, position: { x: data.x, y: data.y } })
      }}
    >
      <Resizable
        width={overlay.size.w}
        height={overlay.size.h}
        onResize={(e, { size }) => {
          onUpdate({ ...overlay, size: { w: size.width, h: size.height } })
        }}
      >
        <OverlayRenderer overlay={overlay} />
      </Resizable>
    </Draggable>
  )
}
```

### Step 6: Save overlay

```typescript
// In-memory (React state)
setOverlays(prev => [...prev, overlay])

// Persistent storage
await saveOverlay(overlay)

// Link to file/note metadata
if (overlay.attachedTo.fileId) {
  const file = getFile(overlay.attachedTo.fileId)
  file.metadata.overlayIds = [...(file.metadata.overlayIds || []), overlay.id]
  await updateFile(file)
}
```

### Step 7: Load overlays when viewing file/note

```typescript
function loadOverlaysFor(fileId?: string, noteId?: string) {
  return overlays.filter(overlay => {
    if (fileId && overlay.attachedTo.fileId === fileId) return true
    if (noteId && overlay.attachedTo.noteId === noteId) return true
    return false
  })
}
```

## Output Contract
```json
{
  "overlay": {
    "id": "overlay-abc123",
    "attachedTo": {
      "fileId": "file-456",
      "anchor": "page",
      "anchorRef": "page:5"
    },
    "position": {"x": 200, "y": 300},
    "size": {"w": 400, "h": 300},
    "blocks": [
      {
        "type": "markdown",
        "payload": {
          "content": "## Explanation\nThis diagram shows..."
        }
      },
      {
        "type": "code",
        "payload": {
          "language": "mermaid",
          "source": "flowchart TD\n  A --> B"
        }
      }
    ]
  }
}
```

## Atomic Tools Used
- `fileIO.getFile(fileId)`
- `fileIO.getNote(noteId)`
- `overlay.validateAttachment(attachedTo)`
- `overlay.createOverlay(spec)`
- `overlay.addBlock(overlayId, block)`
- `render.mermaidToSvg(code)`
- `render.markdownToHtml(markdown)`
- `fileIO.saveOverlay(overlay)`
- `fileIO.loadOverlaysFor(fileId, noteId)`

## Verification Rules
- Position within bounds of attached document
- All blocks have valid content
- Rendered blocks (Mermaid, SVG) must render successfully
- Overlay must not obscure critical content (warn)

## Error Handling
- If attachment invalid → return error
- If block render fails → show error block
- If position out of bounds → auto-adjust to fit

## Estimated Tokens
~2000 tokens (overlay creation + rendering)

## Example Usage

**Scenario 1: Explain concept with diagram**
User reading PDF on page 5 (about algorithms)
User: "add explanation with flowchart"
→ Agent creates overlay at (200, 300)
→ Block 1: Markdown text explanation
→ Block 2: Mermaid flowchart
→ User can drag/resize overlay

**Scenario 2: Annotate code with comments**
User viewing code file
User selects function, asks "explain this"
→ Agent creates overlay next to function
→ Block 1: Text explanation
→ Block 2: Example usage code

**Scenario 3: Multi-media overlay**
User studying biology diagram
User: "add overlay with definition + related image"
→ Block 1: Markdown with definition
→ Block 2: Image from web (cell structure)
→ Block 3: Link to related note
