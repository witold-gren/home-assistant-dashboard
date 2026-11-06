"""Prepare a fresh dev instance: owner, rooms, Home Dashboard and a dashboard. Safe to run only once."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
import sys
import time

import aiohttp

BASE = "http://127.0.0.1:8124"
CLIENT_ID = f"{BASE}/"
DASHBOARD_URL = "home-dashboard"
ROOMS = {
    "Salon": ["light.ceiling_lights", "climate.heatpump", "cover.living_room_window"],
    "Kuchnia": ["light.kitchen_lights"],
    "Sypialnia": ["light.bed_light", "light.office_rgbw_lights", "cover.hall_window", "climate.hvac"],
    "Garaż": ["cover.garage_door"],
}


async def wait_until_ready(session: aiohttp.ClientSession) -> None:
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            async with session.get(f"{BASE}/manifest.json") as response:
                if response.status == 200:
                    return
        except aiohttp.ClientError:
            pass
        await asyncio.sleep(1)
    raise SystemExit("Home Assistant did not start")


async def create_owner(session: aiohttp.ClientSession) -> dict:
    payload = {
        "client_id": CLIENT_ID,
        "name": "Test Dev",
        "username": "dev",
        "password": "dev",
        "language": "pl",
    }
    async with session.post(f"{BASE}/api/onboarding/users", json=payload) as response:
        code = (await response.json())["auth_code"]
    form = {"grant_type": "authorization_code", "code": code, "client_id": CLIENT_ID}
    async with session.post(f"{BASE}/auth/token", data=form) as response:
        return await response.json()


async def finish_onboarding(session: aiohttp.ClientSession, headers: dict) -> None:
    await session.post(f"{BASE}/api/onboarding/core_config", headers=headers)
    await session.post(f"{BASE}/api/onboarding/analytics", headers=headers)
    await session.post(
        f"{BASE}/api/onboarding/integration",
        headers=headers,
        json={"client_id": CLIENT_ID, "redirect_uri": CLIENT_ID},
    )


async def add_integration(session: aiohttp.ClientSession, headers: dict) -> None:
    async with session.post(
        f"{BASE}/api/config/config_entries/flow", headers=headers, json={"handler": "home_dashboard"}
    ) as response:
        flow = await response.json()
    await session.post(f"{BASE}/api/config/config_entries/flow/{flow['flow_id']}", headers=headers, json={})


async def wait_for_demo(session: aiohttp.ClientSession, headers: dict) -> None:
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        async with session.get(f"{BASE}/api/states", headers=headers) as response:
            if any(state["entity_id"] == "lock.kitchen_door" for state in await response.json()):
                return
        await asyncio.sleep(1)
    raise SystemExit("Demo entities did not appear")


async def configure(session: aiohttp.ClientSession, access_token: str) -> None:
    async with session.ws_connect(f"{BASE}/api/websocket") as socket:
        await socket.receive_json()
        await socket.send_json({"type": "auth", "access_token": access_token})
        await socket.receive_json()
        counter = 0

        async def call(message_type: str, **payload) -> dict:
            nonlocal counter
            counter += 1
            await socket.send_json({"id": counter, "type": message_type, **payload})
            while True:
                reply = await socket.receive_json()
                if reply.get("id") == counter:
                    if not reply.get("success"):
                        print("failed", message_type, payload, reply.get("error"), file=sys.stderr)
                    return reply.get("result") or {}

        # Onboarding already creates a few default rooms.
        areas = {area["name"]: area["area_id"] for area in await call("config/area_registry/list")}
        for room, entity_ids in ROOMS.items():
            if room not in areas:
                areas[room] = (await call("config/area_registry/create", name=room))["area_id"]
            for entity_id in entity_ids:
                # Home Assistant 2026.10 keeps the area on the device for entities without their own name.
                entry = await call("config/entity_registry/get", entity_id=entity_id)
                await call("config/device_registry/update", device_id=entry["device_id"], area_id=areas[room])
        await call(
            "lovelace/dashboards/create",
            url_path=DASHBOARD_URL,
            title="Home Dashboard",
            icon="mdi:home",
            mode="storage",
            show_in_sidebar=True,
        )
        await call(
            "lovelace/config/save",
            url_path=DASHBOARD_URL,
            config={
                "strategy": {
                    "type": "custom:home-dashboard",
                    "favorites": ["climate.heatpump", "light.ceiling_lights"],
                }
            },
        )


async def main(config_dir: Path) -> None:
    async with aiohttp.ClientSession() as session:
        await wait_until_ready(session)
        tokens = await create_owner(session)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        await finish_onboarding(session, headers)
        await add_integration(session, headers)
        await wait_for_demo(session, headers)
        await configure(session, tokens["access_token"])
    (config_dir / "tokens.json").write_text(json.dumps(tokens))
    print(f"ready: {BASE}/{DASHBOARD_URL}/home  (user dev, password dev)")


if __name__ == "__main__":
    asyncio.run(main(Path(sys.argv[1])))
