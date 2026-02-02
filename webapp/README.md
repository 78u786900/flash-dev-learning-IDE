# Learning IDE · 線性學習空間 MVP

Cursor 風格嘅學習用 web app，對象：小學、中學學生。

## 功能（MVP）

- **Layout**：頂欄選單、左邊筆記/檔案/OUTLINE/TIMELINE、中間畫布/檔案預覽、右邊 AI Chat、底 status bar
- **筆記**：左邊加/揀筆記，每個筆記有多個 section（章節），可編輯標題同內容
- **拖放檔案**：喺「LEARNING_IDE」下面拖放任何檔案（docx, pptx, pdf, excel, 圖, 片…），點擊後中間會顯示預覽（圖/片/PDF 內嵌，其他可下載）
- **Timeline**：TIMELINE 區會記錄 IDE 操作（建立筆記、加章節、拖放檔案、打開筆記/檔案、完成章節等）
- **AI Chat**：右邊可揀 **Ask** / **Agent** 模式，同埋 **Gemini 3 Flash** / **Gemini 3 Pro**；需要喺 `.env` 設定 `VITE_GEMINI_API_KEY`
- **進度**：每個 section 可勾選「完成」，status bar 顯示完成 %
- **Command Palette**：`Ctrl+P` 開命令
- **Grinding Timer**：Header 按「Timer」開 25min 專注 / 5min 休息
- **全屏專注**：Header 按「全屏專注」進入沉浸式 lock down

## 環境變數（AI Agent）

複製 `.env.example` 做 `.env`，填上 Gemini API key：

```bash
cp .env.example .env
# 編輯 .env，加入：VITE_GEMINI_API_KEY=你的key
```

拎 key：https://aistudio.google.com/apikey

## 點行

```bash
cd webapp
npm install
npm run dev
```

開瀏覽器去 `http://localhost:5173`。

## Build

```bash
npm run build
npm run preview
```

## 技術

- React 19 + TypeScript + Vite
- 純 CSS（Cursor 風格 dark theme），無 UI 庫
