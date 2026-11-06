#!/bin/sh
# Copy the integration to Home Assistant. Never restarts it: Python changes need a restart by hand,
# frontend changes only a page reload.
set -eu
CONFIG=${CONFIG:-/Volumes/config}
SOURCE=custom_components/home_dashboard
TARGET="$CONFIG/custom_components/home_dashboard"
[ -d "$CONFIG/custom_components" ] || { echo "Home Assistant config not mounted at $CONFIG"; exit 1; }
# --inplace: the SMB share rejects rsync's temporary names starting with a dot
CHANGED=$(rsync -rti --inplace --delete --exclude __pycache__ --exclude '._*' "$SOURCE/" "$TARGET/")
echo "$CHANGED"
if echo "$CHANGED" | grep -qE '\.(py|json)$'; then
  echo "==> Python or manifest changed: restart Home Assistant"
else
  echo "==> frontend only: reload the page"
fi
