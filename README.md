# Learning IDE — AI-Powered Learning Workspace

> A Cursor-inspired, AI-augmented learning web application designed for primary and secondary school students. Features an IDE-style layout with integrated note-taking, file management, PDF reading, and a Gemini-powered AI agent that can autonomously manipulate notes, generate quizzes, produce diagrams, and more.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [System Architecture Diagram](#system-architecture-diagram)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [AI Agent Framework](#ai-agent-framework)
  - [Agent Execution Flow](#agent-execution-flow)
  - [Tool System](#tool-system)
  - [Skill Framework](#skill-framework)
- [Data Storage Architecture](#data-storage-architecture)
  - [Storage Layer Diagram](#storage-layer-diagram)
  - [Local Storage (localStorage)](#local-storage-localstorage)
  - [File Storage (IndexedDB)](#file-storage-indexeddb)
  - [Cloud Storage (Google Drive)](#cloud-storage-google-drive)
  - [Sync Strategy](#sync-strategy)
- [Authentication Flow](#authentication-flow)
- [Component Architecture](#component-architecture)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Build & Deployment](#build--deployment)

---

## Architecture Overview

Learning IDE is a full-stack application with a clear separation between:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + TypeScript + Vite | IDE-style SPA with canvas, chat, sidebar |
| **Backend** | Express + TypeScript | OAuth proxy, Google Drive API bridge |
| **AI Engine** | Gemini 3 Flash / Pro (client-side) | Agentic tool-calling loop with streaming |
| **Storage** | localStorage + IndexedDB + Google Drive appData | Three-tier persistence with sync |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                             │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Header   │  │   Sidebar    │  │ Canvas/File  │  │ Chat Panel │  │
│  │ (toolbar, │  │ (notes,files,│  │   Viewer     │  │  (AI Agent │  │
│  │  timer,   │  │  timeline,   │  │ (note editor,│  │  Ask/Agent │  │
│  │  undo/    │  │  outline)    │  │  PDF viewer, │  │  mode,     │  │
│  │  redo)    │  │              │  │  image/video,│  │  streaming)│  │
│  └──────────┘  └──────────────┘  │  overlays)   │  └─────┬──────┘  │
│                                  └──────────────┘        │         │
│  ┌───────────────────────────────────────────────────────┘         │
│  │  Agent Framework (geminiWithTools.ts)                           │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐      │
│  │  │ Tool Defs   │  │ Tool Runner  │  │  Gemini API Call  │      │
│  │  │ (22 tools)  │→ │ (noteTools,  │→ │  (streaming SSE,  │      │
│  │  │             │  │  pdfTools,   │  │   function call   │      │
│  │  │             │  │  searchTools)│  │   loop, max 15    │      │
│  │  └─────────────┘  └──────────────┘  │   turns)          │      │
│  │                                     └───────────────────┘      │
│  └─────────────────────────────────────────────────────────────┐  │
│                                                                │  │
│  ┌─────────────────── Storage Layer ───────────────────────┐   │  │
│  │                                                         │   │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │   │  │
│  │  │ localStorage│  │  IndexedDB   │  │  API Client   │──│───│──┤
│  │  │ (notes,     │  │  (file blobs,│  │  (fetchWith   │  │   │  │
│  │  │  timeline,  │  │   up to      │  │   Auth, JWT)  │  │   │  │
│  │  │  chat,      │  │   500MB per  │  │              │  │   │  │
│  │  │  overlays,  │  │   file)      │  └───────┬───────┘  │   │  │
│  │  │  API keys)  │  └──────────────┘          │          │   │  │
│  │  └─────────────┘                            │          │   │  │
│  └─────────────────────────────────────────────│──────────┘   │  │
│                                                │              │  │
│  ┌──── Gemini API (Direct) ─────┐              │              │  │
│  │ generativelanguage.googleapis│              │              │  │
│  │ .com/v1beta/models/          │              │              │  │
│  │ • generateContent            │              │              │  │
│  │ • streamGenerateContent      │              │              │  │
│  │ • embedContent               │              │              │  │
│  └──────────────────────────────┘              │              │  │
└────────────────────────────────────────────────│──────────────┘  │
                                                 │                 │
                                                 ▼                 │
┌─────────────────────────────────────────────────────────────────┐ │
│                    EXPRESS SERVER (Backend)                      │ │
│                                                                 │ │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │ │
│  │  Auth Routes │  │Storage Routes│  │    Files Routes       │  │ │
│  │  /api/auth/* │  │/api/storage/*│  │    /api/files/*       │  │ │
│  │  (login,     │  │(CRUD notes,  │  │    (upload, download, │  │ │
│  │   callback,  │  │ timeline,    │  │     rename, delete)   │  │ │
│  │   user,      │  │ chat,        │  │    ┌───────────────┐  │  │ │
│  │   logout,    │  │ overlays,    │  │    │ Multer 500MB  │  │  │ │
│  │   refresh)   │  │ verify)      │  │    └───────────────┘  │  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘  │ │
│         │                 │                      │              │ │
│  ┌──────▼─────────────────▼──────────────────────▼──────────┐   │ │
│  │              Google Drive Service                         │   │ │
│  │  • appDataFolder (non-sensitive scope)                    │   │ │
│  │  • storage.json (all structured data)                     │   │ │
│  │  • Individual file blobs (PDF, images, etc.)              │   │ │
│  │  • Retry with exponential backoff (503, 429)              │   │ │
│  └──────────────────────────┬────────────────────────────────┘   │ │
│                             │                                    │ │
│  ┌──────────────────────────▼────────────────────────────────┐   │ │
│  │              Google OAuth 2.0 Service                      │   │ │
│  │  Scopes: userinfo.email, userinfo.profile, drive.appdata   │   │ │
│  │  JWT: 7-day tokens with auto-refresh                       │   │ │
│  └────────────────────────────────────────────────────────────┘   │ │
└──────────────────────────────────────────────────────────────────┘ │
                              │                                      │
                              ▼                                      │
               ┌──────────────────────────┐                          │
               │    Google Cloud APIs      │◄─────────────────────────┘
               │  • OAuth 2.0             │
               │  • Drive API v3          │
               │  • Gemini API            │
               └──────────────────────────┘
```

---

## Tech Stack

### Frontend (`/webapp`)

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7.2 | Build tool & dev server |
| KaTeX | 0.16 | LaTeX math rendering |
| pdf.js / react-pdf | 5.4 / 10.3 | PDF rendering & text extraction |
| PlantUML Encoder | 1.4 | Diagram encoding for PlantUML server |
| html2canvas | 1.4 | Canvas area screenshot capture |

### Backend (`/server`)

| Technology | Version | Purpose |
|-----------|---------|---------|
| Express | 4.21 | HTTP server |
| googleapis | 140.0 | Google Drive & OAuth |
| jsonwebtoken | 9.0 | JWT authentication |
| multer | 1.4 | File upload handling (up to 500MB) |
| express-session | 1.18 | Session management |
| tsx | 4.19 | TypeScript execution for dev |

### AI / LLM

| Service | Model | Purpose |
|---------|-------|---------|
| Gemini 3 Flash | `gemini-3-flash` | Fast agent responses (default) |
| Gemini 3 Pro | `gemini-3-pro` | Higher quality reasoning |
| Gemini Embedding | `gemini-embedding-001` | Semantic search vectors |

---

## Project Structure

```
learning_IDE/
├── README.md                          # This file
├── DEPLOYMENT_GUIDE.md                # Production deployment guide
├── ENV_SWITCH.md                      # Environment switching guide
├── STORAGE_AUDIT.md                   # Storage verification docs
│
├── server/                            # ─── Express Backend ───
│   ├── package.json                   # Dependencies: express, googleapis, jwt, multer
│   ├── tsconfig.json
│   ├── .env.local.example             # Local dev environment template
│   ├── .env.production.example        # Production environment template
│   ├── scripts/
│   │   ├── test-api.mjs               # API testing script
│   │   └── use-env.js                 # Environment switcher
│   └── src/
│       ├── index.ts                   # Express app entry: CORS, sessions, routes
│       ├── types.ts                   # Shared types: Note, Section, StorageData
│       ├── middleware/
│       │   └── auth.ts                # JWT verification, token refresh middleware
│       ├── routes/
│       │   ├── auth.ts                # /api/auth/*  — OAuth login/callback/refresh
│       │   ├── storage.ts             # /api/storage/* — CRUD notes/timeline/chat/overlays
│       │   ├── files.ts               # /api/files/*  — Upload/download/rename/delete files
│       │   └── drive.ts               # /api/drive/*  — Drive health check
│       └── services/
│           ├── googleAuth.ts          # OAuth2 client, scopes, token exchange
│           └── googleDrive.ts         # GoogleDriveService class: CRUD appDataFolder
│
├── webapp/                            # ─── React Frontend ───
│   ├── package.json                   # Dependencies: react 19, katex, pdfjs, plantuml
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html                     # HTML shell
│   ├── public/
│   │   └── pdf-viewer.html            # Standalone PDF viewer for iframe embed
│   └── src/
│       ├── main.tsx                   # React entry: AuthProvider → App
│       ├── App.tsx                    # Root component: state management, layout
│       ├── types.ts                   # Core types: Note, Section, DroppedFile, Timeline
│       ├── index.css                  # Full CSS: Cursor-style dark theme (no UI library)
│       │
│       ├── contexts/
│       │   └── AuthContext.tsx         # Google OAuth state: user, login, logout
│       │
│       ├── api/
│       │   └── client.ts              # fetchWithAuth, authApi, storageApi, filesApi
│       │
│       ├── storage/                   # ─── Three-Tier Storage ───
│       │   ├── persistence.ts         # Layer 1: localStorage (notes, timeline, chat)
│       │   ├── fileStorage.ts         # Layer 2: IndexedDB (file blobs)
│       │   ├── cloudStorage.ts        # Layer 3: Google Drive via API (sync + debounce)
│       │   └── apiKeyStore.ts         # Encrypted API key store (AES-GCM + PBKDF2)
│       │
│       ├── agent/                     # ─── AI Agent Framework ───
│       │   ├── geminiWithTools.ts     # Agent loop: system prompt, SSE streaming, tool dispatch
│       │   ├── types.ts               # AgentContext, ToolResult, ToolResultAction
│       │   ├── chatLog.ts             # Dev terminal logging for chat interactions
│       │   └── tools/
│       │       ├── definitions.ts     # 22 Gemini function declarations (tool schemas)
│       │       ├── index.ts           # Tool registry: name → runner mapping
│       │       ├── noteTools.ts       # Note CRUD tools: create, update, merge, reorder, etc.
│       │       ├── pdfTools.ts        # PDF tools: summarize page, page-to-note, Q&A, defs
│       │       ├── searchTools.ts     # Workspace search: keyword + semantic (embeddings)
│       │       ├── embedding.ts       # Gemini embedding API for semantic search
│       │       ├── runGemini.ts       # Single-prompt Gemini call (used inside tools)
│       │       └── pdfOnDemand.ts     # On-demand PDF page text/image extraction
│       │
│       ├── components/                # ─── UI Components ───
│       │   ├── Header.tsx             # Top bar: undo/redo, timer, fullscreen, API keys
│       │   ├── Sidebar.tsx            # Left panel: notes list, files tree, timeline, outline
│       │   ├── Canvas.tsx             # Note editor: sections, LaTeX, PlantUML rendering
│       │   ├── CanvasAreaWithSelection.tsx  # Selection box + overlay memos on canvas
│       │   ├── CanvasAreaContext.tsx   # Canvas context for area selection
│       │   ├── CanvasToolbar.tsx       # Toolbar for canvas actions
│       │   ├── FileViewer.tsx         # File preview: PDF, images, video, download
│       │   ├── PdfViewerCanvas.tsx    # PDF rendering with page navigation
│       │   ├── ChatPanel.tsx          # AI chat: message list, input, model selector
│       │   ├── NoteContentWithLatex.tsx # LaTeX + PlantUML renderer for note sections
│       │   ├── CodeRenderWindow.tsx   # Iframe-based HTML/React code preview
│       │   ├── CommandPalette.tsx     # Ctrl+P command palette
│       │   ├── GrindingTimer.tsx      # 25min/5min Pomodoro timer
│       │   ├── StatusBar.tsx          # Bottom bar: project name, progress %
│       │   ├── LoginButton.tsx        # Google OAuth login button
│       │   ├── ApiKeyButton.tsx       # API key management modal
│       │   ├── ConfirmDialog.tsx      # Confirmation modal for destructive actions
│       │   └── StorageUsageIndicator.tsx # Cloud storage quota display
│       │
│       ├── framework/                 # ─── Skill Framework (Claude-style) ───
│       │   ├── models/
│       │   │   ├── index.ts
│       │   │   ├── File.ts            # File model
│       │   │   ├── Overlay.ts         # Overlay model
│       │   │   ├── Selection.ts       # Selection model
│       │   │   └── Skill.ts           # SkillMetadata, SkillRegistry, matchSkillsByTriggers
│       │   └── skills/
│       │       ├── registry.json      # 19 registered skills with metadata
│       │       ├── SkillLoader.ts     # Progressive skill loading (Level 1/2)
│       │       ├── STRUCTURE_GENERATOR.md
│       │       ├── READ_FILES/        # 7 read-only skills
│       │       │   ├── detect-filetype-and-indexing/
│       │       │   ├── semantic-search-in-files/
│       │       │   ├── region-ocr/
│       │       │   ├── table-extraction/
│       │       │   ├── audio-transcribe-and-index/
│       │       │   ├── video-summarize-and-chaptering/
│       │       │   └── codebase-reading-and-map/
│       │       ├── EDIT_FILES/        # 7 file-editing skills
│       │       │   ├── file-versioning-and-diff/
│       │       │   ├── pdf-annotate-and-fill/
│       │       │   ├── docx-restructure-and-rewrite/
│       │       │   ├── xlsx-clean-calc-and-visualize/
│       │       │   ├── pptx-generate-and-edit/
│       │       │   ├── image-annotate-and-callouts/
│       │       │   └── code-transform-and-diagram/
│       │       └── EDIT_NOTES/        # 5 note-editing skills
│       │           ├── latex-render-and-verify/
│       │           ├── note-linking-relative-paths/
│       │           ├── canvas-overlay-authoring/
│       │           ├── spaced-repetition-generator/
│       │           └── exam-style-revision-pack/
│       │
│       └── utils/
│           ├── audioTranscription.ts  # Audio transcription utility
│           └── geminiInline.ts        # Inline Gemini call utility
│
└── markdown/                          # ─── Design & Planning Docs ───
    ├── AGENT_FRAMEWORK_EXECUTION_PLAN.md
    ├── AGENT_MEMORY_AND_PERSISTENCE_PLAN.md
    ├── AGENT_SKILLS_CLAUDE_ALIGNMENT.md
    ├── BRAINSTORM_AGENT_TOOLS_AND_CANVAS.md
    ├── BRAINSTORM_SUMMARY.md
    ├── CODEBASE_AND_AGENT_OVERVIEW.md
    └── ...
```

---

## AI Agent Framework

The AI agent is the core intelligence of Learning IDE. It runs entirely client-side, calling the Gemini API directly from the browser with the user's API key. The agent uses **Gemini's native function calling** to autonomously decide which tools to invoke.

### Agent Execution Flow

```
User Message
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│              geminiWithTools.ts                          │
│                                                         │
│  1. Build Context Message                               │
│     • Current note (all sections with full content)     │
│     • Current file (PDF page, chapters, page text)      │
│     • All notes & files in workspace (IDs + names)      │
│     • Recent timeline (last 6 actions)                  │
│     • PDF chapters from TOC (page ranges)               │
│     • Render errors from previous turn (for auto-fix)   │
│                                                         │
│  2. Prepare Conversation History                        │
│     • Last 20 messages (capped to avoid token bloat)    │
│     • System prompt (AGENT_SYSTEM) with rules           │
│     • User message + attached image (if any)            │
│                                                         │
│  3. Call Gemini API (streaming or non-streaming)         │
│     ┌─────────────────────────────────────────┐         │
│     │  POST /v1beta/models/{model}:           │         │
│     │       streamGenerateContent?alt=sse      │         │
│     │                                         │         │
│     │  Body:                                  │         │
│     │  • systemInstruction                    │         │
│     │  • contents (conversation + context)    │         │
│     │  • tools (22 function declarations)     │         │
│     │  • toolConfig: mode=ANY                 │         │
│     │  • generationConfig:                    │         │
│     │    - temperature: 1.0 (Gemini 3)        │         │
│     │    - thinkingConfig: { level: "low" }   │         │
│     │    - maxOutputTokens: 65536             │         │
│     └─────────────────────────────────────────┘         │
│                                                         │
│  4. Parse Response                                      │
│     ├── Text part → Return as final reply               │
│     ├── Thought part → Stream to UI (thinking display)  │
│     └── functionCall part → Execute tool (step 5)       │
│                                                         │
│  5. Tool Execution Loop (max 15 turns)                  │
│     ┌──────────────────────────────────────┐            │
│     │  executeTool(name, args, context)     │            │
│     │     │                                │            │
│     │     ├── noteTools.*  (13 tools)      │            │
│     │     ├── pdfTools.*   (4 tools)       │            │
│     │     ├── searchTools.* (1 tool)       │            │
│     │     └── reply         (1 tool)       │            │
│     │                                      │            │
│     │  Returns: { success, text, action? }  │            │
│     └──────────────────────────────────────┘            │
│     │                                                   │
│     ├── If action → dispatch to App (add/update/delete) │
│     ├── If reply tool → return text to user             │
│     └── Else → append functionResponse, loop to step 3  │
│                                                         │
│  Safety Caps:                                           │
│  • Max 25 sections per run                              │
│  • Max 3 notes per run                                  │
│  • Max 15 API round-trips                               │
└─────────────────────────────────────────────────────────┘
```

### Tool System

The agent has access to **22 tools** organized into four categories:

#### Note Tools (13 tools) — `noteTools.ts`

| Tool | Description |
|------|-------------|
| `create_note` | Create a new note, returns `note_id` for follow-up tools |
| `verbal_to_structured` | Convert verbal/messy text into structured LaTeX note section |
| `summarize_section` | Summarize a note section in 2-4 sentences |
| `expand_section` | Expand a section with examples and explanations |
| `extract_key_terms` | Extract keywords and definitions from content |
| `generate_quiz` | Generate MCQ/short answer questions from content |
| `suggest_structure` | Suggest better chapter structure for notes |
| `merge_sections` | Merge multiple sections into one |
| `reorder_sections` | Reorder sections within a note |
| `search_sections` | Keyword search within note sections |
| `update_section` | Edit title and/or content of a specific section |
| `rename_note` / `delete_note` | Rename or delete entire note |
| `delete_section` | Delete one or more sections from a note |
| `create_code_window` | Create HTML/React code preview attached to a section |
| `generate_plantuml_diagram` | Generate PlantUML diagram as a new section |

#### PDF Tools (4 tools) — `pdfTools.ts`

| Tool | Description |
|------|-------------|
| `summarize_page` | Summarize a PDF page (text + optional image) |
| `page_to_note` | Convert PDF page to structured note section (with LaTeX) |
| `generate_qa_from_page` | Generate Q&A questions from a PDF page |
| `extract_definitions` | Extract definitions and formulas from text |

#### Search Tools (1 tool) — `searchTools.ts`

| Tool | Description |
|------|-------------|
| `search_workspace` | Full-text or semantic search across all notes, files, PDF pages. Supports keyword mode (exact match) and semantic mode (embedding-based cosine similarity). Scoping by `note_ids` or `file_ids`. |

#### System Tools (1 tool)

| Tool | Description |
|------|-------------|
| `reply` | Send a text reply when no action tool is needed |

### How Tools Interact with the App

```
Tool returns ToolResult
    │
    ├── success: boolean
    ├── text: string (shown in chat)
    └── action?: ToolResultAction
            │
            ▼
     App.handleToolAction()
            │
            ├── add_section      → addSectionWithContent() → setNotes()
            ├── update_section   → updateSection()         → setNotes()
            ├── merge_sections   → addSectionWithContent() → setNotes()
            ├── reorder_sections → reorderSections()       → setNotes()
            ├── rename_note      → renameNote()            → setNotes()
            ├── delete_note      → deleteNote()            → setNotes()
            ├── delete_section   → deleteSection()         → setNotes()
            └── upsert_code_window → updateSection()       → setNotes()
                                          │
                                          ▼
                               useEffect → saveNotes()
                                    │         │
                                    ▼         ▼
                              localStorage  Cloud (debounced)
```

### Skill Framework

Beyond the runtime tools, Learning IDE includes a **Claude-style progressive skill framework** with 19 registered skills across 3 macro categories:

```
┌─────────────────────────────────────────────────────┐
│                  Skill Registry                      │
│                (registry.json)                       │
│                                                     │
│  ┌─── READ_FILES (7 skills) ──────────────────┐    │
│  │  • detect-filetype-and-indexing             │    │
│  │  • semantic-search-in-files                 │    │
│  │  • region-ocr                               │    │
│  │  • table-extraction                         │    │
│  │  • audio-transcribe-and-index               │    │
│  │  • video-summarize-and-chaptering           │    │
│  │  • codebase-reading-and-map                 │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─── EDIT_FILES (7 skills) ──────────────────┐    │
│  │  • file-versioning-and-diff                 │    │
│  │  • pdf-annotate-and-fill                    │    │
│  │  • docx-restructure-and-rewrite             │    │
│  │  • xlsx-clean-calc-and-visualize            │    │
│  │  • pptx-generate-and-edit                   │    │
│  │  • image-annotate-and-callouts              │    │
│  │  • code-transform-and-diagram               │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─── EDIT_NOTES (5 skills) ──────────────────┐    │
│  │  • latex-render-and-verify                  │    │
│  │  • note-linking-relative-paths              │    │
│  │  • canvas-overlay-authoring                 │    │
│  │  • spaced-repetition-generator              │    │
│  │  • exam-style-revision-pack                 │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Progressive Disclosure (SkillLoader.ts):**
- **Level 1:** Registry metadata only (~100 tokens per skill) — loaded at boot
- **Level 2:** Full `SKILL.md` content — loaded on demand when a skill is triggered

Each skill has:
- `triggers[]` — keywords that activate the skill
- `inputContract` — required selection, accepted file types
- `outputContract` — required output fields, format
- `estimatedTokens` — cost estimation
- `priority` — ranking when multiple skills match

---

## Data Storage Architecture

### Storage Layer Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      App State (React)                        │
│  notes[], files[], timeline[], chatThreads[], overlays{}      │
└──────┬───────────────┬──────────────────┬────────────────────┘
       │               │                  │
       ▼               ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌───────────────────────────┐
│  Layer 1:    │ │  Layer 2:    │ │  Layer 3:                 │
│  localStorage│ │  IndexedDB   │ │  Google Drive (appData)   │
│              │ │              │ │                           │
│  • notes     │ │  • file blobs│ │  • storage.json           │
│  • timeline  │ │  (PDF, img,  │ │    (notes, timeline,      │
│  • chat      │ │   video,     │ │     chat, overlays,       │
│    threads   │ │   up to      │ │     fileMetadata)         │
│  • canvas    │ │   500MB each)│ │  • Individual files       │
│    overlays  │ │              │ │    (PDF, images, etc.)    │
│  • API keys  │ │  DB: Learning│ │                           │
│    (AES-GCM  │ │  IDEFiles    │ │  Scope: drive.appdata     │
│    encrypted)│ │  Store: files│ │  (non-sensitive, no       │
│              │ │              │ │   verification needed)    │
│  Sync: immed │ │  Sync: immed │ │  Sync: debounced 500ms   │
└──────────────┘ └──────────────┘ └───────────────────────────┘
```

### Local Storage (localStorage)

**File:** `storage/persistence.ts`

| Key | Content | Cap |
|-----|---------|-----|
| `learning_ide_notes` | `Note[]` — all notes with sections | — |
| `learning_ide_timeline` | `TimelineAction[]` — user activity log | 200 entries |
| `learning_ide_chat` | `StoredChatThread[]` — multi-thread chat history | 300 messages/thread |
| `learning_ide_canvas_overlays` | `Record<string, CanvasOverlayMemo[]>` — memo overlays keyed by note/file/page | — |
| `learning_ide_apikey_*` | AES-GCM encrypted API keys (Google, OpenAI, Anthropic) | — |
| `learning_ide_apikey_salt` | Random 16-byte salt for key derivation | — |

**API Key Encryption** (`apiKeyStore.ts`):
- PBKDF2 (100,000 iterations, SHA-256) to derive AES-256-GCM key
- Per-device random salt — ciphertext is useless on a different browser profile
- Keys only exist decrypted in memory while actively used

### File Storage (IndexedDB)

**File:** `storage/fileStorage.ts`

- Database: `LearningIDEFiles`, Object Store: `files`
- Each entry: `{ id, name, type, size, addedAt, blob }`
- Stores raw `Blob` objects — survives browser refresh
- Max file size: 500MB (enforced by Multer on server side)

### Cloud Storage (Google Drive)

**File:** `storage/cloudStorage.ts` + `server/src/services/googleDrive.ts`

All structured data is stored in a single `storage.json` file in Google Drive's `appDataFolder`:

```json
{
  "notes": [{ "id": "n1", "name": "...", "sections": [...], "createdAt": 1234 }],
  "timeline": [{ "id": "t1", "type": "created_note", "label": "...", "at": 1234 }],
  "chatThreads": [{ "id": "chat-1", "title": "Chat 1", "messages": [...] }],
  "canvasOverlays": { "note:n1": [{ "id": "memo-1", "x": 0, "y": 0, ... }] },
  "fileMetadata": [{ "id": "f1", "name": "lecture.pdf", "driveFileId": "abc123", ... }]
}
```

File blobs (PDFs, images, etc.) are stored as individual files in `appDataFolder`.

### Sync Strategy

```
┌───────────────────────────────────────────────────────────────┐
│                    Sync Decision Tree                          │
│                                                               │
│  On Authentication:                                           │
│  ├── Cloud empty + Local has data → Push local to cloud       │
│  ├── Cloud has data + Local empty → Hydrate local from cloud  │
│  └── Both have data → Local is source of truth (no merge)     │
│                                                               │
│  On Save (notes, timeline, chat, overlays):                   │
│  1. Always save to localStorage immediately                   │
│  2. If authenticated: debounced save to cloud (500ms)         │
│                                                               │
│  On File Upload:                                              │
│  1. Upload to Google Drive via API                            │
│  2. Cache blob to IndexedDB                                   │
│  3. Verify file exists on cloud after upload                  │
│                                                               │
│  On File Sync (syncLocalWithCloud):                           │
│  ├── Local file missing on cloud → Upload to cloud            │
│  ├── Cloud file missing locally  → Download and cache         │
│  └── Both exist → Match by ID, update driveFileId             │
└───────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

```
User clicks "Login"
    │
    ▼
Frontend: authApi.getLoginUrl()
    │ GET /api/auth/login
    ▼
Server: generateAuthUrl() with scopes:
    • userinfo.email
    • userinfo.profile
    • drive.appdata
    │
    ▼
Google OAuth Consent Screen
    │ User approves
    ▼
Google redirects to: /api/auth/callback?code=...
    │
    ▼
Server:
    1. Exchange code for tokens (access + refresh)
    2. getUserInfo(access_token) → { id, email, name, picture }
    3. generateToken(user, access, refresh) → JWT (7-day expiry)
    4. Redirect to frontend: /?token=JWT_TOKEN
    │
    ▼
Frontend (AuthContext):
    1. Extract token from URL params
    2. Store in localStorage (flash_dev_token)
    3. Clean URL (remove ?token=...)
    4. Verify: GET /api/auth/user with Bearer token
    5. Set user state → isAuthenticated = true
    │
    ▼
App: Load data from cloud, sync files
```

**Token Refresh:** When the access token expires, the auth middleware automatically refreshes it using the stored refresh token and returns the new JWT via `X-New-Token` response header.

---

## Component Architecture

```
main.tsx
  └── AuthProvider (context: user, login, logout)
       └── App (root state manager)
            │
            ├── Header
            │   ├── Undo/Redo buttons
            │   ├── GrindingTimer toggle
            │   ├── Fullscreen lock toggle
            │   ├── CommandPalette trigger (Ctrl+P)
            │   ├── ApiKeyButton (encrypted key management)
            │   ├── StorageUsageIndicator
            │   └── LoginButton (Google OAuth)
            │
            ├── Sidebar
            │   ├── Notes list (create, select, rename, delete)
            │   ├── Files tree (drag-drop upload, select, rename, delete)
            │   ├── Timeline (activity log)
            │   └── Outline (section headers for current note)
            │
            ├── Canvas Area (center)
            │   ├── CanvasAreaWithSelection (drag-select, overlays)
            │   │   ├── Canvas (when viewing note)
            │   │   │   ├── Section editors (title + content)
            │   │   │   ├── NoteContentWithLatex (KaTeX + PlantUML)
            │   │   │   ├── CodeRenderWindow (iframe HTML/React)
            │   │   │   └── Audio recordings per section
            │   │   │
            │   │   └── FileViewer (when viewing file)
            │   │       ├── PdfViewerCanvas (react-pdf pages)
            │   │       ├── Image viewer
            │   │       ├── Video player
            │   │       └── Download link (other types)
            │   │
            │   └── CanvasToolbar (add section, capture area)
            │
            ├── ChatPanel (right)
            │   ├── Chat tabs (multi-thread: create, switch, delete)
            │   ├── Message list (user + agent messages)
            │   │   ├── Agent run details (thinking, tool calls, logs)
            │   │   └── Streaming text display (typewriter effect)
            │   ├── Model selector (Gemini 3 Flash / Pro)
            │   ├── Mode selector (Ask / Agent)
            │   └── Input area (text + image attachment)
            │
            ├── StatusBar (bottom)
            │   ├── Project name
            │   └── Progress % (completed sections)
            │
            ├── CommandPalette (Ctrl+P overlay)
            ├── GrindingTimer (Pomodoro 25/5 overlay)
            └── ConfirmDialog (delete confirmations)
```

---

## API Reference

### Auth Routes (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/login` | No | Returns Google OAuth URL |
| GET | `/callback` | No | OAuth callback — exchanges code for JWT, redirects to frontend |
| GET | `/user` | Yes | Returns current user info |
| POST | `/logout` | No | Destroys session, clears cookie |
| POST | `/refresh` | No | Refreshes access token using refresh token |

### Storage Routes (`/api/storage`) — All require auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Load all storage data from Drive |
| PUT | `/` | Save all storage data to Drive |
| GET | `/notes` | Load notes only |
| PUT | `/notes` | Save notes only |
| GET | `/timeline` | Load timeline only |
| PUT | `/timeline` | Save timeline (capped at 200) |
| GET | `/chat` | Load chat threads |
| PUT | `/chat` | Save chat threads (capped: 100 threads, 100 messages each) |
| GET | `/overlays` | Load canvas overlays |
| PUT | `/overlays` | Save canvas overlays |
| GET | `/summary` | Lightweight storage summary (counts + quota) |
| POST | `/verify` | Compare client state with cloud, return match status |

### File Routes (`/api/files`) — All require auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all files in user's app folder |
| POST | `/` | Upload file (multipart, max 500MB) |
| GET | `/:id` | Download file by app ID or Drive ID |
| GET | `/:id/url` | Get shareable URL for file |
| PUT | `/:id` | Rename file |
| DELETE | `/:id` | Delete file from Drive + metadata |

### Drive Routes (`/api/drive`) — Require auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ensure-appdata` | Verify appDataFolder is accessible |

---

## Environment Variables

### Frontend (`webapp/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | Optional | Default Gemini API key (users can also set via UI) |
| `VITE_API_URL` | Optional | Backend API base URL (default: `http://localhost:3001/api`) |

### Backend (`server/.env` or `.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth 2.0 Client Secret |
| `FRONTEND_URL` | Yes | Frontend URL (e.g. `http://localhost:5173`) |
| `BACKEND_PUBLIC_URL` | Optional | Public backend URL (for OAuth redirect) |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `SESSION_SECRET` | Yes | Secret for express-session |
| `PORT` | Optional | Server port (default: 3001) |
| `NODE_ENV` | Optional | `development` or `production` |

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Google Cloud Console** project with:
  - OAuth 2.0 Client ID (Web application type)
  - Authorized redirect URI: `http://localhost:3001/api/auth/callback`
- **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Clone and Install

```bash
git clone <repo-url>
cd learning_IDE

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../webapp
npm install
```

### 2. Configure Environment

```bash
# Backend
cd server
cp .env.local.example .env.local
# Edit .env.local with your Google OAuth credentials and secrets

# Frontend
cd ../webapp
cp .env.local.example .env
# Edit .env with your Gemini API key
```

### 3. Run Development

```bash
# Terminal 1: Start backend
cd server
npm run dev          # Runs on http://localhost:3001

# Terminal 2: Start frontend
cd webapp
npm install
npm run dev          # Runs on http://localhost:5173
```

### 4. Open Browser

Navigate to `http://localhost:5173`. The app works offline (localStorage + IndexedDB). Login with Google to enable cloud sync via Google Drive.

---

## Build & Deployment

### Frontend Build

```bash
cd webapp
npm run build        # TypeScript check + Vite production build
npm run preview      # Preview production build locally
```

### Backend Build

```bash
cd server
npm run build        # Compile TypeScript to dist/
npm start            # Run production server
```

### Production Environment

See `DEPLOYMENT_GUIDE.md` for full deployment instructions. Key points:

- Set `NODE_ENV=production` on the server
- Configure production OAuth redirect URIs in Google Cloud Console
- Set secure session/JWT secrets
- Use `BACKEND_PUBLIC_URL` for proper OAuth callback routing
- Frontend and backend can be deployed to separate domains (CORS is configured)

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Client-side AI** | Gemini API called directly from browser — no server proxy needed for AI, lower latency, user controls their own API key |
| **Three-tier storage** | localStorage (instant), IndexedDB (large files), Google Drive (cloud sync) — works offline, syncs when authenticated |
| **appDataFolder scope** | Google Drive `drive.appdata` scope is non-sensitive — no OAuth verification required, user data is isolated |
| **Local-first sync** | localStorage is source of truth; cloud hydrates only when local is empty — prevents data loss on network issues |
| **LaTeX-only notes** | All note content uses LaTeX formatting (no markdown) — consistent rendering, proper math support for students |
| **Streaming SSE** | Real-time typewriter effect for AI responses — better UX than waiting for full response |
| **22 function tools** | Comprehensive tool set lets the agent autonomously create, edit, search, and organize — minimal user intervention |
| **Safety caps** | Max 25 sections, 3 notes, 15 turns per agent run — prevents runaway loops |
| **Encrypted API keys** | AES-GCM with per-device PBKDF2 salt — keys are never stored in plaintext |

---

## License

This project is private and not open-source.
