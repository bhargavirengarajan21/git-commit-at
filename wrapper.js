#!/usr/bin/env node

import { execSync } from 'child_process';
import { platform } from 'os';
import { fileURLToPath } from 'url';
import path from 'path';

console.log("🐳 Running git-commit-gpt container...");

let toolPath = path.dirname(fileURLToPath(import.meta.url));
let repoPath = process.cwd();

if (platform() === 'win32') {
  toolPath = path.resolve(toolPath)
    .replace(/\\/g, '/')
    .replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);
  repoPath = path.resolve(repoPath)
    .replace(/\\/g, '/')
    .replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);
}

const dockerCommand = `docker run --rm -it \
  -v "${toolPath}:/app" \
  -v "${repoPath}:/repo" \
  -w /repo \
  git-commit-gpt node /app/index.js`;

try {
  execSync(dockerCommand, { stdio: 'inherit' });
} catch (err) {
  console.error('❌ Error running git-commit-gpt:', err.message);
  process.exit(1);
}
