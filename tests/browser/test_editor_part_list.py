"""A list in the editor's tree (a room's tiles on Home, a section, the favourites) shows what it holds in its form:
a click opens a tile in its own form, and a row moves or goes in place, instead of a note to use YAML."""

from __future__ import annotations

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401

STRATEGY = {
    "type": "custom:home-dashboard",
    "favorites": ["light.entity_0096"],
    "layout": [
        {
            "id": "garden",
            "name": "Działka",
            "home": [
                {"entity": "light.entity_0096", "name": "Altanka"},
                {"entity": "light.entity_0097"},
                {"entity": "switch.entity_0235", "name": "Alarm"},
            ],
            "sections": [{"title": "Kawa", "tiles": []}],
        },
    ],
}

HOME = "layout/0/home"


def rows(page) -> list[str]:
    return page.locator(f"{APP} [data-part-list] [data-part] .open span").all_inner_texts()


def draft(page) -> dict:
    return page.evaluate("window.editor.app._strategy")


def test_the_tiles_of_a_room_on_home_are_listed_not_left_to_yaml(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, HOME)
    assert desktop.locator(f"{APP} [data-no-form]").count() == 0
    assert rows(desktop)[0] == "Altanka" and rows(desktop)[2] == "Alarm"
    assert desktop.locator(f"{APP} [data-part='{HOME}/1'] code").inner_text() == "light.entity_0097"


def test_a_click_opens_the_tile_in_its_form(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, HOME)
    desktop.locator(f"{APP} [data-part='{HOME}/2'] [data-part-open]").click()
    assert desktop.locator(f"{APP} [data-props-title]").inner_text() == "Alarm"
    assert desktop.locator(f"{APP} [data-form='tile'] [data-field='name'] input").input_value() == "Alarm"


def test_rows_move_and_go_in_place(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, HOME)
    desktop.locator(f"{APP} [data-part='{HOME}/0'] [data-part-down]").click()
    assert [tile.get("name") for tile in draft(desktop)["layout"][0]["home"]] == [None, "Altanka", "Alarm"]
    assert desktop.locator(f"{APP} [data-part='{HOME}/0'] [data-part-up]").is_disabled()
    desktop.locator(f"{APP} [data-part='{HOME}/2'] [data-part-remove]").click()
    assert [tile["entity"] for tile in draft(desktop)["layout"][0]["home"]] == [
        "light.entity_0097",
        "light.entity_0096",
    ]
    # still on the list
    assert (
        desktop.locator(f"{APP} [data-props-title]").inner_text()
        == desktop.locator(f"{APP} [data-node='{HOME}']").first.inner_text().splitlines()[0]
    )


def test_an_added_tile_shows_in_the_list(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "layout/0/sections/0")
    assert desktop.locator(f"{APP} [data-part-list] [data-part]").count() == 0
    form = desktop.locator(f"{APP} [data-add-tile]")
    form.locator("input").fill("switch.entity_0235")
    form.locator("button").click()
    select(desktop, "layout/0/sections/0")
    assert desktop.locator(f"{APP} [data-part='layout/0/sections/0/tiles/0']").count() == 1


def test_the_favourites_are_listed(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "favorites")
    assert desktop.locator(f"{APP} [data-part='favorites/0']").count() == 1
