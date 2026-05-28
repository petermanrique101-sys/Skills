---
name: find-duplicate-systems
description: Sweep the codebase for duplicate / parallel implementations of the same subsystem — multiple agent loops, multiple WS chat streams, multiple memory layers, multiple tool registries — and report a prioritized consolidation plan with a single source of truth per concern. Spawns a team of Explore sub-agents that each own one subsystem axis. Use when the user invokes /find-duplicate-systems, asks to "find duplicate systems", "audit for parallel implementations", "check for divergence", "make sure we only have one X", or wants a one-source-of-truth sweep before a big consolidation.
user-invocable: true
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
  - TodoWrite
  - Write
---

# /find-duplicate-systems — One-source-of-truth audit

This repo has been bitten twice by parallel implementations: we had to
collapse multiple agent loops into `src/canonical-loop/` and multiple
WebSocket chat streams into `src/chat-ws/`. The pattern is the same each
time — a feature gets built in a new file because nobody remembered the
existing one, both drift, bugs appear in the half nobody is editing.

This skill **finds the next batch of duplicates before they bite us**.

## What counts as a "duplicate system"

Two or more code paths that own the **same responsibility** for the
**same caller surface**, even if the implementations differ. Examples:

- Two modules that both drive the agent's tool-call loop.
- Two WS handlers that both stream assistant tokens to the UI.
- Two memory writers that both append to user profile files.
- Two tool registries that callers pick between based on guesswork.
- Two HTTP clients to the same provider with diverging auth handling.
- A "canonical" module and a "legacy" module both still imported by live
  code paths (the legacy one was supposed to be a shim but isn't).

Things that are **not** duplicates:

- Re-export barrels (the file just `export *`s the canonical module).
- Adapter layers that translate one interface to another (provider
  adapters, transport adapters) — these are intentional fanout.
- Tests that exercise the same code path from different angles.
- Snapshot/backup copies under `archive/`, `legacy/`, `.bak`.

## The team

Spawn **one `Explore` sub-agent per subsystem axis**, in parallel, in a
single message. Each agent owns one concern end-to-end. Default axes
(adjust to what the repo actually contains — check `src/` first):

1. **Agent / tool-call loops** — anything that iterates model → tool →
   model. Anchor: `src/canonical-loop/`, `src/ari-kernel/`. Look for
   competing loop drivers under `agent-loop/`, `autopilot/`,
   `agents/`, `agency/`, missions, scheduled runs.
2. **Chat / message streaming transports** — WS, SSE, polling.
   Anchor: `src/chat-ws/`. Look for competing senders under
   `bridge-voice/`, `chat/`, `conversation/`, anywhere that calls
   `ws.send` with assistant tokens.
3. **Tool registries / dispatch** — where tools are registered and
   where a name string gets resolved to a handler. One registry, one
   dispatcher.
4. **Memory writers** — anything that mutates `~/.claude/projects/.../memory/`,
   USER.md, IDENTITY.md, MEMORY.md, or per-project memory files.
5. **Provider clients** — Anthropic, OpenAI, local Ollama. One client
   per provider; CLI/proxy variants must be explicit adapters, not
   parallel clients.
6. **Session / conversation state** — who owns the canonical transcript,
   who persists it, who reloads it.
7. **Auth / credential resolution** — one resolver per credential type.
8. **Sandbox / workspace lifecycle** — app create / delete / list.
9. **Settings / config readers** — settings.json, settings.local.json,
   env var fallbacks.
10. **WebSocket / IPC server endpoints** — one server per port; if two
    files both `createServer` on related ports, flag it.

Don't run all 10 by default. **Ask the user which axes to audit** (or
which one is hurting right now) unless they said "audit everything." If
they said "audit everything," batch in groups of 4 — don't fan out 10
agents at once.

## Sub-agent briefing template

Use `Agent` with `subagent_type: "Explore"`, breadth `"very thorough"`.
Each agent gets this prompt, with `{AXIS}` and `{ANCHOR}` filled in:

```
Audit the repo for duplicate implementations of: {AXIS}.

The user's rule for this codebase: ONE source of truth per subsystem.
We've already had to collapse {AXIS}-like duplication once before — the
canonical module for {AXIS} now lives at {ANCHOR}. Your job is to find
anything else that does the same job.

Report (in this exact structure, under 400 words total):

1. **Canonical module** — confirm {ANCHOR} is still the canonical
   implementation. If not, name what is.

2. **Duplicates** — every other module/file that owns the same
   responsibility. For each:
   - Path
   - One-line description of what it does
   - Who calls it (grep for imports — list the top 3 callers)
   - Evidence it's a duplicate vs. a legitimate adapter (one sentence)
   - Drift signal: does it have logic the canonical doesn't, or vice
     versa? (yes/no + one example if yes)

3. **Shims** — files that are *supposed* to be re-export barrels to
   the canonical but actually contain logic. These are the most
   dangerous because callers think they're using the canonical.

4. **Orphans** — files that look like they belonged to an older
   implementation and have zero or near-zero callers. Candidates for
   deletion.

5. **Consolidation recommendation** — one paragraph. If duplicates
   exist, which way the merge should go (which module wins, what gets
   deleted, what needs to become a real shim).

Do NOT modify any files. Read-only audit.

If {AXIS} doesn't apply to this repo or {ANCHOR} doesn't exist, say so
in one sentence and stop.
```

## The loop

### 1. Confirm axes with the user

Show the default axis list (numbered 1–10 above). Ask which to run, or
take "all" as permission to batch all 10 in groups of 4. If the user
gave a specific concern ("are we duplicating X?"), skip straight to a
single-agent audit for that axis.

### 2. Verify anchors exist before dispatching

For each chosen axis, `Glob` for the anchor directory. If the anchor
doesn't exist (the repo has moved on), `Grep` for one or two known
exports to find the new home and use that as the anchor instead. Don't
brief a sub-agent with a stale anchor — its whole report will be wrong.

### 3. Spawn the batch in parallel

One message, multiple `Agent` calls. `run_in_background: true` — the
harness notifies on each completion. Don't poll.

### 4. Synthesize the report

After all agents in the batch complete, write a single
**consolidation report** to `audits/duplicate-systems-<YYYY-MM-DD>.md`
(create the `audits/` directory if needed). Structure:

```
# Duplicate Systems Audit — <DATE>

## Summary
- Axes audited: N
- Duplicates found: M
- Shims-that-aren't-shims: K
- Orphans: J

## Per-axis findings
### {AXIS_1}
Canonical: ...
Duplicates: ...
Recommendation: ...

(repeat for each axis)

## Prioritized consolidation queue
Rank by: (a) active drift between duplicates, (b) number of callers
touching the wrong one, (c) blast radius if they diverge further.
Each item: which axis, what merges into what, rough effort (S/M/L),
why this rank.

## Next steps
3–5 concrete consolidations the user can authorize now.
```

### 5. Present the queue, not the raw findings

In chat, give the user the **prioritized consolidation queue** + the
path to the full report. Don't dump every audit body inline. Ask which
items they want turned into work — but don't start any consolidation
in this skill. This skill audits; consolidation is its own task.

## Stop conditions

- Sub-agent reports it couldn't find the anchor and the user-supplied
  description doesn't match anything in the repo → ask the user to
  clarify the axis before retrying.
- Two sub-agents independently flag the same file as a duplicate for
  different axes → surface it specifically; it may be a god file
  serving multiple subsystems and needs a split too.
- Audit finds **zero** duplicates across all axes → say so plainly. Do
  not invent items to fill the report.

## Anti-patterns

- Running all 10 axes serially "to be thorough." Parallel batches of 4
  is the point.
- Treating provider adapters as duplicates. Two Anthropic clients with
  different transports (HTTP vs CLI proxy) are adapters, not
  duplicates — they implement the same interface for different
  carriers.
- Recommending deletion of "orphans" without checking dynamic-import
  call sites and config-driven loaders. Grep for the filename as a
  string too.
- Letting a sub-agent propose **how** to do the merge in this skill.
  The audit names the duplication; the consolidation is a separate
  task with its own design.
- Skipping the written report and just summarizing in chat. The report
  is the artifact — it's how the next audit knows what was already
  found.

## One-liner

> **Multi-agent sweep for parallel implementations of the same
> subsystem. One axis per agent, prioritized consolidation queue out,
> read-only.**
