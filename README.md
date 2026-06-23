# Claude Skills

Personal collection of [Claude Code](https://claude.com/claude-code) skills, synced across workstations.

## Install

Clone into `~/.claude/skills/` on each machine:

```bash
git clone https://github.com/petermanrique101-sys/Skills.git ~/.claude/skills
```

Claude Code auto-discovers any directory under `~/.claude/skills/` that contains a `SKILL.md` with the right frontmatter.

## Updating across machines

```bash
cd ~/.claude/skills && git pull
```

When editing a skill on one machine:

```bash
cd ~/.claude/skills
git add <skill>/SKILL.md
git commit -m "<skill>: <what changed>"
git push
```

## Skills in this repo

| Skill | Purpose |
| --- | --- |
| `app-build` | Stand up a new app from idea to shipped, spec-first, with a coding agent doing the implementation. |
| `blast-radius` | Change-impact preflight before editing a shared default/enum/config/policy — finds every consumer, flags cross-concern collateral, forces test triage. SAFE / REVIEW / COUPLED. |
| `canonical-check` | Preflight gate before building or modifying any subsystem — locate the canonical module and force EXTEND / ADAPTER / NEW verdict. |
| `docs-sync` | Autopilot that makes docs match code — gated team of agents audits every doc, adversarially verifies each defect before rewriting, generates the missing, deletes the dead. |
| `find-duplicate-systems` | Multi-agent sweep for parallel implementations of the same subsystem. One source of truth audit. |
| `grill-me` | Interview-style stress test of a plan or design until shared understanding. |
| `refactor-godfiles` | Auto-pilot splitting of files over 400 LOC in batches of 3 with per-batch test gate. |
| `senior-engineer` | Default methodology for non-trivial coding work — root-cause fixes, precise scope, production quality. |
| `vibe-code` | "Vibe code in prod responsibly" — act as PM for the model on larger features with verifiability built in. |

## Skill format

Each skill is a directory containing a `SKILL.md` with YAML frontmatter:

```yaml
---
name: skill-name
description: One-line description ending with when to use it.
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Bash
---

# Skill body in Markdown
```

See the [official skill docs](https://docs.claude.com/en/docs/claude-code/skills) for the full schema.

## Notes on portability

Some skills in this repo reference paths or precedent commits from specific projects (e.g., `refactor-godfiles` cites past splits, `find-duplicate-systems` lists subsystem anchors). Those anchors are illustrative — the methodology in each skill is generic and will adapt to whatever repo you invoke it in. If a skill becomes too project-specific, fork it into that project's local `.claude/skills/` instead.
