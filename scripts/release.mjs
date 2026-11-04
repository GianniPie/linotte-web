// Bumps the app version everywhere it lives, in one go:
//   npm run release -- patch    (2.8.0 -> 2.8.1: fixes only)
//   npm run release -- minor    (2.8.0 -> 2.9.0: new features)
//   npm run release -- major    (2.8.0 -> 3.0.0: big or breaking changes)
// It updates public/version.js (what the app shows), package.json, the
// service worker's cache name (so installed copies pick up the new files),
// and turns CHANGELOG.md's "Unreleased" notes into a dated section for the
// new version. It doesn't commit or tag: review the diff, then commit.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = (p) => path.join(root, p);
const kind = process.argv[2];
if (!["patch", "minor", "major"].includes(kind)) {
  console.error("usage: npm run release -- patch|minor|major");
  process.exit(1);
}

const versionSrc = fs.readFileSync(file("public/version.js"), "utf8");
const current = versionSrc.match(/VERSION = "(\d+)\.(\d+)\.(\d+)"/);
if (!current) throw new Error("no VERSION in public/version.js");
let [major, minor, patch] = current.slice(1).map(Number);
if (kind === "major") { major++; minor = 0; patch = 0; }
if (kind === "minor") { minor++; patch = 0; }
if (kind === "patch") { patch++; }
const next = `${major}.${minor}.${patch}`;

const changelog = fs.readFileSync(file("CHANGELOG.md"), "utf8");
const unreleased = changelog.match(/## \[Unreleased\]\n([\s\S]*?)(?=\n## \[|$)/);
if (!unreleased || !unreleased[1].trim()) {
  console.error('CHANGELOG.md has nothing under "## [Unreleased]": write what changed first.');
  process.exit(1);
}

fs.writeFileSync(file("public/version.js"), versionSrc.replace(current[0], `VERSION = "${next}"`));

const pkgPath = file("package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const swPath = file("public/sw.js");
fs.writeFileSync(swPath, fs.readFileSync(swPath, "utf8")
  .replace(/const CACHE_VERSION = "[^"]*";/, `const CACHE_VERSION = "linotte-v${next}";`));

const date = new Date().toISOString().slice(0, 10);
fs.writeFileSync(file("CHANGELOG.md"), changelog.replace(
  "## [Unreleased]\n",
  `## [Unreleased]\n\n## [${next}] - ${date}\n`,
));

console.log(`${current[0].slice(11, -1)} -> ${next}`);
console.log("Updated public/version.js, package.json, public/sw.js and CHANGELOG.md. Review, then commit.");
