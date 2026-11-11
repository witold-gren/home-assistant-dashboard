"""A tile flat (one row, as before) or tall (two rows), chosen in the editor of a room."""

from __future__ import annotations

from .test_room_editor import MOUNT_ADMIN, layout_with, open_editor, saved_room

SHEET = "home-dashboard-sheet"


def test_a_tile_is_made_tall_in_the_editor_and_saved(phone):
    open_editor(phone)
    phone.locator("[data-edit-tile='A']").first.click()
    assert "on" in phone.locator(f"{SHEET} [data-tile-size] [data-choice='flat']").get_attribute("class")
    phone.locator(f"{SHEET} [data-tile-size] [data-choice='tall']").click()
    phone.locator(f"{SHEET} [data-tile-save]").click()
    # The editor shows it tall at once.
    assert "tall" in phone.locator("[data-edit-list='0'] [data-edit-tile='A']").get_attribute("class")
    room = saved_room(phone)
    assert room["sections"][0]["tiles"][0] == {"entity": room["sections"][0]["tiles"][0]["entity"], "name": "A", "size": "tall"}


def test_flat_again_takes_the_size_away(phone):
    dashboard = layout_with(phone)
    dashboard["layout"][0]["sections"][0]["tiles"][0]["size"] = "tall"
    open_editor(phone, dashboard)
    phone.locator("[data-edit-list='0'] [data-edit-tile='A']").click()
    phone.locator(f"{SHEET} [data-tile-size] [data-choice='flat']").click()
    phone.locator(f"{SHEET} [data-tile-save]").click()
    assert "size" not in saved_room(phone)["sections"][0]["tiles"][0]


def test_a_tall_tile_takes_two_rows_and_flat_ones_fill_beside_it(phone):
    dashboard = layout_with(phone)
    tiles = dashboard["layout"][0]["sections"][0]["tiles"]
    tiles[0]["size"] = "tall"
    d, e = [tile["entity"] for tile in tiles[:2]]
    tiles.append({"entity": d, "name": "D"})
    tiles.append({"entity": e, "name": "E"})
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    phone.evaluate(MOUNT_ADMIN, {"dashboard": dashboard, "room": "r"})
    page = "home-dashboard-page"
    phone.wait_for_selector(f"{page} .tile.tall")
    tall = phone.locator(f"{page} .tile.tall").first.bounding_box()
    flat = [phone.locator(f"{page} [data-tile='{name}']").first.bounding_box() for name in ("B", "D")]
    # Two rows high: as tall as two flat tiles and the gap between them.
    assert abs(tall["height"] - (flat[0]["height"] * 2 + 8)) < 2
    # B and D stand one under the other beside it, in the other column.
    assert flat[0]["x"] > tall["x"] + tall["width"] and flat[1]["x"] == flat[0]["x"]
    assert abs(flat[0]["y"] - tall["y"]) < 1 and flat[1]["y"] > flat[0]["y"]


def test_a_block_has_no_size_to_choose(phone):
    dashboard = layout_with(phone)
    dashboard["layout"][0]["sections"][0]["tiles"].append({"kind": "panel", "name": "Blok", "icon": "mdi:cube"})
    open_editor(phone, dashboard)
    phone.locator("[data-edit-tile='Blok']").click()
    phone.wait_for_selector(f"{SHEET} [data-tile-save]")
    assert phone.locator(f"{SHEET} [data-tile-size]").count() == 0
