---
name: new-project
description: Set up a repo so AI agents (and people) can navigate it fast and change it without whack-a-mole — rules file (AGENTS.md), architecture map, a generated codebase map the build keeps fresh, a 450-line file ceiling, module seal tests, single-declaration registries with completeness tests, a doc-path checker, ADRs, and a history folder. Use when the user invokes /new-project, starts a new project/repo/app/service, asks to "set up the repo structure", "make the codebase easier for AI to navigate", "stop breaking things when we change stuff", or wants to bring an EXISTING repo up to this standard (retrofit mode — audit and report first). Also use before /app-build or /grand-daddy-green scaffolding so the structure exists from commit one.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - PowerShell
  - Agent
  - AskUserQuestion
---

# /new-project — Structure a repo so agents can find their way and can't silently break it

An agent working in an unfamiliar repo fails in two predictable ways:

1. **It trusts a doc that is wrong.** Stale paths and two guidance files that
   contradict each other send it down the wrong road with full confidence.
2. **It changes one end of a coupling it can't see.** Seven tables must all list
   a new tool, but only a prose checklist says so. One is missed, and the bug
   surfaces somewhere else days later. That's the whack-a-mole.

More documentation fixes neither. The fix is to give every kind of knowledge
exactly one home, and to make anything that can drift either *generated* or
*tested*:

| Layer | Answers | Home | Kept true by |
|---|---|---|---|
| Rules | what's allowed | `AGENTS.md` (+ short module guides) | review; kept short |
| Meaning | what owns what, how a request flows | `ARCHITECTURE.md` | doc-path check |
| Facts | modules, importers, dependencies, oversized files | `docs/codebase-map.md` | generated; build fails when stale |
| Couplings | "if X changes, Y must too" | tests | the test suite |
| Decisions | why it's this way | `docs/adr/` | append-only |
| History | how it got here | `docs/history/` | not checked, clearly labeled |

The working rule behind all of it: **if a doc says "remember to also update X",
that sentence should be a failing test instead.**

## Pick the mode

- **New project** (empty repo, or a skeleton without established conventions)
  → follow *New project setup* below.
- **Existing codebase** → read `references/retrofit.md` and follow it. Audit,
  report ranked gaps, and change nothing until the user picks. Keep the repo's
  existing limits and conventions (a repo that enforces 400 lines stays at 400).

If it's unclear which applies, the presence of real application code with
importers between modules means retrofit.

## New project setup

### 1. Establish the stack and layout

Find out (from the repo, or ask if there's nothing yet) the language, the source
root (default `src/`), the test runner, and the build/check command. Language
and framework are product choices, so ask rather than pick. Everything below is
an engineering default; decide it and move on.

The bundled scripts are Node (≥18) and understand JS/TS and Python imports.
For a Python project, Node is a dev-only dependency. If the user won't have
Node at all, port the scripts; each script's header states its contract.

### 2. Copy the tooling into the project

The project must own its checks. CI and other machines can't reach
`~/.claude/skills`. Copy these into `scripts/`:

| From this skill | Purpose |
|---|---|
| `scripts/codebase-map.mjs` | writes `docs/codebase-map.md`; `--check` for build; `--deps <path>` for "who uses this" |
| `scripts/check-file-size.mjs` | 450-line ceiling with a shrink-only allowlist |
| `scripts/check-doc-paths.mjs` | fails when a live doc names a path that doesn't exist |
| `assets/module-seals.test.ts` or `assets/test_module_seals.py` | module-boundary test, starts with an empty table |

Put the seal test where the test runner finds it. The TS template assumes it
sits in the source root, and the Python one assumes `tests/` next to `src/`.
Adjust the one path constant if not.

### 3. Wire the checks into the build

The checks only work if they run without anyone remembering. For a Node project:

```json
"scripts": {
  "docs:map": "node scripts/codebase-map.mjs",
  "deps": "node scripts/codebase-map.mjs --deps",
  "check:map": "node scripts/codebase-map.mjs --check",
  "check:size": "node scripts/check-file-size.mjs",
  "check:doc-paths": "node scripts/check-doc-paths.mjs",
  "check": "npm run check:size && npm run check:doc-paths && npm run check:map && npm test",
  "build": "npm run check:size && npm run check:map && <compile>"
}
```

Pass `--root`, `--max-loc` or `--entry <dir>` when the defaults don't fit.
`--entry` marks a module that is loaded at runtime rather than imported, so the
map doesn't call it dead. For Python, put the same commands in a Makefile, a
`pyproject` task runner, or pre-commit, whichever the project already uses. If
the repo has CI, add `check` to it. If it has none, offer to add a minimal
workflow rather than creating one unasked.

### 4. Write the docs

Use `references/templates.md`. Create:

- `AGENTS.md`: rules, commands, layout, the 450-line rule, coupling rules,
  growth rules. Under ~100 lines, because it loads into every session.
- `ARCHITECTURE.md`: read-these-first, request flow, subsystem table. For a
  brand-new project, fill in what exists and leave the table ready to grow. Don't
  invent subsystems that haven't been built.
- `docs/adr/0001-record-architecture-decisions.md`
- `docs/history/README.md`
- `docs/codebase-map.md`: generate it (`npm run docs:map`), never hand-write.

Fill in real commands and paths. A template placeholder left in a guidance doc
is a stale claim on day one.

### 5. Registries

If the project has, or is about to have, anything registered in more than one
place (tools, routes, permissions, event types, providers, feature flags), set
it up as a single declaration from the start. See
`references/registry-pattern.md`. This prevents the most whack-a-mole of
anything in this setup.

### 6. Prove the gates work

A check that never failed hasn't been tested. Run `check` and confirm it's
green, then prove each gate catches a real violation:

- Add a 460-line throwaway source file → `check:size` fails.
- Put a backticked `src/does-not-exist.ts` in ARCHITECTURE.md → `check:doc-paths` fails.
- Add a module without regenerating the map → `check:map` fails.
- With one seal row, deep-import an internal → the seal test fails.

Revert every probe, re-run `check` green, and report each probe's outcome
honestly. If one didn't fail, the wiring is wrong. Fix it before finishing.

### 7. Hand off

Commit following the user's git conventions (never push unless asked). Then
tell the user what exists, which commands to run, and the growth rules now
written in AGENTS.md. The project doesn't depend on this skill to stay
healthy, because the rules live in the repo.

## File size: why 450

Smaller files help an agent as well as a person. A file under ~450 lines can
usually be read whole in one pass and holds one idea, so the agent edits with
the full picture instead of a window. The cost runs the other way too: dozens
of 30-line files scatter one concept across many reads. So the goal is
**one responsibility per file**, and the ceiling is the alarm that a file has
started doing two jobs. 450 is the default for new projects. Existing repos keep
their own limit.

## Siblings

- `/canonical-check`: before building a subsystem, find the existing owner.
- `/blast-radius`: before changing a shared anchor. `npm run deps -- <path>` gives its consumer list.
- `/docs-sync`: bring an existing repo's docs back in line with the code.
- `/brownfield`, `/grand-daddy-brown`: carry out retrofit gaps the user picked.
- `/app-build`, `/grand-daddy-green`: build a new app; run this skill first so the structure exists from commit one.
