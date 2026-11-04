// node --test scripts/tests/plugin.test.mjs
// The plugin wiring: the manifest lists the reviewer agent, the agent file has valid front matter, and the skill tells the author to use it.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (...p) => readFileSync(join(repo, ...p), 'utf8');

test('plugin.json registers agents/deck-reviewer.md and the file exists', () => {
  const manifest = JSON.parse(read('.claude-plugin', 'plugin.json'));
  assert.deepEqual(manifest.agents, ['./agents/deck-reviewer.md']);
  assert.ok(existsSync(join(repo, 'agents', 'deck-reviewer.md')));
});

test('the reviewer agent: read-only tools, a description that says when to use it, the three scores and the flag-do-not-rewrite rule', () => {
  const text = read('agents', 'deck-reviewer.md').replace(/\r\n/g, '\n');
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(front, 'front matter');
  const field = (k) => new RegExp(`^${k}: (.*)$`, 'm').exec(front[1])?.[1];
  assert.equal(field('name'), 'deck-reviewer');
  assert.match(field('description'), /Use after check\.mjs ends with PASS/);
  assert.equal(field('tools'), 'Read, Glob, Grep');
  assert.ok(field('model'));
  for (const word of ['content', 'design', 'coherence', 'report.json', 'Flag, do not rewrite', '1 (poor)', '5 (excellent)']) assert.ok(text.includes(word), word);
  assert.doesNotMatch(field('tools'), /Edit|Write|Bash/);
});

test('SKILL.md step 7 mentions the reviewer', () => {
  assert.match(read('skills', 'motion-deck', 'SKILL.md'), /`deck-reviewer` agent/);
});
