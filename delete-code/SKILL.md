---
name: delete-code
description: Hunt for deletable code — dead exports, unreachable branches, redundant middleware, vestigial subsystems, and over-abstraction — and produce a ranked kill-list with a per-item safety proof combining static import-graph analysis with runtime evidence (logs, fire-counts, coverage). Use when the user invokes /delete-code, asks "do we have too many subsystems / too much middleware," wants to "eliminate code," "delete instead of write," find dead code, or shrink the codebase without losing behavior. Report-only — it proposes deletions and proves them safe; it does not delete. Sibling to /dry-audit (duplication) and /find-duplicate-systems; this one finds code that can simply go away.
user-invocable: true
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
  - AskUserQuestion
---

# /delete-code — The best PR is the one that removes a subsystem

Arguments passed: `$ARGUMENTS` (target — a folder, a subsystem name, a layer like "middleware", or empty for the whole repo).

The user's instinct is correct and worth stating plainly: **great engineers delete code.** Every line is a liability — it's read, maintained, tested, and reasoned around forever. Net-negative diffs are wins. But *reckless* deletion is worse than sprawl, so this skill's entire job is to find deletion candidates **and prove each one safe before proposing it.**

This skill is **report-only.** It hands back a ranked kill-list. The user decides what dies. Do not delete, do not open a worktree, do not edit — even for "obviously dead" items. Deletion happens later, on explicit go-ahead, ideally via `/brownfield` or `/senior-engineer`.

---

## The core principle: imported ≠ used

The trap in a mature codebase is that **dead code often still compiles and still gets imported.** A subsystem can be wired into the graph and never execute a single time in production. A middleware can be registered in the stack and never fire. A branch can be reachable on paper and dead in practice.

So proof is **two-layered**, and a candidate is only "high confidence" when both agree:

1. **Static layer** — is it in the import graph? Who imports it? Is the export ever referenced?
2. **Runtime layer** — does it actually *run*? Logs, middleware fire-counts, coverage, feature-flag state.

Static-only produces false confidence. Runtime-only produces false alarms (rare paths). Cross them.

⚠️ **This repo uses dynamic `import()` that fools grep.** ARCHITECTURE.md lists dirs that look dead to grep but are live via dynamic import (historically `src/routing/`, `src/conversation/`, `src/agent-loop-detectors/`, `src/context-manager/`). **Always** grep for the module's basename as a *string* (`grep -rn "context-manager"`), not just `import ... from`. A basename appearing in a string literal, a config table, a registry array, or a `import(\`./\${name}\`)` template is a live use. Treat any string-literal hit as "used" until proven otherwise.

---

## The seven deletion categories (ranked easiest → hardest to prove)

Work them in this order. Earlier categories are cheaper to prove and safer to ship.

### 1. Pure re-export shims
A file that only re-exports another (`export * from "./x.js"`). Deletable once importers point at the real module. **Proof:** the file has no logic of its own + count of importers to redirect.
*Known example in this repo:* `src/tool-executor.ts` → `src/tool-execution/index.js`.

### 2. Dead exports
An exported symbol that nothing imports (after the string-literal check above). **Proof:** zero import sites AND zero string-literal references repo-wide, including tests and dynamic-import registries.

### 3. Unreferenced files / vestigial dir scaffolding
A whole file or directory with no live importer. **Proof:** codebase-map.md already computes "dirs with 0 live importers" — start there, then verify each file. *Known example:* `src/agent-loop/` pruned to one live file (`inject-queue.ts`); the dir structure around it is vestigial.

### 4. Redundant / never-firing middleware  ← **the richest vein in this repo**
The canonical-loop middleware stack has ~35 ordered hooks. Some overlap in intent (`premature-completion` vs `refute-completion` vs `verify-gate`; `hallucination-check` vs `action-claim`; `false-refusal` vs `self-check`). Some may never fire in real turns. **Proof requires runtime evidence:** a middleware that is registered but has a fire-count of 0 across real session logs is a deletion candidate; two middlewares that fire on the same condition and take the same action are a merge candidate. See "Middleware audit" below — never propose deleting a guard on static reading alone.

### 5. Unreachable branches / dead flags
A conditional gated on a feature flag that's permanently off, or an `if` whose condition can't hold. **Proof:** flag default + grep for any override + confirm no runtime path sets it true.

### 6. Redundant abstraction layers
An adapter/wrapper/interface with exactly one implementation and one caller, adding indirection without earning it. This is judgment, not just counting — a one-impl interface at a *stable seam* (provider boundary, security kernel) is correct and stays. Flag only single-impl indirection with **no** pending second impl and **no** test/isolation reason. *Watch:* the singular `src/providers/adapter/` vs plural `src/providers/adapters/` split — a naming trap, possibly collapsible.

### 7. Whole vestigial subsystems
A subsystem superseded by a canonical one but left in place. Highest payoff, highest risk. **Proof:** must survive the full pipeline below AND a runtime check showing it's not the live path. Cross-reference ARCHITECTURE.md's "Looks canonical, isn't" section and memory notes tagged shim/monolith/legacy.

---

## The pipeline

### Step 0 — Read the map, don't rebuild it
This repo maintains the answer to half your questions already:
- `docs/codebase-map.md` — per-dir live-importer counts, "0 importer" dirs, god-file check. **Regenerate it first** (`npm run docs:map`) so you're not reading stale data, then read it.
- `ARCHITECTURE.md` — the "Looks canonical, isn't" table and the dynamic-import warnings. This is your false-positive shield.
- Memory index (`MEMORY.md`) — entries tagged shim / monolith / legacy / consolidated.

For any other codebase without these, build a lightweight import graph yourself with grep/glob.

### Step 1 — Gather static evidence
For the target scope, for each candidate:
- `grep -rn "<basename>"` repo-wide (string-literal check — beats dynamic import).
- Count real import sites vs string mentions.
- Note whether it's an entry point, registered in a policy/tool table (`tool-policies.data.ts`), or reachable only via a registry array.

### Step 2 — Gather runtime evidence (this is what makes the skill trustworthy)
Do NOT skip this — it's why the user chose static+runtime. Options, cheapest first:
- **Middleware fire-counts:** read `src/canonical-loop/middlewares/registry.ts` for the live stack, then search server logs (memory note: server logs → `/tmp/sax-server.log`) for each middleware's log signature. A registered middleware with no log evidence of ever firing is category-4 gold.
- **Server logs generally:** grep the log for the subsystem's log tags / route paths. Silence across real sessions = strong dead signal.
- **Feature flags:** find the flag default and any override; a permanently-off flag makes its gated code category-5.
- **Coverage, if available:** an uncovered exported function that also has no import sites is near-certainly dead.
- If no runtime evidence is obtainable for an item, **say so explicitly** and cap its confidence at MEDIUM. Never launder a static-only guess as high-confidence.

Use the `Agent` tool to fan these out — one agent per subsystem or per middleware cluster — when the scope is the whole repo. Give each a narrow question and have it return structured findings (path, category, static evidence, runtime evidence, importers-to-fix).

### Step 3 — Blast-radius each survivor
For every candidate that survives Steps 1–2, before it goes on the list: who breaks if it's gone? List the importers to redirect and any tests that reference it. If a candidate is a shared anchor (default, enum, policy row), note that removing it is a `/blast-radius` job, not a clean delete.

### Step 4 — Rank and report
One kill-list, ranked by **(LOC saved ÷ risk)**. Highest leverage, lowest risk first.

---

## Middleware audit (run this for "too much middleware")

When the target is middleware / "too many guards," do this specifically:
1. Read `src/canonical-loop/middlewares/registry.ts` — the ordered live stack and each hook's order number.
2. Read `types.ts` for the hook contract (`beforeTurn` / `afterModelCall` / `afterToolExecution`).
3. For each middleware, record: **what condition it fires on**, **what action it takes**, **which hook**.
4. Cluster by (condition, action). Same condition + same action across two middlewares = **merge candidate**.
5. Cross with fire-counts from logs. Registered + never-fired = **delete candidate**.
6. Report the stack as a table so the user can see overlaps at a glance.

Never propose removing a behavioral guard on reading alone — a guard that rarely fires may be rare-but-critical (a false-refusal catch that saves one turn in a hundred is worth keeping). Fire-count is a *lead*, and you must state what the guard protects against before proposing its removal.

---

## Output format

```
# Deletion Audit — <target>

**Scope:** <what was examined>  ·  **Candidates found:** N  ·  **Est. LOC removable:** ~X

## Kill-list (ranked by leverage ÷ risk)

### 1. <path or symbol> — <category> — ~<LOC> — risk: <none|low|med|high> — confidence: <HIGH|MED|LOW>
- **What it is:** one line.
- **Static evidence:** import sites, string-literal hits (or none).
- **Runtime evidence:** fire-count / log silence / flag state / coverage — or "none obtainable, confidence capped."
- **Blast radius:** who to redirect; tests referencing it.
- **How to remove:** the concrete move (redirect 3 imports → delete file; merge X into Y; drop flag branch).

### 2. ...

## Merge candidates (not deletions, but shrink the surface)
<middleware overlaps, singular/plural adapter collapse, etc.>

## Kept on purpose (looked deletable, isn't)
<items you checked and cleared — record WHY so the next audit doesn't re-litigate. e.g. "src/context-manager/ — live via dynamic import per ARCHITECTURE.md.">

## Recommended order of execution
<which to do first, and which need /blast-radius or /brownfield rather than a clean delete>
```

---

## Rules

- **Report only.** Never delete, edit, or open a worktree. Hand back the list; wait for go-ahead. (Matches the user's "opinion first, wait for the go-ahead" rule.)
- **Two-layer proof or it doesn't ship as high-confidence.** Static + runtime agree → HIGH. One layer only → MED. Guess → LOW, and label it.
- **The string-literal check is mandatory** before calling anything dead — dynamic `import()` is real here.
- **Deletion candidates ≠ deletion.** Some "dead" code is a rare-but-critical guard. When in doubt, downgrade confidence and say why you're unsure rather than pushing the delete.
- **Record what you cleared.** The "Kept on purpose" section is what makes the *next* audit fast and stops re-litigation.
- **Prefer removing a whole subsystem over trimming lines.** One category-7 win beats fifty dead-export nits. Rank by leverage.
