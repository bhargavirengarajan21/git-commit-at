#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import net from 'net';
import { createClient } from 'redis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const composeFile = path.resolve(__dirname, './docker-compose.yml');

const getGitRoot = () => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

const cwd = process.cwd();
const gitRoot = getGitRoot();

const run = (cmd, opts = {}) =>
  execSync(cmd, { stdio: 'inherit', ...opts });

// TCP probe — avoids HTTP-layer issues on Windows
const portOpen = (host, port) => new Promise(resolve => {
  const socket = new net.Socket();
  socket.setTimeout(1000);
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error',   () => { socket.destroy(); resolve(false); });
  socket.once('timeout', () => { socket.destroy(); resolve(false); });
  socket.connect(port, host);
});

const startServices = () => {
  console.log('\n  Starting Redis, Gradio, and Ollama...\n');
  run(`docker compose -f "${composeFile}" up -d redis ollama gradio`);
};

const waitForGradio = async () => {
  process.stdout.write('  Waiting for Gradio UI to be ready');
  for (let i = 0; i < 40; i++) {
    if (await portOpen('localhost', 7860)) {
      process.stdout.write(' ✓\n');
      return;
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Gradio UI failed to start. Check: docker compose logs gradio');
};

const waitForSession = async (redis) => {
  const existing = await redis.get('active_session');
  if (existing) return JSON.parse(existing);

  console.log('\n  ┌─────────────────────────────────────────┐');
  console.log('  │  Login at: http://localhost:7860        │');
  console.log('  │  Waiting for you to authenticate...     │');
  console.log('  └─────────────────────────────────────────┘\n');

  const LOGIN_TIMEOUT = 5 * 60 * 1000;
  const start = Date.now();

  while (Date.now() - start < LOGIN_TIMEOUT) {
    const raw = await redis.get('active_session');
    if (raw) return JSON.parse(raw);
    await new Promise(r => setTimeout(r, 1000));
  }

  throw new Error('Login timed out after 5 minutes. Please run git-commit-at again.');
};

const generateBranchGraph = (redis) => {
  try {
    redis.set('current_repo', gitRoot);
    console.log('  Generating branch graph...');
    run(
      `docker compose -f "${composeFile}" run --rm` +
      ` -v "${gitRoot}:/git-repo"` +
      ` gradio python /app/generate_graph.py`
    );
    console.log('  Branch graph ready.\n');
  } catch (err) {
    console.log('  Warning: Branch graph generation failed\n');
    console.log(`  Details: ${err.message}\n`);
  }
};

const runCommit = (session) => {
  const tty = process.stdin.isTTY ? '-it' : '-i';
  run(
    `docker compose -f "${composeFile}" run --rm ${tty}` +
    ` -v "${gitRoot}:/git-repo"` +
    ` -e SESSION_USERNAME=${session.username}` +
    ` -e SESSION_EMAIL=${session.email}` +
    ` commit-at`
  );
};

const main = async () => {
  let redis = null;
  try {
    if (!gitRoot) {
      console.error('\n  Error: Not inside a git repository. Run git-commit-at from a git repo.\n');
      process.exit(1);
    }

    const redisUp  = await portOpen('localhost', 6379);
    const gradioUp = await portOpen('localhost', 7860);

    if (!redisUp || !gradioUp) {
      startServices();
    }

    await waitForGradio();

    redis = createClient({ url: 'redis://localhost:6379' });
    redis.on('error', () => {});
    await redis.connect();

    const session = await waitForSession(redis);
    console.log(`\n  Logged in as ${session.username}.`);

    console.log('  Starting commit flow...\n');
    runCommit(session);

    try {
      generateBranchGraph(redis);
    } catch (graphErr) {
      console.log('  (Branch graph generation failed, continuing)\n');
    }
  } catch (err) {
    console.error('\n  Error:', err.message, '\n');
    process.exit(1);
  } finally {
    if (redis) {
      redis.quit().catch(() => {});
    }
  }
};

main();
