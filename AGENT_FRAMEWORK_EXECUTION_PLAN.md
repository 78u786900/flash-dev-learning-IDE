# 🚀 Agent Framework Execution Plan (Blueprint)

> 呢份係將 Agent Skills Framework (v0.3) 整合入現有 Learning IDE 嘅執行藍圖  
> 目標：保持現有功能 + 加入 macro-micro-atomic 三層架構  
> 原則：簡單、可執行、逐步建構

---

## 📋 現有項目狀況評估

### ✅ 已有嘅功能
- 基本筆記系統（sections、編輯、完成狀態）
- 檔案預覽（PDF iframe、圖片、影片）
- AI Chat（Ask / Agent 模式）
- 簡單 Agent 工具系統（11 個工具：筆記 7 個 + PDF 4 個）
- 框選截圖送俾 AI
- Timeline、Timer、Command Palette

### 🔧 需要升級嘅部分
- 工具系統太簡單（扁平結構，冇分層）
- 冇 skill registry / metadata 機制
- 冇 file versioning
- 冇 overlay canvas 系統
- 冇 selection context 機制
- 冇 OCR、table extraction、audio/video 處理

---

## 🏗️ 架構設計（三層）

```
┌─────────────────────────────────────────────────┐
│  Layer A: Macro Router 🧭                       │
│  (READ_FILES | EDIT_FILES | EDIT_NOTES)        │
└─────────────┬───────────────────────────────────┘
              │ 路由到 Top-K micro skills
              ↓
┌─────────────────────────────────────────────────┐
│  Layer B: Micro Skills 🧰                       │
│  (skills/<macro>/<skill-name>/SKILL.md)        │
└─────────────┬───────────────────────────────────┘
              │ 調用多個 atomic tools
              ↓
┌─────────────────────────────────────────────────┐
│  Layer C: Atomic Tools ⚙️                       │
│  (file-io, ocr, extract, render, overlay...)   │
└─────────────────────────────────────────────────┘
```

---

## 📁 新增資料夾結構

```
webapp/
├── src/
│   ├── agent/                    # 現有 agent 資料夾
│   │   ├── types.ts              ✅ 保留，擴充
│   │   ├── geminiWithTools.ts    ✅ 保留，改造
│   │   └── tools/                🔧 改造成 atomic tools
│   │       ├── definitions.ts    ❌ 刪除（改用 skill registry）
│   │       ├── index.ts          🔧 重構
│   │       ├── noteTools.ts      🔧 拆細
│   │       ├── pdfTools.ts       🔧 拆細
│   │       └── runGemini.ts      ✅ 保留
│   │
│   ├── framework/                🆕 新增 agent framework
│   │   ├── router/               # Layer A: Macro Router
│   │   │   ├── MacroRouter.ts
│   │   │   └── MicroSelector.ts
│   │   │
│   │   ├── skills/               # Layer B: Micro Skills
│   │   │   ├── registry.json     # skill metadata
│   │   │   ├── READ_FILES/
│   │   │   │   ├── semantic-search/
│   │   │   │   │   └── SKILL.md
│   │   │   │   ├── region-ocr/
│   │   │   │   │   └── SKILL.md
│   │   │   │   └── table-extraction/
│   │   │   │       └── SKILL.md
│   │   │   ├── EDIT_FILES/
│   │   │   │   ├── file-versioning/
│   │   │   │   │   └── SKILL.md
│   │   │   │   └── pdf-annotate/
│   │   │   │       └── SKILL.md
│   │   │   └── EDIT_NOTES/
│   │   │       ├── latex-render/
│   │   │       │   └── SKILL.md
│   │   │       └── note-linking/
│   │   │           └── SKILL.md
│   │   │
│   │   ├── atomic/               # Layer C: Atomic Tools
│   │   │   ├── fileIO.ts
│   │   │   ├── ocr.ts
│   │   │   ├── extract.ts
│   │   │   ├── transform.ts
│   │   │   ├── render.ts
│   │   │   └── overlay.ts
│   │   │
│   │   ├── models/               # 資料模型
│   │   │   ├── File.ts
│   │   │   ├── Selection.ts
│   │   │   ├── Overlay.ts
│   │   │   └── Version.ts
│   │   │
│   │   └── executor/             # 執行引擎
│   │       ├── SkillExecutor.ts
│   │       └── Verifier.ts
│   │
│   └── components/               ✅ 現有組件
│       └── OverlayCanvas.tsx     🆕 新增 overlay 組件
│
└── public/
    └── skills/                   🆕 skill registry JSON
```

---

## 📊 資料模型設計

### 1️⃣ File Entity (擴充現有 DroppedFile)

```typescript
interface FileEntity {
  id: string                      // ✅ 已有
  name: string                    // ✅ 已有
  type: string                    // ✅ 已有
  url: string                     // ✅ 已有 (blob URL)
  size: number                    // ✅ 已有
  addedAt: number                 // ✅ 已有
  
  // 🆕 新增欄位
  mime: string
  version: number                 // 版本號
  versions: FileVersion[]         // 版本歷史
  index: {
    structure?: any               // 結構索引（章節、頁、slides）
    chunks?: Chunk[]              // 分塊索引
    embeddingsReady: boolean
  }
  metadata: {
    pages?: number                // PDF 頁數
    duration?: number             // 音視頻長度（秒）
    dimensions?: { w: number; h: number }  // 圖片尺寸
  }
}
```

### 2️⃣ Selection Context (全新)

```typescript
interface SelectionContext {
  activeFileId: string | null
  activeNoteId: string | null
  selection: {
    type: 'none' | 'text' | 'region' | 'time_range' | 'pages'
    text?: string                 // 選中文字
    bbox?: { x: number; y: number; w: number; h: number }
    timeRange?: { start: number; end: number }  // 音視頻
    pages?: number[]              // PDF 頁碼
  }
  capturedImage?: string          // ✅ 現有 attachedAreaImage
}
```

### 3️⃣ Overlay Entity (核心新功能)

```typescript
interface Overlay {
  id: string
  attachedTo: {
    fileId?: string
    noteId?: string
    anchor: 'page' | 'slide' | 'global' | 'note-section'
    anchorRef: string             // "page:3", "section:s1"
  }
  layer: number                   // z-index
  position: { x: number; y: number }
  size: { w: number; h: number }
  style: {
    background: 'transparent' | 'solid'
    border: 'none' | 'thin' | 'highlight'
    opacity: number
  }
  blocks: OverlayBlock[]
  createdAt: number
  updatedAt: number
}

interface OverlayBlock {
  id: string
  type: 'text' | 'markdown' | 'image' | 'code' | 'rendered'
  payload: {
    // text/markdown
    content?: string
    
    // image
    url?: string
    
    // code (Mermaid, SVG, etc)
    language?: 'mermaid' | 'svg' | 'plantuml'
    source?: string
    renderMode?: 'static' | 'animated'
    
    // rendered output
    format?: 'svg' | 'png' | 'html'
    artifactUrl?: string
  }
}
```

### 4️⃣ File Version (版本控制)

```typescript
interface FileVersion {
  versionId: string
  fileId: string
  timestamp: number
  diff?: string                   // 與上一版本的差異
  blobUrl: string                 // 該版本的 blob URL
  metadata: {
    changedBy: 'user' | 'agent'
    skillName?: string            // 哪個 skill 做的修改
    changeDescription: string
  }
}
```

### 5️⃣ Skill Registry Metadata

```typescript
interface SkillMetadata {
  name: string                    // "semantic-search-in-files"
  macro: 'READ_FILES' | 'EDIT_FILES' | 'EDIT_NOTES'
  description: string
  triggers: string[]              // ["find", "search", "where"]
  inputContract: {
    requiresSelection: boolean
    acceptedFileTypes?: string[]  // ["pdf", "docx"]
  }
  outputContract: {
    mustInclude: string[]         // ["file_id", "location", "quote"]
  }
  estimatedTokens: number         // 預估 token 消耗
}
```

---

## 🔌 API Endpoints 設計

### Backend API (需要新增)

#### 📂 File Management

```
POST   /api/files/upload
  Body: FormData(file)
  Return: FileEntity

GET    /api/files/:id
  Return: FileEntity

POST   /api/files/:id/version
  Body: { file: Blob, changeDescription: string }
  Return: FileVersion

GET    /api/files/:id/versions
  Return: FileVersion[]

POST   /api/files/:id/index
  Body: { force?: boolean }
  Return: { structure, chunks, embeddingsReady }
```

#### 🔍 Search & Extract (Atomic Tools)

```
POST   /api/tools/ocr
  Body: { imageDataUrl: string, bbox?: {...} }
  Return: { text: string, confidence: number }

POST   /api/tools/table-extract
  Body: { fileId: string, page?: number, bbox?: {...} }
  Return: { table: any[][], csv: string }

POST   /api/tools/semantic-search
  Body: { query: string, fileIds?: string[], selection?: {...} }
  Return: { results: SearchResult[] }

POST   /api/tools/audio-transcribe
  Body: { fileId: string, timeRange?: {...} }
  Return: { transcript: string, timestamps: any[] }
```

#### 🧠 Overlay Management

```
POST   /api/overlays
  Body: Overlay (without id)
  Return: Overlay (with id)

GET    /api/overlays?fileId=xxx&noteId=xxx
  Return: Overlay[]

PUT    /api/overlays/:id
  Body: Partial<Overlay>
  Return: Overlay

DELETE /api/overlays/:id
  Return: { success: boolean }

POST   /api/overlays/:id/blocks
  Body: OverlayBlock (without id)
  Return: OverlayBlock (with id)

POST   /api/overlays/render-code
  Body: { language: string, source: string }
  Return: { format: string, artifactUrl: string }
```

#### 🤖 Agent Framework

```
POST   /api/agent/route
  Body: { 
    userMessage: string,
    selectionContext: SelectionContext,
    history: Message[]
  }
  Return: { 
    macro: string,
    selectedSkills: SkillMetadata[],
    confidence: number
  }

POST   /api/agent/execute-skill
  Body: {
    skillName: string,
    params: Record<string, any>,
    context: {
      fileId?: string,
      noteId?: string,
      selection?: {...}
    }
  }
  Return: {
    success: boolean,
    output: any,
    overlays?: Overlay[],
    versions?: FileVersion[],
    citations?: Citation[]
  }

GET    /api/agent/skills
  Return: SkillMetadata[]

GET    /api/agent/skills/:name
  Return: { metadata: SkillMetadata, skillMd: string }
```

---

## 🎯 MVP 執行步驟（分 4 個 Phase）

### 🔷 Phase 1: 基礎架構 (1-2 days)

**目標：建立資料模型 + API 骨架**

#### Tasks:
1. ✅ 建立 `framework/models/` 裡面所有 TypeScript interfaces
2. ✅ 擴充現有 `types.ts` 加入新欄位
3. ✅ 建立 `framework/atomic/` 資料夾同基本 file IO functions
4. ✅ 建立後端 API routes（用 Express / Next.js API routes）
5. ✅ 設定 file upload + blob storage（localStorage / IndexedDB / cloud）

#### Deliverables:
- `src/framework/models/*.ts` (File, Selection, Overlay, Version)
- `src/framework/atomic/fileIO.ts` (upload, read, save version)
- Backend `/api/files/*` endpoints working

---

### 🔷 Phase 2: Overlay Canvas (2-3 days)

**目標：實現 overlay 系統 + 基本 render**

#### Tasks:
1. ✅ 建立 `OverlayCanvas.tsx` 組件（可拖曳、resize、layer 控制）
2. ✅ 實現 overlay CRUD API
3. ✅ 實現 overlay blocks 渲染（text, markdown, image）
4. ✅ 實現 code block 渲染（Mermaid → SVG）
5. ✅ 整合入現有 `CanvasAreaWithSelection`（overlay 作為新 layer）

#### Deliverables:
- `components/OverlayCanvas.tsx` working
- `/api/overlays/*` endpoints working
- Mermaid diagram 可以喺 PDF/Note 上面顯示

---

### 🔷 Phase 3: Router + Skills (3-4 days)

**目標：實現三層路由 + 第一批 micro skills**

#### Tasks:
1. ✅ 建立 `skills/registry.json`（最少 6 個 skills metadata）
2. ✅ 實現 `MacroRouter.ts`（user intent → macro）
3. ✅ 實現 `MicroSelector.ts`（macro + context → Top-K skills）
4. ✅ 建立 3 個 MVP micro skills（含 SKILL.md）：
   - `semantic-search-in-files`
   - `region-ocr`
   - `file-versioning-and-diff`
5. ✅ 實現 `SkillExecutor.ts`（load SKILL.md → execute atomic tools → verify output）
6. ✅ 整合入現有 `geminiWithTools.ts`（改用 router 揀 skill）

#### Deliverables:
- `framework/router/*.ts` working
- `skills/READ_FILES/semantic-search/SKILL.md` + executor working
- `skills/EDIT_FILES/file-versioning/SKILL.md` + executor working
- Agent chat 可以正確路由到 micro skills

---

### 🔷 Phase 4: Atomic Tools + Polish (2-3 days)

**目標：補全關鍵 atomic tools + UI 整合**

#### Tasks:
1. ✅ 實現 `atomic/ocr.ts`（用 Tesseract.js / cloud OCR API）
2. ✅ 實現 `atomic/extract.ts`（table extraction, 用 pdf.js / tabula-js）
3. ✅ 實現 `atomic/render.ts`（Mermaid, SVG, PlantUML）
4. ✅ 優化 `SelectionContext` 傳遞（from UI → agent）
5. ✅ 加入 version diff viewer（show before/after）
6. ✅ 加入 overlay 管理 UI（sidebar 顯示所有 overlays）

#### Deliverables:
- `/api/tools/ocr` working
- `/api/tools/table-extract` working
- Version diff 可視化
- Overlay 管理 sidebar

---

## 🧪 測試場景（MVP）

### Scenario 1: 搜尋跨檔案內容 🔍
1. 用戶上傳 2 份 PDF（lecture notes）
2. 用戶問：「find where it mentions 'photosynthesis'」
3. Router → `READ_FILES` → `semantic-search-in-files`
4. 返回 citations with file_id + page + quote
5. 顯示喺 Chat + 可點擊跳轉

### Scenario 2: OCR 圖片區域 🖼️
1. 用戶開啟一個 PDF（有數學公式圖片）
2. 用戶框選一個區域 → 送俾 AI
3. 用戶話：「extract the formula」
4. Router → `READ_FILES` → `region-ocr`
5. OCR 返回 LaTeX string
6. 顯示喺 Chat + overlay 顯示喺原位置

### Scenario 3: 生成流程圖 📊
1. 用戶有一段 note section（講解 algorithm steps）
2. 用戶話：「draw a flowchart for this」
3. Router → `EDIT_NOTES` → `code-transform-and-diagram`
4. Agent 生成 Mermaid code
5. 渲染成 SVG overlay block
6. Overlay 顯示喺 note section 旁邊

### Scenario 4: 編輯檔案（版本控制）📝
1. 用戶開啟一個 DOCX
2. 用戶話：「rewrite this paragraph in simpler language」
3. Router → `EDIT_FILES` → `docx-restructure-and-rewrite`
4. 生成 new version + diff
5. 顯示 before/after diff
6. 用戶 confirm → save new version

---

## 🔧 技術選擇建議

### Frontend (現有 + 新增)
- ✅ React 19 + TypeScript (keep)
- ✅ Vite (keep)
- 🆕 Mermaid.js (diagram render)
- 🆕 react-draggable (overlay drag)
- 🆕 diff-match-patch (version diff)
- 🆕 Tesseract.js (browser OCR, optional)

### Backend (需要決定)
**Option A: Serverless (簡單快速)**
- Next.js API routes
- Vercel blob storage
- Supabase (file metadata + overlays storage)

**Option B: Traditional Backend**
- Express.js
- PostgreSQL (metadata)
- S3 / MinIO (file storage)

**推薦 MVP：Option A**

### AI / ML APIs
- ✅ Gemini API (keep for chat)
- 🆕 Gemini Vision (OCR alternative)
- 🆕 pdf.js (PDF parsing, client-side)
- 🆕 mammoth.js (DOCX parsing, client-side)

---

## 📊 資源評估

### Token Budget (per skill execution)
- Macro routing: ~500 tokens
- Micro skill selection: ~800 tokens
- Load SKILL.md: ~2000 tokens
- Execute with context: ~4000 tokens
- **Total per request: ~7500 tokens**

### Storage (MVP 估算)
- File versions: ~5 versions per file × 10 files = 50 MB
- Overlays metadata: ~1 KB per overlay × 100 = 100 KB
- Skill registry: ~50 KB
- **Total: <100 MB for MVP**

---

## ⚠️ 關鍵決策點

### 1️⃣ File Storage 方式
- **Local (IndexedDB)**: 簡單、免費、offline 支援
- **Cloud (Supabase/S3)**: 跨裝置、備份、但要 $$$
- **MVP 推薦**: IndexedDB + localStorage

### 2️⃣ Backend 架構
- **Full client-side**: 所有 file 處理喺 browser（限制：大檔案慢）
- **Hybrid**: 小檔案 client、大檔案 server
- **MVP 推薦**: Hybrid

### 3️⃣ Overlay 持久化
- **Option A**: JSON file per note/file
- **Option B**: Database (Supabase)
- **MVP 推薦**: localStorage JSON

### 4️⃣ OCR Provider
- **Tesseract.js**: 免費、client-side、準確度中等
- **Gemini Vision**: 收費、準確度高、支援手寫
- **MVP 推薦**: Gemini Vision (已有 API key)

---

## 📋 Implementation Checklist

### Phase 1: Foundation ✅
- [ ] Create `framework/models/` folder + all interfaces
- [ ] Extend `DroppedFile` → `FileEntity`
- [ ] Create `SelectionContext` state in App.tsx
- [ ] Setup backend API structure
- [ ] Implement file upload + versioning API

### Phase 2: Overlay ✅
- [ ] Create `OverlayCanvas.tsx` component
- [ ] Implement overlay CRUD in App state
- [ ] Add overlay rendering (text, markdown, image)
- [ ] Add Mermaid code block rendering
- [ ] Integrate overlay layer into `CanvasAreaWithSelection`

### Phase 3: Router + Skills ✅
- [ ] Create `skills/registry.json` (6 skills)
- [ ] Implement `MacroRouter.ts`
- [ ] Implement `MicroSelector.ts`
- [ ] Write 3 SKILL.md templates
- [ ] Implement `SkillExecutor.ts`
- [ ] Refactor `geminiWithTools.ts` to use router

### Phase 4: Tools + Polish ✅
- [ ] Implement OCR atomic tool (Gemini Vision)
- [ ] Implement table extraction tool (pdf.js)
- [ ] Implement render pipeline (Mermaid → SVG)
- [ ] Add version diff viewer UI
- [ ] Add overlay management sidebar
- [ ] Test all 4 scenarios

---

## 🎉 Success Criteria (MVP)

✅ **Done when:**
1. User can upload PDF/DOCX/image
2. User can select region → OCR text
3. User can search across files with citations
4. User can ask agent to generate diagram → overlay renders
5. User can edit file → see diff → save version
6. All overlays persist and reload correctly
7. Router correctly selects appropriate skill 80%+ of time

---

## 📌 Next Steps After MVP

### Post-MVP Enhancements:
1. 🎧 Audio/Video transcribe + chaptering
2. 📊 Excel data cleaning + chart generation
3. 🔗 Bidirectional note linking
4. 🧮 LaTeX editor + live preview
5. 🎯 Spaced repetition flashcards
6. 📦 Exam revision pack generator
7. 🔐 User auth + cloud sync

---

## 💡 Developer Tips

1. **Start small**: Phase 1 做好先，唔好一次過做晒
2. **Test early**: 每個 atomic tool 獨立測試先
3. **Mock first**: 未有 backend 可以 mock API responses
4. **Use types**: 所有 interface 先寫好，減少 bug
5. **Log everything**: Router decisions, skill selections → log 晒方便 debug

---

## 📚 參考資料

- Current codebase: `webapp/src/agent/`
- Tech doc: Agent Skills Framework v0.3
- Mermaid docs: https://mermaid.js.org/
- pdf.js: https://mozilla.github.io/pdf.js/
- Gemini API: https://ai.google.dev/

---

**最後更新**: 2026-02-01  
**狀態**: Ready for execution 🚀  
**預計時間**: 10-12 days for MVP
