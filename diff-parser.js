// parse-diff.js
import { execSync } from 'child_process';
import parse from 'diffparser';

export const diffParser = () => {
  const rawDiff = execSync('git diff --cached', { encoding: 'utf8' });
  console.log("Raw diff output:\n", rawDiff);

  const parsed = parse(rawDiff);
  const structured = [];

  parsed.forEach(file => {
    // Handle new files
    if (file.new || file.from === '/dev/null') {
      structured.push(`${file.to} was added`);
      return;
    }

    // Handle deleted files
    if (file.deleted || file.to === '/dev/null') {
      structured.push(`${file.from} was deleted`);
      return;
    }

    // Handle modified files
    if (file.chunks?.length) {
      file.chunks.forEach(chunk => {
        const beforeLines = chunk.changes
          .filter(c => c.type === 'del')
          .map(c => c.content.trim());
        const afterLines = chunk.changes
          .filter(c => c.type === 'add')
          .map(c => c.content.trim());

        if (beforeLines.length || afterLines.length) {
          structured.push(
            `${file.to || file.from} modified from ${beforeLines.join(' | ')} to ${afterLines.join(' | ')}`
          );
        }
      });
    }
  });

  console.log("Parsed diff output:\n", JSON.stringify(structured, null, 2));
  return structured; // return array instead of string
};
