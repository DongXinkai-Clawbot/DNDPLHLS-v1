
// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

// Lightweight repo sanity check:
// Ensures every RELATIVE import/export ("./" or "../") resolves to a real file.
// This prevents the classic "orphan/duplicate file with broken imports" problem
// from silently creeping back in.

const ROOT = path.resolve(process.cwd());
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json"]; // resolution candidates

const isCodeFile = (p) => p.endsWith(".ts") || p.endsWith(".tsx");
const shouldSkipDir = (dirName) => dirName === "node_modules" || dirName === "dist";

const importRe = /^\s*import\s+(?:[^;]*?\s+from\s+)?["'](\.[^"']*)["']\s*;?\s*$/gm;
const exportFromRe = /^\s*export\s+[^;]*?\s+from\s+["'](\.[^"']*)["']\s*;?\s*$/gm;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

function resolveRelative(fromFile, rel) {
  const base = path.resolve(path.dirname(fromFile), rel);

  // explicit extension? just check that one
  if (path.extname(base)) {
    if (fs.existsSync(base)) return base;
    const ext = path.extname(base);
    const withoutExt = base.slice(0, -ext.length);
    if (ext === ".js") {
      if (fs.existsSync(withoutExt + ".ts")) return withoutExt + ".ts";
      if (fs.existsSync(withoutExt + ".tsx")) return withoutExt + ".tsx";
    } else if (ext === ".jsx") {
      if (fs.existsSync(withoutExt + ".tsx")) return withoutExt + ".tsx";
      if (fs.existsSync(withoutExt + ".ts")) return withoutExt + ".ts";
    }
    return null;
  }

  // try file.ext
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) return candidate;
  }

  // try directory index
  for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
    const candidate = path.join(base, "index" + ext);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function findRelativeSpecifiers(sourceText) {
  const out = [];
  for (const re of [importRe, exportFromRe]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(sourceText)) !== null) out.push(m[1]);
  }
  return out;
}

const problems = [];

for (const file of walk(ROOT)) {
  if (!isCodeFile(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  const rels = findRelativeSpecifiers(text);
  for (const rel of rels) {
    const resolved = resolveRelative(file, rel);
    if (!resolved) {
      problems.push({
        file: path.relative(ROOT, file),
        specifier: rel
      });
    }
  }
}

if (problems.length) {
  console.error("\n[check-relative-imports] Missing relative import targets:\n");
  for (const p of problems) {
    console.error(`- ${p.file}  ->  "${p.specifier}"`);
  }
  console.error("\nFix: correct the path, or delete the orphan file that isn't part of the app.\n");
  process.exit(1);
}

console.log("[check-relative-imports] OK — all relative imports resolve.");
