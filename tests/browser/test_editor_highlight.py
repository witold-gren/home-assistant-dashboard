"""What is chosen in the editor's tree is outlined in red, dashed, in the preview: the tile, the section or the room on
the page, the window of a block or one of its parts; nothing for the settings."""

from __future__ import annotations

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401
from .test_editor_blocks import STRATEGY as BLOCKS
from .test_editor_preview import PREVIEW, frame

MODULE = "/custom_components/home_dashboard/www/editor/highlight.js"


def spec(page, strategy, path):
    return page.evaluate(
        f"async ([s, p]) => (await import('{MODULE}')).highlightSpec(s, p)", [strategy, path]
    )


def test_the_outline_of_each_kind_of_node(desktop) -> None:  # noqa: F811
    strategy = {
        **BLOCKS,
        "favorites": ["light.a"],
        "scenes": [{"entity": "scene.b"}],
        "layout": [
            {
                **BLOCKS["layout"][0],
                "sections": [
                    *BLOCKS["layout"][0]["sections"],
                    {"title": "Inne", "tiles": [{"entity": "light.c", "name": "Lampa"}]},
                ],
            }
        ],
    }
    assert spec(desktop, strategy, ["favorites", 0]) == {
        "scope": "page",
        "attrs": [["data-entity", "light.a"]],
    }
    assert spec(desktop, strategy, ["layout", 0]) == {
        "scope": "page",
        "attrs": [["data-room", "kitchen"], ["data-room-link", "kitchen"]],
    }
    assert spec(desktop, strategy, ["layout", 0, "sections", 1]) == {
        "scope": "page",
        "attrs": [["data-section", "section-1"]],
    }
    tile = spec(desktop, strategy, ["layout", 0, "sections", 1, "tiles", 0])
    assert (
        tile["within"] == [["data-section", "section-1"], ["data-room", "kitchen"]]
        and ["data-entity", "light.c"] in tile["attrs"]
    )
    assert ["data-tile", "Lampa"] in tile["attrs"]
    home = spec(desktop, strategy, ["layout", 0, "home", 0])
    assert home["attrs"][0] == ["data-entity", "switch.test_sounds"] and home["within"] == [
        ["data-room", "kitchen"]
    ]
    # a block in a section: its window, then its parts
    assert spec(desktop, strategy, ["layout", 0, "sections", 0, "tiles", 0]) == {
        "scope": "sheet",
        "whole": True,
    }
    assert spec(desktop, strategy, ["shortcuts", 0, "stats", 0]) == {
        "scope": "sheet",
        "attrs": [["data-stat", "0"]],
    }
    assert spec(desktop, strategy, ["shortcuts", 0, "groups", 1]) == {
        "scope": "sheet",
        "attrs": [["data-panel-group", "1"]],
    }
    assert spec(desktop, strategy, ["shortcuts", 0, "groups", 0, "rows", 1]) == {
        "scope": "sheet",
        "within": [["data-panel-group", "0"]],
        "any": "select.test_profile",
    }
    assert spec(desktop, strategy, ["shortcuts", 0, "stats"]) == {
        "scope": "sheet",
        "attrs": [["data-panel-stats", ""]],
    }
    assert spec(desktop, strategy, ["appearance"]) is None
    assert spec(desktop, strategy, ["scenes", 0]) == {"scope": "page", "attrs": [["data-entity", "scene.b"]]}


BOXES = """() => [...document.querySelectorAll('[data-highlight-box]')].map((box) => box.getBoundingClientRect().toJSON())"""
FIND = """(selector) => { const walk = (root) => { for (const e of root.querySelectorAll('*')) {
    if (e.matches(selector)) return e; const inner = e.shadowRoot && walk(e.shadowRoot); if (inner) return inner; } return null; };
    return walk(document)?.getBoundingClientRect().toJSON() ?? null; }"""


def around(box, rect) -> bool:
    return (
        box["left"] <= rect["left"] + 1
        and box["top"] <= rect["top"] + 1
        and box["right"] >= rect["right"] - 1
        and box["bottom"] >= rect["bottom"] - 1
    )


def test_a_chosen_tile_is_outlined_in_the_preview(desktop) -> None:  # noqa: F811
    """The tile of a room on Home: outlined in the room's card, not where the same entity shows elsewhere."""
    open_editor(desktop, PREVIEW)
    content = frame(desktop, "tablet")
    select(desktop, "layout/0/home/0")
    content.wait_for_function(f"() => ({BOXES})().length === 1")
    rect = content.evaluate(FIND, "[data-room='living'] [data-entity='light.entity_0096']")
    assert rect and around(content.evaluate(BOXES)[0], rect)
    # the settings: no outline
    select(desktop, "appearance")
    content.wait_for_function(f"() => ({BOXES})().length === 0")


def test_a_part_of_a_block_is_outlined_in_its_window(desktop) -> None:  # noqa: F811
    open_editor(desktop, BLOCKS)
    content = frame(desktop, "tablet")
    select(desktop, "shortcuts/0/stats/0")
    content.wait_for_function(f"() => ({BOXES})().length === 1")
    rect = content.evaluate(FIND, "[data-stat='0']")
    assert rect and around(content.evaluate(BOXES)[0], rect)
    select(desktop, "shortcuts/0")
    content.wait_for_function(
        f"() => {{ const b = ({BOXES})(); const p = ({FIND})('.panel[data-kind]'); return b.length === 1 && p && b[0].width >= p.width; }}"
    )


FOLDED = {
    **BLOCKS,
    "shortcuts": [
        {
            "kind": "panel",
            "name": "Auto",
            "entity": "sensor.test_coffee_status",
            "groups": [
                {
                    "title": "Drzwi",
                    "layout": "summary",
                    "rows": [{"entity": "light.entity_0096"}, {"entity": "switch.entity_0235"}],
                },
                {"title": "Płyny", "layout": "summary", "rows": [{"entity": "light.entity_0097"}]},
            ],
        }
    ],
}


def test_a_row_in_a_folded_group_opens_it_and_is_outlined_there(desktop) -> None:  # noqa: F811
    """Folded, a row still had a place, under the fold: the outline fell on the next group."""
    open_editor(desktop, FOLDED)
    content = frame(desktop, "tablet")
    select(desktop, "shortcuts/0/groups/0/rows/1")
    content.wait_for_function(f"() => ({BOXES})().length === 1")
    opened = content.evaluate("""() => { const walk = (root) => { for (const e of root.querySelectorAll('*')) {
        if (e.matches('details[data-summary]')) return e; const inner = e.shadowRoot && walk(e.shadowRoot); if (inner) return inner; } return null; };
        const first = walk(document); return [first.dataset.summary, first.open]; }""")
    assert opened == ["Drzwi", True]
    content.wait_for_function(f"""() => {{ const b = ({BOXES})()[0]; const r = ({FIND})('[data-value="switch.entity_0235"]');
        return b && r && b.top <= r.top + 1 && b.bottom >= r.bottom - 1; }}""")


def test_bringing_a_part_into_sight_scrolls_its_window_not_the_frame(desktop) -> None:  # noqa: F811
    """scrollIntoView moved the document of the frame too, which slid the whole screen up over black."""
    open_editor(desktop, FOLDED)
    content = frame(desktop, "tablet")
    select(desktop, "shortcuts/0/groups/1/rows/0")
    content.wait_for_function(f"() => ({BOXES})().length === 1")
    assert content.evaluate("[document.scrollingElement.scrollTop, window.scrollY]") == [0, 0]
