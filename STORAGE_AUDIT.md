# Storage Audit – Cloud & Local Persistence

## Data Types & Storage Flow

| Data Type | Storage Location | Save Flow | Load Flow |
|-----------|------------------|-----------|-----------|
| **Notes** | `storage.json` in Drive (or localStorage) | `saveNotes()` → debounced → PUT `/storage/notes` | `loadNotes()` → GET `/storage/notes` or localStorage |
| **Timeline** | `storage.json` (capped 200) | `saveTimeline()` → PUT `/storage/timeline` | `loadTimeline()` → GET `/storage/timeline` |
| **Chat threads** | `storage.json` (capped 100 threads × 100 msgs) | `saveChatThreads()` → PUT `/storage/chat` | `loadChatThreads()` → GET `/storage/chat` |
| **Canvas overlays** | `storage.json` | `saveCanvasOverlays()` → PUT `/storage/overlays` | `loadCanvasOverlays()` → GET `/storage/overlays` |
| **File metadata** | `storage.json` (`fileMetadata[]`) | Managed by files API (upload/rename/delete) | Merged with Drive files in GET `/files` |
| **File blobs** | Drive appDataFolder (or IndexedDB) | POST `/files` → `driveService.uploadFile()` | GET `/files/:id` → download + blob URL |

## Notes Structure (Full Fidelity)

Notes include:
- `sections[].recordings` – voice recordings (dataUrl, transcript, etc.)
- `sections[].codeWindows` – inline code windows (HTML/React snippets)

All stored in `storage.json` via the notes payload.

## Fixes Applied

1. **File delete – orphaned files**  
   Files in Drive without metadata (e.g. metadata save failed) can now be deleted; the delete route falls back to Drive listing when metadata is missing.

2. **saveAllToCloud – preserve fileMetadata**  
   `saveAllToCloud` now loads current storage and reuses `fileMetadata` instead of overwriting with `[]`.

3. **First-time sync**  
   When cloud is empty and local has data, the app now pushes notes, timeline, chat, overlays to cloud on first login.

4. **Verification – files included**  
   Storage verification now compares `fileMetadata` as well, and the UI shows file mismatches.

5. **Local files sync on login**  
   Files in IndexedDB are automatically uploaded to Drive when you log in. Each local file is fetched, re-uploaded, and replaced in state with the cloud version.

## Known Limitations

1. **Local files before login**  
   *Fixed:* Local files in IndexedDB are now auto-uploaded to Drive when you log in. “upload local files to cloud” feature.

2. **Large payloads**  
   Recordings with long base64 `dataUrl` can make notes large. Drive has size limits; very large payloads may need chunking or compression.

3. **Concurrent saves**  
   Granular saves (notes, timeline, chat, overlays) each load full storage, modify one field, and save. Rapid edits can cause race conditions; debouncing limits this.

## Verification

Use the avatar dropdown → **驗證儲存** to compare client state with Drive:

- ✓ notes, timeline, chat, overlays, file metadata
- Shows which parts differ when they don’t match
