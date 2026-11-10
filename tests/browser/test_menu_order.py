"""The order of the three dots on Home and in a room, the Look in the side menu, and linking cameras in the settings."""

from __future__ import annotations

from .test_personal_layout import ROOM, add_things
from .test_shortcuts import SHEET, mount_admin
from .test_talk import SETUP

ENTRIES = """(buttons) => buttons
    .filter((button) => !button.dataset.areaLink && !button.hasAttribute('data-home-link'))
    .map((button) => Object.keys(button.dataset)[0])"""


def entries(page) -> list:
    return page.locator(f"{SHEET} .rows > button").evaluate_all(ENTRIES)


def test_on_home_the_three_dots_go_access_background_layout_blocks(phone):
    mount_admin(phone, {})
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.wait_for_selector(f"{SHEET} [data-sheet-personal]")
    assert entries(phone) == ["sheetAccess", "sheetBackground", "sheetPersonal", "sheetBlocks"]


def test_in_a_room_the_three_dots_go_access_background_view_edit(phone):
    add_things(phone)
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(phone, {"layout": [ROOM]}, "room")
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.wait_for_selector(f"{SHEET} [data-sheet-room-view]")
    assert entries(phone) == ["sheetAccess", "sheetBackground", "sheetRoomView", "sheetEdit"]


def test_the_look_sits_in_the_side_menu_above_the_settings(phone):
    mount_admin(phone, {})
    phone.locator("home-dashboard-page [data-menu]").click()
    order = phone.locator("[data-drawer] button").evaluate_all("(buttons) => buttons.map((b) => Object.keys(b.dataset)[0])")
    assert order.index("look") + 1 == order.index("settings")
    phone.locator("[data-drawer] [data-look]").click()
    phone.wait_for_selector(f"{SHEET} [data-tab='themes'], {SHEET} [data-look-everyone]")


def test_someone_without_the_settings_still_finds_the_look(phone):
    mount_admin(phone, {}, admin=False)
    phone.locator("home-dashboard-page [data-menu]").click()
    assert phone.locator("[data-drawer] [data-look]").count() == 1
    assert phone.locator("[data-drawer] [data-settings]").count() == 0


def open_settings(page, cameras: dict) -> None:
    page.evaluate(SETUP, {"speaker": True})
    mount_admin(page, {"cameras": cameras})
    page.evaluate("() => document.querySelector('home-dashboard-chrome').open({ type: 'settings' })")
    page.wait_for_selector(f"{SETTINGS} [data-link-camera]")


SETTINGS = "home-dashboard-settings"


def options(page, selector: str) -> list:
    return page.locator(f"{SETTINGS} {selector} option").evaluate_all("(items) => items.map((o) => o.value)")


def test_any_camera_is_linked_to_a_camera_of_another_integration(phone):
    open_settings(phone, {"tiles": ["camera.hall_nvr"]})
    assert "camera.hall_nvr" in options(phone, "[data-link-camera]")
    # The second camera waits for the first, and offers only cameras of another integration.
    assert phone.locator(f"{SETTINGS} [data-link-other]").is_disabled()
    phone.locator(f"{SETTINGS} [data-link-camera]").select_option("camera.hall_nvr")
    offered = options(phone, "[data-link-other]")[1:]
    assert "camera.hall" in offered
    platforms = phone.evaluate("(ids) => ids.map((id) => window.dashboard.snapshot.entities[id].platform)", offered)
    assert "frigate" not in platforms
    assert phone.locator(f"{SETTINGS} [data-link-add]").is_disabled()
    phone.locator(f"{SETTINGS} [data-link-other]").select_option("camera.hall")
    phone.locator(f"{SETTINGS} [data-link-add]").click()
    assert "camera.hall" in phone.locator(f"{SETTINGS} [data-camera-link='camera.hall_nvr']").inner_text()
    # A linked camera is not offered again.
    assert "camera.hall_nvr" not in options(phone, "[data-link-camera]")
    phone.locator(f"{SETTINGS} [data-save]").click()
    phone.wait_for_function("window.saved.some((message) => message.type === 'lovelace/config/save')")
    saved = phone.evaluate("window.saved.filter((message) => message.type === 'lovelace/config/save').at(-1).config")
    assert saved["strategy"]["cameras"]["controls"] == {"camera.hall_nvr": "camera.hall"}


def test_a_link_is_listed_and_taken_away(phone):
    open_settings(phone, {"tiles": ["camera.hall_nvr"], "controls": {"camera.hall_nvr": "camera.hall"}})
    assert phone.locator(f"{SETTINGS} [data-camera-link]").count() == 1
    phone.locator(f"{SETTINGS} [data-camera-link='camera.hall_nvr'] [data-link-remove]").click()
    assert phone.locator(f"{SETTINGS} [data-camera-link]").count() == 0
    draft = phone.evaluate("() => document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-settings')._draft")
    assert draft["cameras"]["controls"] == {}
