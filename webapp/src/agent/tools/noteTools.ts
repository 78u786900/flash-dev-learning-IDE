import type { AgentContext, ToolResult, ToolResultAction } from '../types'
import type { Note } from '../../types'
import type { CallGeminiFn } from './runGemini'

function getNoteId(ctx: AgentContext): string | null {
  return ctx.note?.id ?? null
}

/** create_note: 建立新筆記並回傳 id；將新筆記存入 ctx.lastCreatedNote 以便同一次 run 內嘅後續工具（如 generate_plantuml_diagram、page_to_note）可以揾到。 */
export async function run_create_note(
  params: { name?: string },
  ctx: AgentContext,
  _callGemini: CallGeminiFn
): Promise<ToolResult> {
  const name = params.name?.trim() || '未命名筆記'
  const createNote = ctx.createNote
  if (!createNote) return { success: false, error: '無法建立筆記（createNote 未提供）' }
  const newNote = createNote(name)
  const mutableCtx = ctx as AgentContext & { lastCreatedNote?: Note }
  mutableCtx.lastCreatedNote = newNote
  return {
    success: true,
    text: `已建立筆記「${name}」。請喺後續每次 page_to_note 或 generate_plantuml_diagram 呼叫入面傳 target_note_id: "${newNote.id}"，將 section 加去呢個新筆記。`,
  }
}

/** verbal_to_structured: 將口語/亂 notes 變成結構化 section */
export async function run_verbal_to_structured(
  params: { raw_text: string; suggested_title?: string },
  ctx: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  const noteId = getNoteId(ctx)
  const prompt = `將以下口語或零散筆記整理成「一條標題 + 一段結構化內容」。
規則：只可用 \\section{...}、\\textbf{...}、\\textit{...}、\\texttt{...}、\\begin{itemize}\\item ...\\end{itemize}、$...$、$$...$$；} 後接字要加空格；唔好用其它 \\ 指令或 markdown（唔好 ** 或 ##）。第一行只輸出 \\section{...}，之後空一行，再輸出段落。\n${params.suggested_title ? `建議標題可參考：${params.suggested_title}\n\n` : ''}用戶輸入：\n\n${params.raw_text}`
  const out = await callGemini(prompt, 'Output only allowed LaTeX. Add space after } before next word. No markdown. No invented \\commands. Traditional Chinese.')
  const lines = out.split('\n').map(l => l.trim()).filter(Boolean)
  const firstLine = lines[0] ?? ''
  const sectionMatch = firstLine.match(/\\section\s*\{([^}]*)\}/)
  const title = sectionMatch ? sectionMatch[1].trim() : (firstLine || '新章節')
  const content = lines.slice(1).join('\n').trim() || params.raw_text
  const action: ToolResultAction | undefined = noteId
    ? { type: 'add_section', noteId, title, content }
    : undefined
  return { success: true, text: `已整理成：**${title}**\n\n${content}`, action }
}

/** summarize_section: 優先從 context.note 裏面根據 section_index 取「完整內容」，避免用被截斷嘅摘要。*/
export async function run_summarize_section(
  params: { section_index: string; content: string },
  ctx: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  let content = params.content
  const idx = parseInt(params.section_index?.trim() ?? '0', 10)
  if (ctx.note && idx >= 1 && idx <= ctx.note.sections.length) {
    const full = ctx.note.sections[idx - 1]?.content
    if (full && full.trim()) content = full
  }
  const prompt = `總結以下筆記 section（Section ${params.section_index}）嘅內容，用 2–4 句話概括要點。用繁體中文。\n\n${content}`
  const text = await callGemini(prompt)
  return { success: true, text }
}

/** expand_section: 同樣優先用 context.note 入面嘅完整 section 內容。*/
export async function run_expand_section(
  params: { section_index?: string; content: string; target_length?: string },
  ctx: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  let content = params.content
  const rawIndex = params.section_index?.trim()
  if (ctx.note && rawIndex) {
    const idx = parseInt(rawIndex, 10)
    if (idx >= 1 && idx <= ctx.note.sections.length) {
      const full = ctx.note.sections[idx - 1]?.content
      if (full && full.trim()) content = full
    }
  }
  const hint = params.target_length
    ? `目標：${params.target_length}。可加例子或解釋。`
    : '適度擴寫，加一兩個例子或解釋，保持清晰。'
  const prompt = `擴寫以下筆記內容。${hint}\n用繁體中文。輸出只可用 \\section{...}、\\textbf{...}、\\textit{...}、\\texttt{...}、\\begin{itemize}\\item ...\\end{itemize}、$...$、$$...$$；} 後接字要加空格；唔好用 markdown 或其它 \\ 指令。\n\n${content}`
  const text = await callGemini(prompt)
  return { success: true, text }
}

/** extract_key_terms */
export async function run_extract_key_terms(
  params: { content: string; format?: string },
  _ctx: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  const formatHint = params.format === 'definitions' ? '列出關鍵詞並附簡短定義。' : params.format === 'both' ? '先列關鍵詞，再選重要嘅寫定義。' : '列出關鍵詞即可。'
  const prompt = `從以下筆記內容抽出關鍵詞。${formatHint}\n用繁體中文。\n\n${params.content}`
  const text = await callGemini(prompt)
  return { success: true, text }
}

/** generate_quiz */
export async function run_generate_quiz(
  params: { content: string; num_questions?: string; question_type?: string },
  _ctx: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  const n = params.num_questions ? parseInt(params.num_questions, 10) : 3
  const typeHint = params.question_type === 'mcq' ? '選擇題' : params.question_type === 'short' ? '短答題' : '混合選擇題同短答題'
  const prompt = `根據以下筆記內容出 ${n} 條測驗題（${typeHint}）。每題要標明題型同答案。用繁體中文。\n\n${params.content}`
  const text = await callGemini(prompt)
  return { success: true, text }
}

/** suggest_structure */
export async function run_suggest_structure(
  params: { content: string },
  _ctx: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  const prompt = `以下係筆記內容。建議一個更好嘅章節結構：列出建議嘅章節標題同每節大概包含咩。用繁體中文。\n\n${params.content}`
  const text = await callGemini(prompt)
  return { success: true, text }
}

/** merge_sections: 合併多段內容成一段。若 context.note 可用，就以 section_indices 從 note 取「完整內容」，唔用模型傳入嘅截斷 contents。*/
export async function run_merge_sections(
  params: { section_indices: string; contents: string; new_title: string },
  ctx: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  const noteId = getNoteId(ctx)
  let contents = params.contents
  if (ctx.note && params.section_indices?.trim()) {
    const indices = params.section_indices
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => n >= 1 && n <= ctx.note!.sections.length)
    const fullSections = indices
      .map(i => ctx.note!.sections[i - 1]?.content?.trim())
      .filter(Boolean) as string[]
    if (fullSections.length) {
      contents = fullSections.join('\n\n')
    }
  }
  const prompt = `將以下多段筆記合併成一段流暢內容。合併後標題為：${params.new_title}\n\n各段內容：\n${contents}\n\n只輸出合併後嘅段落正文（唔好重複標題）。用繁體中文。輸出只可用 \\textbf{...}、\\textit{...}、\\texttt{...}、\\begin{itemize}\\item ...\\end{itemize}、$...$、$$...$$；} 後接字要加空格；唔好用 markdown 或其它 \\ 指令。`
  const content = await callGemini(prompt)
  const action: ToolResultAction | undefined = noteId
    ? { type: 'merge_sections', noteId, sectionIds: params.section_indices.split(',').map(s => s.trim()), newTitle: params.new_title, content }
    : undefined
  return { success: true, text: `合併後（${params.new_title}）：\n\n${content}`, action }
}

function getNote(ctx: AgentContext, noteId?: string): Note | null {
  const id = (noteId ?? ctx.note?.id)?.trim()
  if (!id) return ctx.note ?? null
  const lastCreated = (ctx as AgentContext & { lastCreatedNote?: Note }).lastCreatedNote
  if (lastCreated?.id === id) return lastCreated
  const note = ctx.notes?.find(n => n.id === id) ?? (ctx.note?.id === id ? ctx.note : null)
  return note ?? null
}

/** reorder_sections: 改變同一筆記內 section 順序 */
export async function run_reorder_sections(
  params: { note_id?: string; section_order: string },
  ctx: AgentContext,
  _callGemini: CallGeminiFn
): Promise<ToolResult> {
  const note = getNote(ctx, params.note_id)
  if (!note) return { success: false, error: '搵唔到筆記。請指定 note_id 或確保當前打開緊要改嘅筆記。' }
  const orderStr = params.section_order?.trim()
  if (!orderStr) return { success: false, error: '請提供 section_order，例如 "3,1,2"。' }
  const indices = orderStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => n >= 1 && n <= note.sections.length)
  if (indices.length !== note.sections.length) return { success: false, error: `section_order 必須包含 1 到 ${note.sections.length} 嘅每個序號各一次，逗號分隔。` }
  const sectionIds = indices.map(i => note.sections[i - 1]?.id).filter(Boolean) as string[]
  if (sectionIds.length !== note.sections.length) return { success: false, error: '無效嘅 section 序號。' }
  return {
    success: true,
    text: `已將筆記「${note.name}」嘅 section 順序改為：${orderStr}。`,
    action: { type: 'reorder_sections', noteId: note.id, sectionIds },
  }
}

/** search_sections: 關鍵字/語意搜尋 section */
export async function run_search_sections(
  params: { note_id?: string; query: string },
  ctx: AgentContext,
  _callGemini: CallGeminiFn
): Promise<ToolResult> {
  const note = getNote(ctx, params.note_id)
  if (!note) return { success: false, error: '搵唔到筆記。請指定 note_id 或打開要搜嘅筆記。' }
  const query = (params.query ?? '').trim().toLowerCase()
  if (!query) return { success: false, error: '請提供搜尋關鍵字 query。' }
  const keywords = query.split(/\s+/).filter(Boolean)
  const matches = note.sections
    .map((s, i) => {
      const title = (s.title ?? '').toLowerCase()
      const content = (s.content ?? '').toLowerCase()
      const score = keywords.reduce((n, k) => n + (title.includes(k) ? 2 : 0) + (content.includes(k) ? 1 : 0), 0)
      return { index: i + 1, title: s.title, score }
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
  if (matches.length === 0) return { success: true, text: `筆記「${note.name}」入面冇搵到符合「${params.query}」嘅 section。` }
  const lines = matches.map(m => `  §${m.index}. ${m.title}`)
  return { success: true, text: `筆記「${note.name}」符合「${params.query}」嘅 section：\n${lines.join('\n')}` }
}

/** update_section: 修改某 section 嘅標題或內容 */
export async function run_update_section(
  params: { note_id?: string; section_index: string; title?: string; content?: string },
  ctx: AgentContext,
  _callGemini: CallGeminiFn
): Promise<ToolResult> {
  const note = getNote(ctx, params.note_id)
  if (!note) return { success: false, error: '搵唔到筆記。請指定 note_id 或打開要改嘅筆記。' }
  const idx = parseInt(params.section_index?.trim() ?? '0', 10)
  if (!(idx >= 1 && idx <= note.sections.length)) return { success: false, error: `section_index 必須係 1 到 ${note.sections.length}。` }
  const section = note.sections[idx - 1]
  if (!section) return { success: false, error: '無效嘅 section。' }
  if (params.title === undefined && params.content === undefined) return { success: false, error: '請提供 title 或 content 至少一項。' }
  return {
    success: true,
    text: `已更新筆記「${note.name}」第 ${idx} 節${params.title !== undefined ? ` 標題→「${params.title}」` : ''}${params.content !== undefined ? ' 內容' : ''}。`,
    action: {
      type: 'update_section',
      noteId: note.id,
      sectionId: section.id,
      ...(params.title !== undefined && { title: params.title }),
      ...(params.content !== undefined && { content: params.content }),
    },
  }
}

/** rename_note: 改筆記名稱 */
export async function run_rename_note(
  params: { note_id: string; name: string },
  ctx: AgentContext,
  _callGemini: CallGeminiFn
): Promise<ToolResult> {
  const noteId = (params.note_id ?? '').trim()
  if (!noteId) return { success: false, error: '請提供 note_id。' }
  const note = ctx.notes?.find(n => n.id === noteId) ?? (ctx.note?.id === noteId ? ctx.note : null)
  if (!note) return { success: false, error: '搵唔到該筆記。' }
  const name = (params.name ?? '').trim() || '未命名筆記'
  return {
    success: true,
    text: `已將筆記改名為「${name}」。`,
    action: { type: 'rename_note', noteId, name },
  }
}

/** delete_note: 刪除成份筆記（成個檔案） */
export async function run_delete_note(
  params: { note_id: string },
  ctx: AgentContext,
  _callGemini: CallGeminiFn
): Promise<ToolResult> {
  const noteId = (params.note_id ?? '').trim()
  if (!noteId) return { success: false, error: '請提供 note_id。' }
  const note = ctx.notes?.find(n => n.id === noteId) ?? (ctx.note?.id === noteId ? ctx.note : null)
  if (!note) return { success: false, error: '搵唔到該筆記。' }
  return {
    success: true,
    text: `已刪除筆記「${note.name}」。`,
    action: { type: 'delete_note', noteId },
  }
}

/** delete_section: 從筆記入面刪除一個或多個 section（唔係刪成份筆記） */
export async function run_delete_section(
  params: { note_id?: string; section_indices: string },
  ctx: AgentContext,
  _callGemini: CallGeminiFn
): Promise<ToolResult> {
  const note = getNote(ctx, params.note_id)
  if (!note) return { success: false, error: '搵唔到筆記。請指定 note_id 或打開要改嘅筆記。' }
  const indicesStr = params.section_indices?.trim()
  if (!indicesStr) return { success: false, error: '請提供 section_indices，例如 "9" 或 "3,5"。' }
  const indices = indicesStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => n >= 1 && n <= note.sections.length)
  if (indices.length === 0) return { success: false, error: `section_indices 必須係 1 到 ${note.sections.length} 嘅有效序號，逗號分隔。` }
  const sectionIds = [...new Set(indices)].map(i => note.sections[i - 1]?.id).filter(Boolean) as string[]
  if (sectionIds.length === 0) return { success: false, error: '無效嘅 section 序號。' }
  return {
    success: true,
    text: `已從筆記「${note.name}」刪除 ${sectionIds.length} 個 section（序號：${indicesStr}）。`,
    action: { type: 'delete_section', noteId: note.id, sectionIds },
  }
}

/** Extract PlantUML source from model output: ensure it has @start... @end... block */
function extractPlantUmlSource(raw: string): string | null {
  const trimmed = raw.trim()
  const startMatch = trimmed.match(/@start(\w+)/i)
  if (!startMatch) return null
  const tag = startMatch[1]
  const startIdx = startMatch.index!
  const endTag = '@end' + tag
  const endIdx = trimmed.toLowerCase().indexOf(endTag.toLowerCase(), startIdx)
  if (endIdx === -1) return null
  const afterEnd = endIdx + endTag.length
  return trimmed.slice(startIdx, afterEnd).trim()
}

/** generate_plantuml_diagram: Generate a PlantUML diagram and add as a new section (separate from LaTeX). */
export async function run_generate_plantuml_diagram(
  params: { diagram_type?: string; description?: string; section_title?: string; target_note_id?: string },
  ctx: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  const diagramType = (params.diagram_type ?? 'sequence').trim().toLowerCase()
  const description = (params.description ?? '').trim()
  if (!description) return { success: false, error: '請提供 description（描述要畫咩圖）。' }

  const prompt = `You are a PlantUML expert. Generate ONLY valid PlantUML source code for a ${diagramType} diagram. User request: ${description}

Rules:
- Output ONLY the diagram code. No markdown, no explanation, no \`\`\` wrapper.
- Start with @startuml and end with @enduml (for mindmap use @startmindmap/@endmindmap, for gantt use @startgantt/@endgantt, for wbs use @startwbs/@endwbs; for all other types use @startuml/@enduml).
- Use clear labels in English or the user's language. Keep the diagram readable and well-structured.
- For "activity" or "flowchart" use PlantUML activity diagram syntax (start, :step;, if/else, stop).
- For "er" or "entity-relationship" use "entity" and "relationship" in class diagram or the ER diagram style.
- For "sequence" use participant, ->, -->, etc.
- For "usecase": Put actor and usecase first so the server recognizes it as use case (not component). Use "actor Name", "usecase \\"Label\\" as ID" or "(Label)". For grouping use "package \\"System\\" { ... }" not "rectangle" (rectangle can be mis-parsed as component). Use "left to right direction" after actor/usecase lines. Links: actor --> (UseCase), (A) -- (B) : label.
- For "class" use class, attributes, methods, relationships.
- For "dot" or "digraph" or "commutative diagram": Use @startuml then the very first line must be digraph Name {. Put ALL nodes and ALL edges INSIDE the single digraph block (before the closing }). Do NOT put any edges or statements after the closing }; the server will reject content outside the braces.
Output the complete PlantUML source now:`

  const raw = await callGemini(prompt, 'Output only the PlantUML code, no other text. Start with @startuml or @startmindmap or @startgantt etc. and end with the matching @end.')
  const source = extractPlantUmlSource(raw)
  if (!source) {
    return { success: false, error: '無法從回覆中提取 PlantUML 代碼。請確保有 @startuml ... @enduml 或對應嘅 @start/@end 區塊。', text: raw.slice(0, 500) }
  }

  const note = getNote(ctx, params.target_note_id)
  if (!note) return { success: true, text: `已生成 PlantUML 圖。\n\n\`\`\`\n${source}\n\`\`\`\n\n（未指定有效筆記，所以未加入 section；請將以上代碼複製到筆記嘅 PlantUML 區塊。）` }

  const sectionTitle = (params.section_title ?? `${diagramType} diagram`).trim() || `${diagramType} diagram`
  const action: ToolResultAction = { type: 'add_section', noteId: note.id, title: sectionTitle, content: source }
  return {
    success: true,
    text: `已生成 ${diagramType} 圖並加入筆記「${note.name}」嘅新 section「${sectionTitle}」。`,
    action,
  }
}

/** create_code_window: 為某個 section 建立一個 code render window（HTML / React）。 */
export async function run_create_code_window(
  params: { note_id?: string; section_index: string; language: 'html' | 'react'; title?: string; instructions: string },
  ctx: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  const note = getNote(ctx, params.note_id)
  if (!note) return { success: false, error: '搵唔到筆記。請指定 note_id 或打開要加 code window 嘅筆記。' }

  // section_index 可以超出範圍；為咗 user 體驗，直接 clamp 去最後一個已存在嘅 section
  const rawIndex = params.section_index?.trim()
  let idx = parseInt(rawIndex || `${note.sections.length || 1}`, 10)
  if (Number.isNaN(idx) || idx < 1) idx = 1
  if (idx > note.sections.length) idx = note.sections.length
  if (note.sections.length === 0) {
    return { success: false, error: '呢份筆記暫時冇任何 section，請先加至少一個章節再建立 code window。' }
  }
  const section = note.sections[idx - 1]
  if (!section) return { success: false, error: '無效嘅 section。' }

  const language = (params.language ?? 'html').trim().toLowerCase() === 'react' ? 'react' : 'html'
  const baseTitle = (params.title ?? '').trim()
  const title =
    baseTitle ||
    (language === 'react' ? `React code window：${section.title}` : `HTML code window：${section.title}`)

  const instructions = (params.instructions ?? '').trim()
  if (!instructions) {
    return { success: false, error: '請提供 instructions（描述要整咩動畫 / mini game / 互動效果）。' }
  }

  const sectionContext = section.content?.trim()
    ? `此 code window 會掛喺以下筆記 section 之下（可以用作示範，唔需要重複文字）：\n\n${section.content}\n\n`
    : ''

  if (language === 'html') {
    const prompt = `你係一個前端工程師，要為學習筆記建立一個 **單一 HTML 檔**，用嚟示範：${instructions}。

要求：
- 請輸出「完整 HTML 檔」，包括 <!doctype html>、<html>、<head>、<body>。
- 可以使用 CSS 和 JavaScript（inline 或 <style>/<script>），亦可以載入少量前端 library（例如 Three.js、GSAP），**但一定要用 <script src="..."></script> CDN 方式**，唔好用 import / require / bundler。
- 例如想用 Three.js，可以：
-   <script src="https://unpkg.com/three@0.161.0/build/three.min.js"></script>
-   然後用全域變數 THREE 建立場景（scene、camera、renderer）。
- 如果你只需要簡單動畫，可以直接用 <svg>、CSS animation、requestAnimationFrame 等。
- 重點係：code 要短小清晰，適合教學示範，唔好引入太多無關內容。
- **只輸出 HTML 代碼本身**，唔好加說明文字、唔好用 markdown、唔好加 \`\`\` 標記。

${sectionContext}請立即輸出完整 HTML 檔：`
    const code = await callGemini(prompt, 'Output ONLY the HTML source code, no markdown, no commentary.')
    const action: ToolResultAction = {
      type: 'upsert_code_window',
      noteId: note.id,
      sectionId: section.id,
      language: 'html',
      title,
      source: code,
    }
    return {
      success: true,
      text: `已根據指示為「${note.name}」第 ${idx} 節建立一個 HTML code window：「${title}」。`,
      action,
    }
  }

  // React / JSX 模式
  const promptReact = `你係一個 React 工程師，要為學習筆記建立一個 **單一 React/JSX 檔**，用嚟示範：${instructions}。

執行環境（已由宿主 HTML 提供）：
- 使用 React 18 UMD 版本（全域變數 React）。
- 使用 ReactDOM 18 UMD 版本（全域變數 ReactDOM），已載入 react-dom/client。
- HTML 入面只有一個 <div id="root"></div> 供你掛載。
- 你的代碼會被放入 <script type="text/babel"> ... </script> 內，由 Babel Standalone 編譯 JSX。

要求：
- 請寫一個或多個 React component（例如 App），然後呼叫：
  const rootEl = document.getElementById("root");
  const root = ReactDOM.createRoot(rootEl);
  root.render(<App />);
- 可以使用 React hook（useState/useEffect 等）。
- 可以用簡單 CSS inline style 或 <style>。
- 重點係：代碼要短小清晰，適合教學示範，唔好引入多餘結構。
- **只輸出 JavaScript/JSX 代碼本身**（包括 ReactDOM.createRoot(...)），唔好加說明文字、唔好用 markdown、唔好加 \`\`\` 標記。

${sectionContext}請立即輸出完整 React/JSX 檔內容：`
  const code = await callGemini(promptReact, 'Output ONLY the React/JSX source code, no markdown, no commentary.')
  const action: ToolResultAction = {
    type: 'upsert_code_window',
    noteId: note.id,
    sectionId: section.id,
    language: 'react',
    title,
    source: code,
  }
  return {
    success: true,
    text: `已根據指示為「${note.name}」第 ${idx} 節建立一個 React code window：「${title}」。`,
    action,
  }
}
