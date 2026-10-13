#!/usr/bin/env node
/**
 * Generated structural map of a source tree, for humans and AI agents.
 *
 * Facts that drift (who imports what, which modules are dead, which files are
 * oversized) are computed from the tree instead of hand-written in docs.
 * Resolves static AND dynamic imports — a plain grep for "from" misses
 * `import("./x.js")` and mislabels live modules as dead.
 *
 * Languages: JS/TS (relative specifiers, .js→.ts ESM remapping, index files)
 * and Python (relative + root-anchored absolute imports).
 *
 * Usage:
 *   node codebase-map.mjs                      write the map
 *   node codebase-map.mjs --check              exit 1 if the map is stale (wire into build)
 *   node codebase-map.mjs --deps <path>        who imports <path>, and what it imports
 * Options:
 *   --root <dir>      source root (default: src)
 *   --out <file>      output markdown (default: docs/codebase-map.md)
 *   --max-loc <n>     oversized-file threshold (default: 450)
 *   --entry <dir>     top-level dir reached at runtime, not by import (repeatable)
 *
 * The output only changes on events worth reviewing — a module added or
 * removed, a new cross-module dependency, an importer count change, a module
 * going dead, a file crossing the size limit, a size-tier flip — so --check
 * can gate the build without failing on trivial edits.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const opt = (name, dflt) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : dflt;
};
const optAll = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));

const REPO = process.cwd();
const ROOT = resolve(REPO, opt("--root", "src"));
const OUT = resolve(REPO, opt("--out", "docs/codebase-map.md"));
const MAX_LOC = Number(opt("--max-loc", "450"));
const ENTRIES = new Set(optAll("--entry"));
const CHECK = args.includes("--check");
const DEPS = opt("--deps", null);

// vendor/ and third_party/ hold code we ship but don't own — not mapped, not size-checked.
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", "__pycache__", ".venv", "venv", "coverage", ".next", "vendor", "third_party"]);
const JS_EXT = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const isSource = (p) => (JS_EXT.some((e) => p.endsWith(e)) && !p.endsWith(".d.ts")) || p.endsWith(".py");
const isTest = (p) => {
	const rel = relative(ROOT, p).split(sep).join("/");
	const base = rel.split("/").pop();
	return /\.(test|spec)\.[^.]+$/.test(base) || /^test_.*\.py$/.test(base) || /_test\.py$/.test(base) ||
		/(^|\/)(__tests__|tests?)\//.test(rel);
};
const posix = (p) => relative(ROOT, p).split(sep).join("/");
const unitOf = (p) => {
	const parts = posix(p).split("/");
	return parts.length > 1 ? parts[0] : "(root files)";
};

function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir).sort()) {
		if (SKIP_DIRS.has(name)) continue;
		const p = join(dir, name);
		if (statSync(p).isDirectory()) out.push(...walk(p));
		else if (isSource(p)) out.push(p);
	}
	return out;
}

const JS_SPEC = /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)["'`]([^"'`]+)["'`]/g;
const PY_FROM = /^\s*from\s+(\.*[\w.]*)\s+import\s+(.+)$/gm;
const PY_IMPORT = /^\s*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm;

function resolveJs(fromFile, spec) {
	if (!spec.startsWith(".")) return null;
	const base = resolve(dirname(fromFile), spec);
	const stem = base.replace(/\.(m|c)?jsx?$/, "");
	const candidates = [base, ...JS_EXT.map((e) => stem + e), ...JS_EXT.map((e) => join(base, "index" + e))];
	return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

function resolvePyModule(dotted, anchorDirs) {
	const rel = dotted.split(".").join(sep);
	for (const anchor of anchorDirs) {
		for (const c of [join(anchor, rel + ".py"), join(anchor, rel, "__init__.py")]) {
			if (existsSync(c)) return c;
		}
	}
	return null;
}

function pyTargets(fromFile, text) {
	const out = [];
	const anchors = [ROOT, dirname(ROOT)];
	for (const m of text.matchAll(PY_FROM)) {
		const [, mod, names] = m;
		const dots = mod.match(/^\.*/)[0].length;
		let anchorDirs = anchors;
		let dotted = mod.slice(dots);
		if (dots > 0) {
			let d = dirname(fromFile);
			for (let i = 1; i < dots; i++) d = dirname(d);
			anchorDirs = [d];
		}
		const pkg = dotted ? resolvePyModule(dotted, anchorDirs) : null;
		if (pkg) out.push(pkg);
		// `from pkg import submodule` targets the submodule file when one exists.
		for (const n of names.replace(/[()]/g, "").split(",")) {
			const name = n.trim().split(/\s+/)[0];
			if (!/^\w+$/.test(name)) continue;
			const sub = resolvePyModule(dotted ? `${dotted}.${name}` : name, anchorDirs);
			if (sub) out.push(sub);
		}
	}
	for (const m of text.matchAll(PY_IMPORT)) {
		for (const dotted of m[1].split(",")) {
			const hit = resolvePyModule(dotted.trim(), anchors);
			if (hit) out.push(hit);
		}
	}
	return out;
}

function importsOf(file) {
	const text = readFileSync(file, "utf8");
	if (file.endsWith(".py")) return pyTargets(file, text);
	const out = [];
	for (const m of text.replace(/\\\//g, "/").matchAll(JS_SPEC)) {
		const hit = resolveJs(file, m[1]);
		if (hit) out.push(hit);
	}
	return out;
}

const locOf = (file) => {
	const text = readFileSync(file, "utf8");
	return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
};
const tier = (loc) => (loc < 250 ? "S" : loc < 1000 ? "M" : loc < 3000 ? "L" : "XL");

if (!existsSync(ROOT)) {
	console.error(`source root not found: ${ROOT} (pass --root)`);
	process.exit(2);
}

const files = walk(ROOT);
const prod = files.filter((f) => !isTest(f));
const inTree = new Set(files);
const edges = new Map(); // file -> Set(target files inside the mapped tree)
for (const f of prod) edges.set(f, new Set(importsOf(f).filter((t) => t !== f && inTree.has(t))));

if (DEPS) {
	const target = resolve(REPO, DEPS);
	const inside = (p) => p === target || p.startsWith(target + sep);
	const importers = new Map();
	const deps = new Map();
	for (const [f, ts] of edges) {
		for (const t of ts) {
			if (inside(t) && !inside(f)) (importers.get(unitOf(f)) ?? importers.set(unitOf(f), new Set()).get(unitOf(f))).add(posix(f));
			if (inside(f) && !inside(t)) (deps.get(unitOf(t)) ?? deps.set(unitOf(t), new Set()).get(unitOf(t))).add(posix(t));
		}
	}
	const print = (title, m) => {
		const total = [...m.values()].reduce((n, s) => n + s.size, 0);
		console.log(`\n## ${title} (${total} files across ${m.size} modules)`);
		for (const [unit, s] of [...m].sort((a, b) => b[1].size - a[1].size)) {
			console.log(`\n${unit}/ (${s.size})`);
			for (const p of [...s].sort()) console.log(`  ${p}`);
		}
	};
	console.log(`# Dependencies of ${relative(REPO, target)} (non-test, static + dynamic imports)`);
	print("Imported by", importers);
	print("Imports from", deps);
	process.exit(0);
}

const units = new Map();
for (const f of files) {
	const u = unitOf(f);
	if (!units.has(u)) units.set(u, { files: 0, loc: 0, oversized: [], importers: new Set(), dependsOn: new Set() });
	if (isTest(f)) continue;
	const rec = units.get(u);
	const loc = locOf(f);
	rec.files += 1;
	rec.loc += loc;
	if (loc > MAX_LOC) rec.oversized.push(posix(f));
}
for (const [f, ts] of edges) {
	const from = unitOf(f);
	for (const t of ts) {
		const to = unitOf(t);
		if (to === from) continue;
		units.get(to).importers.add(posix(f));
		if (to !== "(root files)") units.get(from).dependsOn.add(to);
	}
}
for (const [u, rec] of units) if (rec.files === 0) units.delete(u);

const rows = [...units].filter(([u]) => u !== "(root files)").sort((a, b) => b[1].importers.size - a[1].importers.size || a[0].localeCompare(b[0]));
const dead = rows.filter(([u, r]) => r.importers.size === 0 && !ENTRIES.has(u));
const oversized = [...units.values()].flatMap((r) => r.oversized).sort();
const loose = units.get("(root files)")?.files ?? 0;
const rootRel = relative(REPO, ROOT).split(sep).join("/");

const lines = [
	"# Codebase map (generated — do not edit)",
	"",
	`Regenerate with the map script; the build fails when this file is stale. Source root: \`${rootRel}/\`.`,
	"This file owns the facts that drift. ARCHITECTURE.md owns the meaning.",
	"",
	`**Definitions** — *Importers*: distinct non-test files outside the module that import it (static or dynamic). ` +
		`*Size*: S <250 · M <1k · L <3k · XL ≥3k non-test lines. *Oversized*: non-test files over ${MAX_LOC} lines.`,
	"",
	`**Totals:** ${rows.length} modules · ${dead.length} with no importer · ${prod.length} non-test source files · ` +
		`${loose} loose files at the source root · ${oversized.length} oversized files.`,
	"",
	"## Modules",
	"",
	"| Module | Importers | Files | Size | Oversized |",
	"|---|--:|--:|:--:|--:|",
	...rows.map(([u, r]) => `| \`${rootRel}/${u}/\`${ENTRIES.has(u) ? " *(entrypoint)*" : ""} | ${r.importers.size} | ${r.files} | ${tier(r.loc)} | ${r.oversized.length || ""} |`),
	"",
	"## Module dependencies",
	"",
	"Which modules each module imports from. A new entry here is a new coupling — review it.",
	"",
	"| Module | Depends on |",
	"|---|---|",
	...rows.map(([u, r]) => `| \`${u}/\` | ${[...r.dependsOn].sort().map((d) => `\`${d}\``).join(", ") || "—"} |`),
	"",
	"## No live importer",
	"",
	dead.length ? dead.map(([u]) => `- \`${rootRel}/${u}/\` — dead, or reached at runtime (then pass \`--entry ${u}\`)`).join("\n") : "None.",
	"",
	"## Oversized files",
	"",
	oversized.length ? oversized.map((p) => `- \`${rootRel}/${p}\``).join("\n") : "None.",
	"",
];
const output = lines.join("\n");

if (CHECK) {
	const current = existsSync(OUT) ? readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
	if (current !== output) {
		console.error(`${relative(REPO, OUT)} is stale — regenerate it with the codebase map script and commit the result.`);
		process.exit(1);
	}
	console.log(`${relative(REPO, OUT)} is current.`);
} else {
	mkdirSync(dirname(OUT), { recursive: true });
	writeFileSync(OUT, output);
	console.log(`wrote ${relative(REPO, OUT)} (${rows.length} modules, ${dead.length} dead, ${oversized.length} oversized)`);
}
