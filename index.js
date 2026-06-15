#!/usr/bin/env node

import fetch from 'node-fetch';
import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import { diffParser } from './diff-parser.js';
import { execSync as exec } from 'child_process';
import { configExists, readConfig, writeConfig, logCommit } from './config.js';

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/";
const MODEL = 'qwen2.5-coder:1.5b';

const banner = (title, subtitle = '') =>
  console.log(boxen(
    chalk.bold.cyan(title) + (subtitle ? '\n' + chalk.dim(subtitle) : ''),
    { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'cyan', borderStyle: 'round' }
  ));

const infoBox = (title, lines, color = 'yellow') =>
  console.log(boxen(
    chalk.bold[color](title + '\n') +
    lines.map(l => chalk.dim('  • ') + l).join('\n'),
    { padding: 1, borderColor: color, borderStyle: 'round' }
  ));

const getGitDiff = () => {
  try {
    const { structured, rawDiff } = diffParser();
    if (!Array.isArray(structured) || structured.length === 0) {
      console.log(chalk.yellow('No staged changes. Use `git add` before running.'));
      process.exit(0);
    }
    return { structured, rawDiff };
  } catch (error) {
    console.log(chalk.red('Failed to read git diff: ' + error.message));
    process.exit(1);
  }
};

const applyFormat = (format, commitMessage, ticket) => {
  return format
    .replace('<commit_message>', commitMessage)
    .replace('<ticket>', ticket || '')
    .trim();
};

const getSuggestionsFromOllama = async (diff, config) => {
  const prompt = `You are a commit message generator. Study the git diff carefully and write 3 specific commit messages.

Each message must answer: what file/code changed, and what does that change achieve?

FORMAT: <type>: <description>
TYPES: feat, fix, chore, refactor, style, docs, test

RULES:
- Be specific to THIS diff — no generic phrases.
- Mention the file or function name if relevant.
- Describe the purpose, not just the mechanics.
- One line each, under 15 words.
- No bullets, no markdown, no extra commentary.

GIT DIFF:
${diff}

OUTPUT (3 lines, numbered):
1.
2.
3.
`;

  const res = await fetch(`${OLLAMA_URL}api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: true,
      options: { temperature: 0.2, top_p: 0.9, top_k: 20 }
    }),
    timeout: 30000
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Ollama responded with ${res.status}: ${errorText}`);
  }

  process.stdout.write(chalk.dim('\n  Thinking: '));
  let fullResponse = '';
  for await (const chunk of res.body) {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.response) {
          process.stdout.write(chalk.cyan(data.response));
          fullResponse += data.response;
        }
      } catch {}
    }
  }
  process.stdout.write('\n\n');

  if (!fullResponse) throw new Error('No response received from Ollama.');

  const raw = fullResponse
    .split('\n')
    .map(s => s.replace(/^[\d]+[.)]\s*/, '').replace(/[`]/g, '').trim())
    .filter(s => s.length > 4 && s.length < 120)
    .slice(0, 3);

  if (raw.length === 0) throw new Error('Model returned no valid commit messages. Try again.');

  const result = raw.map(line => applyFormat(config.format, line, config.ticket));
  while (result.length < 3) result.push(result[0]);
  return result;
};

const runCommit = (msg) => {
  exec(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { stdio: 'inherit', cwd: '/git-repo' });
};

const getSessionUser = () => {
  const name = process.env.SESSION_USERNAME;
  const email = process.env.SESSION_EMAIL;

  if (name && email) {
    const config = { name, email, format: '<commit_message>' };
    if (!configExists()) {
      writeConfig(config);
    }
    return config;
  }

  if (configExists()) return readConfig();

  throw new Error('Not authenticated. Please login at http://localhost:7860');
};

const main = async () => {
  try {
    const config = getSessionUser();
    banner('git-commit-at', 'Welcome back, ' + config.name + '!');

    console.log('\n' + chalk.cyan('◆') + chalk.bold(' Analyzing staged changes...\n'));

    const { structured, rawDiff } = getGitDiff();

    infoBox('Staged changes', structured, 'yellow');

    fetch(`${OLLAMA_URL}api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: MODEL })
    }).catch(() => {});

    const { ticket } = await inquirer.prompt([{
      type: 'input',
      name: 'ticket',
      message: chalk.cyan('Ticket number') + chalk.dim(' (or leave blank):')
    }]);

    console.log('\n' + chalk.dim('  Variables: ') + chalk.cyan('<commit_message>') + chalk.dim('  ') + chalk.cyan('<ticket>'));
    console.log(chalk.dim('  Example:   ') + chalk.white('AB#<ticket> <commit_message>') + '\n');

    const { format } = await inquirer.prompt([{
      type: 'input',
      name: 'format',
      message: chalk.cyan('Commit format') + chalk.dim(' (or leave blank to use saved):')
    }]);

    const resolvedFormat = format.trim() || config.format;

    console.log('\n' + chalk.cyan('◆') + chalk.bold(' Generating commit suggestions...'));

    const suggestions = await getSuggestionsFromOllama(rawDiff, {
      ...config,
      format: resolvedFormat,
      ticket: ticket.trim()
    });

    infoBox('Suggestions', suggestions, 'green');

    const { message } = await inquirer.prompt([{
      type: 'list',
      name: 'message',
      message: chalk.cyan('Select a commit message:'),
      choices: suggestions
    }]);

    console.log('\n' + boxen(
      chalk.bold('Commit preview\n\n') + chalk.green(message),
      { padding: 1, borderColor: 'green', borderStyle: 'round' }
    ) + '\n');

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: chalk.cyan('Use this commit?')
    }]);

    if (!confirm) {
      console.log(chalk.yellow('\nCommit cancelled.\n'));
      process.exit(0);
    }

    runCommit(message);

    logCommit({
      name: config.name,
      email: config.email,
      message,
      ticket: ticket.trim() || null,
      format: resolvedFormat,
      repo: process.env.GIT_REPO_PATH || '/git-repo'
    });

    console.log('\n' + boxen(
      chalk.green('Committed: ') + chalk.bold(message),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'green', borderStyle: 'round' }
    ) + '\n');

  } catch (error) {
    console.log(chalk.red('\nError: ' + error.message + '\n'));
    process.exit(1);
  }
};

main();
