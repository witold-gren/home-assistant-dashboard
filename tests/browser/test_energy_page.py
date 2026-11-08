"""The Energy page drawn by the dashboard: the settings and statistics of Home Assistant, in its look."""

from __future__ import annotations

ENERGY = "/custom_components/home_dashboard/www/app/energy.js"

NEW_PREFS = {
    "energy_sources": [
        {"type": "grid", "stat_energy_from": "sensor.phase_1", "stat_cost": None, "stat_energy_to": None},
        {"type": "grid", "stat_energy_from": "sensor.phase_2", "stat_cost": None, "stat_energy_to": "sensor.export"},
        {"type": "solar", "stat_energy_from": "sensor.solar"},
    ],
    "device_consumption": [{"stat_consumption": "sensor.fridge", "name": "Lodówka"}, {"stat_consumption": "sensor.tv"}],
}
INFO = {"cost_sensors": {"sensor.phase_1": "sensor.phase_1_cost", "sensor.phase_2": "sensor.phase_2_cost"}}


def run(page, body: str, arg=None):
    return page.evaluate(f"async (arg) => {{ const e = await import('{ENERGY}'); {body} }}", arg)


def test_both_shapes_of_the_settings_are_read(phone):
    new = run(phone, "return e.energyPlan(arg.prefs, arg.info);", {"prefs": NEW_PREFS, "info": INFO})
    assert new["grid"] == [{"from": "sensor.phase_1", "cost": "sensor.phase_1_cost"},
                           {"from": "sensor.phase_2", "cost": "sensor.phase_2_cost"}, {"to": "sensor.export"}]
    assert new["solar"] == ["sensor.solar"]
    assert new["devices"] == [{"id": "sensor.fridge", "name": "Lodówka"}, {"id": "sensor.tv", "name": None}]
    old = run(phone, """return e.energyPlan({ energy_sources: [{ type: 'grid',
        flow_from: [{ stat_energy_from: 'sensor.a', stat_cost: 'sensor.a_cost' }], flow_to: [{ stat_energy_to: 'sensor.b' }] }] });""")
    assert old["grid"] == [{"from": "sensor.a", "cost": "sensor.a_cost"}, {"to": "sensor.b"}]


def test_a_period_has_hours_or_days(phone):
    ranges = run(phone, """const now = new Date(2026, 10, 8, 15, 30);
        return ['day', 'week', 'month'].map((kind) => { const r = e.periodRange(kind, 0, now);
            return [r.start.getDate(), r.period, r.slots.length]; })
            .concat([[e.periodRange('day', -1, now).start.getDate()], [e.periodRange('month', -1, now).start.getMonth()]]);""")
    # 8 November 2026 is a Sunday, so its week starts on Monday the 2nd.
    assert ranges == [[8, "hour", 24], [2, "day", 7], [1, "day", 30], [7], [9]]


def test_the_summary_adds_up_what_the_house_used(phone):
    summary = run(phone, """const plan = e.energyPlan(arg.prefs, arg.info);
        const slots = [0, 3600000];
        const row = (start, change) => ({ start, change });
        const stats = { 'sensor.phase_1': [row(0, 1), row(3600000, 2)], 'sensor.phase_2': [row(0, 0.5)],
            'sensor.export': [row(3600000, 0.5)], 'sensor.solar': [row(3600000, 1.5)],
            'sensor.phase_1_cost': [row(0, 0.76)], 'sensor.fridge': [row(0, 0.2)], 'sensor.tv': [row(0, 0.4)] };
        return e.energySummary(plan, stats, slots);""", {"prefs": NEW_PREFS, "info": INFO})
    assert summary["grid"] == 3.5
    assert summary["exported"] == 0.5
    assert summary["used"] == 4.5
    assert summary["cost"] == 0.76
    assert summary["bars"] == {"grid": [1.5, 2], "solar": [0, 1]}
    assert [device["id"] for device in summary["devices"]] == ["sensor.tv", "sensor.fridge"]


def mount_energy(page) -> None:
    page.evaluate("""(arg) => {
        const original = window.dashboard.hass;
        window.asked = [];
        window.dashboard.hass = (overrides) => original({ ...overrides, callWS: async (message) => {
            window.asked.push(message);
            if (message.type === 'energy/get_prefs') return arg.prefs;
            if (message.type === 'energy/info') return arg.info;
            if (message.type === 'recorder/statistics_during_period') {
                const start = Date.parse(message.start_time);
                return { 'sensor.phase_1': [{ start, change: 1.25 }], 'sensor.phase_1_cost': [{ start, change: 0.95 }],
                         'sensor.fridge': [{ start, change: 0.3 }] };
            }
            return null;
        } });
    }""", {"prefs": NEW_PREFS, "info": INFO})
    page.evaluate("async () => { window.card = await window.dashboard.mount(window.dashboard.hass(), {}, 'energy'); }")
    page.wait_for_selector("home-dashboard-energy [data-energy-tile='energy_used']")


def test_the_page_shows_the_day_with_its_cost_and_devices(phone):
    mount_energy(phone)
    phone.wait_for_function("document.querySelector('home-dashboard-page').shadowRoot.querySelector('home-dashboard-energy').shadowRoot.textContent.includes('1,25')")
    text = phone.evaluate("document.querySelector('home-dashboard-page').shadowRoot.querySelector('home-dashboard-energy').shadowRoot.textContent")
    assert "Zużycie" in text and "1,25 kWh" in text
    assert "Koszt" in text
    assert phone.locator("home-dashboard-energy [data-energy-device='sensor.fridge']").count() == 1
    asked = phone.evaluate("window.asked.find((m) => m.type === 'recorder/statistics_during_period')")
    assert asked["period"] == "hour"
    assert "sensor.phase_1_cost" in asked["statistic_ids"]


def test_another_period_and_an_earlier_one_are_loaded(phone):
    mount_energy(phone)
    phone.locator("home-dashboard-energy [data-energy-period='month']").click()
    phone.wait_for_function("window.asked.filter((m) => m.type === 'recorder/statistics_during_period').at(-1).period === 'day'")
    assert phone.locator("home-dashboard-energy [data-energy-later]").is_disabled()
    phone.locator("home-dashboard-energy [data-energy-earlier]").click()
    phone.wait_for_function("window.asked.filter((m) => m.type === 'recorder/statistics_during_period').length >= 3")
    assert not phone.locator("home-dashboard-energy [data-energy-later]").is_disabled()


def test_the_player_stays_off_the_map_and_energy(phone):
    result = phone.evaluate("""() => {
        const chrome = window.dashboard.chrome;
        return ['home', 'map', 'energy', 'music'].map((page) => {
            const element = document.createElement('home-dashboard-chrome');
            element._playerId = 'media_player.x';
            element.page = page;
            return element._showsPlayer;
        });
    }""")
    assert result == [True, False, False, False]
