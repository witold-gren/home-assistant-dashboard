"""Build tests/fixtures/registry_snapshot.json from a live instance, with nothing identifying left.

Keeps the shape that matters to the model: which entities exist, how they relate to devices, rooms
and groups, and their states. Every name and id is replaced. Run by hand, read-only on the instance:

    python scripts/make_fixture.py <config dir> <url> <token file> <output>
"""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys
import urllib.request

DOMAINS = {"light", "switch", "climate", "cover", "lock", "media_player", "camera", "image"}
KEPT_SUFFIX = re.compile(r"(_homepod_muzyka|_homepod|_last_screen|_last_snapshot)$")
KEPT_ATTRIBUTES = (
    "brightness", "rgb_color", "current_temperature", "temperature", "hvac_action", "current_position",
    "device_class", "is_hue_group", "color_mode",
)  # fmt: skip


def fetch_states(url: str, token: str) -> dict:
    request = urllib.request.Request(f"{url}/api/states", headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return {state["entity_id"]: state for state in json.load(response)}


def build(config_dir: Path, states: dict) -> dict:
    def storage(name: str) -> dict:
        return json.loads((config_dir / ".storage" / name).read_text())["data"]

    entries = [
        entry
        for entry in storage("core.entity_registry")["entities"]
        if entry["entity_id"].split(".")[0] in DOMAINS and not entry.get("disabled_by")
    ]
    areas = {area["id"]: area for area in storage("core.area_registry")["areas"]}
    floors = {floor["floor_id"]: floor for floor in storage("core.floor_registry")["floors"]}
    devices = {device["id"]: device for device in storage("core.device_registry")["devices"]}

    area_ids = {area_id: f"area_{index:02}" for index, area_id in enumerate(sorted(areas), 1)}
    floor_ids = {floor_id: f"floor_{index}" for index, floor_id in enumerate(sorted(floors), 1)}
    device_ids = {device_id: f"device_{index:04}" for index, device_id in enumerate(sorted(devices), 1)}
    stems: dict[str, str] = {}
    entity_ids: dict[str, str] = {}
    for index, entry in enumerate(sorted(entries, key=lambda item: item["entity_id"]), 1):
        domain, object_id = entry["entity_id"].split(".")
        suffix = KEPT_SUFFIX.search(object_id)
        if suffix:
            stem = object_id[: suffix.start()]
            stems.setdefault(stem, f"unit_{len(stems) + 1:02}")
            entity_ids[entry["entity_id"]] = f"{domain}.{stems[stem]}{suffix.group(1)}"
        else:
            entity_ids[entry["entity_id"]] = f"{domain}.entity_{index:04}"

    def clean_state(entity_id: str) -> dict | None:
        state = states.get(entity_id)
        if state is None:
            return None
        attributes = {key: state["attributes"][key] for key in KEPT_ATTRIBUTES if key in state["attributes"]}
        attributes["friendly_name"] = entity_ids[entity_id].split(".")[1].replace("_", " ").title()
        if "entity_picture" in state["attributes"]:
            attributes["entity_picture"] = f"/api/image_proxy/{entity_ids[entity_id]}"
        members = state["attributes"].get("entity_id")
        if isinstance(members, list):
            attributes["entity_id"] = [entity_ids[member] for member in members if member in entity_ids]
        return {"entity_id": entity_ids[entity_id], "state": state["state"], "attributes": attributes}

    snapshot_states = {}
    snapshot_entities = {}
    for entry in entries:
        new_id = entity_ids[entry["entity_id"]]
        snapshot_entities[new_id] = {
            "entity_id": new_id,
            "platform": entry["platform"],
            "area_id": area_ids.get(entry.get("area_id")),
            "device_id": device_ids.get(entry.get("device_id")),
            "entity_category": entry.get("entity_category"),
            "hidden": bool(entry.get("hidden_by")),
        }
        if state := clean_state(entry["entity_id"]):
            snapshot_states[new_id] = state
    return {
        "entities": snapshot_entities,
        "states": snapshot_states,
        "devices": {
            device_ids[device_id]: {"area_id": area_ids.get(device.get("area_id"))}
            for device_id, device in devices.items()
        },
        "areas": {
            new_id: {
                "area_id": new_id,
                "name": f"Room {new_id[-2:]}",
                "floor_id": floor_ids.get(areas[old_id].get("floor_id")),
            }
            for old_id, new_id in area_ids.items()
        },
        "floors": {
            new_id: {"floor_id": new_id, "level": floors[old_id].get("level")}
            for old_id, new_id in floor_ids.items()
        },
    }


def main() -> None:
    config_dir, url, token_file, output = sys.argv[1:5]
    states = fetch_states(url, Path(token_file).expanduser().read_text().strip())
    snapshot = build(Path(config_dir), states)
    Path(output).write_text(json.dumps(snapshot, separators=(",", ":"), sort_keys=True))
    print(f"{len(snapshot['entities'])} entities, {len(snapshot['states'])} states")


if __name__ == "__main__":
    main()
