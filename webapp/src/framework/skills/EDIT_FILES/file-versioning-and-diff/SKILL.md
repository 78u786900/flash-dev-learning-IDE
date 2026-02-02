# Skill: File Versioning and Diff 🔁

## Purpose
Create file versions, generate diff preview, enable rollback. Every edit is reversible with full change history.

## When to Use
- Before any file modification
- User asks "save version" or "create checkpoint"
- User wants to "compare versions" or "undo changes"
- Agent needs to edit file safely

## Input Contract
- `fileId`: string (required)
- `newContent`: Blob | string (required, updated file content)
- `changeDescription`: string (required, what changed)
- `changedBy`: 'user' | 'agent' (required)
- `skillName`: string (optional, which skill made the change)

## Workflow

### Step 1: Get current version
- Read file.version (current version number)
- Read file.versions[latest].blobUrl (current content)

### Step 2: Generate diff
**For text files** (txt, md, code):
```typescript
import DiffMatchPatch from 'diff-match-patch'
const dmp = new DiffMatchPatch()
const diffs = dmp.diff_main(oldContent, newContent)
const diffHtml = dmp.diff_prettyHtml(diffs)
const diffText = dmp.diff_text1(diffs)  // old text
              + dmp.diff_text2(diffs)  // new text
```

**For binary files** (pdf, docx, image):
- Compare file sizes
- Generate checksum (SHA-256)
- Note: "Binary file changed (old: 2.3 MB, new: 2.5 MB)"

### Step 3: Create new version
```typescript
const newVersionId = `v${file.version + 1}-${fileId}`
const newBlobUrl = URL.createObjectURL(newContent)

const newVersion: FileVersion = {
  versionId: newVersionId,
  fileId,
  timestamp: Date.now(),
  diff: diffText,
  blobUrl: newBlobUrl,
  metadata: {
    changedBy,
    skillName,
    changeDescription
  }
}
```

### Step 4: Update file entity
```typescript
file.version += 1
file.versions.push(newVersion)
file.url = newBlobUrl  // point to latest
file.updatedAt = Date.now()
```

### Step 5: Store old version (keep last 10)
- If versions.length > 10 → remove oldest
- Revoke old blob URLs to free memory
- Keep at least version 1 (original)

### Step 6: Generate diff summary
```typescript
const summary = {
  linesAdded: countLinesAdded(diffs),
  linesRemoved: countLinesRemoved(diffs),
  linesChanged: countLinesChanged(diffs),
  percentChange: (changedLines / totalLines) * 100
}
```

## Output Contract
Must return:
```json
{
  "versionId": "v3-file-123",
  "previousVersion": "v2-file-123",
  "diff": {
    "html": "<span>...</span>",
    "text": "- old line\n+ new line",
    "summary": {
      "linesAdded": 5,
      "linesRemoved": 2,
      "linesChanged": 3,
      "percentChange": 15.2
    }
  },
  "changeDescription": "Rewrote introduction paragraph",
  "timestamp": 1738368000000
}
```

## Atomic Tools Used
- `fileIO.getFileBlob(fileId)`
- `fileIO.createBlobUrl(content)`
- `fileIO.updateFileEntity(fileId, updates)`
- `transform.generateDiff(oldContent, newContent)`
- `transform.diffToHtml(diffs)`
- `transform.computeDiffSummary(diffs)`

## Verification Rules
- New version number = old version + 1
- Diff must be non-null (even if "no changes")
- Blob URL must be valid
- Version history max 10 items

## Error Handling
- If file not found → return error
- If newContent same as oldContent → warn "no changes"
- If diff generation fails → store raw content, mark diff as "unavailable"

## Rollback Feature
Allow reverting to previous version:
```typescript
function rollback(fileId: string, targetVersionId: string) {
  const targetVersion = file.versions.find(v => v.versionId === targetVersionId)
  if (!targetVersion) throw new Error('Version not found')
  
  // Create new version pointing to old content
  createVersion(fileId, targetVersion.blobUrl, `Rollback to ${targetVersionId}`, 'user')
}
```

## Estimated Tokens
~1500 tokens (diff generation)

## Example Usage
**User**: Edits `notes.md`, changes 3 paragraphs
**Agent**: Calls `file-versioning-and-diff` before applying changes
**Output**:
```json
{
  "versionId": "v4-notes-456",
  "diff": {
    "summary": {
      "linesAdded": 8,
      "linesRemoved": 5,
      "percentChange": 12.3
    }
  },
  "changeDescription": "Expanded section 2, added examples"
}
```

User can click "View diff" → see before/after comparison
User can click "Rollback to v3" → restore previous version
