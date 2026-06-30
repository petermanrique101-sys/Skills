---
name: grand-daddy-brown
description: Autonomous, parallel, multi-hour campaign over an EXISTING codebase. The for-hours evolution of /brownfield — plans the whole campaign as unlimited atomic chunks, builds a conflict+dependency graph over them, fans out everything that doesn't collide into parallel worktrees, decides engineering questions like a senior would while parking product/money/risk/taste questions without stalling, proves every green chunk by trying to refute it, and ends with an honest ledger. Use when the user invokes /grand-daddy-brown, or wants a large multi-system change-list — a failure-class sweep, a report's full recommendations, a repo-wide refactor — knocked out autonomously over hours. Bakes /canonical-check, /senior-engineer, and /blast-radius into every chunk. Never pushes.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
  - Workflow
  - TodoWrite
  - AskUserQuestion
---

# /grand-daddy-brown — Knock out a huge change-list autonomously, in parallel, for hours

Arguments passed: the campaign — a failure-class list, a report's full set of
recommendations, a repo-wide refactor, a "fix all of X" goal.

`/brownfield` lands changes into existing code, but it is **serial and
supervised on purpose**: one chunk at a time, stop and ask the human on every
failure, capped around eight chunks. That's the right tool when you're
watching. This skill is the opposite tool: **unlimited chunks, run in
parallel where safe, run for hours, hands-off after one approval.**

The price of removing the human from the loop is that you must replace the
human with three things: a **scheduler** that knows what can run together, a
**judgment policy** that decides the engineering and parks the rest, and an
**adversary** that tries to break every "green" before you believe it. Get
those right and the run is trustworthy unattended. Get them wrong and you've
built a confidently-wrong machine that runs for three hours.

---

## Mental model

Brownfield is serial-and-supervised. Grand Daddy Brown is parallel-and-autonomous.
Everything new flows from those two words.

Three disciplines that don't exist in brownfield, and exist here only because
nobody is watching:

1. **The conflict graph is the scheduler.** Parallelism is decided by *files
   touched*, never by "systems." Two chunks that touch disjoint files run at
   once in separate worktrees. Two chunks that touch the same file serialize —
   even if they feel like different systems. A chunk is the atom of {one owner,
   one verification, one rollback}; you never split a chunk across agents.

2. **The autonomy-resolution policy decides what's yours vs. mine.** When a
   chunk raises a question, classify it: an *engineering* question (which seam,
   retry-vs-rework, which pattern) you decide like a senior would, from memory
   and product goals, and keep going. A *product / money / risk / taste*
   question you do **not** answer — you park it and route around it, and the
   campaign keeps moving on the other chunks. Never stall the whole run on one
   question; never silently make a call that was the user's.

3. **Green isn't green until refutation fails.** No human will catch a
   wrong-but-passing fix, so every green chunk gets a skeptic whose only job is
   to break it. It counts as done only when the skeptic fails. Without this the
   loop eventually invents a test to make itself pass — the exact failure
   brownfield warns about, now unsupervised.

Optimize for: **the largest set of clean, independently-verified, reversible
edits the campaign can ship unattended — and a completely honest account of
what shipped, what's waiting on you, and what couldn't be done.**

---

## The loop

### 1. Restate the campaign and define "done"

One sentence for the goal. Then an explicit, checkable **done-list** (the
concrete states that mean the campaign succeeded) and an explicit
**out-of-scope** list. This becomes the law for hours of unattended work — if
it's vague, the run drifts. If the input is a report, its recommendations are
*hypotheses*, not requirements; some won't survive contact with the code.

### 2. Read before you plan

Walk every area the campaign touches. For each: the canonical file that owns
the responsibility, its callers (`Grep` imports + usage), the adjacent module
across each boundary, and any `AGENTS.md` / `CLAUDE.md` / top-of-file
convention. You're about to commit hours — spend the reading budget now. For
breadth, dispatch a few **Explore** agents in parallel, one per area; collect
their maps before planning.

### 3. Plan the whole campaign as chunks (unlimited)

Each chunk is **atomic** (one responsibility, one merge-point), **seam-anchored**
(names the existing file/function it modifies — no new parallel files),
**verifiable** (explicit success criteria), and **reversible** (undoable on its
own). Unlike brownfield there's no chunk cap — a campaign can be dozens.

For every chunk, record its **footprint**: the exact set of files it will
create or edit. The footprint is what the scheduler runs on. A chunk whose
footprint you can't predict is mis-scoped — split it until you can.

If a chunk touches two systems, that's two chunks, not one chunk with two
owners. Draw the boundary at the system line so each piece is independently
ownable.

### 4. Build the conflict + dependency graph

Two kinds of edge between chunks:

- **Conflict edge** — two chunks' footprints overlap (any shared file).
  They must serialize; they can never be in flight together.
- **Dependency edge** — chunk B consumes something chunk A produces (A defines
  the interface, B calls it). B waits for A to land, then starts immediately —
  a *pipeline*, not a full barrier.

Everything with no edge between it runs in parallel. **Watch the conflict
magnets:** shared types files, registries, barrel exports, config tables.
Chunks that all register into one registry conflict on that file even when they
feel independent — serialize them or funnel all the registrations through a
single chunk.

### 5. Blast-radius the whole plan, up front

Before any chunk runs, assess change-impact across the campaign (the
`/blast-radius` discipline, applied to the plan as a whole). Rank chunks by
risk — anything that edits a shared anchor (a default, an enum, a policy table,
a widely-imported constant) is high-risk. **Schedule high-risk chunks last,
behind a gate**, so the safe majority is green and verified before you touch
the load-bearing walls.

### 6. One checkpoint: show the plan, get one approval

Present once, via `AskUserQuestion` or a plain message:
- The one-line restatement + the done-list (so misreads surface now).
- The chunks, each with seam + footprint + verification criteria.
- The graph: what runs in parallel, what serializes, what pipelines.
- The high-risk chunks held behind the gate.
- What you're explicitly **not** doing (and why).

Wait for approval. This is the **only** mandatory human gate in the happy path.
It costs 60 seconds and saves you from a confidently-wrong multi-hour run.
After approval, execution is autonomous until the campaign completes or a chunk
hits something only the user can resolve.

### 7. Persist the plan to disk — this is what makes "for hours" work

Write the plan, the graph, and a per-chunk status (`pending | in-flight |
green | parked | failed`) to a **campaign ledger file** (the session scratchpad
is fine). The ledger — not the conversation — is the source of truth.

This is the whole trick to running for hours: **never hold the plan in
context.** You hold a pointer to the ledger and one chunk at a time. When
context fills you compact freely (nothing load-bearing is in the chat — it's in
the ledger). If the run crashes you resume by re-reading the ledger and
skipping the chunks already marked green. State on disk, one chunk in context.

### 8. Execute in waves

Pick the **execution engine**:
- **Preferred for parallel, multi-hour, resumable runs: the `Workflow` tool.**
  It gives deterministic fan-out, a token *budget* you aim the run at, worktree
  isolation, and journal-based resume. Encode the graph as the script's
  control flow (`pipeline()` for dependency edges, `parallel()` for independent
  chunks, plain serialization for conflict edges).
- **Always-available fallback: a ledger-driven `Agent` loop.** Each wave =
  every chunk whose dependencies are satisfied and whose footprint doesn't
  overlap any in-flight chunk. Dispatch those concurrently, await the wave,
  update the ledger, pick the next wave.

**Parallel chunks that mutate files get their own git worktree** (Workflow's
`isolation: "worktree"`, or a manual worktree in the Agent path) so they can't
trample each other. Merge each worktree back as its chunk goes green; resolve
any merge by hand at the orchestrator level.

### 9. The per-chunk brief bakes in the three gates

Each chunk agent gets a complete brief (use `/brownfield`'s per-chunk template
as the base) **plus** these inlined — the agent does not invoke skills, the
discipline is written into the brief:

- **canonical-check:** "Find the canonical owner of this responsibility and
  EXTEND it. Do not create a new parallel file. If the seam isn't where the
  spec says, return `seam-not-found` — do not improvise one."
- **senior-engineer:** "Smallest correct change that fixes the root cause. No
  drive-by refactors, no speculative generality, no swallowed errors, no
  `as any`. Match the file's existing style."
- **blast-radius:** "Before editing any shared value (a default, enum, config,
  widely-imported constant/type), enumerate its consumers and run their tests.
  Report any consumer in a different concern than the one you're changing."
- **tests are mandatory, not optional:** "Add the tests this change needs —
  at minimum a regression test for the behavior you changed, in the existing
  test layout. Behavior/invariants, not implementation. Never a can't-fail test
  just to get green."
- **scope lock:** "Touch only the files in your footprint. No recursion — do
  not call the Agent or Workflow tool."

### 10. Verify each green chunk by refutation

When a chunk returns green, the orchestrator re-verifies independently (re-run
the tests, `tsc`, grep that the named seam was used — not a new file) **and**
dispatches a **skeptic** agent: "Here is a change that claims to be done and
correct. Try to prove it's wrong — find the input it breaks on, the case it
misses, the seam it forked, the test it faked. Default to 'broken' if unsure."
A chunk is `green` only when the skeptic fails to break it. If the skeptic
wins, the chunk goes back to `pending` with the skeptic's finding attached, or
to `parked` if it needs the user.

### 11. Autonomy-resolution: decide engineering, park the rest

When a chunk returns a question or a non-green status, classify and act —
**never block the whole campaign on one item:**

- **Engineering question** (which seam, retry vs. rework, which of two valid
  patterns, how to name a thing) → **decide** it as the best senior engineer on
  the team would, weighing the product goals and everything in memory. Record
  the decision and the one-line rationale in the ledger. Continue.
- **Product / money / risk / taste question** (should this be paid? is this the
  right UX? is this acceptable risk? do we want this behavior at all?) → **do
  not answer.** Park it in the ledger's decisions queue with enough context for
  the user to decide later. Route the campaign around it — keep running every
  chunk that doesn't depend on the parked answer.
- **`seam-not-found` / `spec-conflict`** → re-plan that chunk against the real
  code (don't auto-invent a seam). If re-planning needs a call that's the
  user's, park it.
- **Repeated failure on the same chunk** → after a couple of honest attempts,
  stop retrying that chunk (retrying invites faked greens), mark it `failed`
  with the diagnosis, and move on. The end ledger reports it.

### 12. Self-compact and resume

When context fills, compact — the ledger holds the plan, so nothing
load-bearing is lost. On the Workflow engine, resume via the journal
(`resumeFromRunId`); cached chunks return instantly, only unfinished ones
re-run. On the Agent loop, resume by re-reading the ledger and skipping
everything already `green`. The campaign survives a compaction or a crash
because its memory was never in the conversation.

### 13. Integration gate (when all chunks are green)

Per-chunk green is necessary, not sufficient — chunks pass individually and
still drift at the **seam between them**. Before declaring the campaign done:

- **Cross-seam contract test** — one final chunk that proves the changed
  systems integrate, not just that each passes alone (the attachment-read
  contract test is the template). Add it to the existing test layout.
- **Full build, not just typecheck** — `npm run build` (the real hygiene gate:
  the 400-LOC ceiling, no-require, etc.), not `tsc --noEmit`.
- **The existing suite stays green** end-to-end.

### 14. Completion ledger — honest or it didn't happen

End with a four-bucket account, because no human watched:

- **Shipped (green):** what's done and verified, with file:line refs.
- **Parked for you:** every product/money/risk/taste question, each with the
  context to decide it.
- **Failed and abandoned:** chunks that couldn't be made correct, with the
  diagnosis — not hidden.
- **Descoped:** what the input asked for that you deliberately left out, and why.

Each chunk is committed on its own so it's reversible and bisectable.
**Never push.** The push, and any deploy, is the user's call.

---

## Strong defaults (don't argue with these)

- **Schedule by files touched, not by "systems."** The merge only cares about
  files; "system" is a human label that hides shared files.
- **One agent owns one chunk owns one seam owns one worktree.** Never split a
  chunk across agents — you lose ownership, verification, and rollback at once.
- **Shared low-level files are conflict magnets.** Types, registries, barrels,
  config tables → serialize even when the systems feel independent.
- **The plan lives on disk; one chunk lives in context.** That's what makes
  hours, compaction, and crash-resume work.
- **Green isn't green until the skeptic fails.** Independent refutation on every
  chunk.
- **Park, don't stall.** A product question parks and the campaign keeps moving;
  it never blocks the other chunks.
- **The orchestrator doesn't edit production code directly** — except to resolve
  a worktree merge or recover a failed chunk by hand.
- **Never push.** Commit per chunk; leave the push to the user.
- **One human gate only:** the plan approval. Everything after is hands-off.

---

## Anti-patterns — refuse them

- **Parallelizing by "system" instead of by files** → merge conflicts and
  silent seam drift.
- **Splitting one chunk across two agents** → no clean owner, can't verify or
  roll back either half.
- **Auto-answering a product/money/risk/taste question** to avoid a stall →
  that call is the user's; park it and route around.
- **Believing "tests green" without refutation** → the loop will fake a green.
- **Holding the whole plan in the conversation** → context fills, the run dies,
  nothing resumes.
- **Pushing because the run finished** → never, under any circumstance.
- **A triumphant "completed everything" summary** that buries the parked, the
  failed, and the descoped → the honest four-bucket ledger is the deliverable.
- **Inventing a seam or a new parallel file** because a chunk couldn't find the
  real one → return `seam-not-found` and re-plan, don't fork.

---

## When to skip this skill

- The change is small or serial (a handful of files, no real parallelism) →
  `/brownfield` or `/senior-engineer`.
- You'll be watching every step → brownfield's supervised loop is the right
  tool; the autonomy machinery is wasted overhead.
- The work is one big tangled edit that can't be decomposed into independent
  chunks → there's nothing to parallelize; do it serially.
- It's a greenfield app being stood up from scratch → use `/grand-daddy-green`.

---

## The one-liner

> **Plan the whole campaign, schedule by what collides, decide the engineering
> and park the rest, prove every green by trying to break it, end honest —
> never push.**

Everything else is implementation detail.
