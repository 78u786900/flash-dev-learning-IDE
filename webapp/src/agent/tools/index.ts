import type { AgentContext, ToolResult } from '../types'
import type { CallGeminiFn } from './runGemini'
import { AGENT_TOOL_DEFINITIONS } from './definitions'
import * as noteTools from './noteTools'
import * as pdfTools from './pdfTools'
import * as searchTools from './searchTools'

export { AGENT_TOOL_DEFINITIONS }
export { createCallGemini } from './runGemini'

type ToolParams = Record<string, string | undefined>

type ToolRunner = (params: Record<string, string | undefined>, ctx: AgentContext, callGemini: CallGeminiFn) => Promise<ToolResult>

function run_reply(
  params: { message?: string },
  _ctx: AgentContext,
  _callGemini: CallGeminiFn
): Promise<ToolResult> {
  return Promise.resolve({
    success: true,
    text: params.message?.trim() || '（無回覆）',
  })
}

const RUNNERS: Record<string, ToolRunner> = {
  reply: run_reply as ToolRunner,
  create_note: noteTools.run_create_note as ToolRunner,
  verbal_to_structured: noteTools.run_verbal_to_structured as ToolRunner,
  summarize_section: noteTools.run_summarize_section as ToolRunner,
  expand_section: noteTools.run_expand_section as ToolRunner,
  extract_key_terms: noteTools.run_extract_key_terms as ToolRunner,
  generate_quiz: noteTools.run_generate_quiz as ToolRunner,
  suggest_structure: noteTools.run_suggest_structure as ToolRunner,
  merge_sections: noteTools.run_merge_sections as ToolRunner,
  reorder_sections: noteTools.run_reorder_sections as ToolRunner,
  search_sections: noteTools.run_search_sections as ToolRunner,
  update_section: noteTools.run_update_section as ToolRunner,
  rename_note: noteTools.run_rename_note as ToolRunner,
  delete_note: noteTools.run_delete_note as ToolRunner,
  delete_section: noteTools.run_delete_section as ToolRunner,
  summarize_page: pdfTools.run_summarize_page as ToolRunner,
  page_to_note: pdfTools.run_page_to_note as ToolRunner,
  generate_qa_from_page: pdfTools.run_generate_qa_from_page as ToolRunner,
  extract_definitions: pdfTools.run_extract_definitions as ToolRunner,
  search_workspace: searchTools.run_search_workspace as ToolRunner,
}

export async function executeTool(
  name: string,
  params: ToolParams,
  context: AgentContext,
  callGemini: CallGeminiFn
): Promise<ToolResult> {
  const run = RUNNERS[name]
  if (!run) return { success: false, error: `Unknown tool: ${name}` }
  try {
    return await run(params, context, callGemini)
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    return { success: false, error: err }
  }
}
