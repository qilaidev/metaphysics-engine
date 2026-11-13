#!/usr/bin/env bash
#
# Keeps the two things an operator actually configures in sync with the code:
#
#   1. every environment variable backend code reads is documented in
#      env.production.template, and
#   2. every one of those variables is passed through to the container by
#      docker-compose.prod.yml.
#
# Both failure modes are silent. An undocumented variable is one an operator has no
# way to know exists; a documented variable that compose does not forward is one they
# can set and watch do nothing — `--env-file` only feeds compose's own substitution,
# it does not inject the file into the container. The template had drifted well behind
# the code once already, which is why this is a CI gate instead of a review habit.
set -euo pipefail

cd "$(dirname "$0")/.."

TEMPLATE="env.production.template"
COMPOSE="docker-compose.prod.yml"

# Escape hatch for variables that are deliberately not in the production template —
# host/process environment inherited from the runner, or local-development-only helpers.
# It is currently empty on purpose: every variable the backend reads is documented.
# Add a pattern here only with a comment saying why that variable cannot be documented.
IGNORED='^$'

code_vars="$(
  grep -rhoE 'env\.[A-Z][A-Z_0-9]+' backend \
    --include='*.js' --include='*.mjs' \
    --exclude-dir=node_modules --exclude-dir=test \
    | sed 's/env\.//' \
    | grep -vE "$IGNORED" \
    | sort -u
)"

template_vars="$(
  grep -oE '^#?[[:space:]]*[A-Z][A-Z_0-9]+=' "$TEMPLATE" \
    | tr -d '# =' \
    | sort -u
)"

# Only the backend service's own `environment:` block counts. Variables that appear
# elsewhere in the file (redis flags, autoheal, memory limits) are compose-side
# substitution and never reach the engine process.
compose_vars="$(
  sed -n '/^  backend:/,/^  [a-z]/p' "$COMPOSE" \
    | grep -oE '^[[:space:]]+[A-Z][A-Z_0-9]+:' \
    | tr -d ' :' \
    | sort -u
)"

fail=0

missing_template="$(comm -23 <(echo "$code_vars") <(echo "$template_vars") || true)"
if [ -n "$missing_template" ]; then
  echo "Read by backend code but missing from $TEMPLATE:" >&2
  echo "$missing_template" | sed 's/^/  - /' >&2
  echo >&2
  echo "Document them in $TEMPLATE, or add them to IGNORED in $0 with a reason." >&2
  echo >&2
  fail=1
fi

missing_compose="$(comm -23 <(echo "$code_vars") <(echo "$compose_vars") || true)"
if [ -n "$missing_compose" ]; then
  echo "Read by backend code but not passed through by $COMPOSE (backend service):" >&2
  echo "$missing_compose" | sed 's/^/  - /' >&2
  echo >&2
  echo "Add them to the backend service's environment: block. Setting them in" >&2
  echo ".env.production alone does NOT reach the container." >&2
  echo >&2
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "env template and compose passthrough cover all $(echo "$code_vars" | wc -l | tr -d ' ') backend variables."
