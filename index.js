#!/usr/bin/env node

import fetch from 'node-fetch';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { spec } from './conventional-comit.js';
import { diffParser } from './diff-parser.js';

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";

const ensureOllama = () =>{
  try {
    execSync("curl -s http://localhost:11434/api/version", { stdio: "ignore" });
  } catch {
    console.log("🚀 Starting Ollama via docker compose...");
    try {
      execSync("docker compose up -d ollama", { stdio: "inherit" });
    } catch (err) {
      console.error("❌ Could not start Ollama. Make sure Docker + docker-compose.yml are present.");
      process.exit(1);
    }
  }
};


const getGitDiff = () => {
  try {
    const diffArray = diffParser(); // returns array
    if (!Array.isArray(diffArray) || diffArray.length === 0) {
      console.log("✅ No staged changes. Use `git add` before running.");
      process.exit(0);
    }

    // turn into a readable string for prompt
    const diff = diffArray.join('\n');
    return diff;
  } catch (error) {
    console.log("❌ Failed to read git diff.", error.message);
    process.exit(1);
  }
};

const getSuggestionsFromOllama = async (diff, ticket_number) => {
  const instruction = spec();

  const prompt = ticket_number? `TASK:
1. Read this instruction: ${instruction}
2. Analyze the following Git diff:
${diff}

GOAL:
- Generate EXACTLY 3 commit messages.
- Each commit message must summarize ALL staged changes together in ONE line.
- Always include added, deleted, and modified files if they exist.
- Keep each message under 30 words.

FORMAT:
[Action #${ticket_number}]: <short description>

EXAMPLES:

Input diff:
diff --git a/app.js b/app.js
+ console.log("Hello");
- console.log("World");
new file mode 100644 app.test.js

Expected commit messages:
feat #123: add app.test.js and update app.js logging
refactor #123: introduce test file and adjust console output in app.js
chore #123: add test and tweak log message in app.js

---

Input diff:
diff --git a/styles.css b/styles.css
- body { color: red; }
+ body { color: blue; }
deleted file mode 100644 old.css

Expected commit messages:
style #456: change body color to blue and remove old.css
refactor #456: update CSS theme and delete obsolete stylesheet
chore #456: adjust styles and clean up unused file

---

Input diff:
diff --git a/server.js b/server.js
+ app.listen(3000);
- app.listen(4000);
new file mode 100644 routes.js

Expected commit messages:
feat #789: add routes.js and update server to listen on port 3000
refactor #789: introduce routes file and adjust server port
chore #789: add new routes and change server configuration

---

RULES:
- Exactly 3 lines, no more, no less.
- Do not use bullets, numbering, or extra commentary.
- Do not output markdown or code fences.
`: `TASK:
1. Read this instruction: ${instruction}
2. Analyze the following Git diff:
${diff}

GOAL:
- Generate EXACTLY 3 commit messages.
- Each commit message must summarize ALL staged changes together in ONE line.
- Always include added, deleted, and modified files if they exist.
- Keep each message under 30 words.

FORMAT:
[Action]: <short description>

EXAMPLES:

Input diff:
diff --git a/app.js b/app.js
+ console.log("Hello");
- console.log("World");
new file mode 100644 app.test.js

Expected commit messages:
feat #123: add app.test.js and update app.js logging
refactor #123: introduce test file and adjust console output in app.js
chore #123: add test and tweak log message in app.js

---

Input diff:
diff --git a/styles.css b/styles.css
- body { color: red; }
+ body { color: blue; }
deleted file mode 100644 old.css

Expected commit messages:
style #456: change body color to blue and remove old.css
refactor #456: update CSS theme and delete obsolete stylesheet
chore #456: adjust styles and clean up unused file

---

Input diff:
diff --git a/server.js b/server.js
+ app.listen(3000);
- app.listen(4000);
new file mode 100644 routes.js

Expected commit messages:
feat #789: add routes.js and update server to listen on port 3000
refactor #789: introduce routes file and adjust server port
chore #789: add new routes and change server configuration

---

RULES:
- Exactly 3 lines, no more, no less.
- Do not use bullets, numbering, or extra commentary.
- Do not output markdown or code fences.
`;
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5-coder:1.5b',
      prompt,
      stream: false
    }),
    timeout: 10000
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`❌ Ollama responded with ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  if (!data.response) {
    throw new Error("❌ No 'response' field received from Ollama.");
  }

  console.log("🤖 Ollama raw response:", data.response);

  // sanitize lines
  return data.response
    .split('\n')
    .map(s => s.replace(/^[-*\d.]+\s*/, '').replace(/[`]/g, '').trim()) // strip list markers/backticks
    .filter(Boolean)
    .slice(0, 3);
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
  return ticket.trim();
};

const runCommit = (msg) => {
  execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
};

const main = async () => {
  try {
    ensureOllama();
    const diff = getGitDiff();

    // Pull model to ensure it’s available
    await fetch("http://localhost:11434/api/pull", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'qwen2.5-coder:1.5b' })
    });

    const ticket_number = await askTicketNumber();
    const suggestions = await getSuggestionsFromOllama(diff, ticket_number);

    console.log("\n✅ Suggestions:\n", suggestions.join('\n'));

    const message = await askCommitMessage(suggestions);
    console.log(`\n📝 Commit preview:\n${message}\n`);

    const { confirm } = await inquirer.prompt([
      { type: 'confirm', name: 'confirm', message: 'Use this commit?' }
    ]);

    if (confirm) runCommit(message);
  } catch (error) {
    console.log("⚠️ Error:", error.message);
  }
};

main();
