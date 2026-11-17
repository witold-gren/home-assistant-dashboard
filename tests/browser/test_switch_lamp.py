"""A switch that powers a lamp (a relay behind a wall lamp or a sconce) is a light: its tile is yellow while on, it
is counted and filtered with the lights, and the status bar says "lights" rather than "devices". Its lamp icon
says so, or `entities.overrides.<id>.light` either way."""

from __future__ import annotations

MODULE = "/custom_components/home_dashboard/www/app/model.js"
STATUS = "/custom_components/home_dashboard/www/app/status-panel.js"


def run(page, body: str):
    return page.evaluate(f"""async () => {{
        const m = await import('{MODULE}');
        const st = await import('{STATUS}');
        const hass = {{ language: 'pl', states: {{
            'switch.sconce': {{ state: 'on', attributes: {{ friendly_name: 'Kinkieta', icon: 'mdi:outdoor-lamp' }} }},
            'switch.coach': {{ state: 'off', attributes: {{ friendly_name: 'Kinkiety', icon: 'mdi:coach-lamp' }} }},
            'switch.tv': {{ state: 'on', attributes: {{ friendly_name: 'Telewizor', icon: 'mdi:television' }} }},
            'switch.clamp': {{ state: 'on', attributes: {{ friendly_name: 'Zacisk', icon: 'mdi:clamp' }} }},
            'switch.plain': {{ state: 'on', attributes: {{ friendly_name: 'Gniazdko' }} }},
            'light.ceiling': {{ state: 'on', attributes: {{ friendly_name: 'Sufit' }} }},
            'sensor.lamp': {{ state: '1', attributes: {{ icon: 'mdi:lamp' }} }} }} }};
        {body}
    }}""")


def test_a_switch_with_a_lamp_icon_is_a_light_and_others_are_not(phone):
    found = run(
        phone,
        """
        const ids = ['switch.sconce', 'switch.coach', 'switch.tv', 'switch.clamp', 'switch.plain', 'light.ceiling', 'sensor.lamp'];
        return ids.map((id) => m.isLight(hass, id, {}));""",
    )
    assert found == [True, True, False, False, False, True, False]


def test_an_override_says_it_either_way_and_an_own_icon_counts(phone):
    found = run(
        phone,
        """
        const config = { entities: { overrides: { 'switch.plain': { light: true }, 'switch.sconce': { light: false },
                                                  'switch.tv': { icon: 'mdi:wall-sconce-round' } } } };
        const look = { appearance: { icons: { 'switch.clamp': 'mdi:floor-lamp' } } };
        return [m.isLight(hass, 'switch.plain', config), m.isLight(hass, 'switch.sconce', config),
                m.isLight(hass, 'switch.tv', config), m.isLight(hass, 'switch.clamp', look)];""",
    )
    assert found == [True, False, True, True]


def test_the_status_bar_counts_a_lamp_switch_with_the_lights(phone):
    facts = run(
        phone,
        """
        const selection = { entityIds: ['light.ceiling', 'switch.sconce', 'switch.tv'] };
        return st.statusHome(hass, selection, {}).map((f) => [f.key, f.count, f.ids]);""",
    )
    assert facts == [["lights", 2, ["light.ceiling", "switch.sconce"]], ["devices", 1, ["switch.tv"]]]


def test_the_tile_of_a_lamp_switch_is_yellow_while_on(phone):
    tones = phone.evaluate("""() => {
        const { model, hass: createHass } = window.dashboard;
        const hass = createHass();
        const config = model.normalizeConfig({});
        const id = Object.keys(hass.entities).find((key) => key.startsWith('switch.') && model.isPrimary(hass.entities[key]));
        const tone = (state, icon) => model.buildTile(window.dashboard.withState(hass, id, { state, attributes: { icon } }), id, null, config);
        const on = tone('on', 'mdi:outdoor-lamp');
        return [on.tone, on.light, tone('off', 'mdi:outdoor-lamp').tone, tone('on', 'mdi:power-socket-eu').tone]; }""")
    assert tones == ["light", True, "off", "appliance"]
