"""The editor on a computer: rooms made from the areas of Home Assistant, and starting from nothing right after the
installation (a dashboard made from the editor, its rooms from the areas)."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, desktop, open_editor  # noqa: F401

DIALOG = "home-dashboard-editor-generate"

HOME = """() => {
    const s = window.editor.snapshot;
    for (const id of Object.keys(s.areas)) delete s.areas[id];
    s.floors = { up: { floor_id: 'up', level: 1 }, ground: { floor_id: 'ground', level: 0 } };
    s.areas.g_living = { area_id: 'g_living', name: 'Salon', floor_id: 'ground', icon: 'mdi:sofa' };
    s.areas.g_bath = { area_id: 'g_bath', name: 'Łazienka', floor_id: 'up' };
    s.areas.g_attic = { area_id: 'g_attic', name: 'Antresola', floor_id: 'ground' };
    s.areas.g_empty = { area_id: 'g_empty', name: 'Strych', floor_id: 'up' };
    const add = (id, area, attributes = {}, entry = {}) => {
        s.states[id] = { entity_id: id, state: 'on', attributes: { friendly_name: id.split('.')[1], ...attributes } };
        s.entities[id] = { entity_id: id, area_id: area, hidden: false, entity_category: null, platform: 'demo', ...entry };
    };
    add('light.g_ceiling', 'g_living'); add('light.g_sofa', 'g_living');
    add('climate.g_thermostat', 'g_living'); add('media_player.g_tv', 'g_living');
    add('cover.g_blind_homekit', 'g_living', {}, { platform: 'homekit_controller' });
    add('cover.g_blind_netatmo', 'g_living', {}, { platform: 'netatmo' });
    add('switch.g_aquarium', 'g_living'); add('automation.g_blinds', 'g_living');
    add('binary_sensor.g_leak', 'g_bath', { device_class: 'moisture' }); add('binary_sensor.g_door', 'g_bath', { device_class: 'door' });
    add('sensor.g_temperature', 'g_bath', { device_class: 'temperature' }); add('light.g_mirror', 'g_bath');
    add('light.g_hidden', 'g_bath', {}, { hidden: true }); add('switch.g_config', 'g_bath', {}, { entity_category: 'config' });
    add('light.g_attic', 'g_attic');
}"""

STRATEGY = {
    "type": "custom:home-dashboard",
    "layout": [{"id": "attic", "name": "Antresola", "areas": ["g_attic"], "sections": []}],
}


@pytest.fixture(autouse=True)
def home(desktop):  # noqa: F811
    desktop.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
    desktop.evaluate(HOME)


def run(page, body: str, arg=None):
    return page.evaluate(
        f"""async (arg) => {{ const g = await import('/custom_components/home_dashboard/www/editor/generate.js');
            const s = window.editor.snapshot;
            const hass = {{ states: s.states, entities: s.entities, devices: s.devices, areas: s.areas, floors: s.floors, language: 'pl' }}; {body} }}""",
        arg,
    )


def draft(page) -> dict:
    return page.evaluate("window.editor.app._strategy")


# What a room gets ---------------------------------------------------------------------------------------------


def test_a_room_of_an_area_has_sections_by_kind_and_a_few_tiles_on_home(desktop):  # noqa: F811
    room = run(desktop, "return g.roomForArea(hass, 'g_living');")
    assert (
        room["id"] == "g_living"
        and room["name"] == "Salon"
        and room["areas"] == ["g_living"]
        and room["icon"] == "mdi:sofa"
    )
    sections = {
        section["title"]: [tile["entity"] for tile in section["tiles"]] for section in room["sections"]
    }
    assert sections == {
        "Oświetlenie": ["light.g_ceiling", "light.g_sofa"],
        "Klimat i rolety": ["cover.g_blind_homekit", "climate.g_thermostat"],
        "Multimedia": ["media_player.g_tv"],
        "Urządzenia": ["switch.g_aquarium"],
        "Automatyzacje": ["automation.g_blinds"],
    }
    assert room["sections"][-1]["tiles"][0] == {
        "entity": "automation.g_blinds",
        "calm": True,
        "tap_toggle": True,
    }
    assert [tile["entity"] for tile in room["home"]] == [
        "climate.g_thermostat",
        "light.g_ceiling",
        "light.g_sofa",
        "cover.g_blind_homekit",
    ]


def test_hidden_technical_and_quiet_sensors_stay_out_but_a_leak_comes_in(desktop):  # noqa: F811
    room = run(
        desktop, "return g.roomForArea(hass, 'g_bath', { kinds: ['lights', 'security'], home: false });"
    )
    assert "home" not in room
    sections = {
        section["title"]: [tile["entity"] for tile in section["tiles"]] for section in room["sections"]
    }
    assert sections == {"Oświetlenie": ["light.g_mirror"], "Bezpieczeństwo": ["binary_sensor.g_leak"]}


def test_areas_by_floor_and_name_with_the_room_that_holds_them(desktop):  # noqa: F811
    areas = run(
        desktop, "return g.generatableAreas(hass, arg).map((a) => [a.area, a.tiles, a.covered]);", STRATEGY
    )
    # The two blinds of the living room are one device: seven tiles, not eight.
    assert areas == [
        ["g_attic", 1, "Antresola"],
        ["g_living", 7, None],
        ["g_bath", 2, None],
        ["g_empty", 0, None],
    ]


def test_rooms_are_added_after_those_there_and_a_held_area_is_left_alone(desktop):  # noqa: F811
    ids = run(
        desktop,
        "return g.withGeneratedRooms(hass, arg, ['g_attic', 'g_bath', 'g_living']).layout.map((room) => room.id);",
        STRATEGY,
    )
    assert ids == ["attic", "g_bath", "g_living"]


# The dialog ----------------------------------------------------------------------------------------------------


def open_dialog(page, strategy=STRATEGY) -> None:
    open_editor(page, strategy)
    page.locator(f"{APP} [data-generate]").click()
    page.wait_for_selector(f"{APP} {DIALOG} [data-generate-dialog]")


def ticked(page) -> list[str]:
    return page.locator(f"{APP} {DIALOG} [data-generate-area].on").evaluate_all(
        "(items) => items.map((i) => i.dataset.generateArea)"
    )


def test_areas_without_a_room_and_with_something_to_show_are_ticked(desktop):  # noqa: F811
    open_dialog(desktop)
    assert ticked(desktop) == ["g_living", "g_bath"]
    assert desktop.locator(f"{APP} {DIALOG} [data-generate-area='g_attic']").is_disabled()
    assert (
        "już w „Antresola”" in desktop.locator(f"{APP} {DIALOG} [data-generate-area='g_attic']").inner_text()
    )


def test_what_is_ticked_shows_in_the_preview_and_adding_is_one_step(desktop):  # noqa: F811
    open_dialog(desktop)
    desktop.locator(f"{APP} {DIALOG} [data-generate-area='g_bath']").click()
    preview = desktop.evaluate("window.homeDashboardPreview.strategy.layout.map((room) => room.id)")
    assert preview == ["attic", "g_living"]
    assert [room["id"] for room in draft(desktop)["layout"]] == ["attic"]
    desktop.locator(f"{APP} {DIALOG} [data-generate-add]").click()
    assert [room["id"] for room in draft(desktop)["layout"]] == ["attic", "g_living"]
    desktop.wait_for_selector(f"{APP} [data-notice='ok']")
    assert "sel" in desktop.locator(f"{APP} [data-node='layout/1']").get_attribute("class")
    desktop.locator(f"{APP} [data-undo]").click()
    assert [room["id"] for room in draft(desktop)["layout"]] == ["attic"]


def test_sections_and_home_follow_the_choices(desktop):  # noqa: F811
    open_dialog(desktop)
    desktop.locator(f"{APP} {DIALOG} [data-generate-kind='automations'] input").check()
    desktop.locator(f"{APP} {DIALOG} [data-generate-kind='media'] input").uncheck()
    desktop.locator(f"{APP} {DIALOG} [data-generate-home] input").uncheck()
    desktop.locator(f"{APP} {DIALOG} [data-generate-add]").click()
    living = next(room for room in draft(desktop)["layout"] if room["id"] == "g_living")
    titles = [section["title"] for section in living["sections"]]
    assert "Automatyzacje" in titles and "Multimedia" not in titles and "home" not in living


def test_closing_leaves_the_draft_and_the_preview_as_they_were(desktop):  # noqa: F811
    open_dialog(desktop)
    desktop.locator(f"{APP} {DIALOG} [data-dialog-close]").click()
    assert desktop.evaluate("window.homeDashboardPreview.strategy.layout.length") == 1
    assert desktop.evaluate("window.editor.server.state.draft") is None


def test_an_empty_dashboard_offers_to_start_from_the_areas(desktop):  # noqa: F811
    open_editor(desktop, {"type": "custom:home-dashboard"})
    desktop.locator(f"{APP} [data-generate-start]").click()
    desktop.wait_for_selector(f"{APP} {DIALOG}")
    desktop.locator(f"{APP} {DIALOG} [data-generate-add]").click()
    assert [room["id"] for room in draft(desktop)["layout"]] == ["g_attic", "g_living", "g_bath"]


# Right after the installation ------------------------------------------------------------------------------------


def test_without_a_dashboard_one_is_made_and_its_rooms_come_from_the_areas(desktop):  # noqa: F811
    desktop.evaluate("async () => window.editor.open({}, { dashboards: [] })")
    desktop.locator(f"{APP} [data-create-dashboard]").click()
    desktop.wait_for_selector(f"{APP} {DIALOG}")
    sent = desktop.evaluate("window.editor.server.state.sent.map((message) => message.type)")
    assert "lovelace/dashboards/create" in sent
    create = desktop.evaluate(
        "window.editor.server.state.sent.find((message) => message.type === 'lovelace/dashboards/create')"
    )
    assert (
        create["url_path"] == "home-dashboard"
        and create["mode"] == "storage"
        and create["require_admin"] is False
    )
    assert desktop.evaluate("window.editor.server.state.live") == {
        "strategy": {"type": "custom:home-dashboard"}
    }
    desktop.locator(f"{APP} {DIALOG} [data-generate-add]").click()
    assert len(draft(desktop)["layout"]) == 3
