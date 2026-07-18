import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WRAPPER = join(
  dirname(fileURLToPath(import.meta.url)),
  'external-agents.sh',
);
const AGENTS = ['kimi', 'codex', 'agy', 'cursor-agent', 'grok'];

// Production reality: the command sees whatever PATH the session has. The
// fixture is a FULLY controlled bin dir — fake CLIs plus a node symlink for
// the wrapper's `exec node`, and nothing else — so no real agent CLI is
// ever reachable from a test.
function fixtureBin() {
  const bin = mkdtempSync(join(tmpdir(), 'attune-bin-'));
  symlinkSync(process.execPath, join(bin, 'node'));
  return bin;
}

const run = (bin, args) =>
  execFileSync('/bin/bash', [WRAPPER, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: bin },
  });

test('installed reports every registry agent missing on an empty PATH', () => {
  const report = JSON.parse(run(fixtureBin(), ['installed']));
  for (const name of AGENTS) assert.equal(report[name].installed, false);
});

test('installed reports an agent with its path', () => {
  const bin = fixtureBin();
  const fake = join(bin, 'codex');
  writeFileSync(fake, '#!/bin/sh\nexit 0\n');
  chmodSync(fake, 0o755);
  const report = JSON.parse(run(bin, ['installed']));
  assert.equal(report.codex.installed, true);
  assert.equal(report.codex.path, fake);
  assert.equal(report.grok.installed, false);
});

test('installed --lines emits one line per registry agent', () => {
  const lines = run(fixtureBin(), ['installed', '--lines']).trim().split('\n');
  assert.equal(lines.length, AGENTS.length);
  assert.ok(lines.every((l) => l.endsWith(': missing')));
});

test('an unknown subcommand fails with usage', () => {
  assert.throws(() => run(fixtureBin(), ['detect']));
});
