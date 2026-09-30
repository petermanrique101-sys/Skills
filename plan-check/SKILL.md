---
name: plan-check
description: Decide between two competing plans (or two of the model's own answers that contradict each other) by finding the ONE fact they actually disagree on, walking every case, and applying the rules written down BEFORE the argument as the tiebreaker. Separates engineering calls (decided by evidence) from product/taste calls (handed back to the user as a single question). Use when the user invokes /plan-check, asks "how do I know who's right", "you just contradicted yourself", "which plan", or when a proposal has been revised and the two versions disagree.
user-invocable: true
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# /plan-check — Who's right, and how would we know?

A model asked to critique its own plan will always find something. That is a
bias, not insight. Two plans written under different pressures (one after
watching a user hit friction, one after re-reading the repo rules) will
disagree, and both will sound confident. The user's question is the right one:

> "You just contradicted yourself. How do I know who's right?"

This skill answers it without asking the user to trust a verdict. It reduces
the disagreement to a fact that can be checked, walks the cases, and lets the
rules that were written before the argument break the tie. What is left is
either decided by evidence or is a product call, which goes back to the user as
one question.

## When this fires

- Two plans for the same change exist and disagree (from two people, two
  sessions, or one model that revised itself).
- The user asks which of two answers is right, or says the model contradicted
  itself.
- A plan was "improved" by self-critique and the improvement is not obviously
  better, only different.
- Before committing to a design where the model's first and second answers
  differed.

Do not fire on a plan nobody disagrees with. That is `/bs-check` (red-team) or
`/grill-me` (interview) territory.

## The procedure

### 1. Name both positions in one sentence each

"Plan A: <what it does>. Plan B: <what it does>." If either cannot be stated in
one sentence, it is not a plan yet; ask for it.

Then say what pressure produced each one. This is not optional: "A was written
right after watching a fresh install with search dead. B was written against
the one-source-of-truth rule." The pressure explains the bias; naming it is
half the answer.

### 2. Find the discriminating question

Strip everything both plans agree on. What is left is usually **one** factual
question, sometimes two. Write it as a question with a checkable answer:

- "Does the seed cover every case the new mechanism would cover?"
- "Is there a second consumer of this default?"
- "Does anything parse this output format?"

If you cannot reduce the disagreement to a checkable question, the plans do not
actually disagree on engineering. They disagree on taste or product. Skip to
step 5.

### 3. Walk every case

Enumerate the situations the change touches and state, for each, what happens
under Plan A and under Plan B. Be exhaustive and boring:

```
Case               | Plan A            | Plan B            | Differs?
fresh install      | ...               | ...               | no
upgraded install   | ...               | ...               | no
user flips strict  | one switch        | two clicks, once  | YES
user wants it off  | switch            | delete 2 entries  | no (both work)
```

Verify the rows, do not assert them: read the code path, grep the consumers,
run the test. A row you did not verify is marked `(unverified)` in the table.

The rows marked YES are the entire disagreement. Usually there is one.

### 4. Apply the rules written before the argument

Read the project's standing rules (`AGENTS.md`, `CLAUDE.md`, the skills the
user set up, their stored feedback). Quote the ones that bear on the YES rows:

- "Prefer editing existing files over creating new ones."
- "Three similar lines beats a premature abstraction."
- "Don't predict future requirements."
- "One source of truth."

These are the tiebreaker because they were not produced under the pressure of
this decision. When one plan satisfies them and the other does not, say so and
weight that plan. When both satisfy them, the rules do not decide; go to step 5.

State plainly which plan the rules favor, and which of the model's own answers
should therefore be weighted higher. Do not soften it.

### 5. Separate the engineering call from the product call

Whatever the walk decided by evidence, decide it: name the plan and proceed.

Whatever is left is a product, money, risk, or taste call. Hand it back as
**one** question that names the exact tradeoff, with the recommendation first:

> "If two clicks on a deliberately strict setup is acceptable friction, Plan B
> (recommended). If not, Plan A. That is the only place they differ."

Not three questions. Not "what do you think?" One question, one tradeoff, one
recommendation.

### 6. Say how to use the model next time

Close with the meta-rule, because the user will hit this again:

> Asking for a critique of a plan produces a critique whether one is warranted
> or not. Ask for the discriminating fact and check it yourself. Weight the
> answer that matches the rules you set in advance over the one written in the
> moment.

## Output shape

Terse, under ~25 lines:

```
Plan-check

A: <one sentence>  — written under: <pressure>
B: <one sentence>  — written under: <pressure>

They agree on: <list>
They disagree on: <the one checkable question>

Cases:
<table; YES rows are the disagreement; unverified rows marked>

Rules that bear on it: <quoted, with which plan satisfies them>

Decided by evidence: <plan> because <row + rule>
Your call (one question): <tradeoff, recommendation first>

Next time: ask for the discriminating fact, not a verdict.
```

## Anti-patterns this skill exists to prevent

- **Verdict by confidence.** "The second answer is better" with no row that
  differs. If the table has no YES row, the plans are the same plan.
- **Critique as proof.** Treating a self-critique as evidence the original was
  wrong. The critique is a third plan with its own pressure.
- **Hiding the product call inside engineering language.** "Two clicks is too
  much" is a product judgment. Name it as one and hand it back.
- **Skipping verification.** A case table built from memory is a guess with
  borders. Read the code for every row you rely on.
- **Asking the user to break the tie on an engineering fact.** If the row can be
  checked, check it. The user decides taste, not whether a consumer exists.

## Relationship to other skills

- `/bs-check` red-teams one document. This resolves two that disagree.
- `/grill-me` interviews the user to build shared understanding. This ends with
  at most one question.
- `/blast-radius` and `/canonical-check` supply verified rows for the case table
  (consumers, canonical modules). Run them when a row needs their evidence.
- `/senior-engineer` runs after the verdict to implement the winning plan.

## One-liner

> Reduce the disagreement to one checkable fact, walk the cases, let the rules
> written before the argument break the tie, and hand back exactly one product
> question.
