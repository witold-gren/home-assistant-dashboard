"""The quick start of the editor: a few questions that start from what is in Home Assistant (areas, leak and smoke
sensors, batteries, hubs, scenes…) and add a working dashboard to the draft as one step; run again it only adds what
is missing."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, desktop, open_editor  # noqa: F401

DIALOG = f"{APP} home-dashboard-editor-quick-start"
MODULE = "/custom_components/home_dashboard/www/editor/quick-start.js"

HOME = """() => {
    const s = window.editor.snapshot;
    for (const id of Object.keys(s.areas)) delete s.areas[id];
    // A home of its own: nothing of the shared registry
    for (const id of Object.keys(s.states)) { delete s.states[id]; delete s.entities[id]; }
    s.floors = { ground: { floor_id: 'ground', name: 'Parter', level: 0 } };
    s.areas.q_living = { area_id: 'q_living', name: 'Salon', floor_id: 'ground' };
    s.areas.q_bath = { area_id: 'q_bath', name: 'Łazienka', floor_id: 'ground' };
    const add = (id, area, attributes = {}, entry = {}) => {
        s.states[id] = { entity_id: id, state: 'off', attributes: { friendly_name: id.split('.')[1], ...attributes } };
        s.entities[id] = { entity_id: id, area_id: area, hidden: false, entity_category: null, platform: 'demo', ...entry };
    };
    add('light.q_ceiling', 'q_living'); add('climate.q_thermostat', 'q_living'); add('cover.q_blind', 'q_living');
    add('lock.q_front', 'q_living'); add('alarm_control_panel.q_home', 'q_living');
    add('scene.q_movie', 'q_living'); add('scene.q_night', 'q_living');
    add('binary_sensor.q_leak', 'q_bath', { device_class: 'moisture' });
    add('binary_sensor.q_smoke', 'q_living', { device_class: 'smoke' });
    add('binary_sensor.q_door', 'q_living', { device_class: 'door' });
    add('sensor.q_remote_battery', 'q_living', { device_class: 'battery', unit_of_measurement: '%' });
    add('light.q_mirror', 'q_bath');
    s.devices.q_hub = { id: 'q_hub', name: 'Zigbee Gateway', model: 'Zigbee Gateway' };
    add('button.q_hub_identify', null, {}, { device_id: 'q_hub', entity_category: 'config' });
}"""

STRATEGY = {"type": "custom:home-dashboard"}


@pytest.fixture(autouse=True)
def home(desktop):  # noqa: F811
    desktop.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
    desktop.evaluate(HOME)


def run(page, body: str, arg=None):
    return page.evaluate(
        f"""async (arg) => {{ const q = await import('{MODULE}');
            const s = window.editor.snapshot;
            const hass = {{ states: s.states, entities: s.entities, devices: s.devices, areas: s.areas, floors: s.floors, language: 'pl' }}; {body} }}""",
        arg,
    )


def draft(page) -> dict:
    return page.evaluate("window.editor.app._strategy")


def open_quick(page, strategy=STRATEGY, **options) -> None:
    open_editor(page, strategy, **options)
    page.locator(f"{APP} [data-editor-settings]").click()
    page.locator(f"{APP} [data-gear-quick]").click()
    page.wait_for_selector(f"{DIALOG} [data-quick-dialog]")


def next_step(page) -> None:
    page.locator(f"{DIALOG} [data-quick-next]").click()


def items(strategy: dict) -> list:
    overview = next(shortcut for shortcut in strategy["shortcuts"] if shortcut["kind"] == "overview")
    return [item for section in overview["sections"] for item in section["items"]]


# What it finds and starts from ----------------------------------------------------------------------------------


def test_it_finds_what_a_dashboard_needs_and_starts_from_it(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    found = run(
        desktop,
        """const f = q.quickStartFindings(hass); const a = q.defaultAnswers(hass, { type: 'custom:home-dashboard' }, f);
        return { leaks: f.leaks, smoke: f.smoke, doors: f.doors, batteries: f.batteries, hubs: f.hubs, scenes: f.scenes,
                 answers: a };""",
    )
    assert found["leaks"] == ["binary_sensor.q_leak"] and found["smoke"] == ["binary_sensor.q_smoke"]
    assert found["doors"] == ["binary_sensor.q_door"] and found["batteries"] == ["sensor.q_remote_battery"]
    # A gateway is known by its model; its entity (even a technical one) goes unavailable with it
    assert found["hubs"] == [{"device": "q_hub", "name": "Zigbee Gateway", "entity": "button.q_hub_identify"}]
    assert sorted(found["scenes"]) == ["scene.q_movie", "scene.q_night"]
    answers = found["answers"]
    assert sorted(answers["areas"]) == ["q_bath", "q_living"]
    assert answers["favourites"] == ["lock.q_front", "alarm_control_panel.q_home", "climate.q_thermostat"]
    assert answers["safety"] == {
        "leak": "alarm",
        "smoke": "alarm",
        "battery": "warning",
        "battery_below": 20,
        "hubs": "alarm",
        "alarm": "alarm",
        "doors": True,
    }


# The window, step by step ---------------------------------------------------------------------------------------


def test_the_answers_make_a_working_dashboard_in_one_step(desktop):  # noqa: F811
    open_quick(desktop)
    assert desktop.locator(f"{DIALOG} [data-quick-progress]").inner_text() == "Krok 1 z 6"
    assert "Bramki i huby" in desktop.locator(f"{DIALOG} [data-quick-found]").inner_text()
    next_step(desktop)  # rooms
    assert desktop.locator(f"{DIALOG} [data-quick-area]").count() == 2
    next_step(desktop)  # home
    assert desktop.locator(f"{DIALOG} [data-quick-chips='scenes'] .chip.on").count() == 2
    next_step(desktop)  # safety
    desktop.locator(f"{DIALOG} [data-quick-level='leak']").select_option("warning")
    desktop.locator(f"{DIALOG} [data-quick-below]").fill("30")
    desktop.locator(f"{DIALOG} [data-quick-below]").dispatch_event("change")
    next_step(desktop)  # look
    next_step(desktop)  # summary
    summary = {
        key: desktop.locator(f"{DIALOG} [data-quick-sum='{key}'] b").inner_text()
        for key in ("rooms", "scenes", "warnings", "status")
    }
    assert summary == {"rooms": "2", "scenes": "2", "warnings": "5", "status": "✓"}
    assert desktop.locator(f"{DIALOG} [data-quick-apply]").inner_text().strip() == "Utwórz dashboard"
    desktop.locator(f"{DIALOG} [data-quick-apply]").click()
    desktop.wait_for_selector(DIALOG, state="detached")
    strategy = draft(desktop)
    assert sorted(room["id"] for room in strategy["layout"]) == ["q_bath", "q_living"]
    assert strategy["favorites"] == ["lock.q_front", "alarm_control_panel.q_home", "climate.q_thermostat"]
    assert [scene["entity"] for scene in strategy["scenes"]] == ["scene.q_movie", "scene.q_night"]
    found = {item["name"]: item for item in items(strategy)}
    assert found["Wyciek wody"]["alarm"] is False and found["Wyciek wody"]["auto"] == "alarm"
    assert found["Dym lub gaz"]["alarm"] is True and found["Dym lub gaz"]["notify"] is True
    assert found["Słabe baterie"]["below"] == 30 and found["Słabe baterie"]["alarm"] is False
    assert found["Bramki i huby nie odpowiadają"]["state"] == "unavailable"
    assert found["Bramki i huby nie odpowiadają"]["entities"] == [
        {"entity": "button.q_hub_identify", "name": "Zigbee Gateway"}
    ]
    assert found["Alarm wyzwolony"]["state"] == "triggered"
    assert strategy["appearance"]["status"]["shown"] is True
    assert strategy["status_panel"]["doors"] == ["binary_sensor.q_door"]
    # Then the tour of the editor, as the last step offered
    desktop.wait_for_selector(f"{APP} home-dashboard-editor-tour")
    # One Undo takes it all back
    desktop.keyboard.press("Escape")
    desktop.locator(f"{APP} [data-undo]").click()
    assert draft(desktop) == STRATEGY


def test_an_answer_shows_in_the_preview_and_closing_leaves_the_draft(desktop):  # noqa: F811
    open_quick(desktop)
    desktop.wait_for_function("window.homeDashboardPreview.strategy?.layout?.length === 2")
    desktop.locator(f"{DIALOG} [data-quick-switch='tablet']").click()
    desktop.locator(f"{DIALOG} [data-dialog-close]").click()
    desktop.wait_for_selector(DIALOG, state="detached")
    assert draft(desktop) == STRATEGY


def test_answers_turned_off_leave_their_part_out(desktop):  # noqa: F811
    open_quick(desktop)
    desktop.locator(f"{DIALOG} [data-quick-switch='tablet']").click()
    desktop.locator(f"{DIALOG} [data-quick-step='safety']").click()
    for key in ("leak", "smoke", "battery", "hubs", "alarm"):
        desktop.locator(f"{DIALOG} [data-quick-level='{key}']").select_option("off")
    desktop.locator(f"{DIALOG} [data-quick-step='summary']").click()
    desktop.locator(f"{DIALOG} [data-quick-switch='tour']").click()
    desktop.locator(f"{DIALOG} [data-quick-apply]").click()
    strategy = draft(desktop)
    assert "shortcuts" not in strategy and "status_panel" not in strategy
    assert "appearance" not in strategy
    assert desktop.locator(f"{APP} home-dashboard-editor-tour").count() == 0


# Run again ------------------------------------------------------------------------------------------------------


def test_run_again_it_only_adds_what_is_missing_and_keeps_what_was_chosen(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    result = run(
        desktop,
        """const own = { type: 'custom:home-dashboard',
              layout: [{ id: 'living', name: 'Pokój dzienny', areas: ['q_living'], sections: [] }],
              favorites: ['lock.q_front'],
              appearance: { tiles: { radius: 8 }, status: { shown: false } },
              shortcuts: [{ kind: 'overview', name: 'Mój status', sections: [{ title: 'Uwaga', alert: true,
                items: [{ name: 'Woda!', auto: 'alarm', classes: ['moisture'], alarm: true, notify: true }] }] }] };
        const answers = { ...q.defaultAnswers(hass, own), theme: 'apple_home' };
        const once = q.withQuickStart(hass, own, answers);
        const twice = q.withQuickStart(hass, once, q.defaultAnswers(hass, once));
        return { once, twice };""",
    )
    once = result["once"]
    assert [room["id"] for room in once["layout"]] == ["living", "q_bath"]
    assert once["favorites"] == ["lock.q_front", "alarm_control_panel.q_home", "climate.q_thermostat"]
    names = [item["name"] for item in items(once)]
    # The leak item of its own stays and is not made twice
    assert names[0] == "Woda!" and "Wyciek wody" not in names
    assert once["shortcuts"][0]["name"] == "Mój status" and len(once["shortcuts"]) == 1
    # What the person chose wins over the theme; the theme fills the rest
    assert once["appearance"]["tiles"]["radius"] == 8 and once["appearance"]["tiles"]["opacity"] == 26
    assert once["appearance"]["status"]["shown"] is False
    twice = result["twice"]
    assert len(items(twice)) == len(items(once))
    assert twice["favorites"] == once["favorites"] and twice["scenes"] == once["scenes"]
    assert len(twice["layout"]) == len(once["layout"])


# Where it is offered --------------------------------------------------------------------------------------------


def test_an_empty_dashboard_offers_the_quick_start(desktop):  # noqa: F811
    open_editor(desktop, STRATEGY)
    desktop.locator(f"{APP} [data-quick-start]").click()
    desktop.wait_for_selector(f"{DIALOG} [data-quick-dialog]")


def test_without_areas_it_says_how_to_add_them(desktop):  # noqa: F811
    desktop.evaluate(
        "() => { const s = window.editor.snapshot; for (const id of Object.keys(s.areas)) delete s.areas[id]; }"
    )
    open_quick(desktop)
    desktop.locator(f"{DIALOG} [data-quick-step='rooms']").click()
    assert "Ustawienia → Obszary" in desktop.locator(f"{DIALOG} [data-quick-no-areas]").inner_text()


def test_the_quick_start_speaks_english_too(desktop):  # noqa: F811
    open_quick(desktop, language="en")
    assert desktop.locator(f"{DIALOG} h2").inner_text() == "Quick start"
    assert desktop.locator(f"{DIALOG} [data-quick-progress]").inner_text() == "Step 1 of 6"
