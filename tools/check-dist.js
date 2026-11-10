#!/usr/bin/env node
/**
 * Verifies every game's build output and package.json entry points.
 *
 *   node tools/check-dist.js
 *
 * For each packages/<game>: dist/public-api.{js,mjs,d.ts,d.mts} and
 * dist/umd/index.global.js exist, and main/module/types/umd/unpkg/exports
 * of package.json point at existing files. Exits with 1 on the first
 * missing file so a broken build never reaches `npm publish`.
 */
const fs = require("fs");
const path = require("path");

const packagesDir = path.resolve(__dirname, "../packages");
const OUTPUTS = [
  "dist/public-api.js",
  "dist/public-api.mjs",
  "dist/public-api.d.ts",
  "dist/public-api.d.mts",
  "dist/umd/index.global.js",
];

function entryPoints(pkg) {
  const points = [pkg.main, pkg.module, pkg.types, pkg.umd, pkg.unpkg];
  for (const entry of Object.values(pkg.exports ?? {})) {
    points.push(...(typeof entry === "string" ? [entry] : Object.values(entry)));
  }
  return points.filter(Boolean);
}

let failed = false;
for (const name of fs.readdirSync(packagesDir).sort()) {
  const dir = path.join(packagesDir, name);
  if (!fs.existsSync(path.join(dir, "package.json"))) continue;
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  const missing = [...new Set([...OUTPUTS, ...entryPoints(pkg)])].filter(
    (file) => !fs.existsSync(path.join(dir, file)),
  );
  if (missing.length) {
    failed = true;
    console.error(`${pkg.name}: missing ${missing.join(", ")}`);
  } else {
    console.log(`${pkg.name}@${pkg.version}: dist complete`);
  }
}
process.exit(failed ? 1 : 0);
