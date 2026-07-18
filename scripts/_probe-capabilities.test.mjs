import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WRAPPER = join(
  dirname(fileURLToPath(import.meta.url)),
  'external-agents.sh',
);

// Production reality: `external-agents.sh capable` runs the real
// capabilities.json against whatever CLIs the PATH holds. The fixture is a
// FULLY controlled PATH: the fake CLIs plus a node symlink for the wrapper's
// `exec node` — and nothing else. Real agent CLIs must be unreachable, or a
// "missing binary" test silently runs real paid probes (node version
// managers put npm-installed CLIs like codex in node's own directory).
function fixture(fakes) {
  const bin = mkdtempSync(join(tmpdir(), 'attune-cap-bin-'));
  symlinkSync(process.execPath, join(bin, 'node'));
  for (const [name, body] of Object.entries(fakes)) {
    const p = join(bin, name);
    writeFileSync(p, `#!/bin/sh\n${body}\n`);
    chmodSync(p, 0o755);
  }
  return bin;
}

// The shipped registry defines no capabilities today; the probe machinery
// stays data-driven, so the tests exercise it through a fixture registry.
const REGISTRY = join(
  mkdtempSync(join(tmpdir(), 'attune-cap-registry-')),
  'capabilities.json',
);
writeFileSync(
  REGISTRY,
  JSON.stringify({
    capabilities: {
      playwright: {
        strength: 'test',
        prompt: 'probe playwright',
        expect: 'PLAYWRIGHT_OK',
      },
      chrome_devtools: {
        strength: 'test',
        prompt: 'probe devtools',
        expect: 'DEVTOOLS_OK',
      },
      computer_use: {
        strength: 'test',
        prompt: 'probe cua',
        expect: 'CUA_OK',
      },
    },
    agents: {
      kimi: {
        invocation: ['kimi', '-p', '{prompt}'],
        probe: ['playwright', 'chrome_devtools'],
      },
      codex: {
        invocation: ['codex'],
        prompt_via: 'stdin',
        probe: ['playwright', 'chrome_devtools', 'computer_use'],
      },
      grok: { invocation: ['grok', '-p', '{prompt}'], probe: [] },
      'cursor-agent': {
        invocation: ['cursor-agent', '{prompt}'],
        probe: [],
      },
    },
  }),
);

function run(bin, extra = []) {
  const marker = join(
    mkdtempSync(join(tmpdir(), 'attune-cap-out-')),
    'marker.json',
  );
  execFileSync('/bin/bash', [WRAPPER, 'capable', marker, ...extra], {
    encoding: 'utf8',
    env: { ...process.env, PATH: bin, ATTUNE_CAPABILITIES_FILE: REGISTRY },
  });
  return JSON.parse(readFileSync(marker, 'utf8')).flags;
}

test('expect marker present reduces to true; wrong marker reduces to false', () => {
  const bin = fixture({
    kimi: 'echo "PLAYWRIGHT_OK about:blank"',
    codex: 'cat >/dev/null; echo "CUA_OK 1440x900"',
  });
  const flags = run(bin);
  assert.equal(flags.kimi.playwright.ok, true);
  // Same fake reply lacks DEVTOOLS_OK, so the sibling capability fails closed.
  assert.equal(flags.kimi.chrome_devtools.ok, false);
  assert.equal(flags.codex.computer_use.ok, true);
  // Codex is probed for the browser capabilities too; this reply proves neither.
  assert.equal(flags.codex.playwright.ok, false);
  assert.equal(flags.codex.chrome_devtools.ok, false);
});

test('CAPABILITY_MISSING and nonzero exits reduce to false', () => {
  const bin = fixture({
    kimi: 'echo "CAPABILITY_MISSING"',
    codex: 'cat >/dev/null; echo "CUA_OK 1x1"; exit 1',
  });
  const flags = run(bin);
  assert.equal(flags.kimi.playwright.ok, false);
  assert.equal(flags.codex.computer_use.ok, false);
});

test('a missing binary reduces to false with the spawn detail', () => {
  const bin = fixture({ kimi: 'echo "PLAYWRIGHT_OK x"' }); // no codex on PATH
  const flags = run(bin);
  assert.equal(flags.codex.computer_use.ok, false);
  assert.match(flags.codex.computer_use.detail, /codex/);
});

test('--only probes exactly the named flags', () => {
  const bin = fixture({ kimi: 'echo "PLAYWRIGHT_OK x"' });
  const flags = run(bin, ['--only', 'kimi.playwright']);
  assert.deepEqual(Object.keys(flags), ['kimi']);
  assert.deepEqual(Object.keys(flags.kimi), ['playwright']);
});

test('registry agents with an empty probe list get no flags', () => {
  const bin = fixture({ kimi: 'echo "PLAYWRIGHT_OK x"' });
  const flags = run(bin);
  assert.equal(flags.grok, undefined);
  assert.equal(flags['cursor-agent'], undefined);
});
