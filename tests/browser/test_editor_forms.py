"""The editor on a computer, stage 3: forms for every key of a tile, a section and a room; adding, duplicating,
moving and removing; dragging in the tree; undo and redo."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, ASK, desktop, focused_in_ask, open_editor, select, type_yaml, yaml_tab  # noqa: F401

FORM = "home-dashboard-editor-props"
STRATEGY = {
    "type": "custom:home-dashboard",
    "favorites": ["light.entity_0096", "light.entity_0097"],
    "layout": [
        {
            "id": "living",
            "name": "Salon",
            "sections": [
                {
                    "title": "Oświetlenie",
                    "tiles": [
                        {"entity": "light.entity_0096", "name": "Sofa", "foo": 1},
                        {"entity": "light.entity_0097"},
                    ],
                },
                {"title": "Inne", "tiles": [{"entity": "switch.entity_0235"}]},
            ],
        },
        {"id": "kitchen", "name": "Kuchnia", "sections": [{"title": "Kawa", "tiles": []}]},
    ],
    "shortcuts": [
        {"kind": "panel", "name": "Ekspres"},
        {"kind": "host", "name": "Maszyny", "columns": [{"title": "NUC"}, {"title": "Jetson"}]},
    ],
}


@pytest.fixture(autouse=True)
def clean_storage(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")


def open_forms(page, strategy=STRATEGY) -> None:
    open_editor(page, strategy)


def draft(page) -> dict:
    """The draft as the editor holds it now (saved or about to be)."""
    return page.evaluate("window.editor.app._strategy")


def tile(page, room=0, section=0, index=0) -> dict:
    return draft(page)["layout"][room]["sections"][section]["tiles"][index]


def field(page, key: str):
    return page.locator(f"{APP} {FORM} [data-field='{key}']")


def fill(page, key: str, text: str) -> None:
    box = field(page, key).locator("input").first
    box.fill(text)
    box.dispatch_event("change")


def add_entity(page, entity_id: str, attributes: dict) -> None:
    page.evaluate(
        """([id, attributes]) => { window.editor.snapshot.states[id] = { entity_id: id, state: attributes.options?.[0] ?? 'on', attributes }; }""",
        [entity_id, attributes],
    )


# Forms ----------------------------------------------------------------------------------------------------


def test_a_tile_has_a_form_with_the_keys_that_apply(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0/sections/0/tiles/0")
    keys = desktop.locator(f"{APP} {FORM} [data-field]").evaluate_all(
        "(fields) => fields.map((f) => f.dataset.field)"
    )
    assert keys == [
        "entity",
        "shortcut",
        "name",
        "icon",
        "size",
        "calm",
        "tap_toggle",
        "active_only",
        "turn_on_only",
        "action",
    ]


def test_a_name_typed_in_the_form_names_the_tile_and_an_empty_one_removes_the_key(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0/sections/0/tiles/0")
    fill(desktop, "name", "Kanapa")
    assert tile(desktop)["name"] == "Kanapa"
    assert desktop.locator(f"{APP} [data-node='layout/0/sections/0/tiles/0'] .label").inner_text() == "Kanapa"
    fill(desktop, "name", "")
    assert "name" not in tile(desktop)


def test_keys_the_form_does_not_know_are_kept(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0/sections/0/tiles/0")
    field(desktop, "calm").locator("button").click()
    assert tile(desktop) == {"entity": "light.entity_0096", "name": "Sofa", "foo": 1, "calm": True}


def test_a_switch_on_writes_true_and_off_removes_the_key(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0/sections/0/tiles/1")
    switch = field(desktop, "tap_toggle").locator("button")
    switch.click()
    assert tile(desktop, index=1)["tap_toggle"] is True
    assert switch.get_attribute("aria-checked") == "true"
    switch.click()
    assert "tap_toggle" not in tile(desktop, index=1)


def test_size_is_flat_or_tall(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0/sections/0/tiles/1")
    field(desktop, "size").locator("[data-option='tall']").click()
    assert tile(desktop, index=1)["size"] == "tall"
    field(desktop, "size").locator("[data-option='default']").click()
    assert "size" not in tile(desktop, index=1)


def test_a_missing_entity_is_said_under_its_field(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0/sections/0/tiles/1")
    fill(desktop, "entity", "light.nowhere")
    assert field(desktop, "entity").locator("[data-entity-missing]").count() == 1
    assert "warn" in desktop.locator(f"{APP} [data-node='layout/0/sections/0/tiles/1']").get_attribute(
        "class"
    )


def test_a_list_tile_offers_the_run_button_and_names_of_its_options(desktop):  # noqa: F811
    add_entity(desktop, "select.drink", {"options": ["none", "Espresso", "Tea"], "friendly_name": "Napój"})
    strategy = {
        **STRATEGY,
        "layout": [
            {
                "id": "kitchen",
                "name": "Kuchnia",
                "sections": [{"title": "Kawa", "tiles": [{"entity": "select.drink"}]}],
            }
        ],
    }
    open_forms(desktop, strategy)
    select(desktop, "layout/0/sections/0/tiles/0")
    field(desktop, "confirm").locator("button").click()
    labels = field(desktop, "labels")
    assert labels.locator("[data-label]").evaluate_all("(inputs) => inputs.map((i) => i.dataset.label)") == [
        "none",
        "Espresso",
        "Tea",
    ]
    box = labels.locator("[data-label='none']")
    box.fill("Brak")
    box.dispatch_event("change")
    assert tile(desktop) == {"entity": "select.drink", "confirm": True, "labels": {"none": "Brak"}}
    box.fill("")
    box.dispatch_event("change")
    assert "labels" not in tile(desktop)


def test_only_switching_on_asks_for_the_pin_service(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0/sections/1/tiles/0")
    assert field(desktop, "off_pin").count() == 0
    field(desktop, "turn_on_only").locator("button").click()
    pin = field(desktop, "off_pin")
    pin.locator("[data-pin='service']").fill("script.guest_off")
    pin.locator("[data-pin='service']").dispatch_event("change")
    pin.locator("[data-pin='field']").fill("pin")
    pin.locator("[data-pin='field']").dispatch_event("change")
    assert tile(desktop, section=1)["off_pin"] == {"service": "script.guest_off", "field": "pin"}
    on_pin = field(desktop, "on_pin").locator("[data-pin='service']")
    on_pin.fill("script.guest_on")
    on_pin.dispatch_event("change")
    assert tile(desktop, section=1)["on_pin"]["service"] == "script.guest_on"


def test_a_tile_of_a_machine_block_chooses_its_machine(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0/sections/1/tiles/0")
    options = field(desktop, "shortcut").locator("option").all_inner_texts()
    assert options == ["Brak", "Ekspres", "Maszyny"]
    field(desktop, "shortcut").locator("select").select_option("Maszyny")
    machines = field(desktop, "column").locator("option").all_inner_texts()
    assert machines == ["Wszystkie maszyny", "NUC", "Jetson"]
    field(desktop, "column").locator("select").select_option("Jetson")
    assert tile(desktop, section=1) == {
        "entity": "switch.entity_0235",
        "shortcut": "Maszyny",
        "column": "Jetson",
    }


def test_a_room_has_its_name_id_and_areas(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/1")
    fill(desktop, "name", "Kuchnia i jadalnia")
    first_area = field(desktop, "areas").locator("[data-area]").first
    area_id = first_area.get_attribute("data-area")
    first_area.click()
    room = draft(desktop)["layout"][1]
    assert room["name"] == "Kuchnia i jadalnia" and room["areas"] == [area_id]
    first_area.click()
    assert "areas" not in draft(desktop)["layout"][1]


def test_a_section_has_its_title_and_layout(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0/sections/1")
    fill(desktop, "title", "Gniazdka")
    field(desktop, "layout").locator("[data-option='row']").click()
    assert draft(desktop)["layout"][0]["sections"][1] == {
        "title": "Gniazdka",
        "tiles": [{"entity": "switch.entity_0235"}],
        "layout": "row",
    }


def test_the_yaml_tab_shows_what_the_form_changed(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0/sections/0/tiles/1")
    fill(desktop, "name", "Sufit")
    yaml_tab(desktop)
    assert desktop.locator(f"{APP} [data-yaml]").input_value() == "entity: light.entity_0097\nname: Sufit\n"


def test_blocks_and_settings_have_forms(desktop):  # noqa: F811
    open_forms(desktop)
    # every block and every setting has a form (test_editor_block_forms.py, test_editor_settings_forms.py)
    select(desktop, "shortcuts/1")
    assert desktop.locator(f"{APP} {FORM} [data-no-form]").count() == 0
    select(desktop, "intercom")
    assert desktop.locator(f"{APP} [data-form='setting-intercom']").count() == 1


# Structure ---------------------------------------------------------------------------------------------------


def test_new_rooms_get_an_id_of_their_own_and_are_chosen(desktop):  # noqa: F811
    open_forms(desktop)
    desktop.locator(f"{APP} [data-add-room]").click()
    desktop.locator(f"{APP} [data-add-room]").click()
    ids = [room["id"] for room in draft(desktop)["layout"]]
    assert ids == ["living", "kitchen", "nowy_pokoj", "nowy_pokoj_2"]
    assert desktop.locator(f"{APP} [data-node='layout/3']").get_attribute("class").split().count("sel") == 1


def test_a_room_gets_a_section_and_the_section_a_tile(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/1")
    desktop.locator(f"{APP} [data-action='add_section']").click()
    assert draft(desktop)["layout"][1]["sections"][1] == {"title": "Nowa sekcja", "tiles": []}
    form = desktop.locator(f"{APP} [data-add-tile]")
    form.locator("input").fill("light.entity_0097")
    form.locator("button").click()
    assert draft(desktop)["layout"][1]["sections"][1]["tiles"] == [{"entity": "light.entity_0097"}]
    assert "sel" in desktop.locator(f"{APP} [data-node='layout/1/sections/1/tiles/0']").get_attribute("class")


def test_a_favourite_is_only_an_entity(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "favorites")
    form = desktop.locator(f"{APP} [data-add-tile]")
    form.locator("input").fill("switch.entity_0235")
    form.locator("button").click()
    assert draft(desktop)["favorites"][-1] == "switch.entity_0235"


def test_a_room_gets_tiles_on_home(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/1/home")
    form = desktop.locator(f"{APP} [data-add-tile]")
    form.locator("input").fill("switch.entity_0235")
    form.locator("button").click()
    assert draft(desktop)["layout"][1]["home"] == [{"entity": "switch.entity_0235"}]


def test_duplicate_puts_a_copy_after_the_tile(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0/sections/0/tiles/0")
    desktop.locator(f"{APP} [data-action='duplicate']").click()
    tiles = draft(desktop)["layout"][0]["sections"][0]["tiles"]
    assert [item.get("name") for item in tiles] == ["Sofa", "Sofa", None]
    assert "sel" in desktop.locator(f"{APP} [data-node='layout/0/sections/0/tiles/1']").get_attribute("class")


def test_up_and_down_move_within_the_list_and_stop_at_its_ends(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0/sections/0/tiles/0")
    assert desktop.locator(f"{APP} [data-action='up']").is_disabled()
    desktop.locator(f"{APP} [data-action='down']").click()
    assert [item["entity"] for item in draft(desktop)["layout"][0]["sections"][0]["tiles"]] == [
        "light.entity_0097",
        "light.entity_0096",
    ]
    assert desktop.locator(f"{APP} [data-action='down']").is_disabled()
    select(desktop, "layout/1")
    desktop.locator(f"{APP} [data-action='up']").click()
    assert [room["id"] for room in draft(desktop)["layout"]] == ["kitchen", "living"]


def test_removing_what_is_not_empty_asks_first(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0")
    desktop.on("dialog", lambda dialog: (_ for _ in ()).throw(AssertionError("a browser dialog")))
    remove = desktop.locator(f"{APP} [data-action='remove']")
    remove.click()
    desktop.wait_for_selector(f"{ASK} [data-ask]")
    assert desktop.locator(f"{ASK} [role='alertdialog'][aria-modal='true']").count() == 1
    assert "Salon" in desktop.locator(f"{ASK} [data-ask-title]").inner_text()
    # A dangerous action: a red button named after it, the focus starts on Cancel, so Enter alone does not remove.
    assert desktop.locator(f"{ASK} [data-ask-ok]").inner_text() == "Usuń"
    assert "danger" in desktop.locator(f"{ASK} [data-ask-ok]").get_attribute("class")
    assert focused_in_ask(desktop) == "cancel"
    # Tab stays in the window.
    desktop.keyboard.press("Tab")
    assert focused_in_ask(desktop) == "ok"
    desktop.keyboard.press("Tab")
    assert focused_in_ask(desktop) == "cancel"
    desktop.keyboard.press("Shift+Tab")
    assert focused_in_ask(desktop) == "ok"
    desktop.keyboard.press("Shift+Tab")
    # Enter on Cancel cancels.
    desktop.keyboard.press("Enter")
    desktop.wait_for_selector(ASK, state="detached")
    assert len(draft(desktop)["layout"]) == 2
    # Esc cancels, and the focus goes back to the button that asked.
    remove.click()
    desktop.wait_for_selector(f"{ASK} [data-ask]")
    desktop.keyboard.press("Escape")
    desktop.wait_for_selector(ASK, state="detached")
    assert len(draft(desktop)["layout"]) == 2
    assert (
        desktop.evaluate(
            "() => document.querySelector('home-dashboard-editor-app').shadowRoot.activeElement?.dataset.action"
        )
        == "remove"
    )
    # A click beside the window cancels too.
    remove.click()
    desktop.wait_for_selector(f"{ASK} [data-ask]")
    desktop.mouse.click(5, 5)
    desktop.wait_for_selector(ASK, state="detached")
    assert len(draft(desktop)["layout"]) == 2
    # The action button removes.
    remove.click()
    desktop.locator(f"{ASK} [data-ask-ok]").click()
    desktop.wait_for_selector(ASK, state="detached")
    assert [room["id"] for room in draft(desktop)["layout"]] == ["kitchen"]


def test_an_empty_section_and_a_tile_go_without_asking(desktop):  # noqa: F811
    open_forms(desktop)
    desktop.on("dialog", lambda dialog: (_ for _ in ()).throw(AssertionError("asked")))
    select(desktop, "layout/1/sections/0")
    desktop.locator(f"{APP} [data-action='remove']").click()
    assert desktop.locator(ASK).count() == 0
    select(desktop, "layout/0/sections/1/tiles/0")
    desktop.locator(f"{APP} [data-action='remove']").click()
    assert draft(desktop)["layout"][1]["sections"] == []
    assert draft(desktop)["layout"][0]["sections"][1]["tiles"] == []


# Undo and redo -----------------------------------------------------------------------------------------------


def test_undo_and_redo_with_the_buttons_and_the_keys(desktop):  # noqa: F811
    open_forms(desktop)
    assert desktop.locator(f"{APP} [data-undo]").is_disabled()
    select(desktop, "layout/0/sections/0/tiles/0")
    desktop.locator(f"{APP} [data-action='remove']").click()
    assert len(draft(desktop)["layout"][0]["sections"][0]["tiles"]) == 1
    desktop.locator(f"{APP} [data-undo]").click()
    assert draft(desktop)["layout"][0]["sections"][0]["tiles"][0]["name"] == "Sofa"
    desktop.locator(f"{APP} [data-redo]").click()
    assert len(draft(desktop)["layout"][0]["sections"][0]["tiles"]) == 1
    desktop.locator(f"{APP} [data-tree]").click(position={"x": 5, "y": 5})
    desktop.keyboard.press("Meta+z")
    assert len(draft(desktop)["layout"][0]["sections"][0]["tiles"]) == 2
    desktop.keyboard.press("Meta+Shift+z")
    assert len(draft(desktop)["layout"][0]["sections"][0]["tiles"]) == 1


def test_letters_typed_in_the_yaml_are_one_step(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/1")
    yaml_tab(desktop)
    box = desktop.locator(f"{APP} [data-yaml]")
    box.click()
    desktop.keyboard.press("End")
    for letter in "abc":
        desktop.keyboard.type(f"\n# {letter}")
    desktop.locator(f"{APP} [data-undo]").click()
    assert desktop.evaluate("window.editor.app._past.length") == 0


def test_a_new_change_forgets_what_could_be_redone(desktop):  # noqa: F811
    open_forms(desktop)
    select(desktop, "layout/0/sections/0/tiles/0")
    desktop.locator(f"{APP} [data-action='remove']").click()
    desktop.locator(f"{APP} [data-undo]").click()
    select(desktop, "layout/1")
    desktop.locator(f"{APP} [data-action='add_section']").click()
    assert desktop.locator(f"{APP} [data-redo]").is_disabled()


def test_undo_of_what_was_chosen_lets_go_of_it(desktop):  # noqa: F811
    open_forms(desktop)
    desktop.locator(f"{APP} [data-add-room]").click()
    desktop.locator(f"{APP} [data-undo]").click()
    assert desktop.locator(f"{APP} [data-props-title]").inner_text() == "Cały dashboard"


# Dragging in the tree -----------------------------------------------------------------------------------------


def node(page, key: str):
    return page.locator(f"{APP} [data-node='{key}']")


def test_a_tile_dragged_onto_a_section_goes_to_its_end(desktop):  # noqa: F811
    open_forms(desktop)
    node(desktop, "layout/0/sections/0/tiles/0").drag_to(node(desktop, "layout/1/sections/0"))
    strategy = draft(desktop)
    assert strategy["layout"][1]["sections"][0]["tiles"][0]["name"] == "Sofa"
    assert len(strategy["layout"][0]["sections"][0]["tiles"]) == 1
    assert "sel" in node(desktop, "layout/1/sections/0/tiles/0").get_attribute("class")


def test_a_tile_dragged_onto_a_tile_goes_before_it(desktop):  # noqa: F811
    open_forms(desktop)
    node(desktop, "layout/0/sections/1/tiles/0").drag_to(node(desktop, "layout/0/sections/0/tiles/1"))
    entities = [item["entity"] for item in draft(desktop)["layout"][0]["sections"][0]["tiles"]]
    assert entities == ["light.entity_0096", "switch.entity_0235", "light.entity_0097"]


def test_a_section_goes_to_another_room_and_rooms_change_order(desktop):  # noqa: F811
    open_forms(desktop)
    node(desktop, "layout/0/sections/1").drag_to(node(desktop, "layout/1"))
    assert [section["title"] for section in draft(desktop)["layout"][1]["sections"]] == ["Kawa", "Inne"]
    node(desktop, "layout/1").drag_to(node(desktop, "layout/0"))
    assert [room["id"] for room in draft(desktop)["layout"]] == ["kitchen", "living"]


def test_what_cannot_go_there_stays(desktop):  # noqa: F811
    open_forms(desktop)
    before = draft(desktop)
    node(desktop, "layout/0").drag_to(node(desktop, "layout/0/sections/0/tiles/0"))
    node(desktop, "layout/0/sections/0/tiles/0").drag_to(node(desktop, "favorites"))
    assert draft(desktop) == before


# The pure parts ---------------------------------------------------------------------------------------------------


def run(page, body: str, arg=None):
    return page.evaluate(
        f"""async (arg) => {{ const t = await import('/custom_components/home_dashboard/www/editor/tree.js');
            const p = await import('/custom_components/home_dashboard/www/editor/props.js'); {body} }}""",
        arg,
    )


@pytest.mark.parametrize(
    ("dragged", "target", "plan"),
    [
        (
            {"kind": "tile", "key": "a", "path": ["layout", 0, "sections", 0, "tiles", 0]},
            {"kind": "tile", "key": "b", "path": ["layout", 1, "home", 2]},
            {"list": ["layout", 1, "home"], "index": 2},
        ),
        (
            {"kind": "tile", "key": "a", "path": ["scenes", 0]},
            {
                "kind": "section",
                "key": "s",
                "path": ["layout", 0, "sections", 1],
                "tilesPath": ["layout", 0, "sections", 1, "tiles"],
            },
            {"list": ["layout", 0, "sections", 1, "tiles"], "index": 1},
        ),
        (
            {"kind": "favorite", "key": "f", "path": ["favorites", 1]},
            {"kind": "favorite", "key": "g", "path": ["favorites", 0]},
            {"list": ["favorites"], "index": 0},
        ),
        (
            {"kind": "favorite", "key": "f", "path": ["favorites", 1]},
            {"kind": "tile", "key": "b", "path": ["scenes", 0]},
            None,
        ),
        (
            {"kind": "section", "key": "s", "path": ["layout", 0, "sections", 0]},
            {"kind": "room", "key": "r", "path": ["layout", 1]},
            {"list": ["layout", 1, "sections"], "index": 1},
        ),
        (
            {"kind": "section", "key": "h", "path": ["layout", 0, "home"]},
            {"kind": "room", "key": "r", "path": ["layout", 1]},
            None,
        ),
        (
            {"kind": "room", "key": "r", "path": ["layout", 1]},
            {"kind": "room", "key": "q", "path": ["layout", 0]},
            {"list": ["layout"], "index": 0},
        ),
        (
            {"kind": "room", "key": "r", "path": ["layout", 1]},
            {"kind": "room", "key": "r", "path": ["layout", 1]},
            None,
        ),
    ],
)
def test_where_a_drop_lands(desktop, dragged, target, plan):  # noqa: F811
    strategy = {
        "favorites": ["a", "b"],
        "scenes": [{}],
        "layout": [{"sections": [{"tiles": []}, {"tiles": [{}]}]}, {"sections": [{"tiles": []}]}],
    }
    assert run(desktop, "return t.dropPlan(arg[0], arg[1], arg[2]);", [strategy, dragged, target]) == plan


def test_the_path_after_a_move(desktop):  # noqa: F811
    paths = run(
        desktop,
        """return [t.movedPath(['x', 0], ['x'], 3), t.movedPath(['x', 3], ['x'], 0), t.movedPath(['x', 0], ['y'], 3)];""",
    )
    assert paths == [["x", 2], ["x", 0], ["y", 3]]


def test_with_field_and_slugify(desktop):  # noqa: F811
    result = run(
        desktop,
        """return [p.withField({ a: 1, b: 2 }, 'a', ''), p.withField({ a: 1 }, 'b', false), p.withField({}, 'c', []),
        p.withField({}, 'd', {}), p.withField({}, 'e', 'x'), p.slugify('Łazienka Główna'), p.slugify('  Pokój dzieci! '), p.slugify('')];""",
    )
    assert result == [{"b": 2}, {"a": 1}, {}, {}, {"e": "x"}, "lazienka_glowna", "pokoj_dzieci", "room"]
