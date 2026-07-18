#!/bin/bash
# worktree.sh — git worktree isolation for external agents that write.
# Human ruled: an external agent that writes to a repo runs inside a
# worktree created here; its diff returns as evidence, and merging stays
# an explicit main-thread step.
#
# Usage:
#   worktree.sh create <repo-dir> <name>       -> prints the worktree path
#   worktree.sh diff <worktree-path>           -> full diff incl. untracked files
#   worktree.sh remove <repo-dir> <worktree-path>

set -euo pipefail

cmd="${1:?usage: worktree.sh create|diff|remove ...}"
case "$cmd" in
  create)
    repo="${2:?repo dir}"
    name="${3:?worktree name}"
    base="${TMPDIR:-/tmp}/dispatch-worktrees"
    mkdir -p "$base"
    path="$base/$(basename "$repo")-$name"
    git -C "$repo" worktree add --detach "$path" >/dev/null
    echo "$path"
    ;;
  diff)
    wt="${2:?worktree path}"
    # --intent-to-add stages untracked paths so diff HEAD shows them; the
    # worktree is scratch, so mutating its index is fine.
    git -C "$wt" add -A --intent-to-add
    git -C "$wt" diff HEAD
    ;;
  remove)
    repo="${2:?repo dir}"
    wt="${3:?worktree path}"
    git -C "$repo" worktree remove --force "$wt"
    ;;
  *)
    echo "unknown subcommand: $cmd" >&2
    exit 64
    ;;
esac
