# CLAUDE.md

## Domain

Dispatch is the external-agent delegation machinery, split out of attune in
attune 0.9.0: the router, the agent registry, the probe scripts, and the
task-type skills built on them. It is a Claude Code-only plugin — no port
matrix, no generated trees, no hooks, no session-start injection. Attune
holds the human-ruled guidelines; dispatch holds the engineering that
reaches other models. Attune's experiment and verification skills reference
dispatch's skills presence-conditionally and degrade gracefully when
dispatch is not installed.

## Surface

- `skills/use-external-agents` — the dispatch interface: the
  `dispatch:external-agent` router subagent, the task brief contract,
  facts-before-use (the matrix call), write isolation (worktrees), and
  conduct. The other skills build on it and do not restate it.
- `skills/audit` — the same audit brief to a panel (`codex`, `kimi`) in
  parallel for diverse model biases; reports saved under
  `${TMPDIR:-/tmp}/dispatch-audit/<name>/`, digest compiled with paths.
- `skills/image-generation` — one brief dispatched concurrently across the
  image-capable agents (`codex`, `agy`); a failure record at
  `${TMPDIR:-/tmp}/dispatch-image-generation/failures.json` blocks
  re-dispatch to an agent after a login or quota failure until the user
  clears it.
- `agents/external-agent.md` — the router subagent. It dispatches to
  exactly the agents a brief pins and never chooses on its own; it verifies
  CLI parameters against fresh `--help` before every launch and reports
  outputs verbatim.

Skill texts hold the blind-cold-reader standard: every sibling skill is
referenced with an invocation verb, every mechanism is named or explicitly
deferred to a named, loadable skill, and paths carry their resolution
rules. Verify any restructured skill by spawning a fresh reader with only
the file and requiring an "executable end to end" verdict.

## The registry

`capabilities.json` is the single source of agent facts:

- `agents.<agent>.invocation` — argv template for one headless run;
  `{prompt}` marks the argument the prompt replaces. The registry is the
  only place invocations live; the router verifies them against live
  `--help` at dispatch (external CLIs update frequently — never invoke
  from memory), and a contradiction is reported for the user to resolve
  by editing the registry.
- `agents.<agent>.prompt_via` — present and `"stdin"` when the CLI takes
  the prompt on stdin; the argv then carries no `{prompt}`.
- `agents.<agent>.probe` — capability names probed for this agent (all
  empty today; an agent with an empty `probe` list exists for identity and
  detection alone).
- `capabilities.<name>` — one probe definition shared by every agent that
  lists it: `prompt` (must make the agent exercise the tool, echo
  tool-derived data back, and offer `CAPABILITY_MISSING` as the honest
  failure reply), `expect` (the substring proving success; reduction is
  fail-closed), `strength` (what the flag gates). The map is empty today —
  the machinery stays data-driven; tests inject fixture registries via
  `ATTUNE_CAPABILITIES_FILE`.

`scripts/external-agents.sh` is the one public command — subcommands
`installed` (free), `usable` (paid), `capable` (paid), and `matrix` (the
one-shot fact sheet, memoized in a marker). The free and paid paths stay
separate underneath so no unconditional caller can drift into paid probes.

## Command naming convention

Every public command is a shell script; when the implementation is
JavaScript, the wrapper just `exec`s node on it. JavaScript not exposed as
a command carries an underscore prefix (`_*.mjs`) — wrappers are the
stable surface, underscored internals may be reshaped freely.

## Vendored code (never hand-edit)

- `scripts/probe-external-agents.sh` — from amplify
  `skills/capability-preflight/probe.sh`, verbatim. Re-vendor from amplify
  to update; divergences belong in new files. It still probes `cua-driver`
  (an amplify concern); harmless, drop on the next vendoring pass if
  amplify splits it.

## Commit gate

`.githooks/pre-commit` (enable per clone with `git config core.hooksPath
.githooks`): syntax checks, unit tests (fixture PATHs only — no real agent
CLI is ever reachable, no paid probe ever runs), `capabilities.json`
parse, and `claude plugin validate` when the CLI is on PATH (a missing CLI
prints SKIPPED, never a silent pass).

## Distribution

`wezzard/skills` is the marketplace; dispatch is catalogued there like its
siblings. Claude Code only — kept deliberately free of porting machinery.
