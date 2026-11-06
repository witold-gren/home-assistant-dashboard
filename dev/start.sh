#!/bin/sh
# Start the throwaway Home Assistant; the first start also runs dev/bootstrap.py.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
CONFIG="$ROOT/.dev-config"
FIRST_RUN=0
if [ ! -f "$CONFIG/tokens.json" ]; then
  FIRST_RUN=1
  rm -rf "$CONFIG"
  mkdir -p "$CONFIG/custom_components"
  ln -s "$ROOT/custom_components/home_dashboard" "$CONFIG/custom_components/home_dashboard"
fi
cp "$ROOT/dev/configuration.yaml" "$CONFIG/configuration.yaml"
"$ROOT/.venv-dev/bin/hass" -c "$CONFIG" --log-file "$CONFIG/home-assistant.log" &
PID=$!
trap 'kill $PID 2>/dev/null' INT TERM EXIT
if [ "$FIRST_RUN" = 1 ]; then
  "$ROOT/.venv-dev/bin/python" "$ROOT/dev/bootstrap.py" "$CONFIG"
fi
wait $PID
