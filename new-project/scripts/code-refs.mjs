#!/usr/bin/env node
/**
 * Symbol-level references for a TypeScript/JavaScript project, answered by
 * the TypeScript language service — the compiler's own resolution. A renamed
 * import (`import { a as b }`), a re-export through a barrel, a namespace
 * import and a method called through a type all count, where a text search
 * either misses them or matches every unrelated word of the same name.
 *
 * The codebase map answers "which modules import this module"; this answers
 * "who uses this function, class, type or member, and where". On demand only:
 * it reads the tree the moment it runs, so it is never stale.
 *
 * Usage:
 *   node code-refs.mjs <Name>               every top-level declaration named <Name>, with its uses
 *   node code-refs.mjs <Name.member>        a member of a class, interface or object literal
 *   node code-refs.mjs <file>#<Name>        only the declaration in <file>
 *   node code-refs.mjs --duplicates         exported names declared in more than one non-test file
 * Options:
 *   --project <tsconfig>   default: tsconfig.json
 *   --tests                list each use in test files (default: test files are counted, not listed)
 *
 * Needs the project's own `typescript` package. Python is not covered: use the
 * codebase map's --deps for module-level questions and a search for symbols.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const opt = (name, dflt) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : dflt;
};
const REPO = process.cwd();
const PROJECT = resolve(REPO, opt("--project", "tsconfig.json"));
const QUERY = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--project");
const DUPLICATES = args.includes("--duplicates");
const LIST_TESTS = args.includes("--tests");

if (!QUERY && !DUPLICATES) {
	console.error("usage: code-refs.mjs <Name> | <Name.member> | <file>#<Name> | --duplicates  [--project tsconfig.json] [--tests]");
	process.exit(2);
}

let ts;
try {
	ts = createRequire(join(REPO, "package.json"))("typescript");
} catch {
	console.error("code-refs needs the project's own `typescript` package (npm i -D typescript).");
	process.exit(2);
}
if (!existsSync(PROJECT)) {
	console.error(`tsconfig not found: ${PROJECT} (pass --project)`);
	process.exit(2);
}

const started = Date.now();
const parsed = ts.getParsedCommandLineOfConfigFile(PROJECT, {}, {
	...ts.sys,
	onUnRecoverableConfigFileDiagnostic: (d) => {
		console.error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
		process.exit(2);
	},
});
const service = ts.createLanguageService({
	getScriptFileNames: () => parsed.fileNames,
	getScriptVersion: () => "0",
	getScriptSnapshot: (f) => (existsSync(f) ? ts.ScriptSnapshot.fromString(readFileSync(f, "utf8")) : undefined),
	getCurrentDirectory: () => REPO,
	getCompilationSettings: () => parsed.options,
	getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
	fileExists: ts.sys.fileExists,
	readFile: ts.sys.readFile,
	readDirectory: ts.sys.readDirectory,
	directoryExists: ts.sys.directoryExists,
	getDirectories: ts.sys.getDirectories,
}, ts.createDocumentRegistry());
const program = service.getProgram();

const rel = (f) => relative(REPO, f).split(sep).join("/");
const isTest = (f) => /\.(test|spec)\.[^.]+$/.test(f) || /(^|\/)(__tests__|tests?)\//.test(rel(f));
const own = program.getSourceFiles().filter((sf) => !sf.isDeclarationFile && !/[\\/]node_modules[\\/]/.test(sf.fileName));

const kindOf = (node) => ts.SyntaxKind[node.kind].replace(/(Declaration|Statement|Signature|Assignment)$/, "").toLowerCase();
const isExported = (st) => !!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** Top-level declarations of a file: functions, classes, interfaces, types, enums, variables. */
function topLevelDecls(sf) {
	const out = [];
	for (const st of sf.statements) {
		const named = ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) ||
			ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st);
		if (named && st.name) out.push({ name: st.name.text, nameNode: st.name, kind: kindOf(st), exported: isExported(st), node: st });
		else if (ts.isVariableStatement(st)) {
			for (const d of st.declarationList.declarations) {
				if (ts.isIdentifier(d.name)) out.push({ name: d.name.text, nameNode: d.name, kind: "variable", exported: isExported(st), node: d });
			}
		}
	}
	return out;
}

/** Named members of a class, interface or object-literal variable. */
function membersOf(decl) {
	const n = decl.node;
	const list = ts.isClassDeclaration(n) || ts.isInterfaceDeclaration(n) ? n.members
		: ts.isVariableDeclaration(n) && n.initializer && ts.isObjectLiteralExpression(n.initializer) ? n.initializer.properties : [];
	return list
		.filter((m) => m.name && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)))
		.map((m) => ({ name: m.name.text, nameNode: m.name, kind: kindOf(m), exported: decl.exported, node: m }));
}

function lineOf(sf, pos) {
	const { line } = sf.getLineAndCharacterOfPosition(pos);
	const starts = sf.getLineStarts();
	return { line: line + 1, text: sf.text.slice(starts[line], starts[line + 1] ?? sf.text.length).trim() };
}

if (DUPLICATES) {
	const byName = new Map();
	for (const sf of own) {
		if (isTest(sf.fileName)) continue;
		for (const d of topLevelDecls(sf)) {
			if (!d.exported) continue;
			if (!byName.has(d.name)) byName.set(d.name, new Set());
			byName.get(d.name).add(`${rel(sf.fileName)} (${d.kind})`);
		}
	}
	const dups = [...byName].filter(([, s]) => s.size > 1).sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
	console.log(`# Exported names declared in more than one non-test file (${dups.length})`);
	console.log("Same name is not always the same job; each is a place to check for a second implementation.\n");
	for (const [name, files] of dups) {
		console.log(`${name} (${files.size})`);
		for (const f of [...files].sort()) console.log(`  ${f}`);
	}
	process.exit(0);
}

let fileFilter = null;
let symbol = QUERY;
if (QUERY.includes("#")) {
	const [file, name] = QUERY.split("#");
	fileFilter = resolve(REPO, file);
	symbol = name;
}
const [outer, member] = symbol.split(".");

const targets = [];
for (const sf of own) {
	if (fileFilter && resolve(sf.fileName) !== fileFilter) continue;
	for (const d of topLevelDecls(sf)) {
		if (d.name !== outer) continue;
		if (!member) targets.push({ sf, ...d, label: outer });
		else for (const m of membersOf(d)) if (m.name === member) targets.push({ sf, ...m, label: `${outer}.${member}` });
	}
}
if (targets.length === 0) {
	console.error(`No top-level declaration named ${symbol}${fileFilter ? ` in ${rel(fileFilter)}` : ""}. ` +
		"A local or nested name isn't indexed here: search for it, then pass <file>#<Name> for its enclosing declaration.");
	process.exit(1);
}

for (const t of targets) {
	const decl = lineOf(t.sf, t.nameNode.getStart(t.sf));
	const groups = service.findReferences(t.sf.fileName, t.nameNode.getStart(t.sf)) ?? [];
	const seen = new Set();
	const byFile = new Map();
	let imports = 0;
	let tests = 0;
	for (const g of groups) {
		for (const r of g.references) {
			const key = `${r.fileName}:${r.textSpan.start}`;
			if (seen.has(key) || r.isDefinition) continue;
			seen.add(key);
			const sf = program.getSourceFile(r.fileName);
			if (!sf || /[\\/]node_modules[\\/]/.test(r.fileName)) continue;
			const at = lineOf(sf, r.textSpan.start);
			if (/^(import\b|export\s*(\*|\{|type\s*\{))/.test(at.text) || /^\}\s*from\s/.test(at.text)) { imports += 1; continue; }
			if (isTest(r.fileName)) tests += 1;
			if (!byFile.has(r.fileName)) byFile.set(r.fileName, []);
			byFile.get(r.fileName).push(at);
		}
	}
	const prodFiles = [...byFile].filter(([f]) => !isTest(f)).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
	const testFiles = [...byFile].filter(([f]) => isTest(f)).sort((a, b) => a[0].localeCompare(b[0]));
	const prodUses = prodFiles.reduce((n, [, l]) => n + l.length, 0);
	console.log(`\n## ${t.label} — ${t.kind}${t.exported ? ", exported" : ""}, ${rel(t.sf.fileName)}:${decl.line}`);
	console.log(`${prodUses} uses in ${prodFiles.length} files · ${tests} in ${testFiles.length} test files · ${imports} import/re-export lines`);
	for (const [f, lines] of prodFiles) {
		console.log(`\n${rel(f)}`);
		for (const l of lines) console.log(`  ${String(l.line).padStart(5)}  ${l.text}`);
	}
	if (testFiles.length) {
		console.log("\ntests:");
		for (const [f, lines] of testFiles) {
			console.log(`  ${rel(f)} (${lines.length})`);
			if (LIST_TESTS) for (const l of lines) console.log(`    ${String(l.line).padStart(5)}  ${l.text}`);
		}
	}
}
console.error(`\n(${((Date.now() - started) / 1000).toFixed(1)}s, ${parsed.fileNames.length} files in the project)`);
