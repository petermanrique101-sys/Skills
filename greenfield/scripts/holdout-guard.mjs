#!/usr/bin/env node
/**
 * The wall around a project's held-out scenario suite.
 *
 * A PreToolUse hook. It refuses any tool call whose input names the holdout
 * folder (~/.holdout/...), unless the call comes from the judge agent. The
 * building agents are told not to read the suite; this is what makes that true
 * instead of a request. It also covers the orchestrator: once the suite is
 * sealed, only the judge reads it, so scenario text cannot leak into a brief.
 *
 * Wire it in the project's .claude/settings.json:
 *   "hooks": { "PreToolUse": [{ "matcher": "*",
 *     "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PROJECT_DIR}/scripts/holdout-guard.mjs\"" }] }] }
 * (anchored to the project root: a hook whose script is not found does not block)
 *
 * Contract:
 *   stdin  the hook input JSON (tool_name, tool_input, agent_type when the
 *          call is made inside a subagent)
 *   exit 0 the call does not name the holdout folder, or the judge made it
 *   exit 2 blocked; stderr tells the agent why
 *
 * What it does not catch: a command that reaches the folder without naming it
 * (a wildcard from the home directory). The folder lives outside the project
 * and no brief names it, so that takes a deliberate search, and the transcript
 * shows it.
 *
 * To revise the suite after sealing, the owner edits it by hand or removes the
 * hook entry. No agent lifts the seal.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The one agent type allowed through. Defined by assets/holdout-judge.md. */
export const JUDGE_AGENT = "holdout-judge";

/** `.holdout` as a path segment: `~/.holdout/x`, `C:\Users\me\.holdout`, ` .holdout/`. Not `notes.holdout.md`. */
const HOLDOUT_SEGMENT = /(^|[^a-z0-9_-])\.holdout([^a-z0-9_.-]|$)/i;

/** True when the text names the holdout folder. Backslashes (and JSON's doubled ones) read as slashes. */
export function namesHoldout(text) {
  return HOLDOUT_SEGMENT.test(String(text).replace(/\\+/g, "/"));
}

/** The decision for one hook input: { block: boolean, reason?: string }. */
export function decide(raw) {
  let input = null;
  try {
    input = JSON.parse(raw);
  } catch {
    // Unparseable input is judged as plain text: fail closed on the one thing guarded.
    return namesHoldout(raw) ? { block: true, reason: "the call names the holdout folder" } : { block: false };
  }
  if (input?.agent_type === JUDGE_AGENT) return { block: false };
  if (!namesHoldout(JSON.stringify(input?.tool_input ?? ""))) return { block: false };
  return { block: true, reason: `${input?.tool_name ?? "this tool call"} names the holdout folder` };
}

function main() {
  const verdict = decide(readFileSync(0, "utf8"));
  if (!verdict.block) process.exit(0);
  console.error(
    `Blocked: ${verdict.reason}. The held-out scenario suite is sealed; only the ${JUDGE_AGENT} agent reads it. ` +
      "Build from spec/. If a scenario looks wrong, say so and let the owner decide.",
  );
  process.exit(2);
}

// Run as a hook; importable without side effects.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
