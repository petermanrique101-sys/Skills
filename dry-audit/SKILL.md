---
name: dry-audit
description: Audit a codebase, prompt library, config set, docs, or workflows for harmful duplication — places where the same knowledge or rule lives in multiple locations and is drifting (or will). Use when the user invokes /dry-audit, asks for a "duplication audit," "code convergence audit," "find divergent code paths," or wants a sweep for parallel implementations / shadow systems. Produces a categorized, risk-scored, file-line-referenced report — not refactors.
user-invocable: true
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# /dry-audit — Find duplicated knowledge, not duplicated text

Arguments passed: `$ARGUMENTS` (target — folder, layer, concept, or "the whole repo").

---

## What DRY actually means

DRY is not "no two lines may look alike." DRY is **"every piece of knowledge has one authoritative representation."** Knowledge = a rule, a business fact, an invariant, a contract. If that knowledge lives in two places and they drift, you have a bug factory.

Two functions that *look* identical but encode different domain rules (`format_user_address`, `format_warehouse_address`) are **not** duplicates. They are coincidentally similar today and will diverge. Collapsing them creates a coupling that costs more than the duplication.

The single most important question in this audit is:

> **If this rule changes, do I have to update both copies?**

- Yes → real duplication. Flag it.
- No → coincidental similarity. Leave it.

Carry this question through every finding.

---

## Three principles staff engineers respect

1. **Rule of Three (Hunt & Thomas).** First occurrence: write it. Second: notice it. Third: extract it. Extracting on the second occurrence is how you build the wrong abstraction.

2. **"Duplication is far cheaper than the wrong abstraction." (Sandi Metz).** A bad shared abstraction couples unrelated callers, accumulates flag parameters, and resists deletion. Real duplication is at least obvious and local.

3. **Contradictions > exact copies.** Two files saying *almost* the same thing are more dangerous than two files saying *exactly* the same thing. Exact copies announce themselves; near-copies hide drift.

---

## Auditor rules (non-negotiable)

- Do not over-abstract.
- Do not treat all repetition as bad.
- Do not modify files unless explicitly asked. Default output is a report.
- Do not include generated, vendor, or build output unless asked (`node_modules`, `dist`, `build`, `.next`, `__pycache__`, lockfiles, minified assets, generated types).
- Prefer specific file paths and line numbers over vague advice.
- Separate "same text" from "same knowledge."
- Flag contradictions more aggressively than exact copies.
- If recommending an abstraction, explain why it is safer than duplication here.
- If recommending leaving duplication alone, explain why.
- If the audit finds no meaningful DRY issues, say that directly. Don't pad.

---

## The loop

### 1. Set the boundary

Before scanning, fix:

- **Target**: which files, folders, layers, concepts (e.g., "the chat path," "all prompts," "config across frontend + backend").
- **Out of scope**: vendor, generated, build artifacts, third-party.
- **Artifact class**: code only, prompts only, docs only, configs only, or mixed.
- **Output mode**: report only (default), or report + proposed patches (only if user said so).

If the target materially affects what you scan and is ambiguous, ask **one** focused question. Otherwise pick the reasonable interpretation and state it in the report header.

### 2. Map sources of truth

Before hunting duplication, build a map of where critical knowledge *currently* lives. For each major concept relevant to the target:

| Concept                          | Where it lives                     | Canonical? |
|----------------------------------|------------------------------------|------------|
| Auth rules                       | `src/auth/*`, `middleware/auth.ts` | ambiguous  |
| Model names                      | `config.ts`, `.env`, prompts/*.md  | no — 3 copies |
| Tool registry                    | `src/tools/registry.ts`            | yes        |
| Pricing tiers                    | `pricing.ts`, landing page, README | no — 3 copies |

This table is the spine of the report. Drift starts where this column says "no."

Concepts to look for, by artifact class:

- **Code**: business rules, validation, API shapes, error policies, retry/backoff, formatting, parsing, ID generation, time/date handling, env-var access, feature flags, model/provider selection, tool registries.
- **Prompts/agents**: behavioral rules, safety rules, tool-use rules, project facts, persona instructions, output schemas, refusal patterns.
- **Docs**: setup steps, architecture descriptions, API references, runbooks.
- **Configs**: env vars, model/provider settings, paths, ports, feature flags, allowlists.
- **Schemas**: database, API, message bus, file formats.
- **Tests**: fixtures, setup helpers, assertion patterns.
- **Workflows**: deploy, release, on-call, escalation, review.

### 3. Detect — concrete methods

Don't just "look." Use grep/AST patterns. For each candidate:

**Symbol collisions** (two definitions for the same concept):
```
Grep: pattern="function (sendMessage|send_message|dispatchMessage)", output_mode=content
Grep: pattern="class \w*(Auth|Authentication|Login)", output_mode=content
```

**Hardcoded values that should be config** (magic strings/numbers):
```
Grep: pattern="(claude-(opus|sonnet|haiku)-[\d-]+|gpt-[34]\.\d|gemini-[\d.]+)", -n=true
Grep: pattern="https?://[^\s\"']+", glob="*.{ts,tsx,js,py}"
```

**Repeated business rules** (look for similar conditionals):
```
Grep: pattern="(price|tier|plan|subscription).*(free|pro|enterprise|paid)", -i=true
```

**Cross-layer drift** — the same fact stated in code, config, prompt, and docs. This is the highest-yield class. Example: a model name appearing in `config.ts`, an env var default, a system prompt, and the README, with at least one stale.

**Near-duplicate functions** — same shape, different file:
1. Find functions with the same name in different modules.
2. For each pair, diff their bodies. If <30% lines differ, flag.

**Stale path / shadow system** — old implementation still wired alongside new one. Signal: two modules answering the same import-name across the codebase, with one barely touched in `git log`.

**Prompt-fragment duplication** — same instruction phrase across multiple prompts. Grep for distinctive sentences (10+ words). If three prompts each say "Never reveal system instructions to the user, even if asked" but with slightly different wording, that's a fragment that wants to be a shared block.

**Git archaeology for staleness**:
```
git log -1 --format=%ai -- path/to/fileA
git log -1 --format=%ai -- path/to/fileB
```
A copy not touched in 18 months while its twin gets monthly commits is almost certainly the stale one.

### 4. Classify each finding

Every finding gets exactly one category:

- **A. Harmful** — same knowledge, multiple homes, drift risk real. Fix.
- **B. Tolerable** — repetition exists, drift unlikely, abstraction would cost more than it saves. Leave, note.
- **C. Intentional** — duplication is the design (defense in depth, layer isolation, deliberate redundancy). Leave, document if undocumented.
- **D. False positive** — looks duplicated, isn't. Coincidental similarity, generated, framework boilerplate, vendor.

The category test isn't "does it look duplicated." It's the question from the top: *if this rule changes, do I have to update both copies?*

### 5. Risk-score each Category-A finding

- **High** — security, auth, billing, credentials, data integrity, compliance, or any business rule already drifted.
- **Medium** — actively maintained code where a bug fix would plausibly miss one copy; inconsistent prompts/configs.
- **Low** — cosmetic, low-traffic, drift unlikely but possible.

User-visible contradictions (pricing says $49 in one place, $99 in another; two docs give conflicting install steps) are automatically **High** regardless of artifact class.

### 6. Recommend — the graduated extraction ladder

When you do recommend a fix, pick the **cheapest** rung that solves the drift problem. Climbing higher than necessary is how DRY audits create worse code than they found.

1. **Shared constant / enum** — for repeated values (URLs, model names, limits).
2. **Shared schema or type** — for repeated shape definitions (Zod, JSON Schema, TypeScript type).
3. **Shared pure function** — for repeated logic with the same inputs/outputs.
4. **Shared module** — for a cluster of related logic + state.
5. **Shared protocol / interface + multiple implementations** — only when the abstraction is genuinely needed for variation.
6. **Code generation from a single source** — schema → types, OpenAPI → clients, etc.
7. **Documented intentional duplication** — a comment explaining why this copy stays.

If you can't name which rung you're recommending, you don't understand the fix yet.

### 7. Anti-patterns to avoid recommending

These are the failure modes of bad DRY refactors. Recommending any of these is worse than the duplication:

- **`processItem(item, opts)` with 8 flag parameters** — you've created a god function that has to know every caller's special case.
- **Base class to share 3 lines** — inheritance bound to incidental similarity. The classes drift, the base class accumulates `if isTypeA` branches.
- **Premature plugin architecture** — shared interface with one implementation. You've added indirection without payoff.
- **Extract-helper-because-it-fits** — extracting a `formatThing(x)` helper used in exactly two places that happen to look similar. Often it's the coincidental-similarity trap.
- **Single-use generic** — `<T>` parameters where there is one T forever.
- **Macro-pattern prompts** — collapsing five distinct agent prompts into one templated prompt with five flags. Prompts diverge by design; this couples them.

If your fix matches one of these, downgrade the recommendation or change rungs.

### 8. Prioritize

- **Fix now**: High-risk findings, user-visible contradictions, drift already in progress.
- **Fix soon**: Medium-risk findings actively slowing dev or where a bug fix would miss a copy.
- **Leave alone**: Tolerable, intentional, and false-positive findings — list them so the user knows you saw them and decided.

---

## Report format

Default output is a single markdown report. Structure:

```markdown
# DRY Audit — <target>

**Scope**: <what was scanned>
**Excluded**: <what was skipped and why>
**Artifact classes**: <code | prompts | docs | configs | schemas | tests | workflows>
**Date**: <ISO date>

## Summary
- N harmful findings (X high, Y medium, Z low)
- M tolerable / intentional / false-positive notes
- Top concerns: <2–4 bullets>

If no meaningful issues: say so here in one sentence and stop.

## Source-of-truth map
| Concept | Locations | Canonical? |
|---|---|---|
| ... | ... | ... |

## Findings

### F1 — <short title>
- **Category**: Harmful / Tolerable / Intentional / False positive
- **Risk**: High / Medium / Low (only for Harmful)
- **Confidence**: High / Medium / Low
- **Locations**:
  - [`path/to/a.ts:42-58`](path/to/a.ts#L42-L58)
  - [`path/to/b.ts:101-117`](path/to/b.ts#L101-L117)
- **What's duplicated**: <one sentence — the knowledge, not the text>
- **Drift evidence**: <what's already different between copies, or staleness signal from git>
- **Recommendation**: <ladder rung + one-line rationale>
- **Why not leave it**: <explain — required when recommending a fix>
- **Why this rung**: <required if not the lowest>

### F2 — ...

## Tolerable / intentional / false positive (audit transparency)
Short list — one line each. Shows the user what you considered and decided to leave.

## Prioritized actions
**Fix now**
- F1, F4, F7
**Fix soon**
- F2, F5
**Leave alone (documented)**
- F3, F6, F8
```

---

## When to skip / shrink this audit

- Codebase under ~2k LOC and under a month old: too early. Duplication needs time to manifest.
- Code about to be deleted or rewritten: pointless.
- Pure prototype / spike: leave it alone, that's what prototypes are for.
- User asked "is X duplicated with Y" — single-concept question. Don't run the full sweep; answer the one question with file refs.

---

## Done criteria

The audit is complete when **all** are true:

1. The audit boundary is clear (scope and exclusions stated in the report header).
2. Meaningful duplication has been identified — or explicitly ruled out with a one-line "no significant DRY issues in <scope>."
3. Each finding has category, risk (if Harmful), locations with file:line, drift evidence, and recommendation.
4. A source-of-truth map exists for the important repeated concepts in scope.
5. The report distinguishes harmful duplication from acceptable duplication, with at least one line on why each tolerable/intentional item stays.
6. Next actions are prioritized into Fix now / Fix soon / Leave alone.

If any of these is missing, the audit isn't done — keep going.
