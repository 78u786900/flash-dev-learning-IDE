/**
 * Skill Metadata - 技能註冊資料
 */

export type MacroCategory = 'READ_FILES' | 'EDIT_FILES' | 'EDIT_NOTES'

export interface SkillInputContract {
  requiresSelection: boolean
  acceptedFileTypes?: string[]  // ['pdf', 'docx', 'image']
  acceptedNoteTypes?: string[]  // ['section', 'full-note']
  requiredFields?: string[]     // ['text', 'bbox', 'timeRange']
}

export interface SkillOutputContract {
  mustInclude: string[]  // ['file_id', 'location', 'quote', 'confidence']
  format: 'text' | 'json' | 'overlay' | 'version' | 'mixed'
}

export interface SkillMetadata {
  name: string
  macro: MacroCategory
  description: string
  triggers: string[]  // keywords that trigger this skill
  inputContract: SkillInputContract
  outputContract: SkillOutputContract
  estimatedTokens: number
  priority: number  // for ranking when multiple skills match
  version: string
  enabled: boolean
}

export interface SkillRegistry {
  version: string
  updatedAt: number
  skills: SkillMetadata[]
}

// Helper: 搵符合 triggers 嘅 skills
export function matchSkillsByTriggers(
  registry: SkillRegistry,
  userMessage: string,
  topK: number = 3
): SkillMetadata[] {
  const message = userMessage.toLowerCase()
  
  const scored = registry.skills
    .filter(s => s.enabled)
    .map(skill => {
      let score = 0
      for (const trigger of skill.triggers) {
        if (message.includes(trigger.toLowerCase())) {
          score += 1
        }
      }
      return { skill, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.skill.priority - a.skill.priority
    })
  
  return scored.slice(0, topK).map(item => item.skill)
}
