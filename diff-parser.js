// parse-diff.js
import { execSync } from 'child_process';
import parse from 'diffparser';

const rawDiff = execSync('git diff', { encoding: 'utf8' });
console.log("Raw diff output:\n", rawDiff);

// Use a library to help parse hunks and files
const parsed = parse(rawDiff);

// Transform to our desired JSON format
const structured = parsed.files.map(file => ({
  file: file.to || file.from,
  changes: file.chunks.map(chunk => ({
    type: "modification",
    before: chunk.changes
      .filter(c => c.type === 'del')
      .map(c => c.content.trim()),
    after: chunk.changes
      .filter(c => c.type === 'add')
      .map(c => c.content.trim())
  }))
}));

console.log(JSON.stringify(structured, null, 2));
