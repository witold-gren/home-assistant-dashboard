"""The media page in the user's own groups, and what they add to the Media filter on Home."""

from __future__ import annotations

from .test_page import mount
from .test_panels import add_entity

TV = {"kind": "tv", "entity": "media_player.tv", "name": "Telewizor"}
SYNC = {"kind": "panel", "name": "Sync", "icon": "mdi:television", "entity": "switch.sync"}
PLAYER = {"entity": "media_player.apple", "name": "Apple TV", "active_only": True}
SECTIONS = [
    {"title": "Telewizory", "tiles": [TV]},
    {"title": "Inne", "tiles": [SYNC, {"entity": "media_player.apple", "name": "Apple TV (Salon)"}]},
    {"title": "Puste", "tiles": [{"entity": "media_player.gone"}]},
]
ROOM = {"id": "salon", "name": "Salon", "areas": ["salon"], "home": [], "sections": [{"tiles": [TV, SYNC, PLAYER]}]}


def add_devices(page) -> None:
    add_entity(page, "media_player.tv", "off", {"friendly_name": "TV"})
    add_entity(page, "media_player.apple", "off", {"friendly_name": "Apple"})
    add_entity(page, "switch.sync", "off", {"friendly_name": "Sync"})


def filtered(page, raw: dict) -> dict:
    return page.evaluate(
        """(raw) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            const config = model.personalize(model.normalizeConfig(raw), "me");
            const home = model.buildHomeModel(instance, config, model.selectEntities(instance, config));
            const rooms = model.applyFilter(home, "media", "pl").rooms;
            return Object.fromEntries(rooms.map((room) => [room.id, room.tiles.map((tile) => tile.name)]));
        }""",
        raw,
    )


def test_the_media_page_shows_the_groups_in_order_and_skips_empty_ones(phone):
    add_devices(phone)
    mount(phone, {"media": {"sections": SECTIONS}}, "media")
    phone.wait_for_selector("home-dashboard-page [data-media-section='Telewizory']")
    titles = phone.locator("home-dashboard-page [data-media-section] h2").all_inner_texts()
    assert titles == ["Telewizory", "Inne"]
    assert phone.locator("home-dashboard-page [data-media-section='Inne'] .tile").count() == 2


def test_without_groups_the_media_page_lists_the_speakers(phone):
    mount(phone, {}, "media")
    phone.wait_for_selector("home-dashboard-page [data-media-section]")
    assert phone.locator("home-dashboard-page [data-media-section] h2").all_inner_texts() == ["Głośniki"]


def test_the_media_filter_adds_what_the_groups_list_to_its_room(phone):
    add_devices(phone)
    tiles = filtered(phone, {"media": {"sections": SECTIONS}, "layout": [ROOM]})["salon"]
    assert {"Telewizor", "Sync", "Apple TV"} <= set(tiles)


def test_a_player_that_hides_when_off_still_shows_in_the_filter(phone):
    add_devices(phone)
    assert "Apple TV" in filtered(phone, {"media": {"sections": SECTIONS}, "layout": [ROOM]})["salon"]


def test_what_the_groups_do_not_list_stays_out_of_the_filter(phone):
    add_devices(phone)
    raw = {"media": {"sections": [{"title": "T", "tiles": [TV]}]}, "layout": [ROOM]}
    tiles = filtered(phone, raw)["salon"]
    assert "Telewizor" in tiles
    assert "Sync" not in tiles


def test_a_room_without_areas_adds_nothing_to_the_filter(phone):
    add_devices(phone)
    raw = {"media": {"sections": SECTIONS}, "layout": [{**ROOM, "id": "media", "areas": []}]}
    assert "media" not in filtered(phone, raw)


def test_a_denied_tile_stays_out_of_the_filter(phone):
    add_devices(phone)
    raw = {"media": {"sections": SECTIONS}, "layout": [ROOM], "access": {"me": {"hide": ["media_player.tv"]}}}
    assert "Telewizor" not in filtered(phone, raw)["salon"]
