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

// Fully controlled PATH: fake CLIs plus a node symlink for the wrapper's
// `exec node`, and nothing else — no real agent CLI is ever reachable.
function fixture(fakes) {
  const bin = mkdtempSync(join(tmpdir(), 'attune-matrix-bin-'));
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
  mkdtempSync(join(tmpdir(), 'attune-matrix-registry-')),
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
    },
    agents: {
      kimi: {
        invocation: ['kimi', '-p', '{prompt}'],
        probe: ['playwright', 'chrome_devtools'],
      },
      codex: {
        invocation: ['codex'],
        prompt_via: 'stdin',
        probe: ['playwright'],
      },
      grok: { invocation: ['grok', '-p', '{prompt}'], probe: [] },
    },
  }),
);

function run(bin, marker, extra = []) {
  return execFileSync('/bin/bash', [WRAPPER, 'matrix', marker, ...extra], {
    encoding: 'utf8',
    env: { ...process.env, PATH: bin, ATTUNE_CAPABILITIES_FILE: REGISTRY },
  });
}

const markerPath = () =>
  join(mkdtempSync(join(tmpdir(), 'attune-matrix-out-')), 'facts.json');

test('one call yields installed, usable, and capable for every agent', () => {
  const bin = fixture({
    kimi: 'echo "PLAYWRIGHT_OK about:blank"',
    grok: 'echo "OK"',
  });
  const marker = markerPath();
  const out = run(bin, marker);
  const data = JSON.parse(readFileSync(marker, 'utf8'));

  // Capability probe doubles as the usable proof.
  assert.equal(data.agents.kimi.usable, true);
  assert.equal(data.agents.kimi.capabilities.playwright.ok, true);
  assert.equal(data.agents.kimi.capabilities.chrome_devtools.ok, false);
  // Capability-less agent gets the minimal usable probe.
  assert.equal(data.agents.grok.usable, true);
  // Missing agents are installed=false with no probes attempted.
  assert.equal(data.agents.codex.installed, false);
  assert.match(out, /kimi: installed=true usable=true playwright=true/);
  assert.match(out, /codex: installed=false/);
});

test('CAPABILITY_MISSING proves usable while the flag fails closed', () => {
  const bin = fixture({ kimi: 'echo "CAPABILITY_MISSING"' });
  const marker = markerPath();
  run(bin, marker);
  const data = JSON.parse(readFileSync(marker, 'utf8'));
  assert.equal(data.agents.kimi.usable, true);
  assert.equal(data.agents.kimi.capabilities.playwright.ok, false);
});

test('an existing marker renders without re-probing; --refresh re-probes', () => {
  const bin = fixture({ kimi: 'echo "PLAYWRIGHT_OK x"' });
  const marker = markerPath();
  run(bin, marker);
  // Empty fixture: every fake is gone. A memoized call must not notice.
  const empty = fixture({});
  const memo = run(empty, marker);
  assert.match(memo, /kimi: installed=true usable=true playwright=true/);
  const refreshed = run(empty, marker, ['--refresh']);
  assert.match(refreshed, /kimi: installed=false/);
});
