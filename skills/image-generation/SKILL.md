---
name: image-generation
description: Generate images by dispatching one brief concurrently to every usable image-capable external agent, presenting all results as options with artifact paths, and remembering login and quota failures so a failed agent is never dispatched to again until its record clears. Use whenever the user asks for image generation.
---

# Image Generation — Concurrent Options, Failure Memory

**Announce at start:** "Generating images across the available agents."

## Why

**The image-capable agents** are `codex` and `agy` — two external agent CLIs whose models generate images. Everything about reaching them lives in this plugin's `use-external-agents` skill: the router that launches them, the brief contract they are dispatched under, and the matrix call that reports whether each one is installed and usable right now. Dispatching to all of them concurrently returns several candidate images, so the user picks instead of settling.

## Protocol

1. **Load the dispatch interface.** Invoke this plugin's `use-external-agents` skill before anything else — this skill builds on its router, its task brief contract, and its facts-before-use matrix call, and does not restate them.
2. **Check the failure record.** Read `${TMPDIR:-/tmp}/dispatch-image-generation/failures.json` — a JSON array of `{agent, reason, at}` entries this skill maintains; a missing file is an empty record. Skip every agent it lists. If the record leaves no agent, report that and stop — clearing the record is the user's call.
3. **Brief.** Compose one image brief per that contract: a fully self-contained prompt, `TAGS: image-generation`, `AGENTS:` the image-capable agents not in the failure record, and a `## Response` section demanding explicit `ARTIFACT_PATH:` lines.
4. **Dispatch concurrently.** Send the brief to the router in one dispatch; the router launches all listed agents in parallel and returns each agent's reply with its artifact paths.
5. **Record failures.** When any agent's run reports a login failure or an exhausted quota, append its `{agent, reason, at}` entry to the failure record before doing anything else — the next generation must never dispatch to that agent.
6. **Present.** Show every generated image by its artifact path, labeled by the agent that produced it. The user picks.

## Principles

**MUST:**

1. You **MUST** read the failure record before every dispatch and skip every recorded agent.
2. You **MUST** record a login or quota failure the moment a run reports one.
3. You **MUST** pass every `ARTIFACT_PATH:` line through verbatim.

**MUST NOT:**

1. You **MUST NOT** dispatch image generation to an agent with a recorded failure — only the user clears the record.
2. You **MUST NOT** pick the best image yourself — present the options; the user picks.
