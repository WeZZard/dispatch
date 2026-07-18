---
name: use-external-agents
description: Dispatch a task to external agent CLIs through the dispatch external-agent router — compose a self-contained task brief, probe all agent facts in one matrix call, and receive the outputs verbatim as evidence. The audit and image-generation skills build on this one; use it directly only when the user directs an external-agent task outside those types.
---

# Use External Agents — One Router, One Brief Contract

**Announce at start:** "Dispatching through the dispatch external-agent router."

Resolve `ATTUNE_ROOT` to the absolute path two directories above this skill's directory — your harness names that directory when it loads this skill — before running any command quoted below. `ATTUNE_ROOT` is the installed plugin root; the agent registry lives at `$ATTUNE_ROOT/capabilities.json`.

## The Interface

One path delegates work to an external agent: the `dispatch:external-agent` router subagent. Launch it with your subagent tool (on Claude Code, the Agent tool with `subagent_type: "dispatch:external-agent"`), passing the whole task brief as its prompt — one launch per brief. The router verifies CLI parameters against each agent's current `--help`, launches headless runs, and responds as the brief's Response section specifies.

**MUST:**

1. You **MUST** delegate external agent work only through the router, with a task brief in the contract below.
2. You **MUST** compose the brief in the main conversation — it holds the context — and write the task prompt fully self-contained: the external agent sees nothing else.
3. You **MUST** pin the agents in the brief's `AGENTS` line — the router dispatches to exactly those and never chooses on its own.

**MUST NOT:**

1. You **MUST NOT** invoke an external agent CLI directly from the main conversation.
2. You **MUST NOT** expect the router to invent context the brief does not carry.
3. You **MUST NOT** dispatch a task no skill covers without the user directing it.

### Task brief contract (the one communication contract)

```text
## Metadata

- GOAL: <one line — what the task must accomplish>
- TAGS: <task traits, e.g. auditing, image-generation>
- AGENTS: <the agents to dispatch to — the dispatching skill pins them>
- CAPABILITIES_MARKER: <optional path to an existing fact marker; omit to let the router probe once itself>

## External Agent Task Prompt

<EXTERNAL_AGENT_TASK_PROMPT>
<the full, self-contained task prompt for the external agent — it sees nothing else>
</EXTERNAL_AGENT_TASK_PROMPT>

## Response

<how the router responds to the main conversation — the report shape, including artifact paths when the task produces artifacts>
```

## Facts Before Use

One command answers everything in one call, printing installed / usable / capable per registry agent:

```bash
bash "$ATTUNE_ROOT/scripts/external-agents.sh" matrix <marker.json>
```

`<marker.json>` is any writable path you pick: the first call probes and writes its memo there; later calls re-render from it free.

**MUST:**

1. You **MUST** treat whether an agent works right now as a volatile fact: probe it, never assume it; a failed probe fails closed.
2. You **MUST** gather the facts in one matrix call and pass the marker path in the brief's `CAPABILITIES_MARKER` so the router never re-probes.

**MUST NOT:**

1. You **MUST NOT** probe layer-by-layer or agent-by-agent — the matrix call is the single probe step.

## Write Isolation

**MUST:**

1. You **MUST** create a worktree before a delegation that writes into a repository — `bash "$ATTUNE_ROOT/scripts/worktree.sh" create <repo-dir> <name>` prints the worktree path — point the external agent at that path as its working directory, collect the changes with `worktree.sh diff <worktree-path>` as evidence, merge or discard explicitly in the main conversation, then `worktree.sh remove <repo-dir> <worktree-path>`.
2. You **MUST** require explicit artifact paths in the reply for non-repository artifacts (generated images and similar) and pass them back verbatim.

**MUST NOT:**

1. You **MUST NOT** let an external agent write to a repository directly — it runs as its own process with its own unsynchronized git behavior.

## Conduct

**MUST:**

1. You **MUST** derive launch parameters from the registry baseline (`$ATTUNE_ROOT/capabilities.json`) verified against fresh `--help` output — external CLIs update frequently.
2. You **MUST** send one invocation per task and parallelize independent tasks across agents.
3. You **MUST** treat external output as evidence, never a decision: synthesis and every ruling stay in the main conversation with the human.

**MUST NOT:**

1. You **MUST NOT** invoke an external CLI from remembered flags.
