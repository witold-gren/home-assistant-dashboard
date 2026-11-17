"""Fields of an icon: typing searches the icons of Home Assistant by name and keyword and lists them; a click, Enter
or leaving the field with a name typed by hand takes it. In the editor (settings, blocks, tiles) and on the tablet."""

from __future__ import annotations

import json

import pytest

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401

ICONS = [
    {"name": "home", "keywords": ["house"]},
    {"name": "home-outline", "keywords": []},
    {"name": "view-dashboard", "keywords": ["dashboard"]},
    {"name": "view-dashboard-outline", "keywords": []},
    {"name": "lamp", "keywords": ["light"]},
]
STRATEGY = {
    "type": "custom:home-dashboard",
    "shortcuts": [{"kind": "departures", "name": "MPK", "icon": "mdi:tram", "entities": []}],
    "menu": {"groups": [{"items": [{"name": "Edytor", "path": "/editor", "shortcut": "HD Editor"}]}]},
}


@pytest.fixture
def editor(desktop):  # noqa: F811
    desktop.route(
        "**/static/mdi/iconList.json",
        lambda route: route.fulfill(content_type="application/json", body=json.dumps(ICONS)),
    )
    desktop.evaluate("() => localStorage.clear()")
    open_editor(desktop, STRATEGY)
    select(desktop, "shortcuts/0")
    desktop.locator(f"{APP} [data-form='block-departures']").wait_for()
    return desktop


def picker(page):
    return page.locator(f"{APP} [data-schema-field='.icon'] home-dashboard-icon-picker")


def icon(page) -> str | None:
    return page.evaluate("window.editor.app._strategy.shortcuts[0].icon")


def test_typing_lists_icons_by_name_and_keyword(editor) -> None:
    picker(editor).locator("[data-icon-input]").fill("dashboard")
    options = picker(editor).locator("[data-icon-option]")
    options.first.wait_for()
    assert options.evaluate_all("(items) => items.map((item) => item.dataset.iconOption)") == [
        "mdi:view-dashboard",
        "mdi:view-dashboard-outline",
    ]
    picker(editor).locator("[data-icon-input]").fill("house")
    picker(editor).locator("[data-icon-option='mdi:home']").wait_for()
    assert options.count() == 1


def test_a_click_takes_an_icon(editor) -> None:
    picker(editor).locator("[data-icon-input]").fill("home")
    picker(editor).locator("[data-icon-option='mdi:home-outline']").click()
    assert icon(editor) == "mdi:home-outline"
    assert picker(editor).locator("[data-icon-list]").count() == 0


def test_the_arrows_and_enter_take_an_icon(editor) -> None:
    field = picker(editor).locator("[data-icon-input]")
    field.fill("home")
    picker(editor).locator("[data-icon-option]").first.wait_for()
    field.press("ArrowDown")
    field.press("ArrowDown")
    field.press("Enter")
    assert icon(editor) == "mdi:home-outline"


def test_a_name_typed_by_hand_is_kept_and_escape_closes_the_list(editor) -> None:
    field = picker(editor).locator("[data-icon-input]")
    field.fill("phu:tram-own")
    field.press("Escape")
    assert picker(editor).locator("[data-icon-list]").count() == 0
    field.fill("phu:tram-own")
    field.press("Enter")
    assert icon(editor) == "phu:tram-own"


def test_nothing_found_says_so_and_clearing_removes_the_icon(editor) -> None:
    picker(editor).locator("[data-icon-input]").fill("zzz")
    picker(editor).locator("[data-icon-none]").wait_for()
    picker(editor).locator("[data-icon-input]").press("Escape")
    picker(editor).locator("[data-icon-clear]").click()
    assert icon(editor) is None


def test_the_menu_offers_blocks_and_keeps_one_written_by_hand(editor) -> None:
    select(editor, "menu")
    editor.locator(f"{APP} [data-form='setting-menu'] [data-schema-form]").first.wait_for()
    editor.locator(f"{APP} [data-schema-entry='.groups.0'] > summary").click()
    editor.locator(f"{APP} [data-schema-entry='.groups.0.items.0'] summary").click()
    choice = editor.locator(f"{APP} [data-schema-field='.groups.0.items.0.shortcut'] select")
    options = choice.locator("option").evaluate_all("(items) => items.map((item) => item.value)")
    assert options == ["", "MPK", "HD Editor"]
    assert choice.input_value() == "HD Editor"
    choice.select_option("")
    items = editor.evaluate("window.editor.app._strategy.menu.groups[0].items")
    assert items == [{"name": "Edytor", "path": "/editor"}]


def test_the_tablet_block_form_has_the_same_icon_field(phone):
    from .test_block_editor import EDITOR, TRAMS, open_block, saved

    phone.route(
        "**/static/mdi/iconList.json",
        lambda route: route.fulfill(content_type="application/json", body=json.dumps(ICONS)),
    )
    open_block(phone, [TRAMS], "Tramwaje")
    field = phone.locator(f"{EDITOR} [data-block-field='icon'] home-dashboard-icon-picker").first
    field.locator("[data-icon-input]").fill("lamp")
    field.locator("[data-icon-option='mdi:lamp']").click()
    assert saved(phone)["shortcuts"][0]["icon"] == "mdi:lamp"


def test_media_queries_match_nothing_where_the_browser_gives_none(desktop) -> None:  # noqa: F811
    """WebKit gives null from matchMedia in a frame that is gone; the dashboard then reads every query as not matching."""
    result = desktop.evaluate("""async () => {
        const { mediaQuery, mediaMatches } = await import('/custom_components/home_dashboard/www/app/media.js');
        const real = window.matchMedia;
        window.matchMedia = () => null;
        try {
            const list = mediaQuery('(min-width: 900px)');
            list.addEventListener('change', () => {});
            list.removeEventListener('change', () => {});
            const { currentLayout } = await import('/custom_components/home_dashboard/www/app/chrome.js');
            return [list.matches, mediaMatches('(min-width: 1px)'), currentLayout()];
        } finally { window.matchMedia = real; }
    }""")
    assert result == [False, False, "phone"]
