import type { GeminiFunctionDeclaration } from '../types'

/** All agent tool definitions for Gemini function calling */
export const AGENT_TOOL_DEFINITIONS: GeminiFunctionDeclaration[] = [
  // —— Reply-only (for agent mode when user just greets / no action needed) ——
  {
    name: 'reply',
    description: 'Send a text reply to the user when no other tool is needed (e.g. greeting, meta question, or brief answer). Use this when the user says hello, thanks, or asks something that does not need a note/PDF tool.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The reply text to show the user (e.g. 你好！有咩可以幫到你？)' },
      },
      required: ['message'],
    },
  },
  // —— Note tools ——
  {
    name: 'create_note',
    description: '建立一個新筆記（新標題）。用於「將呢章變成新筆記」「create a new note」等。建立後請用 target_note_id 喺後續 page_to_note 將 section 加去呢個新筆記。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '新筆記嘅名稱（例如：第一章總結（中四））' },
      },
      required: ['name'],
    },
  },
  {
    name: 'verbal_to_structured',
    description: '將用戶貼上嘅口語或零散文字整理成結構化筆記（標題 + 段落）。用於「將呢段整理成筆記」之類嘅請求。筆記必須全 LaTeX：只可用 \\section{...}、\\textbf{...}、\\textit{...}、\\texttt{...}、\\begin{itemize}\\item ...\\end{itemize}、$...$、$$...$$；唔好用其他 \\ 指令。} 後面若接字母或中文要加空格（例如 \\textbf{群論} 是對）。唔好用 markdown（唔好 ** 或 ##）。',
    parameters: {
      type: 'object',
      properties: {
        raw_text: { type: 'string', description: '用戶貼上嘅原始文字（口語或亂 notes）' },
        suggested_title: { type: 'string', description: '建議嘅章節標題（可選）' },
      },
      required: ['raw_text'],
    },
  },
  {
    name: 'summarize_section',
    description: '總結某一個筆記 section 嘅內容。用於「總結第二章」之類嘅請求。',
    parameters: {
      type: 'object',
      properties: {
        section_index: { type: 'string', description: 'Section 序號（從 1 開始）或 section 標題' },
        content: { type: 'string', description: '該 section 嘅完整內容' },
      },
      required: ['section_index', 'content'],
    },
  },
  {
    name: 'expand_section',
    description: '擴寫某個 section，加例子或解釋。用於「將呢段擴寫成 200 字」之類嘅請求。',
    parameters: {
      type: 'object',
      properties: {
        section_index: { type: 'string', description: 'Section 序號或標題' },
        content: { type: 'string', description: '該 section 嘅現有內容' },
        target_length: { type: 'string', description: '目標字數或「加例子」「加解釋」等指示' },
      },
      required: ['content'],
    },
  },
  {
    name: 'extract_key_terms',
    description: '從筆記內容抽出關鍵詞、定義或重點。用於「列出呢章嘅關鍵詞」之類嘅請求。',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '要分析嘅筆記內容（可係一個或多個 section）' },
        format: { type: 'string', description: '輸出格式：list | definitions | both', enum: ['list', 'definitions', 'both'] },
      },
      required: ['content'],
    },
  },
  {
    name: 'generate_quiz',
    description: '根據筆記內容生成測驗題（選擇題或短答題）。用於「根據呢章出 3 條題」之類嘅請求。',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '筆記內容' },
        num_questions: { type: 'string', description: '題數，例如 3' },
        question_type: { type: 'string', description: '題型：mcq | short | both', enum: ['mcq', 'short', 'both'] },
      },
      required: ['content'],
    },
  },
  {
    name: 'suggest_structure',
    description: '建議筆記嘅章節結構（重新分節、加標題）。用於「幫我重新分節」之類嘅請求。',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '現有筆記全文或相關 section' },
      },
      required: ['content'],
    },
  },
  {
    name: 'merge_sections',
    description: '合併多個 section 成一個。用於「合併 2.1 同 2.2」之類嘅請求。',
    parameters: {
      type: 'object',
      properties: {
        section_indices: { type: 'string', description: '要合併嘅 section 序號或標題，逗號分隔，例如 "2.1, 2.2"' },
        contents: { type: 'string', description: '各 section 嘅內容（按序合併成一段文字）' },
        new_title: { type: 'string', description: '合併後嘅新標題' },
      },
      required: ['section_indices', 'contents', 'new_title'],
    },
  },
  {
    name: 'reorder_sections',
    description: '改變同一筆記內 section 嘅順序。用於「將第三章移去最前」「調換 2 同 3 節」等。傳 section_order：由 1 開始嘅新順序，逗號分隔，例如 "3,1,2" 表示原本第 3 節變第 1、第 1 變第 2、第 2 變第 3。',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'string', description: '筆記 id（context 有 Note: "..." (id) 或唔傳用當前筆記）' },
        section_order: { type: 'string', description: '新順序：section 序號（1-based）逗號分隔，例如 "3,1,2,4"' },
      },
      required: ['section_order'],
    },
  },
  {
    name: 'search_sections',
    description: '用關鍵字或語意搜尋筆記內嘅 section。用於「搵講群論嘅 section」「邊節有提到 automorphism」等。回傳符合嘅 section 序號同標題。',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'string', description: '筆記 id（唔傳則搜當前筆記）' },
        query: { type: 'string', description: '搜尋關鍵字或短句' },
      },
      required: ['query'],
    },
  },
  {
    name: 'update_section',
    description: '直接修改某一個 section 嘅標題或內容。用於「將第二章標題改成 XXX」「改寫第 3 節內容」等。可只改 title、只改 content、或兩樣都改。內容必須全 LaTeX：只可用 \\section{...}、\\textbf{...}、\\textit{...}、\\texttt{...}、\\begin{itemize}\\item ...\\end{itemize}、$...$、$$...$$；} 後接字要加空格；唔好用 markdown 或其它 \\ 指令。',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'string', description: '筆記 id（唔傳用當前筆記）' },
        section_index: { type: 'string', description: 'Section 序號（1-based），例如 "2" 即第二節' },
        title: { type: 'string', description: '新標題（可選）' },
        content: { type: 'string', description: '新內容（可選）' },
      },
      required: ['section_index'],
    },
  },
  {
    name: 'rename_note',
    description: '改筆記檔案嘅名稱。用於「將呢份筆記改名做 XXX」。',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'string', description: '要改名嘅筆記 id' },
        name: { type: 'string', description: '新名稱' },
      },
      required: ['note_id', 'name'],
    },
  },
  {
    name: 'delete_note',
    description: '刪除**成份**筆記檔案（成個 note 會消失）。只用於用戶明確話「刪咗呢份筆記」「delete this note file」。若用戶話「delete page 9 sections」「刪除第9頁嘅 section」係指刪除筆記入面某幾個 section，要用 delete_section，唔好用 delete_note。',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'string', description: '要刪除嘅筆記 id' },
      },
      required: ['note_id'],
    },
  },
  {
    name: 'delete_section',
    description: '從筆記入面刪除一個或多個 section（唔係刪成份筆記）。用於「delete the page 9 sections」「刪除第9頁嘅 section」「remove section 3 and 5」。section_indices 係 1-based、逗號分隔，例如 "9" 或 "3,5,9"。先可用 search_sections 搵「第9頁」對應嘅 section 序號。',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'string', description: '筆記 id（唔傳用當前筆記）' },
        section_indices: { type: 'string', description: '要刪除嘅 section 序號，逗號分隔，1-based，例如 "9" 或 "3,5"' },
      },
      required: ['section_indices'],
    },
  },
  // —— PDF tools ——
  {
    name: 'summarize_page',
    description: '總結當前 PDF 頁嘅內容。傳 page_number 即可，頁面文字會即時從已打開嘅 PDF 擷取（無需預載）。',
    parameters: {
      type: 'object',
      properties: {
        page_text: { type: 'string', description: '該頁文字（可選；若有 page_number 會自動擷取）' },
        page_number: { type: 'string', description: '頁碼（1-based），有需要時會直接從 PDF 擷取該頁文字' },
      },
      required: [],
    },
  },
  {
    name: 'page_to_note',
    description: '將一頁 PDF 轉成筆記 section（標題 + 結構化內容）。用於「呢頁變成筆記」「first 10 pages of chapter」等。可傳 page_number 配 context 嘅 Page 1/2/... 文字，或直接傳 page_text。若用戶要「新筆記」，先 call create_note 再喺每次 page_to_note 傳 target_note_id。筆記必須全 LaTeX：只可用 \\section{...}、\\textbf{...}、\\textit{...}、\\texttt{...}、\\begin{itemize}\\item ...\\end{itemize}、$...$、$$...$$；} 後接字要加空格；唔好用 markdown 或其它 \\ 指令。若原文有亂碼，用正確用字。',
    parameters: {
      type: 'object',
      properties: {
        page_text: { type: 'string', description: '該頁嘅文字（可從 context 嘅 Page N 複製）' },
        page_number: { type: 'string', description: '頁碼（1-based），若 context 有 PDF page texts 可只傳此參數' },
        suggested_title: { type: 'string', description: '建議嘅 section 標題' },
        target_note_id: { type: 'string', description: '要加 section 嘅筆記 id（create_note 回傳嘅 id）；唔傳則加去 context 嘅當前筆記' },
      },
      required: [],
    },
  },
  {
    name: 'generate_qa_from_page',
    description: '根據 PDF 一頁內容出問答題。傳 page_number 即可，頁面文字會即時從已打開嘅 PDF 擷取。',
    parameters: {
      type: 'object',
      properties: {
        page_text: { type: 'string', description: '頁面文字（可選；若有 page_number 會自動擷取）' },
        page_number: { type: 'string', description: '頁碼（1-based）' },
        num_questions: { type: 'string', description: '題數' },
      },
      required: [],
    },
  },
  {
    name: 'extract_definitions',
    description: '從文字中抽出定義、公式或列表。用於「列出呢頁嘅定義」。',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要分析嘅文字（頁或選取）' },
      },
      required: ['text'],
    },
  },
  // —— Workspace search (whole file system as search engine) ——
  {
    name: 'search_workspace',
    description: 'Keyword or semantic (語意) search over the whole workspace: full text of every note section, every PDF page (when loaded), and file names. Returns the MOST RELEVANT hits with position (section §N, page N, file) and source. Use for "搵邊度有講 XXX", "用語意搵同 YYY 有關嘅內容". mode=keyword: exact word match; mode=semantic: meaning-based (embeddings). Multiple searches allowed; use results (note_id, file_id, position) as next input.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query: keywords or short phrase (keyword mode) or natural language (semantic mode)' },
        mode: {
          type: 'string',
          description: 'Optional. keyword (default)=exact word match; semantic=語意搜尋 (meaning-based, uses embeddings). Use semantic when user asks for "意思相近" or "相關內容".',
        },
        scope: {
          type: 'string',
          description: 'Optional. all=notes+files (default); notes=only note text; files=only file names + PDF page text; note_ids:id1,id2 or file_ids:id1,id2 to limit.',
        },
        max_results: { type: 'string', description: 'Optional. Max hits to return, e.g. "20" (default 30)' },
      },
      required: ['query'],
    },
  },
  // —— PlantUML diagrams (separate from LaTeX; for use case, sequence, ER, flowchart, etc.) ——
  {
    name: 'generate_plantuml_diagram',
    description: 'Generate a PlantUML diagram and add it to the current note. Use ONLY for: use case, sequence, class, activity/flowchart, state, ER/entity-relationship, component, deployment, Gantt, mind map, WBS, user journey, etc. Do NOT use for commutative diagrams or abstract-algebra diagrams (exact sequences, morphisms, category theory, pullbacks) – those must use LaTeX \\begin{CD}...\\end{CD} in note content via verbal_to_structured or update_section. Do NOT use for LaTeX math formulas.',
    parameters: {
      type: 'object',
      properties: {
        diagram_type: {
          type: 'string',
          description: 'Type of diagram: sequence, usecase, class, activity, state, component, deployment, object, timing, er, mindmap, gantt, wbs, chronology, salt (wireframe), nwdiag (network), or other',
        },
        description: {
          type: 'string',
          description: 'What the diagram should show (e.g. "User logs in, then sees dashboard; admin can delete users")',
        },
        section_title: {
          type: 'string',
          description: 'Title for the new note section (e.g. "Login use case diagram")',
        },
        target_note_id: {
          type: 'string',
          description: 'Note id to add the section to; omit to use current note',
        },
      },
      required: ['diagram_type', 'description'],
    },
  },
]
