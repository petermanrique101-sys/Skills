#!/usr/bin/env node
/**
 * The structure checks as one command: file-size ceiling, module owners, doc
 * paths, then the codebase map. Every check runs even after one fails, so a
 * single run shows everything to fix. For a build or a harness gate that has
 * one slot for "is the structure right"; the individual scripts stay for
 * targeted runs.
 *
 * Usage:
 *   node check-structure.mjs [--root src] [--max-loc 450] [--check]
 *
 * Without --check the map is REGENERATED (the build keeps it current, and the
 * commit carries it); with --check a stale map fails instead, which is what CI
 * wants. --root and --max-loc are forwarded to every check that takes them.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? [name, args[i + 1]] : [];
};
const root = opt("--root");
const maxLoc = opt("--max-loc");
const check = args.includes("--check");
const here = fileURLToPath(new URL(".", import.meta.url));

const steps = [
	["check-file-size.mjs", [...root, ...maxLoc]],
	["check-module-owners.mjs", [...root]],
	["check-doc-paths.mjs", []],
	["codebase-map.mjs", [...root, ...maxLoc, ...(check ? ["--check"] : [])]],
];

let failed = 0;
for (const [script, flags] of steps) {
	const r = spawnSync(process.execPath, [here + script, ...flags], { stdio: "inherit" });
	if (r.status !== 0) failed += 1;
}
if (failed) {
	console.error(`\ncheck-structure: ${failed} of ${steps.length} checks failed`);
	process.exit(1);
}
console.log("check-structure: OK");
