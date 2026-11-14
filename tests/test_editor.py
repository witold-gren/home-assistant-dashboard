"""The editor's server: a draft that changes nothing, a version for one reviewer, publishing, history."""

from __future__ import annotations

import os
from pathlib import Path

from homeassistant.components.frontend import DATA_PANELS
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry, MockUser

from custom_components.home_dashboard.const import DOMAIN
from custom_components.home_dashboard.editor import HISTORY_LIMIT, PANEL_URL, STORAGE_KEY, config_hash, list_pictures

URL = "home-dashboard"
LIVE = {"strategy": {"type": "custom:home-dashboard", "layout": [{"id": "living", "name": "Living room"}]}}
DRAFT = {"strategy": {"type": "custom:home-dashboard", "layout": [{"id": "living", "name": "Salon"}]}}


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Enable custom_components in tests."""


@pytest.fixture
async def dashboard(hass: HomeAssistant, hass_ws_client) -> None:
    assert await async_setup_component(hass, "http", {})
    assert await async_setup_component(hass, "frontend", {})
    assert await async_setup_component(hass, "lovelace", {})
    entry = MockConfigEntry(domain=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "lovelace/dashboards/create", "url_path": URL, "title": "Home", "mode": "storage"}
    )
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "lovelace/config/save", "url_path": URL, "config": LIVE})
    assert (await client.receive_json())["success"]


async def call(client, **message):
    await client.send_json_auto_id(message)
    return await client.receive_json()


async def ok(client, **message):
    answer = await call(client, **message)
    assert answer["success"], answer
    return answer["result"]


async def live(client):
    return await ok(client, type="lovelace/config", url_path=URL)


async def draft(client, config=DRAFT):
    loaded = await ok(client, type=f"{DOMAIN}/editor/load", url_path=URL)
    return await ok(
        client, type=f"{DOMAIN}/editor/save_draft", url_path=URL, config=config, base=loaded["live_hash"]
    )


@pytest.fixture
async def admin(hass, dashboard, hass_ws_client):
    return await hass_ws_client(hass)


@pytest.fixture
async def reviewer(hass, dashboard) -> MockUser:
    return MockUser(name="Sam").add_to_hass(hass)


async def test_the_panel_is_for_administrators(hass, dashboard) -> None:
    panel = hass.data[DATA_PANELS][PANEL_URL]
    assert panel.require_admin is True
    assert panel.config["_panel_custom"]["name"] == "home-dashboard-editor"
    assert "/editor/editor.js?v=" in panel.config["_panel_custom"]["module_url"]


async def test_the_panel_leaves_the_sidebar_when_asked(hass, dashboard) -> None:
    assert hass.data[DATA_PANELS][PANEL_URL].sidebar_title == "Dashboard editor"
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={"editor_in_sidebar": False})
    await hass.async_block_till_done()
    panel = hass.data[DATA_PANELS][PANEL_URL]
    assert (panel.sidebar_title, panel.sidebar_icon) == (None, None)
    assert panel.require_admin is True  # still at its address, for administrators
    hass.config_entries.async_update_entry(entry, options={"editor_in_sidebar": True})
    await hass.async_block_till_done()
    assert hass.data[DATA_PANELS][PANEL_URL].sidebar_title == "Dashboard editor"


async def test_dashboards_lists_only_those_of_the_strategy(hass, admin) -> None:
    await ok(admin, type="lovelace/dashboards/create", url_path="other-board", title="Other", mode="storage")
    await ok(admin, type="lovelace/config/save", url_path="other-board", config={"views": []})
    found = await ok(admin, type=f"{DOMAIN}/editor/dashboards")
    assert found == {"dashboards": [{"url_path": URL, "title": "Home"}]}


async def test_load_gives_the_live_version_and_nothing_else_yet(admin) -> None:
    loaded = await ok(admin, type=f"{DOMAIN}/editor/load", url_path=URL)
    assert loaded["live"] == LIVE
    assert loaded["live_hash"] == config_hash(LIVE)
    assert (loaded["draft"], loaded["review"], loaded["history"]) == (None, None, [])


async def test_an_unknown_dashboard_is_not_found(admin) -> None:
    answer = await call(admin, type=f"{DOMAIN}/editor/load", url_path="nope")
    assert answer["error"]["code"] == "not_found"


async def test_a_draft_is_kept_and_changes_nothing_live(admin) -> None:
    await draft(admin)
    assert await live(admin) == LIVE
    loaded = await ok(admin, type=f"{DOMAIN}/editor/load", url_path=URL)
    assert loaded["draft"]["config"] == DRAFT
    assert loaded["draft"]["base"] == config_hash(LIVE)


async def test_a_draft_keeps_the_base_it_began_from(admin) -> None:
    first = await draft(admin)
    second = await ok(admin, type=f"{DOMAIN}/editor/save_draft", url_path=URL, config=LIVE, base="other")
    assert second["base"] == first["base"] == config_hash(LIVE)


async def test_discard_throws_the_draft_away(admin) -> None:
    await draft(admin)
    await ok(admin, type=f"{DOMAIN}/editor/discard", url_path=URL)
    assert (await ok(admin, type=f"{DOMAIN}/editor/load", url_path=URL))["draft"] is None


async def test_publish_saves_for_everyone_and_keeps_the_old_version(admin) -> None:
    await draft(admin)
    result = await ok(
        admin, type=f"{DOMAIN}/editor/publish", url_path=URL, base=config_hash(LIVE), note="Salon"
    )
    assert result["live_hash"] == config_hash(DRAFT)
    assert await live(admin) == DRAFT
    loaded = await ok(admin, type=f"{DOMAIN}/editor/load", url_path=URL)
    assert loaded["draft"] is None
    assert [entry["note"] for entry in loaded["history"]] == ["Salon"]
    old = await ok(
        admin, type=f"{DOMAIN}/editor/history_get", url_path=URL, version=loaded["history"][0]["id"]
    )
    assert old["config"] == LIVE


async def test_publish_without_a_draft_is_refused(admin) -> None:
    answer = await call(admin, type=f"{DOMAIN}/editor/publish", url_path=URL, base=config_hash(LIVE))
    assert answer["error"]["code"] == "no_draft"


async def test_a_change_made_elsewhere_stops_publishing_unless_forced(admin) -> None:
    await draft(admin)
    elsewhere = {"strategy": {"type": "custom:home-dashboard", "layout": []}}
    await ok(admin, type="lovelace/config/save", url_path=URL, config=elsewhere)
    answer = await call(admin, type=f"{DOMAIN}/editor/publish", url_path=URL, base=config_hash(LIVE))
    assert answer["error"]["code"] == "conflict"
    assert await live(admin) == elsewhere
    await ok(admin, type=f"{DOMAIN}/editor/publish", url_path=URL, base=config_hash(LIVE), force=True)
    assert await live(admin) == DRAFT


async def test_the_history_keeps_only_the_newest_versions(admin) -> None:
    for index in range(HISTORY_LIMIT + 3):
        config = {"strategy": {"type": "custom:home-dashboard", "layout": [], "n": index}}
        current = await ok(admin, type=f"{DOMAIN}/editor/load", url_path=URL)
        await ok(
            admin, type=f"{DOMAIN}/editor/save_draft", url_path=URL, config=config, base=current["live_hash"]
        )
        await ok(admin, type=f"{DOMAIN}/editor/publish", url_path=URL, base=current["live_hash"])
    history = (await ok(admin, type=f"{DOMAIN}/editor/load", url_path=URL))["history"]
    assert len(history) == HISTORY_LIMIT


async def test_restore_makes_an_old_version_a_draft_not_live(admin) -> None:
    await draft(admin)
    await ok(admin, type=f"{DOMAIN}/editor/publish", url_path=URL, base=config_hash(LIVE))
    version = (await ok(admin, type=f"{DOMAIN}/editor/load", url_path=URL))["history"][0]["id"]
    restored = await ok(admin, type=f"{DOMAIN}/editor/restore", url_path=URL, version=version)
    assert restored["draft"]["config"] == LIVE
    assert restored["draft"]["base"] == config_hash(DRAFT)
    assert await live(admin) == DRAFT


async def test_only_the_reviewer_gets_the_version_to_check(hass, admin, reviewer, hass_ws_client) -> None:
    await draft(admin)
    await ok(admin, type=f"{DOMAIN}/editor/publish_review", url_path=URL, user_id=reviewer.id)
    loaded = await ok(admin, type=f"{DOMAIN}/editor/load", url_path=URL)
    assert loaded["review"]["user_id"] == reviewer.id
    assert "config" not in loaded["review"]
    # The administrator is not the reviewer: nothing for them.
    assert await ok(admin, type=f"{DOMAIN}/review/get", url_path=URL) is None
    token = hass.auth.async_create_access_token(
        await hass.auth.async_create_refresh_token(reviewer, "client")
    )
    sam = await hass_ws_client(hass, access_token=token)
    mine = await ok(sam, type=f"{DOMAIN}/review/get", url_path=URL)
    assert mine["config"] == DRAFT
    assert await live(admin) == LIVE


async def test_a_review_ends_when_published_or_ended(hass, admin, reviewer) -> None:
    await draft(admin)
    await ok(admin, type=f"{DOMAIN}/editor/publish_review", url_path=URL, user_id=reviewer.id)
    await ok(admin, type=f"{DOMAIN}/editor/end_review", url_path=URL)
    assert (await ok(admin, type=f"{DOMAIN}/editor/load", url_path=URL))["review"] is None
    await ok(admin, type=f"{DOMAIN}/editor/publish_review", url_path=URL, user_id=reviewer.id)
    await ok(admin, type=f"{DOMAIN}/editor/publish", url_path=URL, base=config_hash(LIVE))
    assert (await ok(admin, type=f"{DOMAIN}/editor/load", url_path=URL))["review"] is None


async def test_a_review_needs_a_draft_and_a_real_person(admin, reviewer) -> None:
    answer = await call(admin, type=f"{DOMAIN}/editor/publish_review", url_path=URL, user_id=reviewer.id)
    assert answer["error"]["code"] == "no_draft"
    await draft(admin)
    answer = await call(admin, type=f"{DOMAIN}/editor/publish_review", url_path=URL, user_id="nobody")
    assert answer["error"]["code"] == "not_found"


async def test_a_review_reloads_the_pages(hass, admin, reviewer) -> None:
    events = []
    hass.bus.async_listen("lovelace_updated", lambda event: events.append(event.data))
    await draft(admin)
    await ok(admin, type=f"{DOMAIN}/editor/publish_review", url_path=URL, user_id=reviewer.id)
    await hass.async_block_till_done()
    assert {"url_path": URL} in events


async def test_people_who_are_not_administrators_cannot_edit(
    hass, dashboard, reviewer, hass_ws_client
) -> None:
    token = hass.auth.async_create_access_token(
        await hass.auth.async_create_refresh_token(reviewer, "client")
    )
    sam = await hass_ws_client(hass, access_token=token)
    for message in (
        {"type": f"{DOMAIN}/editor/dashboards"},
        {"type": f"{DOMAIN}/editor/load", "url_path": URL},
        {"type": f"{DOMAIN}/editor/save_draft", "url_path": URL, "config": DRAFT, "base": "x"},
        {"type": f"{DOMAIN}/editor/publish", "url_path": URL, "base": "x"},
        {"type": f"{DOMAIN}/editor/publish_review", "url_path": URL, "user_id": reviewer.id},
        {"type": f"{DOMAIN}/editor/restore", "url_path": URL, "version": "x"},
    ):
        answer = await call(sam, **message)
        assert answer["error"]["code"] == "unauthorized", message


async def test_drafts_survive_a_restart(hass, admin, hass_storage) -> None:
    await draft(admin)
    await hass.async_block_till_done()
    saved = hass_storage[STORAGE_KEY]["data"]["dashboards"][URL]["draft"]
    assert saved["config"] == DRAFT


def test_the_fingerprint_does_not_depend_on_the_order_of_keys() -> None:
    assert config_hash({"a": 1, "b": [1, 2]}) == config_hash({"b": [1, 2], "a": 1})
    assert config_hash({"a": 1}) != config_hash({"a": 2})


async def test_the_editor_modules_are_served(hass, dashboard, hass_client_no_auth) -> None:
    client = await hass_client_no_auth()
    for path in ("editor/editor.js", "editor/editor-app.js", "editor/tree.js"):
        response = await client.get(f"/home_dashboard_static/{path}")
        assert response.status == 200, path
        assert response.headers["Cache-Control"] == "no-cache"


def test_pictures_are_the_images_under_www_newest_first(tmp_path) -> None:
    www = tmp_path / "www"
    (www / "backgrounds").mkdir(parents=True)
    (www / ".hidden").mkdir()
    (www / "backgrounds" / "salon.JPG").write_bytes(b"x")
    (www / "old.png").write_bytes(b"xy")
    (www / "notes.txt").write_text("no")
    (www / ".hidden" / "secret.png").write_bytes(b"x")
    os.utime(www / "old.png", (1, 1))
    found = list_pictures(www)
    assert [item["url"] for item in found] == ["/local/backgrounds/salon.JPG", "/local/old.png"]
    assert found[1]["size"] == 2
    assert list_pictures(www, limit=1)[0]["url"] == "/local/backgrounds/salon.JPG"
    assert list_pictures(tmp_path / "missing") == []


def test_a_link_out_of_www_is_left_out(tmp_path) -> None:
    www = tmp_path / "www"
    www.mkdir()
    (tmp_path / "outside.png").write_bytes(b"x")
    (www / "link.png").symlink_to(tmp_path / "outside.png")
    assert list_pictures(www) == []


async def test_pictures_are_listed_for_administrators(hass, admin) -> None:
    www = Path(hass.config.path("www"))
    www.mkdir(exist_ok=True)
    (www / "tlo.webp").write_bytes(b"x")
    result = await ok(admin, type=f"{DOMAIN}/editor/pictures")
    assert "/local/tlo.webp" in [item["url"] for item in result["pictures"]]
