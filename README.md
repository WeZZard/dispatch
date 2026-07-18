# Dispatch

Dispatch delegates tasks to external agent CLIs — Codex, Kimi,
Antigravity, Cursor, Grok — through one router and one brief contract.
Facts are probed in one call before use, agents are pinned by the
dispatching skill, repository writes are isolated in git worktrees, and
outputs return verbatim as evidence. Claude Code only.

- **use-external-agents** is the dispatch interface: compose a
  self-contained task brief, probe all agent facts in one matrix call,
  launch the `dispatch:external-agent` router subagent with the brief.
- **The audit panel** sends the same audit brief to Codex and Kimi in
  parallel — diverse model biases, file-backed reports, and a digest of
  agreements and disagreements for your ruling.
- **Image generation** dispatches one brief concurrently across the
  image-capable agents for candidate options, and remembers login and
  quota failures so a failed agent is never retried until you clear it.

Dispatch pairs with the [attune](https://github.com/WeZZard/attune)
plugin: attune's experiment and verification skills widen through
dispatch's panel when it is installed, and degrade gracefully to self-run
variants when it is not. Either plugin works alone.

## Quick Start

```text
/plugin marketplace add wezzard/skills
/plugin install dispatch@wezzard-skills
```

The skills are `dispatch:use-external-agents`, `dispatch:audit`, and
`dispatch:image-generation`; the router runs as the
`dispatch:external-agent` subagent. External agent CLIs are probed, never
assumed — `scripts/external-agents.sh matrix` is the one fact call.

## License

MIT — see [LICENSE](LICENSE).
