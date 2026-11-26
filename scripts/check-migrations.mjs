// Checks the migration files (#246): numbers are unique, and a file added on this branch never sorts before the
// highest file already on the base branch. The runner refuses such a file at deploy time because production has
// already applied the later one. Pass the base ref as the first argument (default origin/main).
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function findProblems(files, baseFiles) {
  const problems = [];
  const seen = new Map();
  for (const name of files) {
    const prefix = name.split('_')[0];
    if (seen.has(prefix))
      problems.push(`Duplicate migration number ${prefix}: ${seen.get(prefix)} and ${name}`);
    else seen.set(prefix, name);
  }
  const base = new Set(baseFiles);
  const highest = [...baseFiles].sort().at(-1);
  for (const name of files) {
    if (!base.has(name) && highest && name < highest) {
      problems.push(
        `New migration ${name} sorts before ${highest}, which is already on the base branch; renumber it`,
      );
    }
  }
  return problems;
}

function main() {
  const dir = fileURLToPath(new URL('../database/migrations/', import.meta.url));
  const files = readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .sort();
  const ref = process.argv[2] ?? 'origin/main';
  let baseFiles = [];
  try {
    const out = execFileSync('git', ['ls-tree', '--name-only', `${ref}:database/migrations/`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    baseFiles = out.split('\n').filter((n) => n.endsWith('.sql'));
  } catch {
    console.warn(`check-migrations: ${ref} is not available, only the number check runs`);
  }
  const problems = findProblems(files, baseFiles);
  for (const p of problems) console.error(p);
  if (problems.length > 0) process.exit(1);
  console.log(`check-migrations: ${files.length} files ok`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
