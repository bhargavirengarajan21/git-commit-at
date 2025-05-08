#!/usr/bin/env node
import { execSync } from 'child_process';
import { platform } from 'os';
import { fileURLToPath } from 'url';
import path from 'path';
import process from 'process';

console.log("🐳 Launching git-commit-gpt Docker container...");

try {
  execSync('docker --version', { stdio: 'ignore' });
} catch {
  console.error('❌ Docker is not installed.');
  process.exit(1);
}

const imageName = 'git-commit-gpt';
try {
  const result = execSync(`docker images -q ${imageName}`, { encoding: 'utf8' });
  if (!result.trim()) {
    console.error(`❌ Image "${imageName}" not found. Run:\n  docker build -t ${imageName} .`);
    process.exit(1);
  }
} catch {
  console.error('❌ Failed to check Docker image.');
  process.exit(1);
}

// Mount user's repo and your tool source cleanly
let repoPath = process.cwd();


let toolPath = path.dirname(fileURLToPath(import.meta.url));

if (platform() === 'win32') {
  repoPath = repoPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (_, d) => `/${d.toLowerCase()}`);
  toolPath = toolPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (_, d) => `/${d.toLowerCase()}`);
}

const dockerCommand = `docker run --rm \
  -v "${toolPath}:/app" \
  -v "${repoPath}:/repo" \
  -w /repo \
  ${imageName} sh -c "ollama serve & sleep 3 && node /app/index.js"`;

try {
  execSync(dockerCommand, { stdio: 'inherit' });
} catch (err) {
  console.error('❌ Error running git-commit-gpt:', err.message);
  process.exit(1);
}
