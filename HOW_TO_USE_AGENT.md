# How to Use the Agent

Quick guide: build, test, debug, and use the Learning IDE agent.

---

## 1. Build

```bash
cd webapp
npm install
npm run build
```

- **Success**: `dist/` folder with `index.html` and `assets/*.js`.
- **If TypeScript fails**: fix errors in `src/` (and framework skills under `src/framework/skills/`).

---

## 2. Loop Testing (repeated build)

To check that the build is stable, run it several times:

**PowerShell:**
```powershell
cd webapp
1..3 | ForEach-Object { Write-Host "Build $_"; npm run build }
```

**Bash:**
```bash
cd webapp
for i in 1 2 3; do echo "Build $i"; npm run build; done
```

All runs should finish with exit code 0.

---

## 3. Debug Mode

### Option A: Dev server (recommended)

1. Start dev server:
   ```bash
   cd webapp
   npm run dev
   ```
2. Open **http://localhost:5173** in the browser.
3. **Terminal chat log**: While `npm run dev` is running, every chat message (user + agent) is also sent to the **same terminal**. You’ll see lines like:
   - `[Chat USER] <user message>`
   - `[Chat AGENT] <agent reply>`
   - `[Tool] page_to_note → ...`
   - `[Layer] EDIT_NOTES`, `[Skill] page_to_note`, etc.
   So you can watch the full interaction in real time in the terminal.
4. In browser DevTools (F12) → **Sources**, you can set breakpoints in the original `.tsx`/`.ts` files (Vite provides source maps).

### Option B: VS Code + Chrome

1. Start dev server in a terminal: `cd webapp && npm run dev`.
2. In VS Code: **Run and Debug** (Ctrl+Shift+D) → choose **"Launch Chrome (dev)"**.
3. Chrome opens at http://localhost:5173; breakpoints in VS Code (e.g. in `geminiWithTools.ts`, `ChatPanel.tsx`) will hit when the agent runs.

### Option B2: Compound (dev + Chrome together)

- Choose **"Dev + Chrome"** in the debug dropdown. VS Code starts the dev server and launches Chrome.

### Build with source maps (for production-style debugging)

```bash
cd webapp
npm run build:debug
npm run preview
```

Then open http://localhost:4173 and use browser DevTools; stack traces and breakpoints will map to source.

---

## 4. How to Use the Agent in the App

### Prerequisites

- **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey).
- Enter the API key in the app (where the UI asks for it; often in header/settings).

### Steps

1. **Start the app**
   - `npm run dev` → open http://localhost:5173.

2. **Switch to Agent mode**
   - In the chat panel, select **Agent** (not “Ask”). The agent can call tools; “Ask” is plain Q&A.

3. **Give context**
   - **Note**: Create or open a note. The agent sees its sections and can summarize/expand/merge, extract terms, generate quizzes, etc.
   - **PDF**: Open a PDF. The app loads all page text in the background. The agent sees “Page 1”, “Page 2”, … and can turn **multiple pages** (e.g. first 10) into note sections in one go.
   - **Selection**: Select text on the canvas (when supported). The agent uses it as `raw_text` or `page_text` for tools. Do **not** type your selection in chat – keep context from the canvas.

4. **Send a message**
   - Examples (Cantonese):
     - 「將呢段整理成筆記」 → structure pasted/selected text into a note.
     - 「總結第二章」 → summarize section 2.
     - 「根據呢章出 3 條題」 → generate 3 quiz questions from the current section/chapter.
     - 「呢頁變成我筆記嘅一節」 → turn current PDF page into a note section.
     - 「總結呢頁」 → summarize current PDF page.
     - 「抽出呢頁嘅定義」 → extract definitions from current page.

5. **Confirmations**
   - If the agent suggests an action (e.g. “turn this page into a note section”), you can reply **ok**, **yes**, **好**, **directly execute**, or **just follow your thought**. The agent will **execute** that action (e.g. call `page_to_note`) instead of asking again.

6. **Tool / layer / skill logs in chat**
   - Each agent reply can show logs above the text, for example:
     - `[Layer] EDIT_NOTES`
     - `[Skill] page_to_note`
     - `[Tool] page_to_note(...) → ok: 已轉成筆記…`
   - These come from the response and show what the agent did.

7. **Optional: attach image**
   - If the UI has an image attachment, you can send a screenshot/diagram; the agent can use it (e.g. for “Ask” or future vision tools).

8. **Tool results**
   - When the agent calls a tool (e.g. `verbal_to_structured`, `page_to_note`), the app applies the action (e.g. add section to note) and shows the log + reply.

### Available tools (what the agent can do)

| Area   | Tools |
|--------|--------|
| **Notes** | `verbal_to_structured`, `summarize_section`, `expand_section`, `extract_key_terms`, `generate_quiz`, `suggest_structure`, `merge_sections` |
| **PDF**   | `summarize_page`, `page_to_note`, `generate_qa_from_page`, `extract_definitions` |

The agent chooses the tool from your message and the current context (note, PDF page, selection).

---

## 5. Troubleshooting

| Issue | What to do |
|-------|------------|
| Build fails (TS) | Fix errors reported by `tsc`; check `src/` and `src/framework/skills/**/scripts/*.ts`. |
| “Invalid API key” | Check key in Google AI Studio; ensure no extra spaces when pasting. |
| **Failed to fetch** | 網絡唔通、未設 VITE_GEMINI_API_KEY、或被防火牆/擴展擋咗。用 `npm run dev` 喺本機開，唔好用 file://；檢查 `.env` 有 `VITE_GEMINI_API_KEY=你的key`。 |
| Agent does nothing | Ensure **Agent** mode is selected and context is set (note opened or PDF page + optional selection). |
| CORS / network errors | Use the app from the same origin as the dev server (e.g. http://localhost:5173). |
| Debug breakpoints not hit | Use “Launch Chrome (dev)” with dev server already running, or “Dev + Chrome” compound. |

---

## 6. Summary

- **Build**: `cd webapp && npm run build`
- **Loop test**: run `npm run build` 3 times; all should succeed.
- **Debug**: `npm run dev` + browser DevTools, or VS Code “Launch Chrome (dev)” / “Dev + Chrome”.
- **Use agent**: Start app → set API key → Agent mode → open note/PDF, optionally select text → send natural language (e.g. 整理成筆記、總結、出題、呢頁變筆記).

The 19 micro-skills in `src/framework/skills/` are the future extension points; the **current** agent uses the tools in `src/agent/tools/` (notes + PDF) and is ready to use as above.
