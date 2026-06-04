---
name: docs-sync
description: Autopilot that makes a repo's docs match its code — generates missing docs from the code and audits every existing doc, rewriting stale/incorrect claims and deleting dead ones. Runs a gated team of sub-agents (audit → adversarial verify → apply) in parallel worktree batches, auto-commits clean batches, halts on regression. Portable across any repo/language. Use when the user invokes /docs-sync, or asks to "update the docs", "make the docs match the code", "remove stale docs", "document this repo", or "audit our documentation."
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
  - TodoWrite
  - AskUserQuestion
---

# /docs-sync — Make the docs tell the truth about the code

Documentation rots because code moves and prose doesn't. This skill closes the
gap on autopilot: it **generates docs for undocumented surfaces** and **audits
every existing doc against the code it claims to describe**, rewriting stale
claims and deleting dead ones — without a human babysitting each file.

The hard problem in automated doc maintenance is **trust**: a naive rewriter
hallucinates "corrections" and confidently replaces a true statement with a
wrong one. This skill is built around defeating that. Prose has no test suite,
so the autopilot's green gate is **adversarial verification** — every claimed
defect is independently re-confirmed against the code before a single word is
rewritten — plus a doc-only-diff guard and link/snippet validation.

This is a **portable, global** skill. It runs against whatever repo the user is
in. Hardcode nothing about any specific project; **discover** the doc layout,
the build/test commands, and the house conventions at runtime.

## Operating principles (the senior-engineer bar)

Every agent this skill spawns must invoke `/senior-engineer` first and hold to
these rules. They are the difference between a doc sync you can trust and a
plausible-sounding rewrite you can't.

1. **Code is ground truth. Docs bend to code, never the reverse.** If a doc and
   the code disagree, the doc is wrong (unless the doc is an intentional spec/RFC
   describing future state — see scope rules).
2. **Every change is evidence-cited.** A claim is only "stale" if an agent can
   point to the `file:line` in the code that contradicts it. No citation → no
   change. This is non-negotiable and is what the verify stage enforces.
3. **Preserve human intent; fix only factual drift.** Docs carry rationale,
   trade-offs, and "why" that the code does not. Never flatten that into
   generated API noise. Correct the wrong fact, keep the human's voice and
   reasoning.
4. **Docs explain *why* and *how to use*, not *what the code literally is*.**
   Generated docs that merely restate function signatures are negative-value
   churn. Document intent, contracts, gotchas, and usage — things the reader
   can't get by reading the code in ten seconds.
5. **Delete dead docs.** Documentation of removed features, deprecated flags,
   or renamed APIs is worse than no docs — it actively misleads. Cut it, and
   say so in the report.
6. **One source of truth.** Don't create a parallel docs system. Extend the
   doc layout the repo already uses; fold duplicated/overlapping docs together
   rather than adding another file.
7. **Match the house style.** Adopt the repo's existing doc tone, structure,
   heading conventions, and commit-message style. Carry no AI fingerprints into
   commits (no "Claude"/"AI", no co-author trailers) unless the repo's own
   history uses them.

## Phase 0 — Discover the terrain (orchestrator, before any agents)

You cannot batch work you haven't scoped. Do this inline first:

1. **Find the docs.** Default scope is prose documentation:
   - `README*`, `docs/**`, `**/*.md`, `**/*.mdx`, doc sites (`mkdocs.yml`,
     `docusaurus.config.*`, `*.rst` under `docs/`), and top-level guides
     (`CONTRIBUTING`, `ARCHITECTURE`, `CHANGELOG` is read-only — see below).
   - If the user asked to include inline docs, also scope language doc-comments
     (JSDoc/TSDoc `/** */`, Python docstrings, Go doc comments, Rustdoc `///`).
   - Honor an explicit scope passed in args (a path, a glob, "just the README").
2. **Map docs → code.** For each doc (or doc section), identify the code it
   describes: the module, package, public API, CLI, config keys, or endpoints.
   This map is what each audit agent receives so it reads the *right* code.
3. **Detect conventions & gates.** Find the build command, the test command,
   any docs build (`mkdocs build`, `npm run docs`), and any link checker. Find
   the commit-message style from recent `git log`. Note the LOC/style norms.
4. **Classify each doc** into:
   - **audit** — describes code that exists; check it for drift.
   - **generate-target** — a public surface (exported API, CLI, documented
     config) with missing or stub docs.
   - **skip** — see skip rules below.
5. **Show the user the classified inventory and the first batch** before
   starting. If the map is wildly off from what they expect, they redirect now.

### Skip rules (never touch on autopilot)

- `CHANGELOG`/release notes — historical record, not live docs. Read-only.
- `LICENSE`, legal, security policy, code-of-conduct — out of scope.
- Vendored/generated docs (`node_modules/**`, `vendor/**`, generated API dumps,
  anything with a "DO NOT EDIT — generated" banner).
- Specs/RFCs/design docs that explicitly describe *future or proposed* state
  (banner like "Proposal", "Draft", "RFC", "planned"). These intentionally
  diverge from current code. Flag them for the user, don't "correct" them.
- Marketing/landing copy unless the user explicitly asks.

## Phase structure — a gated 3-stage pipeline, run in batches

The team's value is **correctness through independence**, not just speed. Work
flows audit → verify → apply, batched so a bad rewrite fails small.

**Batch size: 3–4 docs/subsystems in parallel.** Never batch two docs that
describe the same code (their fixes can conflict) in the same batch. Largest /
most-divergent docs first.

### Stage 1 — Audit (fan-out, read-only)

One agent per doc (or per subsystem). Each reads the doc **and** the mapped
code, and returns a structured findings report. Read-only — it proposes, it
does not write. Brief template:

```
Invoke /senior-engineer first and follow it throughout.

You are auditing ONE documentation file against the code it describes. You do
NOT edit anything in this stage — you produce a findings report only.

Doc file: [DOC_PATH]
Code it describes: [MAPPED_CODE_PATHS / modules / APIs]
Repo doc conventions: [STYLE NOTES discovered in Phase 0]

Read the doc end-to-end. Read the code it references. For every factual claim
the doc makes (APIs, signatures, flags, config keys, behavior, defaults,
install/usage steps, file paths, examples), determine its status:

  - CORRECT     — matches code. Leave it.
  - STALE       — was true, code changed. Cite the code file:line proving it.
  - WRONG       — never matched / misleading. Cite the contradicting code.
  - DEAD        — documents something that no longer exists. Cite its absence.
  - MISSING     — a public surface in the code this doc should cover but doesn't.

Also flag: code snippets/examples that wouldn't run, broken internal links,
and duplicated content that overlaps another doc.

Output (structured): for each finding — {claim (quoted), status, evidence
(file:line), proposed_revision (exact replacement text, or "DELETE"),
confidence 0-1}. Preserve the author's voice and rationale in every proposed
revision; fix only the wrong fact. Do NOT propose restating code signatures as
prose. If the doc is fully accurate, say so and return zero findings.
```

### Stage 2 — Adversarial verify (independent, the green gate)

For each non-trivial finding from Stage 1, spawn a **different** agent that has
not seen Stage 1's reasoning, prompted to **refute** the finding. This is the
gate that replaces a test suite for prose.

```
Invoke /senior-engineer first.

An audit claims a documentation statement is defective. Your job is to REFUTE
it. Default to "rejected" if you are not certain.

Doc claim (quoted): [CLAIM]
Audit's verdict: [STATUS] — proposed change: [PROPOSED_REVISION]
Cited evidence: [file:line]

Independently read the cited code AND search for any other code path that could
make the original doc claim true (overloads, re-exports, defaults set
elsewhere, platform branches, config). Decide:
  - CONFIRMED — the doc really is defective; the proposed revision is accurate
    and complete. (Verify the proposed replacement is itself correct — don't
    trade one wrong statement for another.)
  - REJECTED  — the original doc claim is actually true, OR the proposed fix is
    itself wrong/incomplete. Explain which.

Output: {verdict, reasoning, corrected_revision_if_needed}.
```

Only **CONFIRMED** findings (with a verified-correct revision) proceed to apply.
REJECTED findings are dropped and logged — never silently applied. For
generated docs (MISSING), the verifier confirms the new doc is accurate and
adds real value (not signature restatement).

### Stage 3 — Apply (worktree, then gate + commit)

Spawn an apply agent **per doc**, using `Agent` with `isolation: "worktree"`,
that writes only the CONFIRMED revisions for its doc.

```
Invoke /senior-engineer first.

Apply these VERIFIED documentation revisions to [DOC_PATH]. Make exactly these
changes — no scope creep, no "while I'm here" edits.

Revisions: [list of {locate, replace_with | DELETE}]
Repo doc/commit conventions: [STYLE NOTES]

Constraints:
- Touch ONLY this doc file (and, if inline-doc mode, the specific source files
  whose doc-comments are listed — never their logic).
- Preserve surrounding prose, voice, and structure. Match house style.
- If generating new doc content, document why/contract/usage — never restate
  signatures.
- Run the repo's docs build and/or link checker if one exists; fix links you
  broke.
- Commit on the worktree branch. Message in the repo's style, e.g.
  "docs(<area>): correct <thing> to match code". No AI fingerprints.

Report: files changed, the commit SHA on the worktree branch, link/build
result, and anything you could not apply with a reason.
```

### Per-batch gate (after all apply agents in a batch finish)

For each completed apply agent: if it reports it touched source logic, created a
parallel doc, or could not apply cleanly → mark failed, skip its merge.

Then merge the batch onto the working branch (cherry-pick the worktree commits;
check `git worktree list` / `git log` to confirm where each committed), and run:

1. **Doc-only-diff guard** — `git diff --stat` of the merged batch contains only
   doc files (and, in inline mode, only doc-comment hunks, no logic). Any
   source-logic change → STOP.
2. **Build/link gate** — docs build passes (if the repo has one); internal links
   resolve; fenced code examples that the repo can compile/lint still do.
3. **Test gate** (inline-doc mode only) — repo test suite matches baseline.

All green → keep the merge (and `git push` only if the repo/user expects pushes
— otherwise leave commits local). Clean up each merged worktree
(`git worktree remove --force`, delete the branch). Any gate fails → STOP, do
not start the next batch, report the regression and the offending diff.

## Halt conditions (stop the autopilot, surface to user)

- A batch fails the doc-only-diff, build/link, or test gate.
- The verify stage **rejects a high fraction** of a doc's findings (e.g. ≥40%)
  — the audit agent is likely hallucinating; the doc/code map may be wrong.
- An agent wants to edit source logic, delete a non-doc file, or rewrite a
  spec/RFC marked as future-state.
- A doc and the code disagree in a way that implies a **code bug, not a doc
  bug** (e.g. the doc describes the obviously-intended behavior and the code
  contradicts it). Don't "fix" the doc to match a bug — flag it for the user.
- The user's repo has no docs at all and the requested scope is "audit" — switch
  to generate mode and confirm what to document first.

## Progress tracking

Use `TodoWrite`: one entry per doc, states
`pending → auditing → verifying → applying → done / skipped / failed`. Update
after each stage so the user can see, at any moment, which docs are clean, which
were rewritten, and which were dropped.

## Communication style

- **Before starting:** one message with the classified inventory (audit /
  generate / skip counts) and the first batch composition.
- **Between batches:** one short line — "batch N done: X docs corrected, Y
  generated, Z findings dropped by verify. Starting next with [docs]." Don't
  narrate per-agent.
- **On halt:** what stopped you, the offending diff, and the decision the user
  owns.
- **On completion:** total docs audited, claims corrected, docs generated, dead
  docs deleted, findings rejected by verification (proof the gate worked), and
  the commit list. Note any code-bug-not-doc-bug items the user should chase.

Don't repeatedly ask "should I continue?" — the user invoked an autopilot. Stop
only on the conditions above.

## Anti-patterns

- **Regenerating docs from scratch.** That destroys human rationale and trades
  drift for blandness. Audit and surgically correct; generate only the missing.
- **Restating signatures as prose.** `getUser(id: string): User` → "Gets a user
  by id" is zero-value churn. Document the contract, errors, and gotchas.
- **Applying an unverified finding** because it "looks right." The verify stage
  exists precisely for the confident-but-wrong correction. No CONFIRMED, no edit.
- **Editing the code to match the docs.** Code is ground truth. If the code
  looks wrong, flag it — don't rewrite the docs to launder a bug.
- **>4 agents per batch or batching docs that describe the same code.** Conflict
  and review-noise outrun the speed gain.
- **Skipping the per-batch gate to go faster.** The batching only protects you
  if each batch is gated before the next starts.
- **Hardcoding one repo's layout/commands.** This is a global skill — discover,
  don't assume.

## One-liner

> **Autopilot that makes docs match code: a gated team of agents audits every
> doc against the code, adversarially verifies each defect before rewriting it,
> generates the missing docs, deletes the dead ones — batched, gated, and
> halting on the first regression.**
