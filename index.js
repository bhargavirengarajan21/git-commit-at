#!/usr/bin/env node
import fetch from 'node-fetch';
import inquirer from 'inquirer';
import { execSync } from 'child_process';

console.log("🚀 git-commit-gpt running inside Docker...");

console.log('isTTY:', process.stdin.isTTY); // should be true


const getGitDiff = () => {
  try {
    const diff = execSync('git diff --cached --unified=5', {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 5 // 5MB buffer
    });
    if (!diff.trim()) {
      console.log("✅ No staged changes. Use `git add` before running.");
      process.exit(0);
    }
    return diff;
  } catch(error) {
    console.log("❌ Failed to read git diff.",error.message);
    process.exit(1);
  }
};

const getSuggestionsFromOllama = async (diff, ticket_number) => {
  let prompt;
  console.log("ticket number",ticket_number)
  if(ticket_number) {
    prompt = `Generate 6 commit messages in Conventional Commits format for all ${diff}. Follow this structure:\n\n[Action #${ticket_number}]: <short description>\n\n. Dont add anyother line, short description should maximum 50 characters summary of all changes`;
  } else {
    prompt = `for a software engineer Based on the following staged code changes: ${diff} Generate exactly 3 clear, concise, and professional "Git commit messages" using the format <Action>: <Short Commit message>. Only return the 3 commit messages, one per line, with no extra commentary.`;
  }
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'codellama:7b-instruct',
      prompt: prompt,
      stream: false
    }),
    timeout: 3000
  });
 

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`❌ Ollama responded with ${res.status}: ${errorTextcl}`);
  }

  const data = await res.json();
  console.log(data);
  if (!data.response) {
    throw new Error("❌ No 'response' field received from Ollama.");
  }

  return data.response
    .split('\n')
    .filter(line => line.trim())
    .slice(0, 4);
};

const askCommitMessage = async (suggestions) => {
  const { message } = await inquirer.prompt([
    {
      type: 'list',
      name: 'message',
      message: 'Select a commit message:',
      choices: suggestions
    }
  ]);
  return message;
};


const askTicketNumber = async () => {
  const { ticket } = await inquirer.prompt([
    {
      type: 'input',
      name: 'ticket',
      message: 'Enter ticket number (or leave blank):'
    }
  ]);
  console.log(ticket);
  return ticket;
};


const runCommit = (msg) => {
  execSync(`git commit -m "${msg}"`, { stdio: 'inherit' });
};

const main = async () => {
  try {
    const diff = getGitDiff();

    // Pull mistral if not yet loaded
    await fetch('http://localhost:11434/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'codellama:7b-instruct' })
    });
    console.log("pull done")
    const ticket_number = await askTicketNumber();
    console.log("ticker",ticket_number);
    const suggestions = await getSuggestionsFromOllama(diff, ticket_number);
    console.log("after log", suggestions);
    const message = await askCommitMessage(suggestions);
    console.log(`\n📝 Commit preview:\n${message}\n`);
    const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: 'Use this commit?' }]);
    if (confirm) runCommit(message);
  } catch(error) {
    console.log(error.message);
  }
};

main();
