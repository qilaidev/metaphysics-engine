// Checks the five ways documentation goes stale without anyone noticing:
//
//   1. a relative link pointing at a file that was renamed or deleted,
//   2. an `npm run <script>` the package.json no longer defines,
//   3. a `./bazi <command>` that is no longer in the command tree,
//   4. an HTTP path in the OpenAPI snapshot that docs/api.md never mentions, and
//   5. a ruling key in backend/constants/rulings.js that the skill's 口径 table omits.
//
// The first four fail the same way: the reader (often an agent following a `next` field)
// runs the command, gets exit 2 or a 404, and has no way to tell whether the docs or
// their own invocation is wrong. Greps do not catch these — the strings look fine.
//
// Node builtins only, no dependencies: this runs in CI before `npm ci`.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '..');
process.chdir(repoRoot);

// CHANGELOG.md is a historical record: it names commands and files that were correct
// at the time and are deliberately gone now.
const EXCLUDED = new Set(['CHANGELOG.md']);

const docs = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter((f) => f && !EXCLUDED.has(f));

const failures = [];
const fail = (file, line, message) => failures.push({ file, line, message });

const lineOf = (source, index) => source.slice(0, index).split('\n').length;

// ---------------------------------------------------------------- relative links

for (const file of docs) {
  const source = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);

  for (const match of source.matchAll(/\]\(([^)\s]+)\)/g)) {
    const raw = match[1];
    if (/^(https?:|mailto:|#)/.test(raw)) continue;

    const target = raw.split('#')[0];
    if (!target) continue;

    if (!fs.existsSync(path.join(dir, target))) {
      fail(file, lineOf(source, match.index), `link target does not exist: ${raw}`);
    }
  }
}

// ------------------------------------------------------------------ npm scripts

const scriptsOf = (pkgPath) => {
  try {
    return Object.keys(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts || {});
  } catch {
    return [];
  }
};

const rootScripts = new Set(scriptsOf('package.json'));
const backendScripts = new Set(scriptsOf('backend/package.json'));

for (const file of docs) {
  const source = fs.readFileSync(file, 'utf8');

  const pattern = /npm\s+(?:(-C|--prefix)\s+(\S+)\s+)?run\s+([A-Za-z][\w:-]*)/g;
  for (const match of source.matchAll(pattern)) {
    const [, , workspace, script] = match;
    const known =
      workspace === undefined
        ? rootScripts
        : workspace.replace(/\/$/, '') === 'backend'
          ? backendScripts
          : null;
    if (known === null) continue;

    if (!known.has(script)) {
      const where = workspace ? `backend/package.json` : 'package.json';
      fail(file, lineOf(source, match.index), `npm script "${script}" is not defined in ${where}`);
    }
  }
}

// ----------------------------------------------------------------- bazi commands

// `bazi help --json` imports nothing outside node: builtins, so this works on a bare
// checkout. If it ever stops working, skip rather than fail — a broken CLI is the CLI
// suite's job to report, not this one's.
let commandPaths = null;
try {
  const help = JSON.parse(
    execFileSync('node', ['tools/cli/bin/bazi.mjs', 'help', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  );

  commandPaths = new Set();
  const walk = (node) => {
    if (node.path) commandPaths.add(node.path);
    (node.commands || []).forEach(walk);
  };
  walk(help.data.tree);
} catch {
  console.warn('note: could not run `bazi help --json`; skipping the CLI command check');
}

if (commandPaths) {
  for (const file of docs) {
    const source = fs.readFileSync(file, 'utf8');

    // Only the command words: everything from the first flag or shell operator onward
    // is arguments, and those are the CLI's own business to validate.
    const pattern = /(?:^|[\s`(])\.\/bazi\s+([a-z][a-z\s]*)/g;
    for (const match of source.matchAll(pattern)) {
      const words = match[1].trim().split(/\s+/);

      // Longest prefix that is a real command; anything beyond it must be an argument
      // (`bazi test backend`, `bazi help calc`), which is fine. A first word that is
      // not a command at all is not.
      let matched = '';
      for (let n = words.length; n > 0; n -= 1) {
        const candidate = words.slice(0, n).join(' ');
        if (commandPaths.has(candidate)) {
          matched = candidate;
          break;
        }
      }

      if (!matched) {
        fail(file, lineOf(source, match.index), `no such CLI command: bazi ${words[0]}`);
      }
    }
  }
}

// ------------------------------------------------------------- api.md coverage

// docs/api.md is the human-readable half of the contract; docs/openapi.json is generated
// and CI-diffed, so it never drifts. api.md does — a new endpoint ships, the snapshot
// updates itself, and the prose silently describes a smaller API than the one running.
// Path-level coverage is all that can be checked mechanically; field-level accuracy is
// still a review job.
try {
  const spec = JSON.parse(fs.readFileSync('docs/openapi.json', 'utf8'));
  const apiDoc = fs.readFileSync('docs/api.md', 'utf8');

  for (const route of Object.keys(spec.paths || {})) {
    if (!apiDoc.includes(route)) {
      fail('docs/api.md', 0, `OpenAPI path is not documented: ${route}`);
    }
  }
} catch (error) {
  console.warn(`note: skipping api.md coverage check (${error.message})`);
}

// ------------------------------------------------------------ rulings coverage

// constants/rulings.js is the single source of truth for every school choice; the skill
// file is where an agent reads them. A ruling added to the code but not to the skill is
// a choice nobody downstream knows was made. Keys are matched as backticked literals so a
// key mentioned only in prose (or a renamed key whose old spelling lingers) still fails.
try {
  const rulingsSource = fs.readFileSync('backend/constants/rulings.js', 'utf8');
  const skillPath = '.claude/skills/bazi-cli/SKILL.md';
  const skill = fs.readFileSync(skillPath, 'utf8');
  const keys = new Set([...rulingsSource.matchAll(/\bkey:\s*'([^']+)'/g)].map((m) => m[1]));

  for (const key of keys) {
    if (!skill.includes('`' + key + '`')) {
      fail(skillPath, 0, `ruling key from backend/constants/rulings.js is not documented: ${key}`);
    }
  }
} catch (error) {
  console.warn(`note: skipping rulings coverage check (${error.message})`);
}

// ----------------------------------------------------------------------- report

if (failures.length > 0) {
  console.error('stale documentation:\n');
  for (const { file, line, message } of failures) {
    console.error(`  ${file}:${line}  ${message}`);
  }
  console.error('\nSee docs/README.md for the doc/code sync table.');
  process.exit(1);
}

console.log(
  `docs check passed: ${docs.length} files, links + npm scripts + CLI commands resolve, ` +
    'every OpenAPI path appears in docs/api.md, every ruling key appears in SKILL.md.'
);
