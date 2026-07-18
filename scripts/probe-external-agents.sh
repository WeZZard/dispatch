#!/bin/bash
# capability-preflight probe — fans out the slow, shell-probeable capability checks
# in PARALLEL, waits for all of them, reduces the results to one JSON object, and
# writes it atomically to the marker path given as $1. MCP-side facts (browser-use,
# computer-use, cua-driver session reachability) are NOT probed here — the invoking
# agent merges those from its own tool inventory at read time.
#
# Usage: probe.sh <marker-output-path>
#
# Each external agent is probed BEHAVIORALLY: one minimal non-interactive prompt
# through the CLI itself, proving the whole chain (binary, login, network, model)
# in one shot — never a credential-file heuristic, never an interactive login.
# Every probe carries its own timeout (perl alarm — macOS ships no timeout(1)) and
# a closed stdin so nothing can block on a prompt.

set -u
MARKER="${1:?usage: probe.sh <marker-output-path>}"
TMP="$(mktemp "${MARKER}.XXXXXX")"
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT

PROBE_TIMEOUT=90
PROBE_PROMPT="Reply with exactly: OK"

with_timeout() { perl -e "alarm $PROBE_TIMEOUT; exec @ARGV" "$@"; }

# ---- fan-out: one background job per candidate ------------------------------

probe_codex() {
  if ! command -v codex >/dev/null 2>&1; then
    printf '{"installed":false,"usable":false,"detail":"codex not on PATH"}' > "$DIR/codex.json"; return
  fi
  out="$(with_timeout codex exec --sandbox read-only --skip-git-repo-check "$PROBE_PROMPT" </dev/null 2>&1)"
  rc=$?
  detail="$(printf '%s' "$out" | tail -1 | head -c 200)"
  if [ $rc -eq 0 ]; then
    printf '{"installed":true,"usable":true,"detail":%s}' "$(printf '%s' "$detail" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" > "$DIR/codex.json"
  else
    printf '{"installed":true,"usable":false,"detail":%s}' "$(printf '%s' "$detail" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" > "$DIR/codex.json"
  fi
}

probe_kimi() {
  if ! command -v kimi >/dev/null 2>&1; then
    printf '{"installed":false,"usable":false,"detail":"kimi not on PATH"}' > "$DIR/kimi.json"; return
  fi
  out="$(with_timeout kimi -p "$PROBE_PROMPT" --output-format text </dev/null 2>&1)"
  rc=$?
  detail="$(printf '%s' "$out" | tail -1 | head -c 200)"
  if [ $rc -eq 0 ]; then
    printf '{"installed":true,"usable":true,"detail":%s}' "$(printf '%s' "$detail" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" > "$DIR/kimi.json"
  else
    printf '{"installed":true,"usable":false,"detail":%s}' "$(printf '%s' "$detail" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" > "$DIR/kimi.json"
  fi
}

probe_cua_cli() {
  if command -v cua-driver >/dev/null 2>&1; then
    printf '{"installed":true}' > "$DIR/cua_cli.json"
  else
    printf '{"installed":false}' > "$DIR/cua_cli.json"
  fi
}

probe_agy() {
  if ! command -v agy >/dev/null 2>&1; then
    printf '{"installed":false,"usable":false,"detail":"agy not on PATH"}' > "$DIR/agy.json"; return
  fi
  out="$(with_timeout agy -p "$PROBE_PROMPT" --sandbox </dev/null 2>&1)"
  rc=$?
  detail="$(printf '%s' "$out" | tail -1 | head -c 200)"
  usable=false; [ $rc -eq 0 ] && usable=true
  printf '{"installed":true,"usable":%s,"detail":%s}' "$usable" "$(printf '%s' "$detail" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" > "$DIR/agy.json"
}

probe_cursor_agent() {
  if ! command -v cursor-agent >/dev/null 2>&1; then
    printf '{"installed":false,"usable":false,"detail":"cursor-agent not on PATH"}' > "$DIR/cursor_agent.json"; return
  fi
  out="$(with_timeout cursor-agent -p --mode ask --output-format text --trust --model auto "$PROBE_PROMPT" </dev/null 2>&1)"
  rc=$?
  detail="$(printf '%s' "$out" | tail -1 | head -c 200)"
  usable=false; [ $rc -eq 0 ] && usable=true
  printf '{"installed":true,"usable":%s,"detail":%s}' "$usable" "$(printf '%s' "$detail" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" > "$DIR/cursor_agent.json"
}

probe_grok() {
  if ! command -v grok >/dev/null 2>&1; then
    printf '{"installed":false,"usable":false,"detail":"grok not on PATH"}' > "$DIR/grok.json"; return
  fi
  out="$(with_timeout grok -p "$PROBE_PROMPT" --output-format plain --permission-mode plan </dev/null 2>&1)"
  rc=$?
  detail="$(printf '%s' "$out" | tail -1 | head -c 200)"
  usable=false; [ $rc -eq 0 ] && usable=true
  printf '{"installed":true,"usable":%s,"detail":%s}' "$usable" "$(printf '%s' "$detail" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" > "$DIR/grok.json"
}

probe_codex & PID_CODEX=$!
probe_kimi  & PID_KIMI=$!
probe_cua_cli & PID_CUA=$!
probe_agy & PID_AGY=$!
probe_cursor_agent & PID_CURSOR=$!
probe_grok & PID_GROK=$!

# ---- barrier + reduce --------------------------------------------------------

wait "$PID_CODEX" "$PID_KIMI" "$PID_CUA" "$PID_AGY" "$PID_CURSOR" "$PID_GROK"

python3 - "$DIR" "$TMP" <<'PYEOF'
import json, sys, os, datetime
d, tmp = sys.argv[1], sys.argv[2]
def load(name, fallback):
    p = os.path.join(d, name)
    try:
        return json.load(open(p))
    except Exception:
        return fallback
result = {
    "probed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "codex": load("codex.json", {"installed": False, "usable": False, "detail": "probe crashed"}),
    "kimi": load("kimi.json", {"installed": False, "usable": False, "detail": "probe crashed"}),
    "cua_driver_cli": load("cua_cli.json", {"installed": False}),
    "agy": load("agy.json", {"installed": False, "usable": False, "detail": "probe crashed"}),
    "cursor_agent": load("cursor_agent.json", {"installed": False, "usable": False, "detail": "probe crashed"}),
    "grok": load("grok.json", {"installed": False, "usable": False, "detail": "probe crashed"}),
}
json.dump(result, open(tmp, "w"), indent=1)
PYEOF

mv "$TMP" "$MARKER"
echo "capability-preflight: probe complete -> $MARKER"
