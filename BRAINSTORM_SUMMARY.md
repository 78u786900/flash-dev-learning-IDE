# 🧠 Learning IDE 腦震盪總結 + MVP 框架

> 對象：小學同中學學生 | 概念：AI 驅動嘅**線性學習空間**，好似「學嘢版 Cursor」咁

---

## 📝 你嘅核心諗法（我嘅理解）

| 你講嘅 | 我理解成 |
|--------|----------|
| **Cursor for learning** | 用 IDE 思維做學習：有「檔案 → 顯示 → Agent」嘅流水線，唔係亂咁擺料 |
| **Files → Display → Agent** | 輸入（筆記/檔案）→ 喺畫布顯示 → AI Agent 幫手整理、擴充、生成 |
| **Verbal notes → 多媒體學習物件** | 口語/隨手寫嘅 notes 可以變成**真正有用嘅多媒體元素**（文字、圖、聲、片等） |
| **Combine notes + generate new** | 可以合併幾份筆記，又可以叫 AI 生出新筆記，唔使由零開始 |
| **Small editable canvas** | 顯示層係**細塊可編輯畫布**，人同 AI 一齊改，唔係淨係「睇」 |
| **Linear personalized notes** | 最終產出係**一條線咁跟住學**、個人化、真係用得著嘅筆記 |
| **Progress % marker** | 學到邊、完成幾多%，要有清楚標示 |
| **Title / section markers** | 有頁/章節標記，方便跳轉同結構化 |
| **Security credentials vibe check** | 俾學生用要**安全、可信**，credentials / 權限要「過到 vibe」 |
| **沉浸式 full screen lock down** | **全屏專注模式**，鎖住介面，減少分心 |
| **Grinding timer** | **讀書/衝刺計時器**，例如專注幾多分鐘、休息幾多，幫學生 grind |

---

## 🎯 一句總結

**「將口頭/零散筆記 → 經 AI 同人一齊喺小畫布上編輯 → 變成有進度、有章節、可全屏專注、有計時嘅線性個人化學習筆記。」**

---

## 🏗️ MVP 框架（最小可行產品）

### Phase 0：前提
- **對象**：小學、中學學生（可先做中學再落小學）
- **平台**：Web app（方便學校/屋企用）
- **安全**：登入 + 權限 + 內容安全（vibe check = 合規、唔出格）

### Phase 1：核心流水線 🧾 → 📺 → 🤖
1. **輸入**
   - 上傳/貼文字 or 錄音（verbal notes）
   - 可選：匯入現有檔案（PDF、txt 等）
2. **Display**
   - 一個**細嘅可編輯畫布**（canvas）
   - 畫布上顯示：標題、段落、多媒體區（文字、圖、連結、之後可加聲/片）
3. **Agent**
   - AI 幫手：將口語/亂 notes 轉成**結構化多媒體學習元素**
   - 可「合併筆記」、可「根據現有內容生成新筆記」

### Phase 2：人機協作 + 線性筆記
4. **編輯**
   - 人同 AI 都可以喺同一塊 canvas 上改：改字、加 section、加元素
   - 改完就係「呢條線性筆記」嘅一部分，唔會散收收
5. **結構**
   - **Title / section markers**：每頁或每個 section 有標題，可跳轉
   - **Progress %**：按 section 或按「完成狀態」計進度，顯示百分比

### Phase 3：專注與習慣
6. **沉浸式 full screen lock down**
   - 全屏模式，隱藏其他 UI，只留筆記 + 必要控制
   - 「Lock down」= 減少離開/分心（例如計時未完唔畀隨便跳走，可設 optional）
7. **Grinding timer**
   - 計時器：設定讀書時長（如 25 min）、休息（如 5 min）
   - 可同「當前筆記 / section」綁埋，例如「呢 section 要 grind 完先標完成」

### Phase 4：安全與合規
8. **Security / credentials vibe check**
   - 登入（可接學校 SSO 或簡單 account）
   - 內容過濾、權限（只睇自己/老師派嘅），符合學校「安全使用」要求

---

## 📐 MVP 功能清單（優先序）

| 優先 | 功能 | 說明 |
|------|------|------|
| P0 | 文字筆記 → 畫布顯示 | 輸入一段 verbal/文字，喺 canvas 顯示成可編輯區 |
| P0 | AI：整理/生成筆記 | 將口語變結構化、可合併、可生成新筆記 |
| P0 | 畫布上人+AI 編輯 | 細 canvas，改字、加 section，即時反映 |
| P1 | Section / 標題標記 | 分頁或分 section，可跳轉 |
| P1 | 進度 % marker | 按 section 或完成狀態顯示 progress % |
| P1 | Grinding timer | 專注計時 + 休息，可選綁 section |
| P2 | 全屏 lock down 模式 | 沉浸式全屏，減少分心 |
| P2 | Security / vibe check | 登入、權限、內容安全（合學校用） |

---

## 🔧 技術向備註（方便之後起樓）

- **Frontend**：Canvas 可以用 block-based editor（例如 Notion-like blocks）或簡單 div-based sections，方便「線性」同「多媒體元素」。
- **Agent**：要定義好「輸入格式」（verbal/text）同「輸出格式」（標題、段落、多媒體 block 類型），先易做 files → display → agent 流水線。
- **Progress**：可以「每個 section 有 done/not done」或「睇到邊一節」嚟計 %。
- **Timer**：獨立 component，可 emit 事件（開始/暫停/完）俾主 app 用，再決定是否 lock UI。

你之後可以按呢個 MVP 一步步做：先做 P0 嘅「輸入 → 畫布 → AI 整理」，再加 sections、progress、timer，最後先做全屏同 security。  
如果你願意，我可以下一步幫你寫 **user stories** 或者 **一個好簡單嘅 prototype 目錄結構**（例如 Next.js / React 應該放邊啲 component）。 📂✨
