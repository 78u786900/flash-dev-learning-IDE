# Agent memory & local persistence – plan

## Goal
- **Agent memory**: store “stuff” locally so the agent has history context.
- **Chat history**: persist conversation (user + agent messages and agent runs).
- **Agentic interaction with history context**: when the user returns, restore chat and timeline so the agent sees past context (messages + timeline).

## Current state (no persistence)
- **Notes**: `App` state only → lost on refresh.
- **Files**: `App` state (blob URLs) → lost on refresh; blob URLs cannot be restored from localStorage.
- **Timeline**: `App` state → lost on refresh.
- **Chat**: `ChatPanel` state (messages + agentRun) → lost on refresh.
- **Agent context**: built at runtime from notes, files, timeline, current file; no persistence.

## What to persist (localStorage)

| Data | Key | Cap / notes |
|------|-----|-------------|
| **Notes** | `learning_ide_notes` | Full (id, name, sections, createdAt). Merge with default if empty. |
| **Timeline** | `learning_ide_timeline` | Last 200 entries (trim on save). |
| **Chat history** | `learning_ide_chat` | Last N messages (e.g. 100) including `agentRun` (logs, toolCalls, error). |

**Agent memory** = chat history + timeline. The agent already receives `messages` (history) and `timeline` (recent actions). Persisting both gives “agent memory” and “interaction with history context” on reload.

**Files**: Not persisted in v1 (blob URLs are invalid after reload). Option later: persist file metadata only and show “re-drop to open” or use IndexedDB for blobs.

## Implementation steps

1. **Persistence module**  
   - Add `src/storage/persistence.ts`: types for stored data, `loadNotes()`, `saveNotes()`, `loadTimeline()`, `saveTimeline()`, `loadChat()`, `saveChat()`.  
   - Use JSON + localStorage; debounce saves (e.g. 300ms) to avoid thrashing.

2. **Persist notes**  
   - On App mount: load notes from storage; if empty, use default note.  
   - When `notes` (or activeNoteId) change: debounced save.  
   - Keep existing “empty notes guard” and default-note logic.

3. **Persist timeline**  
   - On App mount: load timeline from storage (optional merge with in-memory).  
   - When `timeline` changes: debounced save (cap at 200).

4. **Persist chat history**  
   - Lift chat state from ChatPanel to App: `messages`, `setMessages` (and optionally mode/model).  
   - On App mount: load chat from storage; initialize messages.  
   - When messages change: debounced save (cap at 100 messages).  
   - ChatPanel receives `messages` and `onMessagesChange` (or `setMessages`).  
   - Ensure `agentRun` in each message is JSON-serializable (it already is: logs, toolCalls, error).

5. **Restore agent context**  
   - No extra step: agent context is rebuilt from restored notes + timeline + current file.  
   - Restored `messages` are passed to `runAgentChatWithTools` as history, so the model sees full conversation history after reload.

## File structure
- `webapp/src/storage/persistence.ts` – load/save, keys, debounce, types.
- `App.tsx` – init from storage, save on changes (notes, timeline, chat).
- `ChatPanel.tsx` – receive messages/setMessages from App; keep local UI state (input, loading, liveAgentRun).

## Edge cases
- **First load / no storage**: use default note, empty timeline, default welcome message in chat.  
- **Corrupt or old JSON**: catch parse errors; fall back to defaults.  
- **Chat cap**: keep last 100 messages; trim oldest on save.
