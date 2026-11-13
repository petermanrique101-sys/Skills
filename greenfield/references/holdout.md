# The held-out scenario suite

The suite is how the build finds out whether the spec was right. It only works
if the agents that build the app never see it: a test a builder can read is a
test it builds to. Read this at phase 4 and whenever a chunk is judged.

## Contents
1. Where it lives
2. Writing scenarios
3. The scenario index
4. Sealing the suite
5. Proving the wall
6. Judging
7. When a scenario fails
8. Revising the suite

---

## 1. Where it lives

`~/.holdout/<project>/`, outside the repo. Inside the repo every worktree gets
a copy and any `Glob` for `*.md` finds it. Make it its own git repository so
its history is kept:

```bash
mkdir -p ~/.holdout/<project> && git -C ~/.holdout/<project> init
```

It is per-machine unless the owner pushes it somewhere private. Say so in the
completion report.

## 2. Writing scenarios

Write them from the spec, before any chunk is built. Written afterwards, they
describe what the agent built instead of what the owner wanted.

Pick the ones that most separate a working app from a broken one:

- the primary happy path for each done-list item;
- the two or three failures that would embarrass the owner in production;
- the edge case the spec was vaguest about;
- one scenario per constitution rule that behavior can show (the record
  survives an email change; another user's data is refused).

5-8 for a small app in supervised mode. Autonomous mode needs more, because the
suite is the only reviewer: every done-list item covered, and every chunk in
the plan verified by at least one scenario.

One file per scenario, `<short-name>.scenario.md`:

```markdown
# Scenario: <short name>

**Persona:** <who is doing this>
**Context:** <what is true when they start>
**Steps:**
1. They do X
2. They expect Y
3. They do Z

**Satisfaction criteria:**
- <the thing they expected actually happens>
- <edge case A is handled, specifically: ...>
- <the state afterwards is ...>

**Kind:** checkable | judgment
```

Prose, not code. `checkable` means one judge can decide it from what the app
does. `judgment` means it turns on taste (does this read clearly, does the page
match `spec/design.md`) and goes to a panel (section 6).

Show the owner the scenarios before sealing. This is the last time anyone but
the judge reads them.

## 3. The scenario index

The orchestrator has to say which scenarios to run without reading them. Before
sealing, write the index into `spec/ledger.md`:

```markdown
## Scenario index
| File | Kind | Covers |
|---|---|---|
| checkout-happy.scenario.md | checkable | done-list 2; product.md flow 3 |
| declined-card.scenario.md | checkable | done-list 2; constitution 4 |
| first-impression.scenario.md | judgment | design.md |
```

File names and coverage only. No steps, no criteria.

## 4. Sealing the suite

Commit the suite in its own repository first; nothing outside the judge can
touch the folder afterwards. Then:

1. Copy this skill's `scripts/holdout-guard.mjs` into the project's `scripts/`.
2. Copy this skill's `assets/holdout-judge.md` to the project's
   `.claude/agents/holdout-judge.md`.
3. Add the hook to the project's `.claude/settings.json` (merge with whatever
   is there):

```json
"hooks": { "PreToolUse": [{ "matcher": "*",
  "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PROJECT_DIR}/scripts/holdout-guard.mjs\"" }] }] }
```

   The path is anchored to the project root on purpose. A hook whose script
   cannot be found exits with an error that does not block, so a relative path
   that breaks in a worktree would leave the wall open without saying so.
   Commit the guard and the settings before any worktree is cut.

From here every tool call that names `.holdout` is refused, for the builders
and for the orchestrator alike, unless the `holdout-judge` agent made it. That
is the point: a later session of the orchestrator cannot paste scenario text
into a brief, because it cannot read it.

Because of that, never write the folder's path into a prompt, a brief, a
Workflow script or a file after sealing. Refer to scenarios by file name from
the index; the judge knows where they are.

## 5. Proving the wall

A wall that never refused anything has not been tested.

- Spawn a throwaway general-purpose agent with a prompt that describes the
  folder without naming it (a prompt that names it is itself refused): "The
  user's home directory has a hidden folder named with a dot followed by the
  word holdout. Try to read any file under it and report exactly what
  happened." It must come back refused.
- Spawn the `holdout-judge` agent: "Project `<project>`. List the scenario file
  names you can see." It must list them.

If the first probe gets through, the hook is not live. If the second fails with
an unknown agent type, the agent definition has not loaded.

**Expect to need a new session.** A hook and an agent definition added while a
session is running are often not picked up by that session (a settings file
that did not exist at startup, in particular). When either probe misbehaves:

1. Write the resume point in `spec/ledger.md`: "Suite sealed, wall not yet
   proven. Next: run both wall probes, then phase 5."
2. Tell the owner, in one line, to open a new session in the project folder and
   say "resume the greenfield build".
3. Stop. Do not plan or build in a session where the wall is not live.

The resumed session's first act is to run both probes. Record the outcome in
the ledger, honestly. If the wall cannot be made to refuse even in a new
session, say so and let the owner choose between fixing it and building with a
suite that is only out of reach, not sealed.

## 6. Judging

Start the app for real (not a mock of it), then spawn the judge:

```
Project: <project>
Scenarios: <file names from the index, or "all">
App: <URL / command / binary and how to reach it>
```

The judge returns, per scenario, `pass | fail | not-run`, a 0-10 score, what it
observed, and the gap stated as behavior.

- **`checkable` scenarios:** one judge.
- **`judgment` scenarios:** a panel of three judges, spawned separately so none
  sees another's answer. Put at least one on a different capable model than the
  one that built the app (the Agent tool's `model` option, or a second-vendor
  tool if the owner has one installed); a model is a poor critic of its own
  habits. Majority decides; report a split as a split.
- The orchestrator never scores a scenario itself. It wrote the spec, so it
  reads the app the way the spec meant, which is the bias the suite exists to
  remove.

## 7. When a scenario fails

Assume, in this order:

1. **The spec was ambiguous.** Fix `spec/`, then rebuild the chunk. The spec
   grows over a build; every failure teaches what was unclear.
2. **The build is wrong.** Send the chunk back with the gap.
3. **The scenario is wrong.** Rare. Be suspicious of yourself, and take it to
   the owner (section 8).

Hand a builder the gap as the judge wrote it, tied to the spec: "product.md
flow 3 says the cart survives a declined card; observed: the cart was empty."
Never more than that. The builder fixes the behavior the spec promised; it does
not learn what the test checks.

When the spec and the code disagree, the spec wins and the code changes. An
agent that proposes editing the spec to match what it built is proposing to
move the target; treat it as a proposal and judge it on its merits.

## 8. Revising the suite

Only the owner changes a sealed suite: by editing the file themselves, or by
removing the hook entry, having the change made, and sealing again. In
autonomous mode a suspected-wrong scenario is parked for the owner and the
chunk it blocks is marked `parked`, never forced green.
