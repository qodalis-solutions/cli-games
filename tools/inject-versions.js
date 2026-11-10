#!/usr/bin/env node
/**
 * Writes each game's version into its src/lib/version.ts (LIBRARY_VERSION)
 * and copies the version of packages/2048 to the root package.json.
 *
 *   node tools/inject-versions.js
 *
 * Every game shares one version; packages/2048 is the canonical source.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packagesDir = path.join(root, "packages");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeVersionFiles() {
  for (const name of fs.readdirSync(packagesDir).sort()) {
    const dir = path.join(packagesDir, name);
    const packageJson = path.join(dir, "package.json");
    const versionFile = path.join(dir, "src", "lib", "version.ts");
    if (!fs.existsSync(packageJson) || !fs.existsSync(path.dirname(versionFile))) continue;
    const { version } = readJson(packageJson);
    fs.writeFileSync(
      versionFile,
      `\n// Automatically generated during build\nexport const LIBRARY_VERSION = '${version}';\nexport const API_VERSION = 2;\n  `,
      "utf8",
    );
    console.log(`Version ${version} written to packages/${name}/src/lib/version.ts`);
  }
}

function writeWorkspaceVersion() {
  const { version } = readJson(path.join(packagesDir, "2048", "package.json"));
  const rootPackage = path.join(root, "package.json");
  const pkg = readJson(rootPackage);
  pkg.version = version;
  fs.writeFileSync(rootPackage, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log(`Workspace package.json version updated to ${version}`);
}

writeVersionFiles();
writeWorkspaceVersion();
