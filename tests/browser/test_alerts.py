"""Warnings on Home: the Status items marked `notify`, as cards that close until tomorrow and can be muted for a week."""

from __future__ import annotations

from .test_page import mount

PAGE = "home-dashboard-page"

BATTERIES = """(levels) => {
    const snapshot = window.dashboard.snapshot;
    const add = (id, state, platform, device, attributes = {}) => {
        snapshot.entities[id] = { entity_id: id, platform, device_id: device, hidden: false };
        snapshot.states[id] = { entity_id: id, state, attributes: { unit_of_measurement: '%', device_class: 'battery', ...attributes } };
    };
    add('sensor.porch_battery', levels.porch, 'eufy_sdk', 'porch', { friendly_name: 'Ganek' });
    add('sensor.porch_battery_health', '5', 'eufy_sdk', 'porch');
    snapshot.entities['camera.porch'] = { entity_id: 'camera.porch', platform: 'eufy_sdk', device_id: 'porch', hidden: false };
    add('sensor.motion_battery', '5', 'eufy_sdk', 'motion', { friendly_name: 'Czujnik ruchu' });
    add('sensor.garden_battery', levels.garden, 'neolink', 'garden', { friendly_name: 'Ogród' });
    snapshot.entities['camera.garden'] = { entity_id: 'camera.garden', platform: 'neolink', device_id: 'garden', hidden: false };
    add('sensor.door_battery', 'unavailable', 'zha', 'door', { friendly_name: 'Drzwi' });
    localStorage.removeItem('home-dashboard-alerts-dismissed');
}"""

STATUS = {"kind": "overview", "name": "Status", "icon": "mdi:check", "sections": [{"title": "Uwaga", "alert": True, "items": [
    {"name": "Kamery na baterię", "icon": "mdi:battery-alert", "auto": "battery", "platforms": ["eufy_sdk", "neolink"],
     "device_has": "camera", "below": 20, "notify": True},
    {"name": "Zigbee", "icon": "mdi:battery-alert", "auto": "battery", "platforms": ["zha"], "below": 10, "notify": True},
    {"name": "Bez powiadomienia", "icon": "mdi:battery", "auto": "battery", "platforms": ["eufy_sdk"], "below": 99},
]}]}


def open_home(page, porch="12", garden="80") -> None:
    page.evaluate(BATTERIES, {"porch": porch, "garden": garden})
    mount(page, {"shortcuts": [STATUS]})
    page.wait_for_selector(f"{PAGE} .chips", state="attached")


def cards(page) -> list:
    return page.locator(f"{PAGE} [data-alert]").evaluate_all("(cards) => cards.map((card) => card.dataset.alert)")


def test_only_notifying_items_with_something_to_say_show_on_home(phone):
    open_home(phone)
    # A sensor of the same integration without a camera, a battery's wear and an unavailable device stay out.
    assert cards(phone) == ["Status/Kamery na baterię"]
    card = phone.locator(f"{PAGE} [data-alert]")
    assert "Ganek 12%" in card.inner_text()
    assert "Czujnik" not in card.inner_text()


def test_one_device_opens_with_more_and_several_are_only_listed(phone):
    open_home(phone)
    phone.locator(f"{PAGE} [data-alert-more]").click()
    # The dashboard's own window of the sensor, not Home Assistant's.
    phone.wait_for_selector("home-dashboard-sheet .panel[data-kind='sensor']")
    phone.evaluate("() => document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')._close()")
    phone.wait_for_timeout(400)
    open_home(phone, garden="15")
    card = phone.locator(f"{PAGE} [data-alert]").last
    assert "Ganek 12%" in card.inner_text() and "Ogród 15%" in card.inner_text()
    assert card.locator("[data-alert-more]").count() == 0


def test_closed_today_it_comes_back_when_a_new_device_joins(phone):
    open_home(phone)
    phone.locator(f"{PAGE} [data-alert-close]").click()
    assert cards(phone) == []
    # The same device on the next draw: still closed.
    mount(phone, {"shortcuts": [STATUS]})
    assert cards(phone) == []
    # Another device falls below: the card is back.
    phone.evaluate("() => { window.dashboard.snapshot.states['sensor.garden_battery'].state = '9'; }")
    mount(phone, {"shortcuts": [STATUS]})
    phone.wait_for_selector(f"{PAGE} [data-alert]")


def test_a_card_closed_yesterday_shows_again_today(phone):
    open_home(phone)
    phone.evaluate("""() => localStorage.setItem('home-dashboard-alerts-dismissed',
        JSON.stringify({ day: '2000-01-01', seen: { 'Status/Kamery na baterię': ['sensor.porch_battery'] } }))""")
    mount(phone, {"shortcuts": [STATUS]})
    phone.wait_for_selector(f"{PAGE} [data-alert]")


def test_muted_for_a_week_nothing_shows(phone):
    phone.evaluate("""async () => { const p = await import('/custom_components/home_dashboard/www/app/prefs.js');
        window.hass = window.hass ?? {}; p.savePrefs({ callWS: async () => null }, { alerts_muted_until: Date.now() + 864e5 }); }""")
    open_home(phone)
    assert cards(phone) == []
    phone.evaluate("""async () => { const p = await import('/custom_components/home_dashboard/www/app/prefs.js');
        p.savePrefs({ callWS: async () => null }, { alerts_muted_until: Date.now() - 1 }); }""")
    mount(phone, {"shortcuts": [STATUS]})
    phone.wait_for_selector(f"{PAGE} [data-alert]")


def test_on_a_tablet_a_card_takes_a_third_of_the_width(tablet):
    open_home(tablet)
    card = tablet.locator(f"{PAGE} [data-alert]").bounding_box()
    page = tablet.locator(f"{PAGE} .chips").bounding_box()
    assert card["width"] < page["width"] / 2.5


LEAKS = """(states) => {
    const snapshot = window.dashboard.snapshot;
    const add = (id, state, deviceClass, name) => {
        snapshot.entities[id] = { entity_id: id, platform: 'zha', device_id: id, hidden: false };
        snapshot.states[id] = { entity_id: id, state, attributes: { device_class: deviceClass, friendly_name: name } };
    };
    add('binary_sensor.sink_leak', states.sink, 'moisture', 'Zlew');
    add('binary_sensor.washer_leak', states.washer, 'moisture', 'Pralka');
    add('binary_sensor.kitchen_smoke', states.smoke, 'smoke', 'Kuchnia dym');
    add('binary_sensor.window', 'on', 'window', 'Okno');
    localStorage.removeItem('home-dashboard-alerts-dismissed');
}"""

ALARMS = {"kind": "overview", "name": "Status", "icon": "mdi:check", "sections": [{"title": "Uwaga", "alert": True, "items": [
    {"name": "Wyciek wody", "icon": "mdi:water-alert", "auto": "alarm", "classes": ["moisture"], "notify": True},
    {"name": "Dym", "icon": "mdi:smoke-detector-alert", "auto": "alarm", "classes": ["smoke", "gas"], "notify": True},
]}]}


def open_alarms(page, sink="on", washer="off", smoke="off") -> None:
    page.evaluate(LEAKS, {"sink": sink, "washer": washer, "smoke": smoke})
    mount(page, {"shortcuts": [ALARMS]})
    page.wait_for_selector(f"{PAGE} .chips", state="attached")


def test_a_leak_anywhere_in_the_home_is_a_red_card_that_cannot_be_closed(phone):
    open_alarms(phone)
    assert cards(phone) == ["Status/Wyciek wody"]
    card = phone.locator(f"{PAGE} [data-alert]")
    assert "alarm" in card.get_attribute("class")
    assert "Zlew" in card.inner_text() and "Pralka" not in card.inner_text()
    assert card.locator("[data-alert-close]").count() == 0


def test_smoke_has_its_own_card(phone):
    open_alarms(phone, sink="off", smoke="on")
    assert cards(phone) == ["Status/Dym"]


def test_nothing_shows_while_all_is_dry(phone):
    open_alarms(phone, sink="off")
    assert cards(phone) == []


def test_an_alarm_shows_even_when_warnings_are_muted_or_closed(phone):
    phone.evaluate("""async () => { const p = await import('/custom_components/home_dashboard/www/app/prefs.js');
        p.savePrefs({ callWS: async () => null }, { alerts_muted_until: Date.now() + 864e5 }); }""")
    open_alarms(phone)
    assert cards(phone) == ["Status/Wyciek wody"]
    phone.evaluate("""async () => { const p = await import('/custom_components/home_dashboard/www/app/prefs.js');
        p.savePrefs({ callWS: async () => null }, { alerts_muted_until: Date.now() - 1 }); }""")


def test_more_on_a_single_leak_opens_its_sensor_window(phone):
    open_alarms(phone)
    phone.locator(f"{PAGE} [data-alert-more]").click()
    phone.wait_for_selector("home-dashboard-sheet .panel[data-kind='binary']")


def test_the_status_screen_shows_the_leak_in_red_too(phone):
    run = phone.evaluate("""async () => { const o = await import('/custom_components/home_dashboard/www/app/overview.js');
        const hass = { language: 'pl', entities: {}, states: {
            'binary_sensor.a': { entity_id: 'binary_sensor.a', state: 'on', attributes: { device_class: 'moisture', friendly_name: 'Zlew' } },
            'binary_sensor.b': { entity_id: 'binary_sensor.b', state: 'on', attributes: { device_class: 'door', friendly_name: 'Drzwi' } } } };
        const item = o.overviewItem(hass, { name: 'Wyciek', auto: 'alarm' });
        return { rows: item.rows.map((row) => row.name), alarm: item.alarm }; }""")
    assert run == {"rows": ["Zlew"], "alarm": True}


def test_the_block_form_offers_an_alarm_item(phone):
    kind = phone.evaluate("""async () => { const b = await import('/custom_components/home_dashboard/www/app/block-editor.js');
        const item = b.withItemKind({ name: 'Wyciek' }, 'alarm');
        return [b.itemKind(item), item.auto, item.classes, item.notify, b.itemKind({ auto: 'battery' })]; }""")
    assert kind == ["alarm", "alarm", ["moisture"], True, "battery"]
