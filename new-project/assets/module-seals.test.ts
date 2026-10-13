/**
 * Module seals: code outside a sealed module may import it only through its
 * public entry points. An agent can then learn a module from its index file
 * alone, and a reach into internals fails here instead of silently coupling
 * two modules.
 *
 * Add a row to SEALS when a module gains a few outside importers (the
 * generated codebase map shows importer counts). If a symbol is missing from
 * a module's public surface, export it from the entry point — don't loosen
 * the seal.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Directory containing this test = the source root. Adjust if the test lives elsewhere.
const SRC = fileURLToPath(new URL(".", import.meta.url));

interface Seal {
	/** Module directory, relative to SRC. */
	dir: string;
	/** Allowed paths inside the module, relative to it, without extension. "index" = the front door. */
	publicEntries: string[];
}

const SEALS: Seal[] = [
	// { dir: "billing", publicEntries: ["index"] },
];

const SPECIFIER = /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)["'`]([^"'`]+)["'`]/g;

function* sourceFiles(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules") continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) yield* sourceFiles(full);
		else if (/\.(ts|tsx|mts|cts|js|jsx|mjs)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) yield full;
	}
}

function violationsFor(seal: Seal): string[] {
	const moduleDir = resolve(SRC, seal.dir);
	const allowed = new Set(seal.publicEntries.map((e) => resolve(moduleDir, e)));
	const out: string[] = [];
	for (const file of sourceFiles(SRC)) {
		if (file.startsWith(moduleDir + sep)) continue;
		const text = readFileSync(file, "utf8");
		for (const m of text.matchAll(SPECIFIER)) {
			const spec = m[1];
			if (!spec.startsWith(".")) continue;
			const target = resolve(file, "..", spec).replace(/\.(m|c)?[jt]sx?$/, "");
			const inside = target === moduleDir || target.startsWith(moduleDir + sep);
			if (!inside) continue;
			const entry = target === moduleDir ? resolve(moduleDir, "index") : target;
			if (allowed.has(entry)) continue;
			const line = text.slice(0, m.index).split("\n").length;
			out.push(`${relative(SRC, file)}:${line} → "${spec}"`);
		}
	}
	return out;
}

describe("module seals", () => {
	it.each(SEALS.length ? SEALS : [null])("%o is imported only through its public entries", (seal) => {
		if (!seal) return; // no seals yet
		const violations = violationsFor(seal);
		expect(
			violations,
			`Deep imports into ${seal.dir}/ — import from ${seal.publicEntries.map((e) => `${seal.dir}/${e}`).join(" or ")} ` +
				`(export the symbol there if it is missing):\n  ${violations.join("\n  ")}`,
		).toEqual([]);
	});
});
