#!/usr/bin/env node

/**
 * Build and install VSIX extension.
 * Output filename: {name}-{version}.vsix
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const { name, version } = pkg;
const vsixName = `${name}-${version}.vsix`;
const buildDir = path.join(root, "build");
const vsixPath = path.join(buildDir, vsixName);

fs.mkdirSync(buildDir, { recursive: true });

console.log(`Packaging ${vsixName} ...`);
execSync(`npx @vscode/vsce package -o "${vsixPath}"`, { cwd: root, stdio: "inherit" });

console.log(`\nInstalling ${vsixName} ...`);
execSync(`code --install-extension "${vsixPath}" --force`, { cwd: root, stdio: "inherit" });

console.log(`\nDone: ${vsixPath}`);
