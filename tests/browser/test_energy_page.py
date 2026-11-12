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


def mount_energy(page, dashboard: dict | None = None) -> None:
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
    page.evaluate("async (dashboard) => { window.card = await window.dashboard.mount(window.dashboard.hass(), dashboard, 'energy'); }",
                  dashboard or {})
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


# The meter and its phases ------------------------------------------------------------------------
METER = """(arg) => {
    const snapshot = window.dashboard.snapshot;
    const add = (id, state, attributes) => {
        snapshot.entities[id] = { entity_id: id, device_id: 'meter', platform: 'supla', hidden: false };
        snapshot.states[id] = { entity_id: id, state, attributes };
    };
    add('sensor.phase_1', '100', { unit_of_measurement: 'kWh', device_class: 'energy' });
    for (const [n, power, volts, amps] of [[1, '29.1', '238.4', '0.31'], [2, '31.7', String(arg.volts2), '0.26'], [3, '157.3', '239.3', '1.06']]) {
        add(`sensor.meter_faza_${n}_moc_czynna`, power, { unit_of_measurement: 'W', device_class: 'power' });
        add(`sensor.meter_faza_${n}_moc_bierna`, '-50', { unit_of_measurement: 'var' });
        add(`sensor.meter_faza_${n}_napiecie`, volts, { unit_of_measurement: 'V', device_class: 'voltage' });
        add(`sensor.meter_faza_${n}_natezenie_pradu`, amps, { unit_of_measurement: 'A', device_class: 'current' });
        add(`sensor.meter_faza_${n}_wspolczynnik_mocy`, '38.9', { unit_of_measurement: '%', device_class: 'power_factor' });
        add(`sensor.meter_faza_${n}_czestotliwosc_pradu`, '49.95', { unit_of_measurement: 'Hz' });
    }
}"""


def test_the_phases_are_found_on_the_device_of_the_meter(phone):
    phone.evaluate(METER, {"volts2": 239})
    found = run(phone, "return e.meterPhases(window.dashboard.hass(), 'sensor.phase_1');")
    assert [phase["phase"] for phase in found["phases"]] == [1, 2, 3]
    assert found["phases"][0] == {"phase": 1, "power": "sensor.meter_faza_1_moc_czynna", "voltage": "sensor.meter_faza_1_napiecie",
                                  "current": "sensor.meter_faza_1_natezenie_pradu", "factor": "sensor.meter_faza_1_wspolczynnik_mocy"}
    assert found["frequency"].endswith("_czestotliwosc_pradu")
    chosen = run(phone, "return e.meterPhases(window.dashboard.hass(), 'sensor.phase_1', [{ power: 'sensor.a' }]);")
    assert chosen == {"phases": [{"phase": 1, "power": "sensor.a"}], "frequency": None}
    assert run(phone, "return e.meterPhases(window.dashboard.hass(), 'sensor.nothing');") == {"phases": [], "frequency": None}


def test_a_voltage_is_within_near_an_end_or_out(phone):
    states = run(phone, "return [239, 210, 250, 200, 260, NaN].map((v) => e.voltageState(v));")
    assert states == ["ok", "edge", "edge", "out", "out", None]


def test_a_period_is_weighed_against_the_one_before_up_to_the_same_slot(phone):
    result = run(phone, "return [e.comparedWith([1, 2, 0], [1, 1, 5], 1), e.comparedWith([1, 2, 0], [1, 1, 5]), e.comparedWith([1], [0])];")
    assert result == [0.5, -0.5714285714285714, None]


def mount_wide(page, volts2=239) -> None:
    page.evaluate(METER, {"volts2": volts2})
    mount_energy(page)


def energy(page, selector: str):
    return page.locator(f"home-dashboard-energy {selector}")


def test_a_tablet_on_its_side_has_the_numbers_in_a_row_and_the_chart_beside_the_phases(tablet):
    mount_wide(tablet)
    tablet.wait_for_selector("home-dashboard-energy [data-energy-phase='3']")
    assert energy(tablet, "[data-energy-layout]").get_attribute("data-energy-layout") == "wide"
    tiles = energy(tablet, ".tiles .tile").evaluate_all("(tiles) => tiles.map((tile) => tile.dataset.energyTile)")
    assert tiles[:4] == ["energy_now", "energy_used", "energy_cost", "energy_measured"]
    top = {round(energy(tablet, f".tiles .tile >> nth={index}").bounding_box()["y"]) for index in range(4)}
    assert len(top) == 1
    chart = energy(tablet, "[data-energy-chart]").bounding_box()
    phases = energy(tablet, "[data-energy-phases]").bounding_box()
    assert phases["x"] > chart["x"] + chart["width"] - 1 and abs(phases["y"] - chart["y"]) <= 1
    now = energy(tablet, "[data-energy-tile='energy_now']").inner_text()
    assert "218 W" in now and "3 fazy" in now and "49,95 Hz" in now
    # The devices are tiles, with the rest the meter counted that no device did.
    assert energy(tablet, ".device-tile").count() >= 2
    assert energy(tablet, "[data-energy-device='untracked']").count() == 1


def test_each_phase_shows_its_voltage_on_the_range_of_the_grid(tablet):
    mount_wide(tablet, volts2=209)
    tablet.wait_for_selector("home-dashboard-energy [data-energy-phase='2']")
    assert energy(tablet, "[data-energy-phase='1'] [data-energy-voltage]").get_attribute("data-energy-voltage") == "ok"
    assert energy(tablet, "[data-energy-phase='2'] [data-energy-voltage]").get_attribute("data-energy-voltage") == "edge"
    assert "209 V" in energy(tablet, "[data-energy-phase='2']").inner_text()
    energy(tablet, "[data-energy-phase='3']").click()
    chart = tablet.evaluate("document.querySelector('home-dashboard-chrome')._overlay.sheet")
    assert chart["kind"] == "chart"
    assert chart["chart"]["mode"] == "phase" and chart["chart"]["power"] == "sensor.meter_faza_3_moc_czynna"
    assert chart["chart"]["voltage"] == "sensor.meter_faza_3_napiecie" and chart["chart"]["band"] == [207, 253]


def test_the_period_before_is_asked_for_the_meters_and_shown_behind(phone):
    mount_energy(phone)
    phone.wait_for_function("window.asked.filter((m) => m.type === 'recorder/statistics_during_period').length >= 2")
    asks = phone.evaluate("window.asked.filter((m) => m.type === 'recorder/statistics_during_period')")
    earlier = min(asks, key=lambda ask: ask["start_time"])
    assert earlier["statistic_ids"] == ["sensor.phase_1", "sensor.phase_2"]
    phone.wait_for_selector("home-dashboard-energy [data-energy-before]", state="attached")
    assert energy(phone, "[data-energy-layout]").get_attribute("data-energy-layout") == "narrow"


def test_on_a_tablet_the_chart_is_as_tall_as_the_phases(tablet):
    # A wide one: the chart would grow with its width.
    tablet.set_viewport_size({"width": 1600, "height": 1024})
    mount_wide(tablet)
    tablet.wait_for_selector("home-dashboard-energy [data-energy-phase='3']")
    chart = energy(tablet, "[data-energy-chart]").bounding_box()
    phases = energy(tablet, "[data-energy-phases]").bounding_box()
    assert abs(chart["height"] - phases["height"]) <= 1



# The chart window -------------------------------------------------------------------------------------
CHART = "/custom_components/home_dashboard/www/app/history-chart.js"
SHEET = "home-dashboard-sheet"


def chart_fn(page, body: str):
    return page.evaluate(f"async () => {{ const c = await import('{CHART}'); {body} }}")


def test_the_chart_reads_its_numbers(phone):
    result = chart_fn(phone, """return [c.spread([1, 2, NaN, 3]), c.spread([]), c.axisBounds([200, 210]),
        c.axisBounds([239, 240], [207, 253]), c.slotAt(50, 100, 4), c.slotAt(-5, 100, 4), c.slotAt(500, 100, 4)];""")
    assert result[0] == {"min": 1, "mean": 2, "max": 3}
    assert result[1] is None
    assert [round(value, 1) for value in result[2]] == [199.2, 210.8]
    assert result[3][0] < 207 and result[3][1] > 253
    assert result[4:] == [2, 0, 3]


def open_chart(page, chart: dict) -> None:
    page.evaluate("""(chart) => {
        const original = window.dashboard.hass;
        window.asked = [];
        window.dashboard.hass = (overrides) => original({ ...overrides, callWS: async (message) => {
            window.asked.push(message);
            const now = Date.now();
            if (message.type === 'history/history_during_period')
                return Object.fromEntries(message.entity_ids.map((id, n) => [id,
                    Array.from({ length: 30 }, (_, i) => ({ s: String(id.includes('volt') ? 236 + (i % 5) : 100 + n * 50 + i), lu: (now - (30 - i) * 600000) / 1000 }))]));
            if (message.type === 'recorder/statistics_during_period')
                return { [message.statistic_ids[0]]: Array.from({ length: 24 }, (_, i) => ({ start: now - (24 - i) * 3600000, change: i === 9 ? 1.5 : 0.2 })) };
            return null;
        } });
        window.dashboard.snapshot.states['sensor.l1_power'] = { entity_id: 'sensor.l1_power', state: '150', attributes: { unit_of_measurement: 'W' } };
        window.dashboard.snapshot.states['sensor.l1_volt'] = { entity_id: 'sensor.l1_volt', state: '239', attributes: { unit_of_measurement: 'V' } };
    }""", chart)
    page.evaluate("async () => { window.card = await window.dashboard.mount(window.dashboard.hass(), {}, 'home'); }")
    page.wait_for_function("document.querySelector('home-dashboard-chrome') !== null")
    page.evaluate("(chart) => document.querySelector('home-dashboard-chrome').open({ type: 'sheet', sheet: { kind: 'chart', chart } })", chart)
    page.wait_for_selector(f"{SHEET} home-dashboard-history-chart [data-chart-plot]")


def test_a_phase_shows_its_power_and_its_voltage_in_its_range(tablet):
    open_chart(tablet, {"title": "Faza L1", "mode": "phase", "power": "sensor.l1_power", "voltage": "sensor.l1_volt", "band": [207, 253]})
    plots = tablet.locator(f"{SHEET} [data-chart-plot]").evaluate_all("(plots) => plots.map((plot) => plot.dataset.chartPlot)")
    assert plots == ["W", "V"]
    assert tablet.locator(f"{SHEET} [data-chart-plot='V'] .band").count() == 1
    # The voltage keeps the colour it has above, in the numbers now.
    assert "126, 226, 168" in tablet.locator(f"{SHEET} [data-chart-plot='V'] .line").evaluate("(line) => getComputedStyle(line).stroke")
    now = tablet.locator(f"{SHEET} [data-chart-now]").inner_text()
    assert "150 W" in now and "239 V" in now
    assert tablet.locator(f"{SHEET} [data-chart-facts]").count() == 2
    # The window is wider on a tablet, centred.
    assert tablet.locator(f"{SHEET} .panel").bounding_box()["width"] == 760


def test_a_finger_on_the_chart_shows_the_value_there_and_the_range_changes(tablet):
    open_chart(tablet, {"title": "Teraz", "mode": "lines", "lines": [{"id": "sensor.l1_power", "name": "L1", "unit": "W"}]})
    plot = tablet.locator(f"{SHEET} [data-chart-plot] svg").bounding_box()
    tablet.mouse.move(plot["x"] + plot["width"] * 0.98, plot["y"] + plot["height"] / 2)
    tip = tablet.locator(f"{SHEET} [data-chart-tip]")
    assert tip.count() == 1 and " W" in tip.inner_text()
    asked = len(tablet.evaluate("window.asked.filter((m) => m.type === 'history/history_during_period')"))
    tablet.locator(f"{SHEET} [data-chart-range='7d']").click()
    tablet.wait_for_function(f"window.asked.filter((m) => m.type === 'history/history_during_period').length > {asked}")
    last = tablet.evaluate("window.asked.filter((m) => m.type === 'history/history_during_period').at(-1)")
    span = (__import__("datetime").datetime.fromisoformat(last["end_time"].replace("Z", "+00:00"))
            - __import__("datetime").datetime.fromisoformat(last["start_time"].replace("Z", "+00:00")))
    assert round(span.total_seconds() / 3600) == 168


def test_a_device_shows_its_energy_as_bars_with_its_total(tablet):
    open_chart(tablet, {"title": "Zmywarka", "mode": "bars", "energy": "sensor.dishwasher"})
    assert tablet.locator(f"{SHEET} [data-chart-bar]").count() == 24
    asked = tablet.evaluate("window.asked.filter((m) => m.type === 'recorder/statistics_during_period').at(-1)")
    assert asked["statistic_ids"] == ["sensor.dishwasher"] and asked["period"] == "hour"
    facts = tablet.locator(f"{SHEET} [data-chart-facts]").inner_text()
    assert "6,1 kWh" in facts and "1,5 kWh" in facts


# An energy store ---------------------------------------------------------------------------------
STORE = {"block": "EcoFlow", "name": "Delta", "battery": "sensor.store_battery", "state": "sensor.store_state",
         "labels": {"charging": "Ładuje się"}, "input": "sensor.store_in", "output": "sensor.store_out",
         "remaining": "sensor.store_left"}
STORE_BLOCK = {"kind": "panel", "name": "EcoFlow", "entity": "sensor.store_state",
               "groups": [{"title": "A", "rows": [{"entity": "sensor.store_in"}]}, {"title": "B", "rows": []}]}


def add_store(page) -> None:
    page.evaluate("""() => { const snapshot = window.dashboard.snapshot;
        const add = (id, state, unit) => { snapshot.states[id] = { entity_id: id, state, attributes: unit ? { unit_of_measurement: unit } : {} }; };
        add('sensor.store_battery', '76', '%'); add('sensor.store_state', 'charging');
        add('sensor.store_in', '410', 'W'); add('sensor.store_out', '35', 'W'); add('sensor.store_left', '95', 'min'); }""")


def store_dashboard() -> dict:
    return {"energy": {"storage": [STORE]},
            "layout": [{"id": "g", "name": "Garaż", "areas": [], "home": [], "sections": [{"title": "X", "tiles": [STORE_BLOCK]}]}]}


def test_an_energy_store_shows_its_charge_power_and_time(phone):
    add_store(phone)
    mount_energy(phone, store_dashboard())
    card = energy(phone, "[data-energy-store='Delta']")
    text = card.inner_text()
    for expected in ("Delta", "Ładuje się", "76%", "410 W", "35 W", "1 h 35 min"):
        assert expected in text


def test_a_tap_on_the_store_opens_the_window_of_its_block(phone):
    add_store(phone)
    mount_energy(phone, store_dashboard())
    energy(phone, "[data-energy-store='Delta']").click()
    phone.wait_for_selector("home-dashboard-sheet section.panel[data-kind='panel']")
    assert "EcoFlow" in phone.locator("home-dashboard-sheet header").first.inner_text()


def test_without_storage_the_page_has_no_store(phone):
    mount_energy(phone)
    assert energy(phone, "[data-energy-storage]").count() == 0


def test_a_finger_on_the_chart_reads_the_value_of_that_hour(phone):
    mount_energy(phone)
    plot = energy(phone, "[data-energy-plot]")
    box = plot.bounding_box()
    # The first hour of the day: 1.25 kWh in the statistics of the test.
    phone.mouse.move(box["x"] + 2, box["y"] + box["height"] / 2)
    readout = energy(phone, "[data-energy-readout]").inner_text()
    assert "00:00" in readout and "1,25 kWh" in readout
    assert energy(phone, ".level").count() == 2


def test_a_store_that_is_away_says_so_instead_of_zeros(phone):
    add_store(phone)
    phone.evaluate("() => { window.dashboard.snapshot.states['sensor.store_battery'].state = 'unknown'; }")
    mount_energy(phone, store_dashboard())
    text = energy(phone, "[data-energy-store='Delta']").inner_text()
    assert "Brak połączenia" in text
    assert "Wejście" not in text
