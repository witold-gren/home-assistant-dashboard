"""A server's plug in the window of servers: what it draws, its day, its history; opened alone from its room tile."""

from __future__ import annotations

from .test_panels import add_entity, room_with
from .test_shortcuts import HOST_COLUMNS

SHEET = "home-dashboard-sheet"
HOST = "home-dashboard-host"
POWER = {
    "entity": "sensor.plug_power",
    "voltage": "sensor.plug_voltage",
    "current": "sensor.plug_current",
    "energy": "sensor.plug_energy",
    "switch": "switch.plug",
}
SERVER = {**HOST_COLUMNS["columns"][0], "graph": None, "power": POWER}
OTHER = {**SERVER, "title": "Jetson", "power": None}
BLOCK = {**HOST_COLUMNS, "columns": [SERVER, OTHER]}

# Today's energy in two rows; the power over the day as a history.
ANSWERS = """async (message) => {
    window.asked = [...(window.asked ?? []), message];
    if (message.type === 'frontend/get_user_data') return null;
    if (message.type === 'recorder/statistics_during_period') {
        return { 'sensor.plug_energy': [{ start: Date.now(), change: 0.25 }, { start: Date.now(), change: 0.2 }] };
    }
    if (message.type === 'history/history_during_period') {
        const now = Date.now() / 1000;
        return { 'sensor.plug_power': [{ s: '20', lu: now - 3600 }, { s: '24', lu: now - 60 }] };
    }
    return null;
}"""

MOUNT = """async ({ dashboard, answers }) => {
    window.hass = window.dashboard.hass({ callWS: eval(answers) });
    window.card = await window.dashboard.mount(window.hass, dashboard, 'home');
}"""


def setup(page, tile: dict) -> None:
    add_entity(page, "sensor.cpu", "3", {"unit_of_measurement": "%"})
    add_entity(page, "sensor.plug_power", "24", {"unit_of_measurement": "W"})
    add_entity(page, "sensor.plug_voltage", "231.4", {"unit_of_measurement": "V"})
    add_entity(page, "sensor.plug_current", "0.12", {"unit_of_measurement": "A"})
    add_entity(page, "sensor.plug_energy", "123.45", {"unit_of_measurement": "kWh"})
    add_entity(page, "switch.plug", "on")
    page.evaluate(MOUNT, {"dashboard": {"shortcuts": [BLOCK], **room_with(tile)}, "answers": ANSWERS})
    page.wait_for_function("document.querySelector('home-dashboard-chrome') !== null")


def open_nuc(page) -> None:
    setup(page, {"shortcut": "Host", "column": "Serwer", "entity": "sensor.plug_power", "name": "Intel NUC"})
    page.locator("home-dashboard-page [data-entity='sensor.plug_power']").first.click()
    page.wait_for_selector(f"{SHEET} {HOST} [data-power]")


def test_the_room_tile_shows_the_power_and_opens_its_machine_alone(phone):
    open_nuc(phone)
    assert phone.locator(f"{SHEET} .panel").get_attribute("data-kind") == "host"
    assert "Intel NUC" in phone.locator(f"{SHEET} header h2").inner_text()
    assert phone.locator(f"{SHEET} {HOST} [data-column]").evaluate_all("(items) => items.map((item) => item.dataset.column)") == ["Serwer"]


def test_the_plug_tells_what_it_draws_today_and_in_total(phone):
    open_nuc(phone)
    power = phone.locator(f"{SHEET} {HOST} [data-power]")
    assert power.locator("[data-watts]").inner_text().replace("\n", "") == "24,0W"
    assert power.locator("[data-plug]").inner_text() == "Gniazdko włączone"
    phone.wait_for_function("""() => document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')
        .shadowRoot.querySelector('home-dashboard-host').shadowRoot.querySelector('.power-facts').innerText.includes('0,45 kWh')""")
    facts = power.locator(".power-facts").inner_text()
    for text in ("Napięcie", "231 V", "Natężenie", "0,12 A", "Dziś", "0,45 kWh", "Łącznie", "123,5 kWh"):
        assert text in facts


def test_the_power_is_drawn_from_its_history_and_nothing_is_switched(phone):
    open_nuc(phone)
    phone.wait_for_selector(f"{SHEET} {HOST} home-dashboard-history-chart >> svg")
    asked = [message for message in phone.evaluate("window.asked") if message["type"] == "history/history_during_period"]
    assert asked[-1]["entity_ids"] == ["sensor.plug_power"]
    assert phone.evaluate("window.hass.calls") == []
    assert phone.locator(f"{SHEET} {HOST} [data-power] button[role='switch']").count() == 0


def test_a_new_state_does_not_load_the_history_again(phone):
    open_nuc(phone)
    phone.wait_for_selector(f"{SHEET} {HOST} home-dashboard-history-chart >> svg")
    count = phone.evaluate("window.asked.filter((message) => message.type === 'history/history_during_period').length")
    add_entity(phone, "sensor.plug_power", "30", {"unit_of_measurement": "W"})
    phone.evaluate("""async (answers) => { const sheet = document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('home-dashboard-sheet');
        sheet.hass = window.dashboard.hass({ callWS: eval(answers) }); await sheet.updateComplete; }""", ANSWERS)
    phone.wait_for_function("""() => document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')
        .shadowRoot.querySelector('home-dashboard-host').shadowRoot.querySelector('[data-watts]').innerText.startsWith('30')""")
    assert phone.evaluate("window.asked.filter((message) => message.type === 'history/history_during_period').length") == count


def test_the_whole_window_keeps_every_machine(phone):
    setup(phone, {"shortcut": "Host", "entity": "sensor.plug_power", "name": "Serwery"})
    phone.locator("home-dashboard-page [data-entity='sensor.plug_power']").first.click()
    phone.wait_for_selector(f"{SHEET} {HOST} [data-column='Jetson']")
    assert phone.locator(f"{SHEET} {HOST} [data-power]").count() == 1


def test_on_a_tablet_one_machine_stands_on_two_columns(tablet):
    open_nuc(tablet)
    boxes = tablet.evaluate("""() => { const root = document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('home-dashboard-sheet').shadowRoot.querySelector('home-dashboard-host').shadowRoot;
        const box = (selector) => root.querySelector(selector).getBoundingClientRect().toJSON();
        return { card: box('.column > .card:first-child'), power: box('[data-power]') }; }""")
    assert boxes["power"]["left"] > boxes["card"]["right"]
    assert abs(boxes["power"]["top"] - boxes["card"]["top"]) < 2


def test_on_a_phone_one_machine_shows_its_power_first(phone):
    open_nuc(phone)
    tops = phone.evaluate("""() => { const root = document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('home-dashboard-sheet').shadowRoot.querySelector('home-dashboard-host').shadowRoot;
        return [root.querySelector('[data-power]'), root.querySelector('.column > .card:not(.power)')]
            .map((element) => element.getBoundingClientRect().top); }""")
    assert tops[0] < tops[1]


def test_energy_since_midnight_adds_up_the_rows(phone):
    total = phone.evaluate("""async () => { const { energySince } = await import('/custom_components/home_dashboard/www/app/host.js');
        return energySince({ a: [{ change: 0.5 }, { change: 0.25 }], b: [] }, ['a', 'b', 'c']); }""")
    assert total == {"a": 0.75, "b": 0, "c": 0}
