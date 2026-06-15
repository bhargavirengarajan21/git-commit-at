// parse-diff.js
import { execSync } from 'child_process';
import parse from 'diffparser';

export const diffParser = () => {
  const rawDiff = execSync('git diff --cached', { encoding: 'utf8', cwd: '/git-repo' });

  const parsed = parse(rawDiff);
  const structured = [];

  parsed.forEach(file => {
    if (file.new || file.from === '/dev/null') {
      structured.push(`${file.to} was added`);
      return;
    }
    if (file.deleted || file.to === '/dev/null') {
      structured.push(`${file.from} was deleted`);
      return;
    }
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

  return { structured, rawDiff };
};
