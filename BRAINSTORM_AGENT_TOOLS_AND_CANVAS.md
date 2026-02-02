# 🧠 AI Agent 工具 × 畫布 Toolbar 腦震盪

> 參考：[BRAINSTORM_SUMMARY.md](./BRAINSTORM_SUMMARY.md) · 中間 = **Miro 式畫布**（檔案 + 可編輯層）· 底部 = **按檔案類型嘅 toolbar**

---

## 🎯 核心概念

| 概念 | 說明 |
|------|------|
| **中間 = Canvas** | 唔係淨係「睇」檔案，而係一塊 **可編輯畫布**：上面有檔案內容（PDF 頁、圖、片、筆記 section）+ **覆蓋層**（便籤、高亮、箭嘴、連結）。人同 AI 都可以喺同一塊畫布上操作。 |
| **底部 Toolbar** | 固定喺畫布下方，**跟住當前檔案類型** 顯示唔同工具；再加一組 **畫布通用工具**（縮放、平移、加便籤、加連結等）。 |
| **AI Agent 工具** | 每種檔案類型對應一組 **Agent 可以調用嘅工具**（例如「呢頁 PDF 總結」「呢段轉成筆記」），右邊 Chat 用 Agent mode 時就可以用呢啲工具同畫布互動。 |

---

## 📐 畫布通用（任何檔案類型都出現）

### 畫布層結構（由底到面）

1. **底層**：當前檔案內容（PDF 一頁 / 圖 / 片 / 筆記 section 列表）
2. **覆蓋層**：便籤、高亮、箭嘴/形狀、連結線、文字標註（可拖曳、可編輯）
3. **選擇層**：用戶框選嘅區域（例如「將呢段送俾 AI」）

### 底部 Toolbar — 通用區（左或右固定一截）

| 工具 | 說明 | 可接 AI |
|------|------|--------|
| 🔍 縮放 | 畫布 zoom in/out，睇多啲或少啲 | — |
| ✋ 平移 | Pan 畫布，唔改內容 | — |
| 📌 便籤 | 加一張可拖曳便籤，寫字或錄音；可連結去某個 section/頁 | Agent 可「根據便籤生成筆記」 |
| 🔗 連結 | 畫兩點拉一條線，連去另一份筆記 / section / 頁 / URL | Agent 可「解釋呢個連結關係」 |
| ✏️ 箭嘴/形狀 | 簡單畫箭嘴、圓、框，標重點 | — |
| 🎯 送俾 AI | 將當前選擇（或成個畫布 context）送俾右邊 Agent | 直接觸發 Agent |

---

## 📄 按檔案類型：Toolbar + AI Agent 工具

### 1. 筆記（Notes / 線性 sections）

**畫布顯示**：線性 section 列表（已有），可視為「一條長畫布」或分頁；每個 section 可當一個 block，上面可加便籤/連結。

**底部 Toolbar（筆記專用）**

| 工具 | 說明 |
|------|------|
| ➕ 加 section | 喺當前筆記加新章節 |
| ✓ 標完成 | 將選中 section 標為完成（進度 % 會更新） |
| ↕️ 調序 | 拖曳 section 調先後 |
| 📌 便籤 | 喺某 section 上加便籤 |
| 🔗 連結 | 將 section 連去其他筆記/檔案/URL |

**AI Agent 可調用嘅工具**

| 工具 | 說明 | 例子 |
|------|------|------|
| `summarize_section` | 總結某個 section | 「總結第二章」 |
| `expand_section` | 擴寫某 section（加例子、解釋） | 「將呢段擴寫成 200 字」 |
| `merge_sections` | 合併多個 section | 「合併 2.1 同 2.2」 |
| `generate_quiz` | 根據 section 生成選擇/短答題 | 「根據呢章出 3 條題」 |
| `extract_key_terms` | 抽出關鍵詞/定義 | 「列出呢章嘅關鍵詞」 |
| `suggest_structure` | 建議章節結構 | 「幫我重新分節」 |
| `verbal_to_structured` | 將口語/亂 notes 變成結構化 section | 「將我貼嘅呢段整理成筆記」 |

---

### 2. PDF

**畫布顯示**：單頁或連續頁渲染（已有 PdfContentOnly）；上面可疊便籤、高亮、箭嘴。

**底部 Toolbar（PDF 專用）**

| 工具 | 說明 |
|------|------|
| ◀ ▶ 上一頁 / 下一頁 | 翻頁（已有） |
| 🔍 縮放 | 頁面 zoom（已有） |
| 🖍️ 高亮 | 選文字 → 高亮（顏色可選） |
| 📌 便籤 | 喺頁面某位置加便籤（可綁定座標或選取範圍） |
| ✏️ 箭嘴/框 | 標重點區域 |
| 📋 複製 / 加入筆記 | 選取文字 → 複製或「加入當前筆記做新 section」 |
| 🎯 送俾 AI | 選取文字或整頁 → 送俾 Agent |

**AI Agent 可調用嘅工具**

| 工具 | 說明 | 例子 |
|------|------|------|
| `extract_text` | 抽出當前頁/選取文字 | 俾 Agent 做下文 |
| `summarize_page` | 總結當前頁 | 「總結呢頁」 |
| `page_to_note` | 將一頁轉成筆記 section | 「呢頁變成我筆記嘅一節」 |
| `generate_qa_from_page` | 根據一頁出 Q&A | 「根據呢頁出 2 條問答」 |
| `extract_definitions` | 抽出定義、公式、列表 | 「列出呢頁嘅定義」 |
| `ocr_region` | 對某區域做 OCR（圖多嘅 PDF） | 「認呢幅圖嘅字」 |

---

### 3. 圖片（Image）

**畫布顯示**：圖片全幅或縮放顯示；上面可加便籤、箭嘴、文字標註。

**底部 Toolbar（圖片專用）**

| 工具 | 說明 |
|------|------|
| 🔍 縮放 | 放大縮小 |
| ✏️ 標註 | 箭嘴、圓、框、文字 |
| 📌 便籤 | 喺圖上某點加便籤 |
| 🔗 連結 | 連去筆記/section/URL |
| 🎯 送俾 AI | 成張圖或框選區域送俾 Agent |

**AI Agent 可調用嘅工具**

| 工具 | 說明 | 例子 |
|------|------|------|
| `describe_image` | 描述圖片內容 | 「呢張圖係咩？」 |
| `ocr_image` | 認圖中文字 | 「讀出圖入面嘅字」 |
| `caption` | 生成一句 caption | 「幫我寫一句說明」 |
| `to_flashcard` | 將圖變成閃卡（正面圖，背面描述/問題） | 「做成一張 flashcard」 |
| `suggest_labels` | 建議圖上標籤（例如圖解、流程圖） | 「幫我標呢張圖嘅部分」 |

---

### 4. 影片（Video）

**畫布顯示**：播放器 + 時間軸；可喺時間軸上加「標記點」、便籤綁定時間。

**底部 Toolbar（影片專用）**

| 工具 | 說明 |
|------|------|
| ⏯ 播放/暫停、速度 | 基本播放（已有） |
| 📍 時間標記 | 喺當前時間打一個標記（例如「重點 1」） |
| 📌 便籤 @ 時間 | 喺當前秒數加便籤，之後一點就跳去該秒 |
| ✂️ 選段 | 選 start–end，可「送俾 AI」或「轉成筆記」 |
| 🎯 送俾 AI | 全片/選段/當前時間附近送俾 Agent |

**AI Agent 可調用嘅工具**

| 工具 | 說明 | 例子 |
|------|------|------|
| `summarize_video` | 總結全片或選段 | 「總結呢條片」 |
| `chapters_from_video` | 生成章節/時間戳列表 | 「幫我分章節」 |
| `qa_from_transcript` | 根據 transcript 出 Q&A | 「根據對白出 3 條題」 |
| `key_moments` | 抽出重點時刻（幾多秒） | 「列出 5 個重點時刻」 |
| `segment_to_note` | 將某段（如 2:00–5:00）轉成筆記 section | 「2 分到 5 分轉成筆記」 |

---

### 5. Office 類（docx, pptx, xlsx）— 後續擴展

**畫布顯示**：預覽（若可渲染）或「卡牌」式一頁一頁；上面同樣可加便籤、連結。

**底部 Toolbar（Office 專用構想）**

| 工具 | 說明 |
|------|------|
| 上一頁/下一頁 | 若分頁預覽 |
| 📌 便籤、🔗 連結 | 同 PDF |
| 📋 加入筆記 | 選取內容 → 加入筆記 |
| 🎯 送俾 AI | 選取或整份送俾 Agent |

**AI Agent 可調用嘅工具（構想）**

| 工具 | 說明 |
|------|------|
| `summarize_doc` | 總結整份或一節 |
| `outline_doc` | 生成大綱 |
| `extract_key_points` | 抽出要點 |
| `to_study_guide` | 生成溫習提要 |
| `compare_docs` | 比較兩份 doc（若日後支援多檔） |

---

### 6. 其他 / 無法預覽

**底部 Toolbar**：下載、用系統開、**「貼上內容做筆記」**（將剪貼簿文字變成新 section）。

**AI Agent**：若有辦法拎到文字（例如 paste），可 `verbal_to_structured`；否則提示「請手動加入筆記或上傳可支援類型」。

---

## 🤖 Agent 與 Toolbar 點配合

- **用戶做嘢**：喺畫布揀內容（選文字、選段、選區域）→ 撳 toolbar「送俾 AI」或撳某個「轉成筆記」→ 右邊 Agent 收到 **context**（選取 + 檔案類型 + 當前筆記）。
- **Agent 做嘢**：Agent mode 可調用上面嘅工具（例如 `summarize_page`、`page_to_note`），執行完結果可以 **寫回畫布**（例如新 section、新便籤、高亮）或只喺 Chat 回覆。
- **Toolbar 跟類型**：底部 toolbar 由「當前係筆記 / PDF / 圖 / 片 / Office」決定顯示邊一組專用工具，再加通用畫布工具（便籤、連結、縮放、送俾 AI）。

---

## 📌 同 BRAINSTORM_SUMMARY 對齊

- **Small editable canvas**：中間就係呢塊畫布，檔案 + 覆蓋層，人同 AI 一齊改。
- **Verbal notes → 多媒體學習物件**：用 `verbal_to_structured`、`page_to_note`、`segment_to_note` 等工具將口語/檔案內容變成筆記 section。
- **Combine notes, generate new**：用 `merge_sections`、`expand_section`、`suggest_structure` 同「加入筆記」類工具。
- **Progress % / section markers**：筆記 toolbar 嘅「標完成」、調序，同現有 progress 同 OUTLINE 對齊。

下一步可以揀一種檔案類型（例如 PDF 或筆記）先實現 **底部 toolbar + 一兩個 Agent 工具**，再逐步加其他類型同更多工具。 🚀
