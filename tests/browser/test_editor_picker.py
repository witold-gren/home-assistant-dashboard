"""The editor on a computer, stage 4: the picker of tiles. Filters by area, kind and use, where an entity is shown
already, the same device from two integrations, the battery of a device, suggestions, the preview of what is ticked,
and adding as one step."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401

PICKER = "home-dashboard-editor-picker"
STRATEGY = {
    "type": "custom:home-dashboard",
    "favorites": [],
    "layout": [
        {"id": "test_kitchen", "name": "Kuchnia", "sections": [{"title": "Kawa", "tiles": [{"entity": "light.test_lamp"}]}]},
        {"id": "office", "name": "Biuro", "areas": ["test_office"], "sections": [{"title": "Biurko", "tiles": []}]},
    ],
}

HOME = """() => {
    const s = window.editor.snapshot;
    s.areas.test_kitchen = { area_id: 'test_kitchen', name: 'Kuchnia testowa' };
    s.areas.test_office = { area_id: 'test_office', name: 'Biuro testowe' };
    s.devices.dev_blind = { id: 'dev_blind', area_id: 'test_kitchen' };
    s.devices.dev_lamp = { id: 'dev_lamp', area_id: 'test_kitchen' };
    const add = (id, state, attributes, entry) => {
        s.states[id] = { entity_id: id, state, attributes };
        s.entities[id] = { entity_id: id, hidden: false, entity_category: null, ...entry };
    };
    add('cover.test_blind_homekit', 'open', { friendly_name: 'Roleta kuchnia' }, { platform: 'homekit_controller', device_id: 'dev_blind' });
    add('cover.test_blind_netatmo', 'open', { friendly_name: 'Roleta 1' }, { platform: 'netatmo', area_id: 'test_kitchen' });
    add('cover.test_blinds_group', 'open', { friendly_name: 'Wszystkie rolety' }, { platform: 'group', area_id: 'test_kitchen' });
    add('light.test_lamp', 'on', { friendly_name: 'Lampa kuchnia' }, { platform: 'hue', device_id: 'dev_lamp' });
    add('sensor.test_lamp_battery', '42', { device_class: 'battery', unit_of_measurement: '%' }, { platform: 'hue', device_id: 'dev_lamp', entity_category: 'diagnostic' });
    add('select.test_drink', 'none', { friendly_name: 'Napój', options: ['none', 'Espresso'] }, { platform: 'delonghi', area_id: 'test_kitchen' });
    add('automation.test_morning', 'on', { friendly_name: 'Poranek testowy' }, { platform: 'automation' });
    add('light.test_desk', 'off', { friendly_name: 'Lampka biurko' }, { platform: 'hue', area_id: 'test_office' });
}"""


@pytest.fixture(autouse=True)
def home(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")
    desktop.evaluate(HOME)


def open_picker(page, node="layout/0/sections/0") -> None:
    open_editor(page, STRATEGY)
    select(page, node)
    page.locator(f"{APP} [data-action='pick']").click()
    page.wait_for_selector(f"{APP} {PICKER} [data-picker]")


def rows(page) -> list[str]:
    return page.locator(f"{APP} {PICKER} [data-picker-row]").evaluate_all("(rows) => rows.map((row) => row.dataset.pickerRow)")


def row(page, entity: str):
    return page.locator(f"{APP} {PICKER} [data-picker-row='{entity}']")


def chip(page, name: str):
    return page.locator(f"{APP} {PICKER} [data-filter='{name}']")


def draft(page) -> dict:
    return page.evaluate("window.editor.app._strategy")


# Filters --------------------------------------------------------------------------------------------------


def test_a_section_of_a_room_opens_on_the_room_s_area(desktop):  # noqa: F811
    open_picker(desktop)
    assert "Kuchnia \u203a Kawa" in desktop.locator(f"{APP} {PICKER} header").inner_text()
    kitchen = {"cover.test_blind_homekit", "cover.test_blind_netatmo", "cover.test_blinds_group", "light.test_lamp", "select.test_drink"}
    assert set(rows(desktop)) == kitchen


def test_a_room_with_areas_opens_on_them(desktop):  # noqa: F811
    open_picker(desktop, "layout/1/sections/0")
    assert rows(desktop) == ["light.test_desk"]


def test_all_areas_and_without_an_area(desktop):  # noqa: F811
    open_picker(desktop)
    desktop.locator(f"{APP} {PICKER} [data-picker-search]").fill("test")
    chip(desktop, "all").click()
    assert {"light.test_desk", "automation.test_morning"} <= set(rows(desktop))
    chip(desktop, "unassigned").click()
    assert "automation.test_morning" in rows(desktop)
    assert "light.test_desk" not in rows(desktop)
    chip(desktop, "room").click()
    assert "light.test_desk" not in rows(desktop)


def test_kinds_narrow_and_add_up(desktop):  # noqa: F811
    open_picker(desktop)
    covers = {"cover.test_blind_homekit", "cover.test_blind_netatmo", "cover.test_blinds_group"}
    chip(desktop, "kind-covers").click()
    assert set(rows(desktop)) == covers
    chip(desktop, "kind-lights").click()
    assert set(rows(desktop)) == covers | {"light.test_lamp"}


def test_search_by_name_or_id(desktop):  # noqa: F811
    open_picker(desktop)
    desktop.locator(f"{APP} {PICKER} [data-picker-search]").fill("netatmo")
    assert rows(desktop) == ["cover.test_blind_netatmo"]
    desktop.locator(f"{APP} {PICKER} [data-picker-search]").fill("napój")
    assert rows(desktop) == ["select.test_drink"]


def test_groups_and_technical_entities_wait_for_a_choice(desktop):  # noqa: F811
    open_picker(desktop)
    chip(desktop, "kind-sensors").click()
    assert rows(desktop) == []
    chip(desktop, "technical").click()
    assert rows(desktop) == ["sensor.test_lamp_battery"]


# What a row tells ------------------------------------------------------------------------------------------


def test_what_is_shown_already_says_where_and_comes_last(desktop):  # noqa: F811
    open_picker(desktop)
    assert rows(desktop)[-1] == "light.test_lamp"
    assert row(desktop, "light.test_lamp").locator("[data-picker-used]").inner_text() == "już w: Kuchnia"
    chip(desktop, "hide-used").click()
    assert "light.test_lamp" not in rows(desktop)


def test_the_same_blind_from_two_integrations_is_marked_both_ways(desktop):  # noqa: F811
    open_picker(desktop)
    homekit = row(desktop, "cover.test_blind_homekit").locator("[data-picker-twin]").inner_text()
    netatmo = row(desktop, "cover.test_blind_netatmo").locator("[data-picker-twin]").inner_text()
    assert "Roleta 1 (netatmo)" in homekit
    assert "Roleta kuchnia (homekit_controller)" in netatmo
    assert "Wszystkie rolety" not in homekit
    assert row(desktop, "light.test_lamp").locator("[data-picker-twin]").count() == 0


def test_the_battery_of_the_device_and_the_area_are_told(desktop):  # noqa: F811
    open_picker(desktop)
    facts = row(desktop, "light.test_lamp").locator("small").first.inner_text()
    assert facts == "light.test_lamp · Kuchnia testowa · Bateria 42%"


def test_a_list_gets_the_suggestion_of_its_run_button(desktop):  # noqa: F811
    open_picker(desktop)
    assert "zaznacz, potem uruchom" in row(desktop, "select.test_drink").locator("[data-picker-tip]").inner_text()


# Ticking and adding -----------------------------------------------------------------------------------------


def test_what_is_ticked_shows_in_the_preview_and_not_in_the_draft(desktop):  # noqa: F811
    open_picker(desktop)
    row(desktop, "cover.test_blind_homekit").click()
    preview = desktop.evaluate("window.homeDashboardPreview.strategy.layout[0].sections[0].tiles.map((t) => t.entity)")
    assert preview == ["light.test_lamp", "cover.test_blind_homekit"]
    assert len(draft(desktop)["layout"][0]["sections"][0]["tiles"]) == 1
    assert "Zaznaczone: 1" in desktop.locator(f"{APP} {PICKER} [data-picker-count]").inner_text()
    desktop.locator(f"{APP} {PICKER} [data-picker-close]").click()
    preview = desktop.evaluate("window.homeDashboardPreview.strategy.layout[0].sections[0].tiles.length")
    assert preview == 1


def test_adding_puts_the_tiles_in_the_order_they_were_ticked_as_one_step(desktop):  # noqa: F811
    open_picker(desktop)
    row(desktop, "select.test_drink").click()
    row(desktop, "cover.test_blind_homekit").click()
    desktop.locator(f"{APP} {PICKER} [data-picker-add]").click()
    tiles = draft(desktop)["layout"][0]["sections"][0]["tiles"]
    assert tiles == [{"entity": "light.test_lamp"}, {"entity": "select.test_drink", "confirm": True}, {"entity": "cover.test_blind_homekit"}]
    assert desktop.locator(f"{APP} {PICKER}").count() == 0
    assert "sel" in desktop.locator(f"{APP} [data-node='layout/0/sections/0/tiles/1']").get_attribute("class")
    desktop.locator(f"{APP} [data-undo]").click()
    assert len(draft(desktop)["layout"][0]["sections"][0]["tiles"]) == 1


def test_without_suggestions_a_tile_is_only_its_entity(desktop):  # noqa: F811
    open_picker(desktop)
    desktop.locator(f"{APP} {PICKER} [data-picker-suggest]").uncheck()
    row(desktop, "select.test_drink").click()
    desktop.locator(f"{APP} {PICKER} [data-picker-add]").click()
    assert draft(desktop)["layout"][0]["sections"][0]["tiles"][-1] == {"entity": "select.test_drink"}


def test_unticking_takes_it_back(desktop):  # noqa: F811
    open_picker(desktop)
    row(desktop, "cover.test_blind_homekit").click()
    row(desktop, "cover.test_blind_homekit").click()
    assert desktop.locator(f"{APP} {PICKER} [data-picker-add]").is_disabled()


def test_favourites_get_entities_only(desktop):  # noqa: F811
    open_picker(desktop, "favorites")
    desktop.locator(f"{APP} {PICKER} [data-picker-search]").fill("napój")
    row(desktop, "select.test_drink").click()
    desktop.locator(f"{APP} {PICKER} [data-picker-add]").click()
    assert draft(desktop)["favorites"] == ["select.test_drink"]


def test_a_long_list_says_how_many_more_there_are(desktop):  # noqa: F811
    open_picker(desktop)
    chip(desktop, "all").click()
    chip(desktop, "technical").click()
    assert len(rows(desktop)) == 200
    assert "zawęź" in desktop.locator(f"{APP} {PICKER} [data-picker-more]").inner_text()


# The pure parts ----------------------------------------------------------------------------------------------


def run(page, body: str, arg=None):
    return page.evaluate(
        f"""async (arg) => {{ const m = await import('/custom_components/home_dashboard/www/editor/picker-model.js');
            const hass = {{ ...window.editor.app.hass, states: window.editor.snapshot.states, entities: window.editor.snapshot.entities,
                devices: window.editor.snapshot.devices, areas: window.editor.snapshot.areas, language: 'pl' }}; {body} }}""",
        arg,
    )


def test_kind_area_battery_and_tile(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    result = run(desktop, """return [m.kindOf('cover.a'), m.kindOf('scene.a'), m.kindOf('vacuum.a'), m.areaOf(hass, 'light.test_lamp'),
        m.areaOf(hass, 'automation.test_morning'), m.batteryOf(hass, 'light.test_lamp'), m.batteryOf(hass, 'cover.test_blind_netatmo'),
        m.tileFor(hass, 'select.test_drink', ['favorites']), m.tileFor(hass, 'automation.test_morning', ['scenes'])];""")
    assert result == ["covers", "automations", "other", "test_kitchen", None, 42, None, "select.test_drink", {"entity": "automation.test_morning", "calm": True}]


def test_usage_counts_every_place(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    places = run(desktop, """const strategy = { favorites: ['light.a'], scenes: [{ entity: 'scene.x' }],
        layout: [{ id: 'k', name: 'Kuchnia', home: [{ entity: 'light.a' }], scenes: [{ entity: 'scene.x' }],
            sections: [{ tiles: [{ entity: 'light.a' }, { shortcut: 'Ekspres', entity: 'sensor.e' }] }] }] };
        return Object.fromEntries(m.usage(strategy, 'pl'));""")
    assert places == {"light.a": ["Ulubione", "Kuchnia"], "scene.x": ["Sceny", "Kuchnia"], "sensor.e": ["Kuchnia"]}


def test_twins_need_one_area_one_kind_and_two_integrations(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    twins = run(desktop, """
        const ids = (entity) => m.twinsOf(hass, entity).map((twin) => twin.entity);
        hass.states['cover.test_blind_netatmo'] = { ...hass.states['cover.test_blind_netatmo'], attributes: { device_class: 'garage' } };
        const differentClass = ids('cover.test_blind_homekit');
        return [ids('light.test_lamp'), differentClass, ids('select.test_drink')];""")
    assert twins == [[], [], []]


def test_a_home_of_thousands_of_entities_is_listed_at_once(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    took = desktop.evaluate("""async () => { const m = await import('/custom_components/home_dashboard/www/editor/picker-model.js');
        const states = {}, entities = {}, devices = {}, areas = {};
        for (let n = 0; n < 3000; n++) {
            const area = `area_${n % 20}`, device = `dev_${n % 1500}`;
            areas[area] = { area_id: area, name: area };
            devices[device] = { id: device, area_id: area };
            const id = n % 3 ? `light.l${n}` : `sensor.b${n}`;
            states[id] = { entity_id: id, state: '50', attributes: n % 3 ? { friendly_name: `L ${n}` } : { device_class: 'battery' } };
            entities[id] = { entity_id: id, device_id: device, platform: n % 2 ? 'hue' : 'zha' };
        }
        const hass = { states, entities, devices, areas, language: 'pl' };
        const start = performance.now();
        for (let round = 0; round < 3; round++) m.pickerRows({ ...hass, states: { ...states } }, { layout: [] }, {});
        return (performance.now() - start) / 3; }""")
    assert took < 400


def test_two_blinds_of_one_integration_and_lights_of_many_are_no_twins(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    twins = run(desktop, """const add = (id, platform, area) => {
            hass.states[id] = { entity_id: id, state: 'open', attributes: { friendly_name: id } };
            hass.entities[id] = { entity_id: id, platform, area_id: area };
        };
        add('cover.salon_a', 'homekit_controller', 'test_office'); add('cover.salon_b', 'homekit_controller', 'test_office');
        add('cover.salon_c', 'zha', 'test_office');
        add('light.k_hue', 'hue', 'test_kitchen'); add('light.k_zha', 'zha', 'test_kitchen');
        const ids = (entity) => m.twinsOf({ ...hass, states: { ...hass.states } }, entity).map((twin) => twin.entity);
        return [ids('cover.salon_a'), ids('cover.salon_c'), ids('light.k_hue'), ids('cover.test_blinds_group')];""")
    assert twins == [[], [], [], []]
