"""What keeps a tab with the dashboard or the editor light when it stays open all day.

Home Assistant hands a new hass on every change of a state in the house, many times a second where power is metered:
the page takes one at most every HASS_TIMING.shown ms (the first at once, the last always), a hidden tab far less often
and the newest when it is shown again; the editor is drawn for states alone at most every EDITOR_TIMING.states ms.
A frame of the preview loaded again leaves nothing behind in the editor, and a hidden tab streams no camera.
The other tests set these times to 0 (tests/js/*harness.html).
"""

from __future__ import annotations

from .test_camera_cards import SHEET, live_cards, open_featured
from .test_editor_app import APP, desktop, open_editor  # noqa: F401
from .test_editor_preview import frame, open_preview

PAGE = "/custom_components/home_dashboard/www/app/page.js"
EDITOR = "/custom_components/home_dashboard/www/editor/editor-app.js"

# Hides or shows the tab, as the browser does when another tab is chosen.
SET_HIDDEN = """(hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
}"""
WAIT = "(ms) => new Promise((resolve) => setTimeout(resolve, ms))"


def test_a_burst_of_hass_is_taken_at_once_and_its_last_one_soon_after(phone):
    taken = phone.evaluate(f"""async () => {{
        const {{ HASS_TIMING }} = await import('{PAGE}');
        const wait = {WAIT};
        HASS_TIMING.shown = 400;
        try {{
            const d = window.dashboard;
            const card = await d.mount(d.hass());
            const second = d.hass();
            const third = d.hass();
            card.hass = second;
            card.hass = third;
            const early = card.hass === second || card.hass === third;
            await wait(700);
            return {{ early, late: card.hass === third }};
        }} finally {{
            HASS_TIMING.shown = 0;
        }}
    }}""")
    assert taken == {"early": False, "late": True}


def test_a_hidden_tab_takes_the_newest_hass_when_shown_again(phone):
    taken = phone.evaluate(f"""async () => {{
        const {{ HASS_TIMING }} = await import('{PAGE}');
        const wait = {WAIT};
        const setHidden = {SET_HIDDEN};
        Object.assign(HASS_TIMING, {{ shown: 400, hidden: 60000 }});
        try {{
            const d = window.dashboard;
            const card = await d.mount(d.hass());
            await wait(450);
            setHidden(true);
            const first = d.hass();
            card.hass = first;
            const newest = d.hass();
            card.hass = newest;
            await wait(600);
            const whileHidden = card.hass === newest;
            setHidden(false);
            return {{ whileHidden, shown: card.hass === newest }};
        }} finally {{
            Object.assign(HASS_TIMING, {{ shown: 0, hidden: 0 }});
            setHidden(false);
        }}
    }}""")
    assert taken == {"whileHidden": False, "shown": True}


def test_the_editor_is_drawn_for_a_new_entity_at_once_and_not_for_every_state(desktop):  # noqa: F811
    open_editor(desktop)
    drawn = desktop.evaluate(f"""async () => {{
        const {{ EDITOR_TIMING }} = await import('{EDITOR}');
        const app = window.editor.app;
        EDITOR_TIMING.states = 60000;
        try {{
            await app.updateComplete;
            const before = app._drawnAt;
            await new Promise((resolve) => setTimeout(resolve, 20));
            app.hass = {{ ...app.hass, states: {{ ...app.hass.states }} }};
            await app.updateComplete;
            const forStates = app._drawnAt !== before;
            app.hass = {{ ...app.hass, entities: {{ ...app.hass.entities }} }};
            await app.updateComplete;
            return {{ forStates, forEntities: app._drawnAt !== before, waiting: Boolean(app._statesTimer) }};
        }} finally {{
            EDITOR_TIMING.states = 0;
        }}
    }}""")
    assert drawn == {"forStates": False, "forEntities": True, "waiting": False}


def test_frames_loaded_again_leave_no_listeners_in_the_editor(desktop):  # noqa: F811
    open_preview(desktop)
    frame(desktop, "phone")
    frame(desktop, "tablet")
    count = "() => [window.editor.app._source.listeners.size, window.editor.app._source.commands.size]"
    before = desktop.evaluate(count)
    for color in ("dark", "light", "dark"):
        desktop.locator(f"{APP} [data-color='{color}']").click()
        frame(desktop, "phone")
        frame(desktop, "tablet")
    assert before[0] > 0
    assert desktop.evaluate(count) == before


def test_a_hidden_tab_streams_no_camera_and_the_wall_plays_again_when_shown(tablet):
    open_featured(tablet)
    tablet.wait_for_function("window.createdCards.some((card) => card.camera_view === 'live')")
    started = len(live_cards(tablet))
    sheet = f"document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('{SHEET}')"
    tablet.evaluate(f"({SET_HIDDEN})(true)")
    assert tablet.evaluate(f"{sheet}._wallLive") is None
    assert tablet.locator(f"{SHEET} [data-wall-live] > [data-card]").count() == 0
    tablet.evaluate(f"({SET_HIDDEN})(false)")
    tablet.wait_for_function(
        f"window.createdCards.filter((card) => card.camera_view === 'live').length > {started}"
    )
    assert tablet.locator(f"{SHEET} [data-wall-live] > [data-card]").count() == 1
    tablet.evaluate("localStorage.removeItem('home-dashboard-camera-layout')")


def test_a_closed_window_closes_its_sound(tablet):
    open_featured(tablet)
    closed = tablet.evaluate(f"""() => {{
        const sheet = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('{SHEET}');
        let closed = false;
        sheet._soundMixer = {{ close: () => {{ closed = true; }} }};
        sheet.remove();
        return [closed, sheet._soundMixer];
    }}""")
    assert closed == [True, None]
    tablet.evaluate("localStorage.removeItem('home-dashboard-camera-layout')")


def test_the_entities_of_a_device_are_listed_once_per_registry(phone):
    found = phone.evaluate("""() => {
        const { model } = window.dashboard;
        const entities = {
            'camera.door': { entity_id: 'camera.door', device_id: 'd1' },
            'sensor.door_battery': { entity_id: 'sensor.door_battery', device_id: 'd1' },
            'light.hall': { entity_id: 'light.hall', device_id: 'd2' },
            'sensor.loose': { entity_id: 'sensor.loose' },
        };
        const hass = { entities, states: {} };
        const first = model.entitiesOfDevice(hass, 'd1');
        const again = model.entitiesOfDevice({ ...hass, states: { x: 1 } }, 'd1');
        const changed = { ...entities, 'binary_sensor.door_streaming': { entity_id: 'binary_sensor.door_streaming', device_id: 'd1' } };
        return {
            first, same: first === again, none: model.entitiesOfDevice(hass, 'd9'), missing: model.entitiesOfDevice(hass, null),
            changed: model.entitiesOfDevice({ entities: changed, states: {} }, 'd1'),
        };
    }""")
    assert found == {
        "first": ["camera.door", "sensor.door_battery"],
        "same": True,
        "none": [],
        "missing": [],
        "changed": ["camera.door", "sensor.door_battery", "binary_sensor.door_streaming"],
    }
