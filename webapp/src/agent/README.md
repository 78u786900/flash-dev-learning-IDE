# AI Agent System

Agent 系統：右邊 Chat 用 **Agent mode** 時會用 Gemini function calling 調用以下工具，並可將結果寫回筆記（例如加 section）。

## 結構

- **types.ts** — `AgentContext`（當前筆記/檔案/選取/頁文字）、`ToolResult`、`ToolResultAction`（add_section、update_section、merge_sections）
- **tools/definitions.ts** — 所有工具嘅 Gemini `functionDeclarations`（name, description, parameters）
- **tools/noteTools.ts** — 筆記工具實現（verbal_to_structured, summarize_section, expand_section, extract_key_terms, generate_quiz, suggest_structure, merge_sections）
- **tools/pdfTools.ts** — PDF 工具實現（summarize_page, page_to_note, generate_qa_from_page, extract_definitions）
- **tools/runGemini.ts** — 單次 prompt 調用 Gemini（工具內部用）
- **tools/index.ts** — `executeTool(name, params, context, callGemini)`、匯出 `AGENT_TOOL_DEFINITIONS`
- **geminiWithTools.ts** — `runAgentChatWithTools()`：送 user message + context、帶 tools 調用 Gemini、處理 functionCall 迴圈、執行工具並可 `onToolAction`

## 點加新工具

1. 在 **definitions.ts** 加一條 `functionDeclarations`（name, description, parameters）
2. 在 **noteTools.ts** 或 **pdfTools.ts**（或新檔）寫 `run_<name>(params, ctx, callGemini) => Promise<ToolResult>`
3. 在 **tools/index.ts** 的 `RUNNERS` 登記 `name: run_<name>`

## App 接駁

- App 傳 `agentContext`（note, file, fileType）同 `onToolAction` 俾 ChatPanel
- Agent mode 發送時用 `runAgentChatWithTools`；工具返回 `action` 時會觸發 `onToolAction`，App 會加 section / 更新 section / 合併 section
