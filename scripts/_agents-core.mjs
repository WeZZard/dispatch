// _agents-core.mjs — shared internals behind external-agents.sh: the agent
// registry, PATH lookup, and the behavioral probe runner. Never a public
// surface.

import { execFile } from 'node:child_process';
import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROBE_TIMEOUT_MS = 180000;

export const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// ATTUNE_CAPABILITIES_FILE overrides the registry path — tests inject
// fixture registries through it; runtime callers never set it.
export function loadConfig() {
  return JSON.parse(
    readFileSync(
      process.env.ATTUNE_CAPABILITIES_FILE ??
        join(pluginRoot, 'capabilities.json'),
      'utf8',
    ),
  );
}

export function findOnPath(name) {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    const p = join(dir, name);
    try {
      accessSync(p, constants.X_OK);
      if (statSync(p).isFile()) return p;
    } catch {
      // not here — keep walking PATH
    }
  }
  return null;
}

// One headless probe run of an agent CLI. Resolves (never rejects) with the
// spawn/exit error (if any) and the combined output.
export function probeOne(spec, prompt) {
  const argv = spec.invocation.map((a) => (a === '{prompt}' ? prompt : a));
  return new Promise((resolve) => {
    const child = execFile(
      argv[0],
      argv.slice(1),
      { encoding: 'utf8', timeout: PROBE_TIMEOUT_MS },
      (err, stdout = '', stderr = '') => {
        resolve({ err, out: `${stdout}\n${stderr}` });
      },
    );
    child.stdin.on('error', () => {});
    if (spec.prompt_via === 'stdin') child.stdin.write(prompt);
    child.stdin.end();
  });
}

export function lastLine(out) {
  return out.trim().split('\n').filter(Boolean).at(-1) ?? '';
}
