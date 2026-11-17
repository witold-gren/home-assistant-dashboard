#!/bin/sh
# Run once while the demo image is built: start Home Assistant, make the owner, rooms and dashboard, stop it.
set -eu
# In a container Home Assistant listens on every address of the container; Docker publishes it on 127.0.0.1 only.
sed 's/server_host: 127.0.0.1/server_host: 0.0.0.0/' /demo/configuration.yaml > /config/configuration.yaml
python3 -m homeassistant -c /config --log-file /config/home-assistant.log &
PID=$!
python3 /demo/bootstrap.py /config
# Home Assistant writes what it keeps (users, rooms, the dashboard) when it stops.
kill -TERM "$PID"
wait "$PID" || true
rm -f /config/home-assistant.log* /config/tokens.json
