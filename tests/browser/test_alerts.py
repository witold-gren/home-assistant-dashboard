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
    phone.evaluate("""() => { window.moreInfo = []; window.addEventListener('hass-more-info', (e) => window.moreInfo.push(e.detail.entityId)); }""")
    phone.locator(f"{PAGE} [data-alert-more]").click()
    assert phone.evaluate("window.moreInfo") == ["sensor.porch_battery"]
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
