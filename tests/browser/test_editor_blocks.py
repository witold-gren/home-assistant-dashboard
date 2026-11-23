"""The editor on a computer, stage 5: blocks of several entities. Their parts in the tree, a form for the block,
its numbers, buttons, groups and rows, the options of a list, the entities of its devices it does not show yet, the
window of the block in the preview and whether it fits on the tablet."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401
from .test_editor_preview import frame

FORM = "home-dashboard-editor-props"
COFFEE = {
    "kind": "panel",
    "name": "Ekspres",
    "entity": "sensor.test_coffee_status",
    "stats": [{"name": "Kawy", "entity": "sensor.test_total"}],
    "actions": [],
    "groups": [
        {
            "title": "Ustawienia",
            "layout": "controls",
            "rows": [{"entity": "switch.test_cup_light"}, {"entity": "select.test_profile"}],
        },
        {"title": "Stan", "rows": []},
    ],
}
STRATEGY = {
    "type": "custom:home-dashboard",
    "shortcuts": [COFFEE, {"kind": "host", "name": "Maszyny", "columns": []}],
    "layout": [
        {
            "id": "kitchen",
            "name": "Kuchnia",
            "home": [{"entity": "switch.test_sounds"}],
            "sections": [
                {
                    "title": "Pralnia",
                    "tiles": [{"kind": "panel", "name": "Pralka", "groups": [{"title": "Stan", "rows": []}]}],
                }
            ],
        }
    ],
}

HOME = """() => {
    const s = window.editor.snapshot;
    s.devices.dev_coffee = { id: 'dev_coffee', area_id: null };
    const add = (id, state, attributes, entry = {}) => {
        s.states[id] = { entity_id: id, state, attributes };
        s.entities[id] = { entity_id: id, hidden: false, entity_category: null, platform: 'delonghi', device_id: 'dev_coffee', ...entry };
    };
    add('sensor.test_coffee_status', 'ready', { friendly_name: 'Ekspres status' });
    add('sensor.test_total', '4554', { friendly_name: 'Kawy łącznie' });
    add('switch.test_cup_light', 'on', { friendly_name: 'Podświetlenie' });
    add('switch.test_sounds', 'on', { friendly_name: 'Dźwięki' });
    add('select.test_profile', 'Alex', { friendly_name: 'Profil', options: ['Alex', 'Sam', 'Gość', 'USER 4'] });
    add('switch.test_debug', 'off', { friendly_name: 'Debugowanie' }, { entity_category: 'config' });
    add('sensor.test_hidden', '1', { friendly_name: 'Ukryty' }, { hidden: true });
    add('button.test_turn_on', 'unknown', { friendly_name: 'Włącz ekspres' });
}"""


@pytest.fixture(autouse=True)
def home(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")
    desktop.evaluate(HOME)


def draft(page) -> dict:
    return page.evaluate("window.editor.app._strategy")


def coffee(page) -> dict:
    return draft(page)["shortcuts"][0]


def field(page, key: str):
    return page.locator(f"{APP} {FORM} [data-field='{key}']")


def fill(page, locator, text: str) -> None:
    locator.fill(text)
    locator.dispatch_event("change")


def keys(page) -> list[str]:
    return page.locator(f"{APP} [data-node]").evaluate_all(
        "(nodes) => nodes.map((node) => node.dataset.node)"
    )


# The tree -------------------------------------------------------------------------------------------------------


def test_a_block_opens_into_numbers_buttons_groups_and_rows(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    found = keys(desktop)
    for key in (
        "shortcuts/0/stats",
        "shortcuts/0/stats/0",
        "shortcuts/0/actions",
        "shortcuts/0/groups",
        "shortcuts/0/groups/0",
        "shortcuts/0/groups/0/rows/0",
        "shortcuts/0/groups/0/rows/1",
        "shortcuts/0/groups/1",
    ):
        assert key in found
    assert "shortcuts/1/groups" not in found
    assert "layout/0/sections/0/tiles/0/groups/0" in found
    labels = desktop.locator(f"{APP} [data-node='shortcuts/0/groups/0/rows/0'] .label").inner_text()
    assert labels == "Podświetlenie"


# Forms ------------------------------------------------------------------------------------------------------------


def test_a_block_has_a_form_of_its_tile_and_window(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "shortcuts/0")
    found = desktop.locator(f"{APP} {FORM} [data-field]").evaluate_all(
        "(fields) => fields.map((f) => f.dataset.field)"
    )
    assert found == [
        "name",
        "icon",
        "entity",
        "status",
        "state_text",
        "labels",
        "active",
        "active_state",
        "details",
        "compact",
        "fullscreen",
        "quick",
    ]
    field(desktop, "compact").locator("button").click()
    fill(desktop, field(desktop, "name").locator("input"), "Kawa")
    assert coffee(desktop)["compact"] is True and coffee(desktop)["name"] == "Kawa"


def test_a_block_button_on_its_tile_is_set_in_its_form_and_keeps_its_data(desktop):  # noqa: F811
    with_data = {
        **COFFEE,
        "quick": {"name": "STOP", "service": "vector.stop", "data": {"device_id": "dev_coffee"}},
    }
    open_editor(desktop, {**STRATEGY, "shortcuts": [with_data, *STRATEGY["shortcuts"][1:]]})
    select(desktop, "shortcuts/0")
    quick = field(desktop, "quick")
    assert quick.locator("[data-quick-help='active']").count() == 1
    assert "device_id" in quick.locator("[data-quick-data]").inner_text()
    fill(desktop, quick.locator("[data-quick='active'] input"), "switch.test_cup_light")
    fill(desktop, quick.locator("[data-quick='confirm'] input"), "Zatrzymać?")
    assert coffee(desktop)["quick"] == {
        "name": "STOP",
        "service": "vector.stop",
        "data": {"device_id": "dev_coffee"},
        "active": "switch.test_cup_light",
        "confirm": "Zatrzymać?",
    }
    assert "Podświetlenie" in quick.inner_text()
    fill(desktop, quick.locator("[data-quick='active'] input"), "")
    assert "active" not in coffee(desktop)["quick"]


def test_an_empty_button_form_removes_quick(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "shortcuts/0")
    quick = field(desktop, "quick")
    fill(desktop, quick.locator("[data-quick='name'] input"), "Wyłącz")
    assert coffee(desktop)["quick"] == {"name": "Wyłącz"}
    fill(desktop, quick.locator("[data-quick='name'] input"), "")
    assert "quick" not in coffee(desktop)


def test_a_block_tile_of_a_room_has_the_same_form(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "layout/0/sections/0/tiles/0")
    assert field(desktop, "fullscreen").count() == 1


def test_states_are_named_with_their_own_words(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "shortcuts/0/groups/0/rows/0")
    labels = field(desktop, "labels")
    assert labels.locator("[data-label]").evaluate_all("(inputs) => inputs.map((i) => i.dataset.label)") == [
        "on",
        "off",
    ]
    fill(desktop, labels.locator("[data-label='on']"), "Świeci")
    assert coffee(desktop)["groups"][0]["rows"][0]["labels"] == {"on": "Świeci"}
    select(desktop, "shortcuts/0")
    fill(desktop, field(desktop, "labels").locator("[data-new-state]"), "heating")
    assert coffee(desktop)["labels"] == {"heating": "heating"}


def test_a_number_takes_its_digits_and_a_format_of_time(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "shortcuts/0/stats/0")
    fill(desktop, field(desktop, "digits").locator("input"), "1")
    field(desktop, "format").locator("[data-option='duration']").click()
    assert coffee(desktop)["stats"][0] == {
        "name": "Kawy",
        "entity": "sensor.test_total",
        "digits": 1,
        "format": "duration",
    }
    fill(desktop, field(desktop, "digits").locator("input"), "")
    assert "digits" not in coffee(desktop)["stats"][0]


def test_a_button_is_added_by_its_entity_with_its_name_and_asks_first(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "shortcuts/0/actions")
    adder = desktop.locator(f"{APP} [data-add-part]")
    adder.locator("input").fill("button.test_turn_on")
    adder.locator("button").click()
    assert coffee(desktop)["actions"] == [{"name": "Włącz ekspres", "entity": "button.test_turn_on"}]
    fill(desktop, field(desktop, "confirm").locator("input"), "Włączyć ekspres?")
    assert coffee(desktop)["actions"][0]["confirm"] == "Włączyć ekspres?"


def test_groups_are_added_laid_out_and_get_rows(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "shortcuts/0/groups")
    desktop.locator(f"{APP} [data-action='add_group']").click()
    assert coffee(desktop)["groups"][2] == {"title": "Nowa grupa", "rows": []}
    field(desktop, "layout").locator("[data-option='summary']").click()
    assert coffee(desktop)["groups"][2]["layout"] == "summary"
    assert field(desktop, "layout").locator("[data-option='default']").inner_text().strip() == "Wiersze"
    adder = desktop.locator(f"{APP} [data-add-part]")
    adder.locator("input").fill("sensor.test_total")
    adder.locator("button").click()
    assert coffee(desktop)["groups"][2]["rows"] == [{"entity": "sensor.test_total"}]


# The options of a list --------------------------------------------------------------------------------------------


def options(page) -> list[str]:
    return page.locator(f"{APP} {FORM} [data-option-row]").evaluate_all(
        "(rows) => rows.map((row) => row.dataset.optionRow)"
    )


def test_the_options_of_a_list_are_ordered_named_and_hidden(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "shortcuts/0/groups/0/rows/1")
    assert field(desktop, "unit").count() == 0
    assert options(desktop) == ["Alex", "Sam", "Gość", "USER 4"]
    desktop.locator(f"{APP} {FORM} [data-option-row='Gość'] [data-option-up]").click()
    assert options(desktop) == ["Alex", "Gość", "Sam", "USER 4"]
    assert coffee(desktop)["groups"][0]["rows"][1]["order"] == ["Alex", "Gość", "Sam", "USER 4"]
    desktop.locator(f"{APP} {FORM} [data-option-row='USER 4'] [data-option-hide]").click()
    fill(desktop, desktop.locator(f"{APP} {FORM} [data-option-row='Gość'] [data-option-label]"), "Goście")
    row = coffee(desktop)["groups"][0]["rows"][1]
    assert row["hide"] == ["USER 4"] and row["labels"] == {"Gość": "Goście"}
    desktop.locator(f"{APP} {FORM} [data-option-row='Gość'] [data-option-down]").click()
    assert "order" not in coffee(desktop)["groups"][0]["rows"][1]


# From the device -----------------------------------------------------------------------------------------------


def leftovers(page) -> list[str]:
    return page.locator(f"{APP} [data-leftover]").evaluate_all(
        "(items) => items.map((item) => item.dataset.leftover)"
    )


def test_the_entities_of_the_device_not_in_the_block_are_offered(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "shortcuts/0")
    assert leftovers(desktop) == ["switch.test_debug", "switch.test_sounds", "button.test_turn_on"]
    assert "config" in desktop.locator(f"{APP} [data-leftover='switch.test_debug']").inner_text()


def test_a_click_adds_it_to_the_chosen_group_or_the_last(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "shortcuts/0/groups/0/rows/0")
    desktop.locator(f"{APP} [data-leftover='switch.test_sounds']").click()
    assert coffee(desktop)["groups"][0]["rows"][-1] == {"entity": "switch.test_sounds"}
    assert "switch.test_sounds" not in leftovers(desktop)
    select(desktop, "shortcuts/0")
    desktop.locator(f"{APP} [data-leftover='switch.test_debug']").click()
    assert coffee(desktop)["groups"][1]["rows"] == [{"entity": "switch.test_debug"}]


def test_a_block_without_entities_of_a_device_offers_nothing(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    select(desktop, "layout/0/sections/0/tiles/0")
    assert desktop.locator(f"{APP} [data-leftovers]").count() == 0


# Dragging ---------------------------------------------------------------------------------------------------------


def node(page, key: str):
    return page.locator(f"{APP} [data-node='{key}']")


def test_a_row_goes_to_another_group_of_its_block_but_not_of_another_block(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    node(desktop, "shortcuts/0/groups/0/rows/0").drag_to(node(desktop, "shortcuts/0/groups/1"))
    assert coffee(desktop)["groups"][1]["rows"] == [{"entity": "switch.test_cup_light"}]
    before = draft(desktop)
    node(desktop, "shortcuts/0/groups/1/rows/0").drag_to(
        node(desktop, "layout/0/sections/0/tiles/0/groups/0")
    )
    assert draft(desktop) == before


def test_groups_change_order(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    node(desktop, "shortcuts/0/groups/1").drag_to(node(desktop, "shortcuts/0/groups/0"))
    assert [group["title"] for group in coffee(desktop)["groups"]] == ["Stan", "Ustawienia"]


# The window in the preview --------------------------------------------------------------------------------------


def frame_sheet_kind(page, device: str):
    content = frame(page, device)
    return content.evaluate("""() => { const walk = (root) => { const hit = root.querySelector('home-dashboard-sheet');
        if (hit) return hit; for (const e of root.querySelectorAll('*')) { const inner = e.shadowRoot && walk(e.shadowRoot); if (inner) return inner; } return null; };
        const sheet = walk(document); return sheet?.shadowRoot?.querySelector('.panel')?.dataset.kind ?? null; }""")


def test_choosing_a_block_opens_its_window_in_the_preview_and_measures_it(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    desktop.wait_for_selector(f"{APP} iframe[data-frame='tablet']")
    frame(desktop, "tablet")
    select(desktop, "shortcuts/0/groups/0")
    desktop.wait_for_selector(f"{APP} [data-fit='tablet']")
    assert frame_sheet_kind(desktop, "tablet") == "panel"
    assert "Okno" in desktop.locator(f"{APP} [data-fit='tablet']").inner_text()
    select(desktop, "layout/0")
    desktop.wait_for_selector(f"{APP} [data-fit='tablet']", state="detached")


def test_a_change_of_the_block_shows_in_its_open_window(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    frame(desktop, "tablet")
    select(desktop, "shortcuts/0")
    desktop.wait_for_selector(f"{APP} [data-fit='tablet']")
    fill(desktop, field(desktop, "name").locator("input"), "Kawiarka")
    content = frame(desktop, "tablet")
    content.wait_for_function("""() => { const walk = (root) => { const hit = root.querySelector('home-dashboard-sheet');
        if (hit) return hit; for (const e of root.querySelectorAll('*')) { const inner = e.shadowRoot && walk(e.shadowRoot); if (inner) return inner; } return null; };
        return walk(document)?.shadowRoot?.textContent.includes('Kawiarka'); }""")


# The pure parts --------------------------------------------------------------------------------------------------


def run(page, body: str, arg=None):
    return page.evaluate(
        f"""async (arg) => {{ const b = await import('/custom_components/home_dashboard/www/editor/block-model.js');
            const p = await import('/custom_components/home_dashboard/www/editor/props.js'); {body} }}""",
        arg,
    )


def test_the_block_of_a_path(desktop):  # noqa: F811
    paths = run(
        desktop,
        """const s = arg;
        return [b.blockPathOf(s, ['shortcuts', 0, 'groups', 0, 'rows', 1]), b.blockPathOf(s, ['shortcuts', 1]),
            b.blockPathOf(s, ['layout', 0, 'sections', 0, 'tiles', 0, 'groups', 0]), b.blockPathOf(s, ['layout', 0, 'home', 0]),
            b.blockPathOf(s, ['layout', 0])];""",
        STRATEGY,
    )
    assert paths == [["shortcuts", 0], None, ["layout", 0, "sections", 0, "tiles", 0], None, None]


def test_adding_a_row_and_the_group_of_a_path(desktop):  # noqa: F811
    result = run(
        desktop,
        """const s = { shortcuts: [{ kind: 'panel', name: 'A' }, { kind: 'panel', groups: [{ rows: [] }, { rows: [{}] }] }] };
        const first = b.addBlockRow(s, ['shortcuts', 0], 'light.a', null, 'Inne');
        const second = b.addBlockRow(s, ['shortcuts', 1], 'light.b', null, 'Inne');
        const third = b.addBlockRow(s, ['shortcuts', 1], 'light.c', 0, 'Inne');
        return [first.strategy.shortcuts[0].groups, first.path, second.path, third.path,
            b.groupIndexOf(['shortcuts', 1], ['shortcuts', 1, 'groups', 1, 'rows', 0]), b.groupIndexOf(['shortcuts', 1], ['shortcuts', 1, 'stats'])];""",
    )
    assert result == [
        [{"title": "Inne", "rows": [{"entity": "light.a"}]}],
        ["shortcuts", 0, "groups", 0, "rows", 0],
        ["shortcuts", 1, "groups", 1, "rows", 1],
        ["shortcuts", 1, "groups", 0, "rows", 0],
        1,
        None,
    ]


def test_with_options_keeps_only_what_differs(desktop):  # noqa: F811
    result = run(
        desktop,
        """const options = ['a', 'b', 'c'];
        return [p.withOptions({ entity: 'select.x' }, options, { order: ['b', 'a', 'c'] }),
            p.withOptions({ entity: 'select.x', order: ['b', 'a', 'c'] }, options, { order: ['a', 'b', 'c'] }),
            p.withOptions({ entity: 'select.x', labels: { a: 'A' } }, options, { labels: { a: '' } }),
            p.withOptions({ entity: 'select.x' }, options, { hide: ['c'] })];""",
    )
    assert result == [
        {"entity": "select.x", "order": ["b", "a", "c"]},
        {"entity": "select.x"},
        {"entity": "select.x"},
        {"entity": "select.x", "hide": ["c"]},
    ]


def test_the_states_an_entity_knows(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    known = run(
        desktop,
        """const hass = window.editor.app.hass;
        return [p.knownStates(hass, 'select.test_profile'), p.knownStates(hass, 'switch.test_sounds'), p.knownStates(hass, 'sensor.test_total'),
            p.knownStates(hass, 'sensor.nowhere')];""",
    )
    assert known == [["Alex", "Sam", "Gość", "USER 4"], ["on", "off"], [], []]


def test_the_window_closes_when_another_room_is_chosen(desktop):  # noqa: F811
    """The frame goes to the other room and the window of the block must not stay over it."""
    strategy = {**STRATEGY, "layout": [*STRATEGY["layout"], {"id": "media", "name": "Media", "sections": []}]}
    open_editor(desktop, strategy)
    frame(desktop, "tablet")
    select(desktop, "layout/0/sections/0/tiles/0")
    frame(
        desktop, "tablet"
    ).wait_for_function("""() => { const walk = (root) => { const hit = root.querySelector('home-dashboard-sheet');
        if (hit) return hit; for (const e of root.querySelectorAll('*')) { const inner = e.shadowRoot && walk(e.shadowRoot); if (inner) return inner; } return null; };
        return walk(document)?.shadowRoot?.querySelector('.panel')?.dataset.kind === 'panel'; }""")
    select(desktop, f"layout/{len(strategy['layout']) - 1}")
    content = frame(desktop, "tablet")
    content.wait_for_function("() => new URLSearchParams(location.search).get('room') === 'media'")
    desktop.wait_for_timeout(600)
    assert frame_sheet_kind(desktop, "tablet") is None
    assert content.evaluate("new URLSearchParams(location.search).get('room')") == "media"


SHEET_KIND = """() => { const walk = (root) => { const hit = root.querySelector('home-dashboard-sheet');
    if (hit) return hit; for (const e of root.querySelectorAll('*')) { const inner = e.shadowRoot && walk(e.shadowRoot); if (inner) return inner; } return null; };
    return walk(document)?.shadowRoot?.querySelector('.panel')?.dataset.kind ?? null; }"""


@pytest.mark.parametrize("then", ["layout/0/sections/0", "layout/0", "appearance"])
def test_the_window_goes_when_something_else_is_chosen(desktop, then):  # noqa: F811
    open_editor(desktop, STRATEGY)
    content = frame(desktop, "tablet")
    select(desktop, "layout/0/sections/0/tiles/0")
    content.wait_for_function(f"() => ({SHEET_KIND})() === 'panel'")
    select(desktop, then)
    content.wait_for_function(f"() => ({SHEET_KIND})() === null", timeout=5000)


def test_a_number_row_chooses_its_control(desktop):  # noqa: F811
    keys = run(
        desktop,
        """return [p.rowFields({ entity: 'input_number.limit' }).map((f) => f.key),
        p.rowFields({ entity: 'sensor.power' }).map((f) => f.key)];""",
    )
    assert "control" in keys[0] and "control" not in keys[1]
