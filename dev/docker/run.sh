#!/bin/sh
# The demo container: Home Assistant in front, so Ctrl+C stops it (and `docker run --rm` removes the container).
echo "==> http://127.0.0.1:8124/home-dashboard/home  (user dev, password dev; Ctrl+C stops)"
exec python3 -m homeassistant -c /config
