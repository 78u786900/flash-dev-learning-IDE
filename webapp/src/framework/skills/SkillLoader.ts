/**
 * SkillLoader – Progressive disclosure for Agent Skills (Claude-style).
 * Level 1: Registry metadata only (~100 tokens per skill).
 * Level 2: Full SKILL.md when a skill is triggered.
 */

import type { SkillRegistry, SkillMetadata } from '../models/Skill'

import registryData from './registry.json'

const registry = registryData as SkillRegistry

/** All SKILL.md under this directory; keys are e.g. "./READ_FILES/detect-filetype-and-indexing/SKILL.md" */
const skillFileModules = import.meta.glob<string>('./**/SKILL.md', { query: '?raw', import: 'default' })

/** Map skill name -> loader that returns SKILL.md content */
const nameToLoader = ((): Record<string, () => Promise<string>> => {
  const map: Record<string, () => Promise<string>> = {}
  for (const key of Object.keys(skillFileModules)) {
    const match = key.match(/\.\/(?:READ_FILES|EDIT_FILES|EDIT_NOTES)\/([^/]+)\/SKILL\.md$/)
    if (match) map[match[1]] = skillFileModules[key] as () => Promise<string>
  }
  return map
})()

/**
 * Get the full registry (Level 1 – metadata only).
 */
export function getRegistry(): SkillRegistry {
  return registry
}

/**
 * Build a short "available skills" summary for the system prompt (Claude-style Level 1).
 * One line per skill: "Skill: <name> – <description> Use when: <triggers>."
 */
export function getRegistrySummary(maxSkills: number = 30): string {
  const lines = registry.skills
    .filter((s) => s.enabled)
    .slice(0, maxSkills)
    .map(
      (s) =>
        `Skill: ${s.name} – ${s.description} Use when: ${(s.triggers || []).slice(0, 5).join(', ')}.`
    )
  return lines.join('\n')
}

/**
 * Get metadata for a skill by name.
 */
export function getSkillMetadata(name: string): SkillMetadata | undefined {
  return registry.skills.find((s) => s.name === name)
}

/**
 * Load full SKILL.md content for a skill (Level 2 – when triggered).
 * Returns the raw Markdown string or undefined if not found.
 */
export async function getSkillMarkdown(name: string): Promise<string | undefined> {
  const loader = nameToLoader[name]
  if (!loader) return undefined
  try {
    return await loader()
  } catch {
    return undefined
  }
}

/**
 * Check if a skill has loadable SKILL.md.
 */
export function hasSkillMarkdown(name: string): boolean {
  return name in nameToLoader
}
