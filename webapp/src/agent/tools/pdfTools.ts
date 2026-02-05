import type { AgentContext, ToolResult, ToolResultAction } from '../types'
import type { CallGeminiFn } from './runGemini'

function getNoteId(ctx: AgentContext): string | null {
  // Prefer the note that was just created in this agent run (create_note tool),
  // so follow-up tools like page_to_note attach sections to the intended note
  // even if the model forgets to pass target_note_id explicitly.
  if (ctx.lastCreatedNote?.id) return ctx.lastCreatedNote.id
  return ctx.note?.id ?? null
}

/** summarize_page: page text can be fetched on demand when page_number is given and PDF is open. */
export async function run_summarize_page(
  params: { page_text?: string; page_number?: string },
  ctx: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  let pageText = params.page_text?.trim() || (params.page_number && ctx.pdfPageTexts?.[Number(params.page_number)])
  if (!pageText && params.page_number && ctx.file?.url && ctx.file.name?.toLowerCase().endsWith('.pdf') && ctx.getPdfPageTextOnDemand) {
    try {
      pageText = await ctx.getPdfPageTextOnDemand(ctx.file.url, Number(params.page_number))
    } catch {
      // fall through
    }
  }
  if (!pageText?.trim()) return { success: false, error: '無法取得該頁文字。請喺左邊揀要處理嘅 PDF 再試。' }
  const pageLabel = params.page_number ? `（第 ${params.page_number} 頁）` : ''
  const prompt = `總結以下 PDF 頁面${pageLabel}嘅內容，用 2–4 句話概括要點。用繁體中文。若有附圖（例如交換圖、幾何圖），請一併考慮圖中資訊。\n\n${pageText}`

  let images: string[] | undefined
  let imageAttached = false
  if (params.page_number && ctx.file?.url && ctx.file.name?.toLowerCase().endsWith('.pdf') && ctx.getPdfPageImageOnDemand) {
    try {
      const img = await ctx.getPdfPageImageOnDemand(ctx.file.url, Number(params.page_number))
      if (img) {
        images = [img]
        imageAttached = true
      }
    } catch {
      // ignore image errors; still summarize文字
    }
  }

  const text = await callGemini(prompt, undefined, images)
  const imageInfo = imageAttached
    ? '【Image】已成功附上該頁截圖（包含可能嘅圖像／交換圖）。'
    : '【Image】未能附上該頁截圖（可能無啟用圖片擷取或頁面載入失敗），以下內容純文字分析。'
  return { success: true, text: `${imageInfo}\n\n${text}` }
}

/** page_to_note: 將一頁轉成筆記 section. Page text is fetched on demand from the current PDF when page_number is given. */
export async function run_page_to_note(
  params: { page_text?: string; page_number?: string; suggested_title?: string; target_note_id?: string },
  ctx: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  // Validate page_number range if totalPdfPages is known
  if (params.page_number) {
    const pageNum = Number(params.page_number)
    if (Number.isNaN(pageNum) || pageNum < 1) {
      return { success: false, error: `無效嘅頁碼：${params.page_number}。頁碼必須係正整數。` }
    }
    if (ctx.totalPdfPages && pageNum > ctx.totalPdfPages) {
      return { success: false, error: `頁碼 ${pageNum} 超出 PDF 總頁數（${ctx.totalPdfPages}）。請檢查頁碼範圍。` }
    }
  }
  let pageText =
    (params.page_text?.trim() && params.page_text) ||
    (params.page_number && ctx.pdfPageTexts?.[Number(params.page_number)])
  if (!pageText?.trim() && params.page_number) {
    if (!ctx.file?.url || !ctx.file.name?.toLowerCase().endsWith('.pdf'))
      return { success: false, error: '無法取得該頁文字：而家 context 入面冇 PDF 檔案。請確保發送訊息之前已經喺左邊揀咗要轉嘅 PDF 並打開緊。' }
    if (!ctx.getPdfPageTextOnDemand)
      return { success: false, error: '無法取得該頁文字：on-demand 擷取未設定。' }
    try {
      pageText = await ctx.getPdfPageTextOnDemand(ctx.file.url, Number(params.page_number))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, error: `無法取得該頁文字：${msg}` }
    }
  }
  if (!pageText?.trim()) {
    return { success: false, error: '無法取得該頁文字（該頁可能冇文字或係圖）。請喺左邊揀要處理嘅 PDF 再試。' }
  }
  const noteId = params.target_note_id?.trim() || getNoteId(ctx)
  const titleHint = params.suggested_title ? `建議標題：${params.suggested_title}` : `根據內容起一個簡短章節標題（可包含「第 X 頁」）`
  const styleHint = /emoji|中四|grade\s*10|廣東話|cantonese/i.test(params.suggested_title ?? '')
    ? ' 用廣東話寫，加適量 emoji，用詞啱中四學生。'
    : ' 用繁體中文。'
  const prompt = `將以下 PDF 頁面內容整理成筆記 section（如有附圖，例如交換圖、示意圖，請一併解讀，必要時以文字描述圖中結構）。
${titleHint}
規則：
- 只可用這些 LaTeX 指令：\\section{...}、\\textbf{...}、\\textit{...}、\\texttt{...}、\\begin{itemize}\\item ...\\end{itemize}、\\begin{enumerate}\\item ...\\end{enumerate}、$...$、$$...$$。唔好用任何其它 \\ 指令（例如唔好發明 \\tovthfs 等）。
- 可讀性空格：} 後面若接中英文字母要加一個空格，例如 \\textbf{群論} 是對（唔好 \\textbf{群論}是對）。$...$ 前後若係文字要加空格。
- 第一行只輸出 \\section{...} 標題，之後空一行，再輸出段落。唔好用 markdown（唔好 ** 或 ##）。若原文有亂碼或錯字，用正確用字。${styleHint}\n\n${pageText}`

  let images: string[] | undefined
  let imageAttached = false
  if (params.page_number && ctx.file?.url && ctx.file.name?.toLowerCase().endsWith('.pdf') && ctx.getPdfPageImageOnDemand) {
    try {
      const img = await ctx.getPdfPageImageOnDemand(ctx.file.url, Number(params.page_number))
      if (img) {
        images = [img]
        imageAttached = true
      }
    } catch {
      // ignore; still可純文字
    }
  }

  const out = await callGemini(
    prompt,
    'Output only allowed LaTeX: \\section, \\textbf, \\textit, \\texttt, \\begin{itemize}\\item, $...$, $$...$$. Add space after } before next word. No markdown. No invented \\commands. Traditional Chinese. If image is provided, use it（例如交換圖、箭頭圖）去補充文字內容，必要時以文字描述圖中結構。',
    images
  )
  const lines = out.split('\n').map(l => l.trim()).filter(Boolean)
  const firstLine = lines[0] ?? ''
  const sectionMatch = firstLine.match(/\\section\s*\{([^}]*)\}/)
  const title = sectionMatch ? sectionMatch[1].trim() : (firstLine || (params.page_number ? `第 ${params.page_number} 頁` : '新章節'))
  const content = (sectionMatch ? lines.slice(1) : lines.slice(1)).join('\n').trim() || pageText
  const imageInfo = imageAttached
    ? '【Image】已成功附上該頁截圖（包含可能嘅圖像／交換圖），並已用作整理筆記。'
    : '【Image】未能附上該頁截圖（可能無啟用圖片擷取或頁面載入失敗），本節只根據文字整理。'
  const action: ToolResultAction | undefined = noteId
    ? { type: 'add_section', noteId, title, content }
    : undefined
  return { success: true, text: `${imageInfo}\n\n已轉成筆記：**${title}**\n\n${content}`, action }
}

/** generate_qa_from_page: page text on demand when page_number given and PDF open. */
export async function run_generate_qa_from_page(
  params: { page_text?: string; page_number?: string; num_questions?: string },
  ctx: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  let pageText = params.page_text?.trim() || (params.page_number && ctx.pdfPageTexts?.[Number(params.page_number)])
  if (!pageText && params.page_number && ctx.file?.url && ctx.file.name?.toLowerCase().endsWith('.pdf') && ctx.getPdfPageTextOnDemand) {
    try {
      pageText = await ctx.getPdfPageTextOnDemand(ctx.file.url, Number(params.page_number))
    } catch {
      // fall through
    }
  }
  if (!pageText?.trim()) return { success: false, error: '無法取得該頁文字。請喺左邊揀要處理嘅 PDF 再試。' }
  const n = params.num_questions ? parseInt(params.num_questions, 10) : 2
  const prompt = `根據以下頁面內容出 ${n} 條問答題（問答形式，要有答案）。用繁體中文。\n\n${pageText}`
  const text = await callGemini(prompt)
  return { success: true, text }
}

/** extract_definitions */
export async function run_extract_definitions(
  params: { text: string },
  _ctx: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  const prompt = `從以下文字中抽出定義、公式或要點列表。每項簡短標明。用繁體中文。\n\n${params.text}`
  const text = await callGemini(prompt)
  return { success: true, text }
}
