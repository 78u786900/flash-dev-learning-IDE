# Codebase & Agent Framework Overview

> Single reference for codebase structure, agent logic, and current progress.  
> Last updated: 2026-02-01

---

## 1. Project & File Structure

```
learning_IDE/
├── AGENT_FRAMEWORK_EXECUTION_PLAN.md   # Blueprint: macro-micro-atomic layers, phases
├── HOW_TO_USE_AGENT.md                 # Build, debug, use agent (Cantonese)
├── CODEBASE_AND_AGENT_OVERVIEW.md      # This file
├── FINAL_SKILLS_STATUS.md             # 19 framework skills status
├── webapp/
│   ├── src/
│   │   ├── main.tsx, App.tsx           # Entry + root state (notes, files, chat, timeline)
│   │   ├── types.ts                   # Note, Section, DroppedFile, TimelineAction
│   │   ├── storage/
│   │   │   └── persistence.ts         # localStorage: notes, timeline, chat (debounced)
│   │   ├── agent/                     # ★ Agent runtime (Gemini + tools)
│   │   │   ├── types.ts               # AgentContext, ToolResult, ToolResultAction
│   │   │   ├── geminiWithTools.ts     # runAgentChatWithTools: context, loop, logs
│   │   │   ├── chatLog.ts             # Terminal log (user/agent)
│   │   │   └── tools/
│   │   │       ├── definitions.ts    # Gemini functionDeclarations (all tools)
│   │   │       ├── index.ts          # executeTool, RUNNERS map
│   │   │       ├── runGemini.ts      # createCallGemini (single prompt)
│   │   │       ├── embedding.ts       # Gemini embed API → cosine similarity (semantic search)
│   │   │       ├── noteTools.ts       # create_note, verbal_to_structured, update_section, etc.
│   │   │       ├── pdfTools.ts        # summarize_page, page_to_note, extract_definitions, etc.
│   │   │       ├── pdfOnDemand.ts     # getPdfPageTextOnDemand (fetch page text by number)
│   │   │       └── searchTools.ts     # search_workspace (keyword + semantic)
│   │   ├── components/                # UI
│   │   │   ├── ChatPanel.tsx          # Ask/Agent mode, send → runAgentChatWithTools, live log
│   │   │   ├── Sidebar.tsx, Header.tsx, StatusBar.tsx
│   │   │   ├── Canvas.tsx, FileViewer.tsx  # Note editor; PDF/image/video viewer + PDF text stream
│   │   │   ├── NoteContentWithLatex.tsx   # LaTeX-first note renderer
│   │   │   └── ...
│   │   └── framework/                 # Future macro-micro-atomic (not yet wired to agent)
│   │       ├── models/                # File, Selection, Overlay, Skill (TypeScript)
│   │       └── skills/                # 19 micro-skills (SKILL.md + refs/ + scripts/)
│   │           ├── registry.json      # name, macro, triggers, input/output contracts
│   │           ├── READ_FILES/        # detect-filetype, semantic-search, region-ocr, table, audio, video, codebase
│   │           ├── EDIT_FILES/        # file-versioning, pdf-annotate, docx, xlsx, pptx, image, code-transform
│   │           └── EDIT_NOTES/        # latex-render, note-linking, canvas-overlay, spaced-repetition, exam-pack
│   └── public/pdf-viewer.html         # Same-origin PDF viewer (optional; native iframe used by default)
```

- **Runtime agent** lives in `webapp/src/agent/`: tools are **flat** (no router); Gemini picks tools by name from `definitions.ts` and `RUNNERS` in `tools/index.ts`.
- **Framework** in `webapp/src/framework/` is the **future** layer: `registry.json` + 19 skills with SKILL.md; the plan is to route user intent → macro → micro-skills and execute via atomic tools. Currently the app does **not** call the framework router or SkillExecutor; it only uses the agent tools.

---

## 2. Agent Framework (Current) – How It Works

### 2.1 Data flow

1. **App.tsx** holds: `notes`, `files`, `activeNoteId`, `activeFileId`, `timeline`, `chatMessages`, PDF state (`pdfPageTexts`, `pdfChapters`, `viewingPdfPageNumber`, `lastUsedPdfFile`).
2. **Persistence**: `loadNotes/saveNotes`, `loadTimeline/saveTimeline`, `loadChat/saveChat` (debounced, caps: timeline 200, chat 100). Notes and chat are restored on load; files are not (blob URLs invalid).
3. **Agent context**: `App` builds `agentContext` (see below) and passes it to `ChatPanel` with `onToolAction` and (for messages) `messages` / `onMessagesChange`.
4. **ChatPanel**: On send in **Agent** mode it calls `runAgentChatWithTools({ apiKey, modelApiId, messages, userMessage, agentContext, onToolAction, onLog, attachedImage })`. `onLog` streams each log line to `liveAgentRun`, so the UI shows a real-time log. When the run finishes, the final reply and `agentRun` (logs, toolCalls, error) are appended to `messages` and persisted.

### 2.2 Context: `buildContextMessage` (geminiWithTools.ts)

The model receives a single **context string** that includes:

- Workspace summary: number of notes/files; instruction to use `search_workspace` for macro search.
- All notes: `note_id`, name, section count.
- All files: `file_id`, name, type.
- Current note: id, name, sections (title + content preview ~400 chars).
- Current/last file, file type, and if PDF: “User is currently viewing: … PDF page N”, plus optional `pageText`/selection.
- PDF on-demand: “When you call page_to_note(page_number) or summarize_page(page_number), the tool fetches that page’s text.”
- PDF chapters (from outline), total pages, and optional `pdfPageTexts` hint.
- Timeline: last 6 entries (e.g. “Reading: file, page N”).
- No blob URLs or raw file content; only metadata, section previews, and page/chapter info.

### 2.3 Loop (runAgentChatWithTools)

- **History**: Last 20 messages (`HISTORY_CAP`) are sent as conversation history.
- **User turn**: `contextBlurb` + “LATEST REQUEST (act only on this):” + `[User]\n` + user message (and optional image).
- **System**: `AGENT_SYSTEM` (Cantonese, rules for first page/chapter, new note, PDF page, search_workspace, LaTeX-only notes, etc.).
- **Loop** (max 15 turns):
  - Call Gemini with `contents` + `tools` (functionDeclarations) + `toolConfig` (ANY, allowed names).
  - If response is **text** → return that as final reply.
  - If response is **functionCall** → resolve tool name and args, then:
    - `pushLog` `[Layer]`, `[Skill]`, `[Tool] name(args…)`, then `[Tool] name → ok/error: <first 80 chars>`.
    - For **search_workspace** success: push `[Search result]` and full result lines (so realtime log shows full search output).
    - `executeTool(name, args, agentContext, callGemini)` → get `ToolResult`; if `action` (e.g. add_section), call `onToolAction(action)`.
    - Append to `allParts`: model’s functionCall + user functionResponse (result text). Continue loop.
  - If tool was **reply** and success → return that as final reply (with optional fallback if some other tool failed).
- **Layer/skill labels**: From `TOOL_LAYER_SKILL` (e.g. `search_workspace` → READ_FILES / search_workspace). Used only for logging.

### 2.4 Tools (atomic, flat)

- **Definitions**: `AGENT_TOOL_DEFINITIONS` in `tools/definitions.ts` (name, description, parameters) → sent to Gemini as `functionDeclarations`.
- **Runners**: In `tools/index.ts`, `RUNNERS[name]` = `run_<name>` from `noteTools`, `pdfTools`, `searchTools`; `executeTool` looks up and runs, returns `ToolResult` (success, text, action?, error).
- **Notable tools**:
  - **reply**: echo message (used when no other tool needed).
  - **create_note**, **verbal_to_structured**, **page_to_note**, **update_section**, **merge_sections**, **reorder_sections**, **rename_note**, **delete_note**, **delete_section**, **search_sections**, **summarize_section**, **expand_section**, **extract_key_terms**, **generate_quiz**, **suggest_structure**.
  - **summarize_page**, **generate_qa_from_page**, **extract_definitions** (PDF).
  - **search_workspace**: `query`, optional `mode` (keyword | semantic), optional `scope` (all | notes | files | note_ids:id1,id2 | file_ids:…). Semantic uses `ctx.embedForSearch` (Gemini embedding API + cosine similarity). Builds hits from note sections, file names, and PDF page text (from `ctx.pdfPageTexts` or current file). Returns multiline text; full result is also pushed to the realtime log.

### 2.5 Tool actions → App

- `onToolAction` in App handles: `add_section`, `merge_sections`, `update_section`, `reorder_sections`, `rename_note`, `delete_note`, `delete_section`. App updates `notes` (and optionally `activeNoteId`), then persistence saves notes. No backend; all in memory + localStorage.

### 2.6 PDF text and “current page”

- **FileViewer**: When showing a PDF, starts `loadPdfPageTextsStream` (pdfjs-dist), streams page text in chunks; calls `onPdfTextLoaded(pages, fileId, totalPages)` and `onPdfChaptersLoaded(chapters, fileId, totalPages)`. App only applies these when `activeFileIdRef.current === fileId` (stable callbacks from App avoid restarting stream on every render).
- **Page number**: With native PDF iframe, the app does not get scroll position; `viewingPdfPageNumber` defaults to 1 when a PDF is opened and can be updated by a custom viewer. Agent uses this as “current page” for “this page” and for `page_to_note`/`summarize_page`.
- **On-demand**: `getPdfPageTextOnDemand` (pdfOnDemand.ts) is passed in context when a PDF is active; tools that need a specific page’s text call it with `(fileUrl, pageNumber)` so PDF text does not have to be fully preloaded.

---

## 3. Framework (Future) vs Current Agent

- **Agent framework plan** (AGENT_FRAMEWORK_EXECUTION_PLAN.md): Macro router (READ_FILES | EDIT_FILES | EDIT_NOTES) → micro-skills (from registry) → atomic tools. Backend API and SkillExecutor are described but not implemented in the webapp.
- **Current state**: The webapp uses **only** the flat agent in `src/agent/`: Gemini + definitions + runners. The 19 skills in `src/framework/skills/` are **metadata + SKILL.md + scripts** for future use (e.g. when router and SkillExecutor are wired). So:
  - **Agent** = Gemini + tools in `agent/tools/` (notes, PDF, search_workspace, etc.).
  - **Framework** = registry + 19 micro-skills (read/edit files/notes) as extension points for a future macro-micro-atomic pipeline.

---

## 4. Progress Summary

| Area | Status |
|------|--------|
| Notes + PDF tools | ✅ Working (create_note, page_to_note, verbal_to_structured, update_section, etc.) |
| Workspace search | ✅ search_workspace (keyword + semantic when embedForSearch set); full result in realtime log |
| Agent memory / persistence | ✅ Notes, timeline, chat (with agentRun) in localStorage; history cap 20; “act on latest” in prompt |
| LaTeX notes | ✅ Note content LaTeX-only; NoteContentWithLatex + tool descriptions enforce LaTeX |
| PDF text for agent | ✅ Streamed in FileViewer; stable callbacks; on-demand fetch for arbitrary page |
| PDF “current page” | ⚠️ From context (viewingPdfPageNumber); native iframe does not expose scroll → often page 1 |
| Realtime log | ✅ Layer/Skill/Tool + full search_workspace result in live run panel |
| Framework (router, executor) | ❌ Not wired; skills and registry are ready for future integration |

---

## 5. Key Files to Touch for…

- **Change agent behavior / tools**: `agent/geminiWithTools.ts` (context, system prompt, loop, logs), `agent/tools/definitions.ts`, `agent/tools/index.ts`, and the specific `*Tools.ts` / `searchTools.ts`.
- **Change context**: `buildContextMessage` in `geminiWithTools.ts` and `AgentContext` in `agent/types.ts`; construction in `App.tsx`.
- **Persistence**: `storage/persistence.ts`; load/save in `App.tsx` and ChatPanel’s use of `messages`/`onMessagesChange`.
- **UI for chat/agent**: `components/ChatPanel.tsx` (send, live run, renderAgentRunBlock).
- **PDF text loading**: `components/FileViewer.tsx` (stream), `App.tsx` (onPdfTextLoaded / onPdfChaptersLoaded, activeFileIdRef), `agent/tools/pdfOnDemand.ts`.
- **Framework skills (future)**: `framework/skills/registry.json`, `framework/models/Skill.ts`, and each skill’s `SKILL.md` and `refs/` / `scripts/`.

This document reflects the codebase and agent logic as of the last read-through; use it as the single reference for structure and flow.
