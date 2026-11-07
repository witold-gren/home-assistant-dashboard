"""The side menu and its editor."""

from __future__ import annotations

from .test_panels import add_entity
from .test_shortcuts import HOST, SHEET, mount_admin

EDITOR = "home-dashboard-block-editor"
MENU = {"groups": [
    {"title": "Skróty", "items": [{"shortcut": "Host"}, {"shortcut": "Brak"}, {"name": "Kamery", "icon": "mdi:cctv", "path": "/cameras", "hide_for_guests": True}]},
    {"items": [
        {"name": "Ustawienia", "icon": "mdi:cog", "path": "/config", "admin": True},
        {"name": "Powiadomienia", "icon": "mdi:bell", "action": "notifications"},
    ]},
]}


def open_menu(page, dashboard: dict, admin: bool = True) -> None:
    mount_admin(page, dashboard, admin=admin)
    page.locator("home-dashboard-page .top-bar button").first.click()
    page.wait_for_selector("[data-drawer]")


def test_without_a_menu_the_shortcuts_and_links_stay(phone):
    open_menu(phone, {"shortcuts": [HOST]})
    assert phone.locator(f"[data-drawer-shortcut='{HOST['name']}']").count() == 1
    assert phone.locator("[data-link='/history']").count() == 1


def test_the_menu_shows_its_groups_and_entries(phone):
    open_menu(phone, {"shortcuts": [HOST], "menu": MENU})
    assert phone.locator("[data-drawer] h3").all_inner_texts() == ["Skróty"]
    assert phone.locator("[data-link='/cameras']").inner_text().strip() == "Kamery"
    assert phone.locator("[data-link='/history']").count() == 0


def test_a_shortcut_entry_opens_the_block(phone):
    open_menu(phone, {"shortcuts": [HOST], "menu": MENU})
    phone.locator(f"[data-drawer-shortcut='{HOST['name']}']").click()
    phone.wait_for_selector(f"{SHEET} section.panel[data-kind='panel']")


def test_a_shortcut_that_is_gone_leaves_no_empty_entry(phone):
    open_menu(phone, {"shortcuts": [HOST], "menu": MENU})
    assert phone.locator("[data-drawer-shortcut='Brak']").count() == 0


def test_a_block_taken_away_from_someone_leaves_their_menu(phone):
    open_menu(phone, {"shortcuts": [HOST], "menu": MENU, "visibility": {f"block:{HOST['name']}": {"only": ["nobody"]}}})
    assert phone.locator(f"[data-drawer-shortcut='{HOST['name']}']").count() == 0


def test_an_administrator_entry_is_hidden_from_others(phone):
    open_menu(phone, {"menu": MENU}, admin=False)
    assert phone.locator("[data-link='/config']").count() == 0
    assert phone.locator("[data-menu-edit]").count() == 0


def test_the_notifications_entry_opens_the_window_of_the_dashboard(phone):
    open_menu(phone, {"menu": MENU})
    phone.locator("[data-menu-action='notifications']").click()
    phone.wait_for_selector(f"{SHEET} section.panel[data-kind='notifications']")


def test_guest_mode_hides_a_camera_entry_on_its_accounts(phone):
    add_entity(phone, "input_boolean.guest", "on", {})
    guest = {"guest": {"entity": "input_boolean.guest", "hide": []}}
    open_menu(phone, {"menu": MENU, "cameras": guest})
    assert phone.locator("[data-link='/cameras']").count() == 0
    assert phone.locator("[data-menu-action='notifications']").count() == 1


def test_guest_mode_for_other_accounts_leaves_the_entry(phone):
    add_entity(phone, "input_boolean.guest", "on", {})
    guest = {"guest": {"entity": "input_boolean.guest", "hide": [], "users": ["Tablet"]}}
    open_menu(phone, {"menu": MENU, "cameras": guest})
    assert phone.locator("[data-link='/cameras']").count() == 1


def open_editor(page, dashboard: dict) -> None:
    open_menu(page, dashboard)
    page.locator("[data-menu-edit]").click()
    page.wait_for_selector(f"{EDITOR} [data-block-save]")


def saved_menu(page) -> dict:
    page.locator(f"{EDITOR} [data-block-save]").click()
    page.wait_for_function("window.saved.length > 0")
    return page.evaluate("window.saved.at(-1).config.strategy.menu")


def test_the_editor_starts_from_what_the_menu_shows(phone):
    open_editor(phone, {"shortcuts": [HOST]})
    menu = saved_menu(phone)
    assert menu["groups"][0]["items"] == [{"shortcut": HOST["name"]}]
    assert "kind" not in menu
    assert {"name": "Historia", "icon": "mdi:chart-box-outline", "path": "/history"} in menu["groups"][1]["items"]


def test_a_new_group_with_an_entry_is_saved(phone):
    open_editor(phone, {"menu": {"groups": [{"items": [{"name": "A", "path": "/a"}]}]}})
    phone.locator(f"{EDITOR} [data-block-add='groups']").click()
    group = phone.locator(f"{EDITOR} [data-block-field='groups'] > details").last
    group.locator("[data-block-field='title'] input").fill("System")
    group.locator("[data-block-add='items']").click()
    entry = group.locator("[data-block-entry]").last
    entry.locator("[data-block-field='name'] input").fill("Ustawienia")
    entry.locator("[data-block-field='path'] input").fill("/config")
    entry.locator("[data-block-field='admin'] input").check()
    menu = saved_menu(phone)
    assert menu["groups"][1] == {"title": "System", "items": [{"name": "Ustawienia", "path": "/config", "admin": True}]}
