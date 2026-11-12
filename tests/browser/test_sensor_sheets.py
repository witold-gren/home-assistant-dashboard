"""The dashboard's own windows of a sensor that is on or off, a list to choose from and a number."""

from __future__ import annotations

from .test_panels import add_entity, room_with

SHEET = "home-dashboard-sheet"
LEAK = "binary_sensor.leak"
DRINK = "select.drink"
DRINKS = ["none", "Espresso Coffee", "Cappuccino", "Hot Water"]

# A leak two hours ago for ten minutes, then dry; a temperature over the day.
ANSWERS = """async (message) => {
    window.asked = [...(window.asked ?? []), message];
    if (message.type === 'frontend/get_user_data') return null;
    if (message.type === 'history/history_during_period') {
        const now = Date.now() / 1000;
        if (message.entity_ids[0] === 'binary_sensor.leak') {
            return { 'binary_sensor.leak': [{ s: 'off', lu: now - 86000 }, { s: 'on', lu: now - 7200 }, { s: 'off', lu: now - 6600 }] };
        }
        return { [message.entity_ids[0]]: [{ s: '20.5', lu: now - 3600 }, { s: '21.3', lu: now - 60 }] };
    }
    return null;
}"""

MOUNT = """async ({ dashboard, answers }) => {
    window.hass = window.dashboard.hass({ callWS: eval(answers) });
    window.hass.formatEntityState = (stateObj, state) => {
        const value = state ?? stateObj.state;
        const words = { 'binary_sensor.leak': { on: 'wykryto', off: 'brak' }, 'select.drink': { Cappuccino: 'Kapuczino' } };
        return words[stateObj.entity_id]?.[value] ?? value;
    };
    window.card = await window.dashboard.mount(window.hass, dashboard, 'home');
}"""


def open_entity(page, entity_id: str) -> None:
    page.evaluate(MOUNT, {"dashboard": room_with({"entity": entity_id}), "answers": ANSWERS})
    page.wait_for_function("document.querySelector('home-dashboard-chrome') !== null")
    page.locator(f"home-dashboard-page [data-entity='{entity_id}'] .text").first.click()
    page.wait_for_selector(f"{SHEET} .panel")


def add_leak(page, state: str = "off") -> None:
    add_entity(page, LEAK, state, {"device_class": "moisture", "friendly_name": "Zalanie zlew"})
    page.evaluate("""() => { const snapshot = window.dashboard.snapshot;
        snapshot.entities['binary_sensor.leak'] = { entity_id: 'binary_sensor.leak', device_id: 'sink', platform: 'zha' };
        snapshot.entities['sensor.leak_battery'] = { entity_id: 'sensor.leak_battery', device_id: 'sink', platform: 'zha' };
        snapshot.states['sensor.leak_battery'] = { entity_id: 'sensor.leak_battery', state: '87',
            attributes: { device_class: 'battery', unit_of_measurement: '%' } }; }""")


def test_a_leak_sensor_opens_its_own_window_with_state_battery_and_history(phone):
    add_leak(phone)
    open_entity(phone, LEAK)
    assert phone.locator(f"{SHEET} .panel").get_attribute("data-kind") == "binary"
    assert phone.locator(f"{SHEET} [data-state-text]").inner_text().lower() == "brak"
    assert "Bateria 87%" in phone.locator(f"{SHEET} .info").inner_text()
    history = phone.locator(f"{SHEET} home-dashboard-state-history")
    history.locator("[data-state-row]").first.wait_for()
    assert history.locator("[data-state-row]").count() == 1
    assert "10 min" in history.locator("[data-state-row]").inner_text()
    assert history.locator("[data-state-strip] span").count() == 1
    assert "1" in history.locator("[data-state-summary]").inner_text()
    assert phone.evaluate("window.hass.calls") == []


def test_a_leak_now_is_red(phone):
    add_leak(phone, "on")
    open_entity(phone, LEAK)
    assert "security" in phone.locator(f"{SHEET} [data-state-badge]").get_attribute("class")
    assert phone.locator(f"{SHEET} home-dashboard-state-history").get_attribute("alarm") is not None


def test_the_week_asks_for_seven_days(phone):
    add_leak(phone)
    open_entity(phone, LEAK)
    phone.locator(f"{SHEET} home-dashboard-state-history [data-state-days='7']").click()
    phone.wait_for_function("window.asked.filter((message) => message.type === 'history/history_during_period').length >= 2")
    asked = [message for message in phone.evaluate("window.asked") if message["type"] == "history/history_during_period"][-1]
    days = phone.evaluate("([end, start]) => Math.round((Date.parse(end) - Date.parse(start)) / 86400000)",
                          [asked["end_time"], asked["start_time"]])
    assert days == 7


def test_the_cog_still_opens_home_assistant(phone):
    add_leak(phone)
    open_entity(phone, LEAK)
    assert phone.locator(f"{SHEET} [data-details]").is_visible()


def test_a_list_shows_every_option_named_and_picks_one(phone):
    add_entity(phone, DRINK, "none", {"options": DRINKS, "friendly_name": "Ekspres Napój"})
    open_entity(phone, DRINK)
    assert phone.locator(f"{SHEET} .panel").get_attribute("data-kind") == "select"
    labels = phone.locator(f"{SHEET} [data-choice]").all_inner_texts()
    assert [label.strip() for label in labels] == ["Brak", "Espresso Coffee", "Kapuczino", "Hot Water"]
    assert "on" in phone.locator(f"{SHEET} [data-choice='none']").get_attribute("class")
    phone.locator(f"{SHEET} [data-choice='Cappuccino']").click()
    call = [call for call in phone.evaluate("window.hass.calls") if call["type"] == "service"][-1]
    assert (call["domain"], call["service"], call["data"]) == ("select", "select_option", {"entity_id": DRINK, "option": "Cappuccino"})


def test_the_tile_of_a_list_says_none_in_words(phone):
    add_entity(phone, DRINK, "none", {"options": DRINKS})
    phone.evaluate(MOUNT, {"dashboard": room_with({"entity": DRINK, "name": "Napój"}), "answers": ANSWERS})
    phone.wait_for_function("document.querySelector('home-dashboard-chrome') !== null")
    assert "Brak" in phone.locator(f"home-dashboard-page [data-entity='{DRINK}']").first.inner_text()


def test_a_number_opens_its_value_and_chart(phone):
    add_entity(phone, "sensor.temp", "21.3", {"unit_of_measurement": "°C", "device_class": "temperature"})
    open_entity(phone, "sensor.temp")
    assert phone.locator(f"{SHEET} .panel").get_attribute("data-kind") == "sensor"
    phone.wait_for_selector(f"{SHEET} home-dashboard-history-chart >> svg")
    asked = [message for message in phone.evaluate("window.asked") if message["type"] == "history/history_during_period"]
    assert asked[-1]["entity_ids"] == ["sensor.temp"]


def test_a_sensor_without_a_number_keeps_the_window_of_home_assistant(phone):
    add_entity(phone, "sensor.status", "brewing", {})
    phone.evaluate(MOUNT, {"dashboard": room_with({"entity": "sensor.status"}), "answers": ANSWERS})
    phone.wait_for_function("document.querySelector('home-dashboard-chrome') !== null")
    phone.locator("home-dashboard-page [data-entity='sensor.status'] .text").first.click()
    phone.wait_for_timeout(300)
    assert phone.locator(f"{SHEET} .panel").count() == 0


def test_strip_segments_fit_the_range(phone):
    segments = phone.evaluate("""async () => { const { stripSegments } = await import('/custom_components/home_dashboard/www/app/state-history.js');
        return stripSegments([{ start: 50, end: 60 }, { start: -10, end: 10 }, { start: 90, end: null }, { start: 200, end: 210 }], 0, 100, 100); }""")
    assert segments == [{"left": 50, "width": 10}, {"left": 0, "width": 10}, {"left": 90, "width": 10}]


def add_plug(page, with_power: bool = True) -> None:
    add_entity(page, "switch.fridge", "on", {"friendly_name": "Lodówka"})
    page.evaluate("""(withPower) => { const snapshot = window.dashboard.snapshot;
        snapshot.entities['switch.fridge'] = { entity_id: 'switch.fridge', device_id: 'plug', platform: 'zha' };
        if (!withPower) return;
        const add = (id, state, attributes) => {
            snapshot.entities[id] = { entity_id: id, device_id: 'plug', platform: 'zha' };
            snapshot.states[id] = { entity_id: id, state, attributes };
        };
        add('sensor.fridge_power', '84.5', { device_class: 'power', unit_of_measurement: 'W' });
        add('sensor.fridge_energy', '312.456', { device_class: 'energy', unit_of_measurement: 'kWh' }); }""", with_power)


def test_a_plug_shows_its_power_and_a_line_of_it_under_the_switch(phone):
    add_plug(phone)
    open_entity(phone, "switch.fridge")
    assert phone.locator(f"{SHEET} .panel").get_attribute("data-kind") == "switch"
    power = phone.locator(f"{SHEET} [data-switch-power='sensor.fridge_power']")
    assert power.locator("[data-switch-watts]").inner_text() == "84,5 W"
    assert "312,46 kWh" in power.inner_text()
    phone.wait_for_selector(f"{SHEET} [data-switch-power] home-dashboard-history-chart >> svg")
    asked = [message for message in phone.evaluate("window.asked") if message["type"] == "history/history_during_period"]
    assert asked[-1]["entity_ids"] == ["sensor.fridge_power"]
    assert phone.locator(f"{SHEET} [data-switch-power] home-dashboard-history-chart >> .now").count() == 0
    assert "short" in phone.locator(f"{SHEET} [data-big-switch]").get_attribute("class")
    switch = phone.locator(f"{SHEET} [data-big-switch]").bounding_box()
    assert switch["y"] + switch["height"] <= power.bounding_box()["y"]


def test_a_switch_without_a_power_sensor_stays_as_it_was(phone):
    add_plug(phone, with_power=False)
    open_entity(phone, "switch.fridge")
    assert phone.locator(f"{SHEET} [data-switch-power]").count() == 0
    assert "short" not in phone.locator(f"{SHEET} [data-big-switch]").get_attribute("class")
