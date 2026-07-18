#!/usr/bin/env node
// _detect-external-agents.mjs — internal implementation of
// `external-agents.sh installed`: free PATH detection of the agents named in
// capabilities.json (the agent registry). No probes, no cost, no side
// effects — safe to run at every session start.

import { findOnPath, loadConfig } from './_agents-core.mjs';

const { agents } = loadConfig();
const names = Object.keys(agents);

if (process.argv[2] === '--lines') {
  for (const name of names) {
    const p = findOnPath(name);
    console.log(p ? `- ${name}: installed (${p})` : `- ${name}: missing`);
  }
} else {
  const report = {};
  for (const name of names) {
    const p = findOnPath(name);
    report[name] = p ? { installed: true, path: p } : { installed: false };
  }
  console.log(JSON.stringify(report));
}
