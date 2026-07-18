#!/bin/bash
# external-agents.sh — the public command for external agent facts
# (this plugin's `use-external-agents` skill):
#
#   external-agents.sh matrix <marker.json> [--refresh]
#       The one-shot fact sheet: installed / usable / capable for every
#       registry agent in ONE call (probes run in parallel; PAID — one
#       prompt per agent×capability, one per capability-less agent).
#       Memoized in the marker: existing marker renders free; --refresh
#       re-probes.
#
#   external-agents.sh installed [--lines]
#       Free PATH detection only. No probes, no cost — safe at every
#       session start.
#
#   external-agents.sh usable <marker.json>
#       Behavioral usability probe alone (vendored from amplify; PAID).
#
#   external-agents.sh capable <marker.json> [--only agent.capability ...]
#       Targeted capability re-check (PAID) — for a single flag in doubt;
#       prefer matrix for anything broader.

set -euo pipefail
# Builtin-only directory resolution — this wrapper must work on a minimal
# PATH (no coreutils), since callers control PATH tightly in tests.
src="${BASH_SOURCE[0]:-$0}"
case "$src" in
  */*) DIR="$(cd "${src%/*}" && pwd)" ;;
  *) DIR="$(pwd)" ;;
esac

cmd="${1:?usage: external-agents.sh matrix|installed|usable|capable ...}"
shift
case "$cmd" in
  matrix)    exec node "$DIR/_matrix.mjs" "$@" ;;
  installed) exec node "$DIR/_detect-external-agents.mjs" "$@" ;;
  usable)    exec bash "$DIR/probe-external-agents.sh" "$@" ;;
  capable)   exec node "$DIR/_probe-capabilities.mjs" "$@" ;;
  *)
    echo "unknown subcommand: $cmd (matrix|installed|usable|capable)" >&2
    exit 64
    ;;
esac
