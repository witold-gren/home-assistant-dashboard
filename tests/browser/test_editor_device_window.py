"""Own windows of devices from the editor on a computer: a new block of any kind from the "+" of the blocks, a card of
Home Assistant for a tile's entity, and a tile of a room made into a block in its place."""

from __future__ import annotations

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401

STRATEGY = {
    "type": "custom:home-dashboard",
    "shortcuts": [{"kind": "panel", "name": "Blok", "icon": "mdi:widgets"}],
    "layout": [
        {
            "id": "kitchen",
            "name": "Kuchnia",
            "sections": [
                {
                    "title": "Urządzenia",
                    "tiles": [
                        {
                            "entity": "switch.entity_0235",
                            "name": "Ekspres",
                            "icon": "mdi:coffee-maker",
                            "size": "tall",
                        },
                        {"entity": "light.entity_0096", "shortcut": "Blok"},
                    ],
                }
            ],
        },
    ],
    "entities": {"overrides": {"switch.entity_0235": {"name": "Kawa"}}},
}

TILE = "layout/0/sections/0/tiles/0"


def draft(page) -> dict:
    return page.evaluate("window.editor.app._strategy")


def test_the_plus_of_the_blocks_offers_every_kind_and_adds_one(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    desktop.locator(f"{APP} [data-add-block]").click()
    kinds = desktop.locator(f"{APP} [data-block-new]").evaluate_all(
        "(items) => items.map((item) => item.dataset.blockNew)"
    )
    assert {"panel", "overview", "departures", "host", "page", "app", "news"} <= set(kinds)
    desktop.locator(f"{APP} [data-block-new='panel']").click()
    blocks = draft(desktop)["shortcuts"]
    # the name of a block is its key, so a second one gets a number
    assert blocks[1] == {"kind": "panel", "name": "Blok 2", "icon": "mdi:view-dashboard-outline"}
    assert desktop.evaluate("window.editor.app._selected.key") == "shortcuts/1"
    assert desktop.locator(f"{APP} [data-block-kinds]").count() == 0


def test_a_tile_offers_its_window_and_a_tile_of_a_block_does_not(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, TILE)
    assert desktop.locator(f"{APP} [data-device-window]").count() == 1
    select(desktop, "layout/0/sections/0/tiles/1")
    assert desktop.locator(f"{APP} [data-device-window]").count() == 0


def test_a_card_for_the_entity_goes_to_its_own_settings_and_away_again(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, TILE)
    card = desktop.locator(f"{APP} [data-device-card]")
    card.fill("type: entities\nentities: [switch.entity_0235]")
    card.dispatch_event("change")
    assert draft(desktop)["entities"]["overrides"]["switch.entity_0235"] == {
        "name": "Kawa",
        "card": {"type": "entities", "entities": ["switch.entity_0235"]},
    }
    card.fill("")
    card.dispatch_event("change")
    assert draft(desktop)["entities"]["overrides"]["switch.entity_0235"] == {"name": "Kawa"}


def test_a_card_without_its_type_is_refused_with_a_reason(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, TILE)
    card = desktop.locator(f"{APP} [data-device-card]")
    card.fill("entities: [switch.entity_0235]")
    card.dispatch_event("change")
    assert desktop.locator(f"{APP} [data-device-card-error]").count() == 1
    assert "card" not in draft(desktop)["entities"]["overrides"]["switch.entity_0235"]


def test_a_tile_becomes_a_block_in_its_place(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, TILE)
    desktop.locator(f"{APP} [data-tile-to-block]").click()
    tile = draft(desktop)["layout"][0]["sections"][0]["tiles"][0]
    assert tile == {
        "kind": "panel",
        "name": "Ekspres",
        "icon": "mdi:coffee-maker",
        "entity": "switch.entity_0235",
        "size": "tall",
    }
    # still chosen, now with the forms of a block
    assert desktop.evaluate("window.editor.app._selected.key") == TILE
    assert desktop.locator(f"{APP} [data-device-window]").count() == 0
    assert len(draft(desktop)["shortcuts"]) == 1


def test_the_helpers_keep_names_free_and_overrides_tidy(desktop) -> None:  # noqa: F811
    result = desktop.evaluate("""async () => {
        const b = await import('/custom_components/home_dashboard/www/editor/block-model.js');
        const strategy = { shortcuts: [{ name: 'Status' }, { name: 'Status 2' }] };
        const hass = { states: { 'fan.air': { attributes: { friendly_name: 'Oczyszczacz', icon: 'mdi:air-purifier' } } } };
        return [b.freeBlockName(strategy, 'Status'), b.freeBlockName(strategy, 'Odjazdy'),
                b.tileAsBlock(hass, { entity: 'fan.air' }),
                b.withEntityCard({ entities: { overrides: { 'a.b': { card: { type: 'x' } } } } }, 'a.b', null).entities];
    }""")
    assert result == [
        "Status 3",
        "Odjazdy",
        {"kind": "panel", "name": "Oczyszczacz", "icon": "mdi:air-purifier", "entity": "fan.air"},
        {},
    ]
