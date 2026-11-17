"""The activity of the household: the dashboard writes the pages and windows each person opens, and the
owner of Home Assistant (or the people chosen) reads them, with the changes of states each person made."""

from __future__ import annotations

from datetime import date, timedelta
import json
import shutil

from homeassistant.core import Context, HomeAssistant
from homeassistant.setup import async_setup_component
from homeassistant.util import dt as dt_util
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.home_dashboard import activity
from custom_components.home_dashboard.const import DOMAIN


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Enable custom_components in tests."""


async def set_up(hass: HomeAssistant, viewers: list[str] | None) -> MockConfigEntry:
    # The config folder of the tests is shared: each test starts with no days written.
    shutil.rmtree(activity.folder(hass), ignore_errors=True)
    assert await async_setup_component(hass, "http", {})
    assert await async_setup_component(hass, "frontend", {})
    entry = MockConfigEntry(domain=DOMAIN, options={activity.CONF_VIEWERS: viewers} if viewers else {})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def send(client, message: dict) -> dict:
    send.counter = getattr(send, "counter", 0) + 1
    await client.send_json({"id": send.counter, **message})
    return await client.receive_json()


def day_range(hours: int = 1) -> dict:
    now = dt_util.utcnow()
    return {
        "start": (now - timedelta(hours=hours)).isoformat(),
        "end": (now + timedelta(minutes=5)).isoformat(),
    }


async def test_a_page_and_a_window_opened_are_read_back_with_the_person(
    hass: HomeAssistant, hass_ws_client, hass_admin_user
) -> None:
    await set_up(hass, [hass_admin_user.id])
    client = await hass_ws_client(hass)
    seen = {
        "type": f"{DOMAIN}/activity/seen",
        "kind": "page",
        "name": "Home",
        "page": "/home-dashboard/home",
        "device": "iPad (app)",
    }
    assert (await send(client, seen))["success"]
    window = {
        "type": f"{DOMAIN}/activity/seen",
        "kind": "window",
        "name": "Salon lamp",
        "entity_id": "light.salon",
        "page": "/home-dashboard/home",
        "device": "iPad (app)",
    }
    assert (await send(client, window))["success"]
    result = (await send(client, {"type": f"{DOMAIN}/activity/get", **day_range()}))["result"]
    mine = [entry for entry in result["entries"] if entry["kind"] in ("page", "window")]
    assert [(entry["kind"], entry["name"], entry["user_id"]) for entry in mine] == [
        ("page", "Home", hass_admin_user.id),
        ("window", "Salon lamp", hass_admin_user.id),
    ]
    assert mine[1]["entity_id"] == "light.salon" and mine[1]["device"] == "iPad (app)"
    assert any(person["id"] == hass_admin_user.id for person in result["people"])
    assert result["retention_days"] == activity.RETENTION_DAYS


async def test_only_the_people_chosen_read_it(hass: HomeAssistant, hass_ws_client) -> None:
    await set_up(hass, ["somebody-else"])
    client = await hass_ws_client(hass)
    answer = await send(client, {"type": f"{DOMAIN}/activity/get", **day_range()})
    assert not answer["success"] and answer["error"]["code"] == activity.ERROR_NOT_ALLOWED


async def test_without_a_choice_only_the_owner_reads_it(
    hass: HomeAssistant, hass_ws_client, hass_admin_user, hass_owner_user
) -> None:
    await set_up(hass, None)
    assert await activity.async_viewers(hass) == {hass_owner_user.id}
    client = await hass_ws_client(hass)
    answer = await send(client, {"type": f"{DOMAIN}/activity/get", **day_range()})
    assert not answer["success"]


async def test_a_range_of_more_than_a_month_is_refused(
    hass: HomeAssistant, hass_ws_client, hass_admin_user
) -> None:
    await set_up(hass, [hass_admin_user.id])
    client = await hass_ws_client(hass)
    answer = await send(client, {"type": f"{DOMAIN}/activity/get", **day_range(hours=24 * 32)})
    assert not answer["success"]


async def test_a_wrong_kind_is_refused(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    await set_up(hass, [hass_admin_user.id])
    client = await hass_ws_client(hass)
    answer = await send(client, {"type": f"{DOMAIN}/activity/seen", "kind": "keystroke", "name": "x"})
    assert not answer["success"]


async def test_days_older_than_the_retention_are_removed(hass: HomeAssistant, hass_admin_user) -> None:
    await set_up(hass, [hass_admin_user.id])
    today = date(2026, 11, 17)
    for age in (0, activity.RETENTION_DAYS, activity.RETENTION_DAYS + 1, 60):
        path = activity.day_file(hass, today - timedelta(days=age))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"at": "x"}) + "\n")
    removed = await activity.async_purge(hass, today)
    assert sorted(removed) == sorted(
        f"{(today - timedelta(days=age)).isoformat()}.jsonl" for age in (activity.RETENTION_DAYS + 1, 60)
    )
    left = sorted(path.name for path in activity.folder(hass).glob("*.jsonl"))
    assert left == sorted(
        f"{(today - timedelta(days=age)).isoformat()}.jsonl" for age in (0, activity.RETENTION_DAYS)
    )


async def test_the_panel_is_for_administrators(hass: HomeAssistant, hass_admin_user) -> None:
    await set_up(hass, [hass_admin_user.id])
    panels = hass.data["frontend_panels"]
    assert panels[activity.PANEL_URL].require_admin


async def test_with_writing_down_off_nothing_is_kept(
    hass: HomeAssistant, hass_ws_client, hass_admin_user
) -> None:
    entry = await set_up(hass, [hass_admin_user.id])
    hass.config_entries.async_update_entry(entry, options={**entry.options, "activity_record": False})
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    answer = await send(client, {"type": f"{DOMAIN}/activity/seen", "kind": "page", "name": "home"})
    assert answer["success"] and answer["result"] == {"recorded": False}
    result = (await send(client, {"type": f"{DOMAIN}/activity/get", **day_range()}))["result"]
    assert [entry for entry in result["entries"] if entry["kind"] != "change"] == []


async def test_the_panel_leaves_the_sidebar_but_keeps_its_address(
    hass: HomeAssistant, hass_admin_user
) -> None:
    entry = await set_up(hass, [hass_admin_user.id])
    assert hass.data["frontend_panels"][activity.PANEL_URL].sidebar_title
    hass.config_entries.async_update_entry(entry, options={**entry.options, "activity_in_sidebar": False})
    await hass.async_block_till_done()
    panel = hass.data["frontend_panels"][activity.PANEL_URL]
    assert panel.sidebar_title is None and panel.require_admin


async def test_live_brings_pages_and_changes_made_by_people(
    hass: HomeAssistant, hass_ws_client, hass_admin_user
) -> None:
    await set_up(hass, [hass_admin_user.id])
    viewer = await hass_ws_client(hass)
    await viewer.send_json({"id": 1, "type": f"{DOMAIN}/activity/subscribe"})
    assert (await viewer.receive_json())["success"]
    other = await hass_ws_client(hass)
    seen = {
        "type": f"{DOMAIN}/activity/seen",
        "kind": "window",
        "name": "light: Biurko",
        "entity_id": "light.biurko",
    }
    await send(other, seen)
    live = (await viewer.receive_json())["event"]
    assert (live["kind"], live["name"], live["user_id"]) == ("window", "light: Biurko", hass_admin_user.id)
    # a change by an automation (no person) does not come, one made from an app does
    hass.states.async_set("sensor.power", "120")
    hass.states.async_set("light.biurko", "on", context=Context(user_id=hass_admin_user.id))
    await hass.async_block_till_done()
    change = (await viewer.receive_json())["event"]
    assert (change["kind"], change["entity_id"], change["state"], change["user_id"]) == (
        "change",
        "light.biurko",
        "on",
        hass_admin_user.id,
    )


async def test_live_is_only_for_the_people_chosen(hass: HomeAssistant, hass_ws_client) -> None:
    await set_up(hass, ["somebody-else"])
    client = await hass_ws_client(hass)
    answer = await send(client, {"type": f"{DOMAIN}/activity/subscribe"})
    assert not answer["success"] and answer["error"]["code"] == activity.ERROR_NOT_ALLOWED


async def test_the_page_is_told_whether_its_person_sees_the_activity(
    hass: HomeAssistant, hass_ws_client, hass_admin_user
) -> None:
    entry = await set_up(hass, [hass_admin_user.id])
    client = await hass_ws_client(hass)
    answer = await send(client, {"type": f"{DOMAIN}/settings/subscribe"})
    assert answer["success"]
    assert (await client.receive_json())["event"]["activity_viewer"] is True
    hass.config_entries.async_update_entry(
        entry, options={**entry.options, activity.CONF_VIEWERS: ["somebody"]}
    )
    await hass.async_block_till_done()
    assert (await client.receive_json())["event"]["activity_viewer"] is False
