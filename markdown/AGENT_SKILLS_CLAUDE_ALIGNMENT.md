# Claude Agent Skills vs Learning IDE Framework – Alignment & Improvements

## 1. What is Claude’s latest “Agent Skills” idea?

### 1.1 Definition (Anthropic / agentskills.io)

- **Agent Skills** are **folders** of instructions, scripts, and resources that an agent **discovers and loads when relevant**.
- They are **model-invoked**: the agent scans available skills and loads them on demand (no manual slash commands or fixed tool lists).
- **Open standard**: [agentskills.io](https://skill.md/) / [Agent Skills on GitHub](https://github.com/agentskills/agentskills); same format across Claude apps, Claude Code, and API.

### 1.2 How it works in an agentic framework

| Aspect | Claude Agent Skills |
|--------|----------------------|
| **Discovery** | Agent gets **metadata only** at startup (~100 tokens per skill): `name` + `description` (YAML frontmatter). |
| **Trigger** | When the user request matches a skill’s description, the agent **loads that skill’s full instructions** (e.g. reads `SKILL.md` from the filesystem). |
| **Progressive disclosure** | **Level 1**: Metadata always in system prompt. **Level 2**: Full `SKILL.md` only when skill is triggered. **Level 3**: Extra files (refs, scripts) loaded or **executed** only when needed; script **output** goes to context, not the script code. |
| **Execution** | Skills run in a **VM/code execution** environment. Agent uses bash to read files and run scripts; only script **output** consumes context. |
| **Structure** | Each skill is a **directory** with `SKILL.md` (required), optional `refs/`, `scripts/`, resources. `SKILL.md` has **YAML frontmatter** (`name`, `description`) + Markdown body. |

### 1.3 Why it works well

- **Efficient**: Many skills can be “installed” with low context cost; only the chosen skill’s instructions (and later, only needed refs/scripts) are loaded.
- **Composable**: Multiple skills can be combined; the agent picks which ones are relevant.
- **Portable**: Same folder format across products; build once, reuse.
- **Deterministic-friendly**: Scripts do fixed operations; the model orchestrates and uses their output instead of generating all logic in tokens.

---

## 2. Current project framework (Learning IDE)

### 2.1 What we have

| Component | Current state |
|-----------|----------------|
| **Macro layer** | READ_FILES, EDIT_FILES, EDIT_NOTES (conceptual; not yet a router that selects macro first). |
| **Micro skills** | 19 skills under `framework/skills/<macro>/<skill-name>/` with `SKILL.md`, `refs/`, `scripts/`. |
| **Registry** | `registry.json` with metadata: name, macro, description, triggers, inputContract, outputContract, estimatedTokens, priority, version, enabled. |
| **Agent** | Gemini + function-calling tools (e.g. page_to_note, summarize_page). **No** runtime loading of `SKILL.md`; system prompt is fixed. |
| **Progressive disclosure** | Registry exists but is **not** injected into the agent as “available skills”. Full `SKILL.md` is never loaded into the conversation. |
| **Scripts** | `scripts/*.ts` exist for deterministic helpers; they are **not** invoked by the agent in a “run script, get output only” way. |

### 2.2 Gaps vs Claude-style Agent Skills

1. **No YAML frontmatter in SKILL.md**  
   Claude/open standard use `name` and `description` in YAML at the top for discovery. Our skills have no frontmatter; discovery is from `registry.json` only.

2. **Registry not used for discovery in the agent**  
   The model does not see “available skills: name + description”. So it cannot “scan and match” like Claude; it only sees Gemini tool definitions and a fixed system prompt.

3. **No progressive loading of SKILL.md**  
   When a skill is chosen (by intent or router), we don’t load that skill’s `SKILL.md` into the context. So the model never gets the full workflow/instructions for that skill.

4. **Scripts are code, not “run and pass output”**  
   We have scripts in the repo, but the agent doesn’t “execute script, get output, add to context”. Logic is duplicated in agent tools (e.g. pdfTools) rather than calling framework scripts and using their output.

5. **No explicit “skill selection” step**  
   We have `wantsFirstPageToNote()` and tool-calling, but no general “match user intent → select skill(s) from registry → load SKILL.md” pipeline.

---

## 3. Recommended adjustments and improvements

### 3.1 Align with open standard (SKILL.md + YAML)

- **Add YAML frontmatter** to each `SKILL.md`:
  - Required: `name` (match folder name), `description` (what it does + when to use; can mirror registry).
  - Optional: `version`, `license`, `metadata`, `compatibility`.
- **Keep** the existing Markdown body (Purpose, When to Use, Workflow, etc.).
- **Benefit**: Skills become parseable for metadata-only loading and compatible with tools/specs that expect the agentskills.io format.

### 3.2 Progressive disclosure (metadata → full SKILL.md)

- **Level 1 – Always**: Build a short “available skills” text from `registry.json` (e.g. “Skill: detect-filetype-and-indexing – Detect file type, extract structure… Use when: index, analyze file…”). Inject this into the **system prompt** (or a dedicated context block) so the model knows what skills exist and when they apply.
- **Level 2 – When triggered**: When the router or intent matcher selects a skill (e.g. “first page to note” → page_to_note, or “search in files” → semantic-search-in-files), **load that skill’s SKILL.md** (full text) and append it to the **next user or system message** (e.g. “Use the following skill instructions: …”). So the model gets full instructions only for the chosen skill.
- **Level 3 – As needed**: For skills that have `refs/` or `scripts/`, load refs when the workflow references them; for scripts, either call them in the app and pass output to the model, or document “agent should request script output” and implement a tool that runs a script by name and returns output.

Implement a **SkillLoader** (or equivalent) that:
- Reads `registry.json` and returns a list of metadata entries (for Level 1).
- Given a skill name, reads the corresponding `SKILL.md` from the filesystem (or bundled path) and returns its content (for Level 2).

### 3.3 Intent → skill selection (router)

- Use **registry.triggers** (and optionally macro) to score user message vs each skill; pick top-K skills.
- If exactly one high-confidence match, **auto-load that skill’s SKILL.md** (Level 2) and optionally **auto-execute** (like current “first page to note”) when conditions are met.
- Keep **macro** (READ_FILES / EDIT_FILES / EDIT_NOTES) as a first-step filter if desired, then select among micro-skills under that macro.

### 3.4 Scripts as “run and pass output”

- Prefer **deterministic scripts** in `scripts/` for parsing, extraction, conversion; the agent (or backend) **runs** the script and only the **output** is sent to the model.
- Reduces context and increases reliability. Optionally add a tool “run_skill_script” with params `skillName`, `scriptName`, `args`, returning stdout/result.

### 3.5 Single source of truth for “when to use”

- **Registry** and **SKILL.md YAML `description`** should stay in sync (same “when to use” idea). Consider generating one from the other or validating that they match (e.g. in CI or a small script).

---

## 4. Implementation checklist (concise)

| # | Item | Status / Note |
|---|------|----------------|
| 1 | Add YAML frontmatter to all SKILL.md (name, description) | **Done** for `detect-filetype-and-indexing`; use as template for the rest. |
| 2 | SkillLoader: load registry (metadata only) | **Done** – `webapp/src/framework/skills/SkillLoader.ts`: `getRegistry()`, `getRegistrySummary()`. |
| 3 | SkillLoader: load full SKILL.md by skill name | **Done** – `getSkillMarkdown(name)`, `hasSkillMarkdown(name)`. |
| 4 | Inject “available skills” (name + description) into agent system prompt | **Optional** – call `getRegistrySummary()` and append to system prompt so the model sees Level 1 discovery. |
| 5 | On intent match, load chosen skill’s SKILL.md into next turn | **Next** – in `geminiWithTools` or router: when a skill is selected (e.g. via `matchSkillsByTriggers`), call `getSkillMarkdown(selectedSkill.name)` and inject into the next message. |
| 6 | Use triggers from registry for intent → skill selection | **Done** – `Skill.ts` has `matchSkillsByTriggers`; wire it to SkillLoader and agent. |
| 7 | Script execution: run script by name, return output to model | **Future** – add tool or backend endpoint. |

### 4.1 How to wire SkillLoader into the agent (optional)

- **Level 1 (discovery)**: In `geminiWithTools.ts`, before building the system prompt, call `getRegistrySummary()` and append e.g. `\n\n[Available skills]\n${getRegistrySummary()}` so the model knows what skills exist and when to use them.
- **Level 2 (full instructions)**: When the router or intent matcher selects a skill (e.g. `matchSkillsByTriggers(registry, userMessage)[0]`), call `await getSkillMarkdown(skill.name)` and prepend to the user message or add a system segment: `Use the following skill instructions:\n${markdown}`.

---

## 5. References

- [Anthropic – Agent Skills overview](https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview)
- [Claude blog – Introducing Agent Skills](https://www.claude.com/blog/skills)
- [Agent Skills open standard – skill.md / agentskills.io](https://skill.md/)
- [Agent Skills specification (YAML frontmatter)](https://agentskills.io/specification)
- Project: `webapp/src/framework/skills/`, `AGENT_FRAMEWORK_EXECUTION_PLAN.md`
