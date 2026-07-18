---
name: audit
description: Audit completed or in-progress work with a panel of external models — the same self-contained audit brief to Codex and Kimi in parallel for their diverse biases, file-backed reports, and a compiled digest of agreements and disagreements. Use after completing significant work, before declaring a nontrivial task done, or whenever the user asks for an audit or a second opinion.
---

# Audit — A Panel of Diverse Models

**Announce at start:** "Running a dispatch audit with an external panel."

## Why

One model reviewing its own work re-applies the biases that produced it. Different models miss different things, so the same audit dispatched to a panel buys perspectives a single reviewer cannot: findings the panel agrees on are strong signals, and findings the panel splits on mark judgment calls worth the user's attention.

**The panel** is `codex` and `kimi` — two external agent CLIs running models unrelated to this session's. Everything about reaching them lives in this plugin's `use-external-agents` skill: the router that launches them, the brief contract they are dispatched under, and the matrix call that reports whether each one is installed and usable right now.

## Protocol

1. **Load the dispatch interface.** Invoke this plugin's `use-external-agents` skill before anything else — this skill builds on its router, its task brief contract, and its facts-before-use matrix call, and does not restate them.
2. **Scope.** Name the audit (kebab-case) and write what is being audited — the diff, the document, the decision — and the questions the auditors must answer.
3. **Brief.** Compose one audit brief per that contract: a fully self-contained task prompt (the auditor sees nothing else — inline the material or point at readable paths), `TAGS: auditing`, `AGENTS: codex kimi`, and a `## Response` section requiring each auditor's full report, one finding at a time, each finding with its claim, its evidence, and its severity.
4. **Dispatch.** Send the brief to the router in one dispatch; the router launches the panel's agents in parallel and returns each agent's report in its reply. Write each report verbatim to `${TMPDIR:-/tmp}/dispatch-audit/<name>/<agent>.md` — that directory is the audit directory.
5. **Compile.** Report one digest: findings the auditors agree on first, findings unique to one auditor with your assessment of each, and disagreements flagged for the user's judgment — every cited finding carries its report's file path.
6. **Rule.** The user decides which findings to act on. Act only after the ruling.

## Principles

**MUST:**

1. You **MUST** send the identical brief to every agent on the panel — divergent briefs make agreement and disagreement meaningless.
2. You **MUST** dispatch the whole panel through one router call, in parallel.
3. You **MUST** write every report verbatim to its file before compiling.
4. You **MUST** carry each cited finding's report path in the digest.
5. You **MUST** leave the audit directory in place — it is the audit's backtrace.

**MUST NOT:**

1. You **MUST NOT** audit with one model while the matrix shows another agent on the panel usable.
2. You **MUST NOT** drop a finding you disagree with — present it with your assessment; the user rules.
3. You **MUST NOT** act on a finding before the user's ruling.
