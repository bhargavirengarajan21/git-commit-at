#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

console.log("🐳 Running git-commit-at...");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const composeFile = path.resolve(__dirname, './docker-compose.yml');

try {
  // 1️⃣ Start Ollama
  console.log("🔍 Starting Ollama...");
  execSync(`docker compose -f ${composeFile} up -d ollama`, { stdio: 'inherit' });

  // 2️⃣ Run commit-at service (builds if needed)
  console.log("🚀 Running Commit-At CLI...");
  execSync(`docker compose -f ${composeFile} run --rm -it commit-at`, { stdio: 'inherit' });

} catch (err) {
  console.error("❌ Error running git-commit-at:", err.message);
  process.exit(1);
}
