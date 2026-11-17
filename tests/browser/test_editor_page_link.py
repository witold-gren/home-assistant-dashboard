"""A block that opens a page (Media, Music, Map, Energy) points to the settings where that page's groups are edited,
and the settings for Home and the tablet have an icon Home Assistant knows."""

from __future__ import annotations

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401

STRATEGY = {
    "type": "custom:home-dashboard",
    "shortcuts": [
        {"name": "Źródła", "icon": "mdi:play-box-multiple-outline", "page": "media"},
        {"name": "Host", "icon": "mdi:server"},
    ],
    "media": {
        "sections": [
            {"title": "Głośniki", "tiles": [{"entity": "media_player.entity_0001", "name": "Salon"}]}
        ]
    },
    "layout": [],
}


def test_a_block_opening_the_media_page_links_to_its_settings(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "shortcuts/0")
    link = desktop.locator(f"{APP} [data-page-link='media']")
    assert link.count() == 1
    link.locator("[data-page-link-open]").click()
    assert desktop.evaluate("window.editor.app._selected.key") == "media"


def test_a_block_without_a_page_has_no_link(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "shortcuts/1")
    assert desktop.locator(f"{APP} [data-page-link]").count() == 0


def test_home_and_tablet_settings_have_a_known_icon(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    icon = desktop.locator(f"{APP} [data-node='home_settings'] ha-icon").first.get_attribute(
        "icon"
    ) or desktop.evaluate(
        "window.editor.app.renderRoot.querySelector(\"[data-node='home_settings'] ha-icon\").icon"
    )
    assert icon == "mdi:tablet-dashboard"
