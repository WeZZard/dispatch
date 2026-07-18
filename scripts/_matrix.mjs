#!/usr/bin/env node
// _matrix.mjs — internal implementation of `external-agents.sh matrix`: the
// one-shot fact sheet. One command answers installed / usable / capable for
// every registry agent.
//
// Paid-prompt economy: a capability probe already proves the whole usable
// chain (binary, login, network, model) — a CAPABILITY_MISSING reply is a
// working CLI honestly lacking the tool — so agents with probe lists get no
// separate usable probe; agents without get one minimal prompt. All probes
// run in parallel: wall time is the slowest probe, not the sum.
//
// Results are memoized in the marker: when it exists the matrix re-renders
// from it without probing. --refresh forces a re-probe.
//
// Usage: _matrix.mjs <marker.json> [--refresh]

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import {
  findOnPath,
  lastLine,
  loadConfig,
  probeOne,
} from './_agents-core.mjs';

const marker = process.argv[2];
if (!marker || marker.startsWith('--')) {
  console.error('usage: _matrix.mjs <marker.json> [--refresh]');
  process.exit(64);
}
const refresh = process.argv.includes('--refresh');

const { capabilities, agents } = loadConfig();

function render(data) {
  for (const [name, entry] of Object.entries(data.agents)) {
    if (!entry.installed) {
      console.log(`${name}: installed=false`);
      continue;
    }
    const caps = Object.entries(entry.capabilities ?? {})
      .map(([cap, r]) => ` ${cap}=${r.ok}${r.ok ? '' : ` (${r.detail})`}`)
      .join('');
    console.log(
      `${name}: installed=true usable=${entry.usable}${entry.usable ? '' : ` (${entry.detail})`}${caps}`,
    );
  }
}

if (existsSync(marker) && !refresh) {
  render(JSON.parse(readFileSync(marker, 'utf8')));
  process.exit(0);
}

const data = { probed_at: new Date().toISOString(), agents: {} };
const jobs = [];

for (const [name, spec] of Object.entries(agents)) {
  const path = findOnPath(name);
  if (!path) {
    data.agents[name] = { installed: false };
    continue;
  }
  const entry = { installed: true, path, usable: false, capabilities: {} };
  data.agents[name] = entry;
  if (spec.probe.length > 0) {
    // Pre-seed in registry order: jobs finish in any order, and key
    // insertion order drives the rendered line — keep it deterministic.
    for (const cap of spec.probe) {
      entry.capabilities[cap] = { ok: false, detail: 'unprobed' };
    }
    for (const cap of spec.probe) {
      jobs.push(
        probeOne(spec, capabilities[cap].prompt).then(({ err, out }) => {
          const ok =
            !err &&
            out.includes(capabilities[cap].expect) &&
            !out.includes('CAPABILITY_MISSING');
          entry.capabilities[cap] = {
            ok,
            detail: (err ? err.message.split('\n')[0] : lastLine(out)).slice(0, 200),
          };
          // A reply — even CAPABILITY_MISSING — proves the whole CLI chain.
          if (!err) entry.usable = true;
          else entry.detail = err.message.split('\n')[0].slice(0, 200);
        }),
      );
    }
  } else {
    jobs.push(
      probeOne(spec, 'Reply with exactly: OK').then(({ err, out }) => {
        entry.usable = !err;
        entry.detail = (err ? err.message.split('\n')[0] : lastLine(out)).slice(0, 200);
      }),
    );
  }
}

await Promise.all(jobs);

const tmp = `${marker}.tmp-${process.pid}`;
writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
renameSync(tmp, marker);
render(data);
