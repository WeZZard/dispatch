#!/usr/bin/env node
// _probe-capabilities.mjs — internal implementation of
// `external-agents.sh capable`: targeted behavioral probes of
// tool-dependent capabilities. For the full one-shot fact sheet use
// `external-agents.sh matrix` instead; this exists for narrow re-checks
// (--only) when a single flag is in doubt.
//
// Flag reduction, fail-closed: ok = CLI exit 0 AND the output contains the
// capability's `expect` marker AND does not contain CAPABILITY_MISSING.
//
// Usage: _probe-capabilities.mjs <marker-output-path> [--only agent.capability ...]

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { lastLine, loadConfig, probeOne } from './_agents-core.mjs';

const args = process.argv.slice(2);
const marker = args[0];
if (!marker || marker.startsWith('--')) {
  console.error(
    'usage: _probe-capabilities.mjs <marker-output-path> [--only agent.capability ...]',
  );
  process.exit(64);
}
const only = [];
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--only' && args[i + 1]) only.push(args[++i]);
}

const { capabilities, agents } = loadConfig();

const jobs = [];
for (const [agent, spec] of Object.entries(agents)) {
  for (const capability of spec.probe) {
    const cap = capabilities[capability];
    if (!cap) {
      console.error(
        `probe-capabilities: unknown capability in agents.${agent}.probe: ${capability}`,
      );
      process.exit(64);
    }
    const flag = `${agent}.${capability}`;
    if (only.length > 0 && !only.includes(flag)) continue;
    jobs.push(
      probeOne(spec, cap.prompt).then(({ err, out }) => {
        const ok =
          !err && out.includes(cap.expect) && !out.includes('CAPABILITY_MISSING');
        const detail = (err ? err.message.split('\n')[0] : lastLine(out)).slice(0, 200);
        return { agent, capability, ok, detail };
      }),
    );
  }
}

const results = await Promise.all(jobs);
const flags = {};
for (const r of results) {
  (flags[r.agent] ??= {})[r.capability] = { ok: r.ok, detail: r.detail };
  console.log(`${r.agent}.${r.capability}: ${r.ok}${r.ok ? '' : ` (${r.detail})`}`);
}

const tmp = `${marker}.tmp-${process.pid}`;
writeFileSync(
  tmp,
  JSON.stringify({ probed_at: new Date().toISOString(), flags }, null, 2) + '\n',
);
renameSync(tmp, marker);
