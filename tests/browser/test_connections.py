"""Connections of a camera on a battery: a red dot while a stream of it is open, and a log of when and how long."""

from __future__ import annotations

from .test_recorded_live import LONG_AGO, SETUP, YESTERDAY
from .test_shortcuts import mount_admin

SHEET = "home-dashboard-sheet"
MODULE = "/custom_components/home_dashboard/www/app/connections.js"
CHROME = "document.querySelector('home-dashboard-chrome')"

STREAM = """(arg) => {
    const snapshot = window.dashboard.snapshot;
    snapshot.entities['binary_sensor.slup_streaming'] = { entity_id: 'binary_sensor.slup_streaming', device_id: 'slup', platform: 'eufy_sdk', hidden: false };
    snapshot.states['binary_sensor.slup_streaming'] = { entity_id: 'binary_sensor.slup_streaming', state: arg.state, attributes: { device_class: 'running' } };
    const now = Date.now() / 1000;
    window.historyRows = { 'binary_sensor.slup_streaming': [
        { s: 'off', lu: now - 7200 }, { s: 'on', lu: now - 7000 }, { s: 'off', lu: now - 6970 },
        { s: 'on', lu: now - 6000 }, { s: 'off', lu: now - 600 }, { s: 'on', lu: now - 20 } ] };
    const original = window.dashboard.hass;
    window.dashboard.hass = (overrides) => { const base = original(overrides); const callWS = base.callWS;
        return { ...base, callWS: async (message) => message.type === 'history/history_during_period'
            ? (window.askedHistory = message, window.historyRows) : callWS(message) }; };
}"""


def setup(page, state="on") -> None:
    page.evaluate(
        SETUP,
        {
            "recording": True,
            "folder": "media-source://media_source/media/eufy/T86P2ABC",
            "path": None,
            "yesterday": YESTERDAY,
            "longAgo": LONG_AGO,
        },
    )
    page.evaluate(STREAM, {"state": state})
    mount_admin(page, {"cameras": {"tiles": ["image.slup_last_screen"]}})


def run(page, body: str):
    return page.evaluate(f"async () => {{ const c = await import('{MODULE}'); {body} }}")


def test_sessions_are_read_from_the_history(phone):
    result = run(
        phone,
        """return c.sessionsOf([{ s: 'off', lu: 0 }, { s: 'on', lu: 10 }, { s: 'off', lu: 40 },
        { s: 'on', lu: 100 }, { s: 'on', lu: 120 }], 160000);""",
    )
    assert result == [
        {"start": 100000, "end": None, "seconds": 60},
        {"start": 10000, "end": 40000, "seconds": 30},
    ]
    assert run(
        phone,
        "return [c.sensorKind('binary_sensor.a_camera_link'), c.sensorKind('binary_sensor.a_streaming'),"
        " c.sensorKind('binary_sensor.a_recording_live_view')];",
    ) == ["link", "stream", "recording"]
    assert run(phone, "return [5, 125, 5400].map((s) => c.formatSeconds(s, 'pl'));") == [
        "5 s",
        "2 min 5 s",
        "1 h 30 min",
    ]


def test_a_camera_with_an_open_stream_has_a_red_dot_on_home(phone):
    setup(phone, "on")
    phone.wait_for_selector("home-dashboard-page [data-camera='image.slup_last_screen'] [data-stream-dot]")


def test_without_a_stream_there_is_no_dot(phone):
    setup(phone, "off")
    phone.wait_for_selector("home-dashboard-page [data-camera='image.slup_last_screen']")
    assert (
        phone.locator("home-dashboard-page [data-camera='image.slup_last_screen'] [data-stream-dot]").count()
        == 0
    )


def test_the_dot_shows_in_all_cameras_and_in_the_window(tablet):
    setup(tablet, "on")
    tablet.evaluate(f"{CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'cameras' }} }})")
    tablet.wait_for_selector(f"{SHEET} [data-camera-card='image.slup_last_screen'] [data-stream-dot]")
    tablet.evaluate(
        f"{CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'camera', entityId: 'image.slup_last_screen' }} }})"
    )
    tablet.wait_for_selector(f"{SHEET} .stage > [data-stream-dot]")


def test_the_settings_have_a_log_of_connections(phone):
    setup(phone, "on")
    phone.evaluate(
        f"{CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'camera', entityId: 'image.slup_last_screen' }} }})"
    )
    phone.locator(f"{SHEET} header button[data-details]").first.click()
    phone.locator(f"{SHEET} [data-tab='connections']").click()
    phone.wait_for_selector(f"{SHEET} [data-conn-totals]")
    assert phone.evaluate("window.askedHistory.entity_ids") == ["binary_sensor.slup_streaming"]
    rows = phone.locator(f"{SHEET} [data-conn-row]")
    assert rows.count() == 3
    totals = phone.locator(f"{SHEET} [data-conn-totals]").inner_text()
    assert "Strumieni\n3" in totals and "Ponad 5 min\n1" in totals
    # The one left open for 90 minutes stands out; the one going on now says so.
    assert phone.locator(f"{SHEET} [data-conn-row].long").count() == 1
    assert "teraz" in rows.first.inner_text()


BATTERY = """(level) => {
    const snapshot = window.dashboard.snapshot;
    snapshot.entities['sensor.slup_battery'] = { entity_id: 'sensor.slup_battery', device_id: 'slup', platform: 'eufy_sdk', hidden: false };
    snapshot.states['sensor.slup_battery'] = { entity_id: 'sensor.slup_battery', state: level, attributes: { device_class: 'battery', unit_of_measurement: '%' } };
}"""


def with_battery(page, level: str, stream: str = "off") -> None:
    page.evaluate(
        SETUP,
        {
            "recording": True,
            "folder": "media-source://media_source/media/eufy/T86P2ABC",
            "path": None,
            "yesterday": YESTERDAY,
            "longAgo": LONG_AGO,
        },
    )
    page.evaluate(STREAM, {"state": stream})
    page.evaluate(BATTERY, level)
    mount_admin(page, {"cameras": {"tiles": ["image.slup_last_screen"]}})


def test_the_pictures_of_the_pages_have_no_battery_badge(phone):
    """So many badges would crowd the pictures: the battery shows in the window of a camera only."""
    with_battery(phone, "54", stream="on")
    phone.wait_for_selector("home-dashboard-page [data-camera='image.slup_last_screen'] [data-stream-dot]")
    assert phone.locator("home-dashboard-page [data-camera-battery]").count() == 0


def test_the_window_of_a_camera_says_how_much_is_left(tablet):
    with_battery(tablet, "80", stream="on")
    tablet.evaluate(
        f"{CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'camera', entityId: 'image.slup_last_screen' }} }})"
    )
    badge = tablet.locator(f"{SHEET} .stage > [data-camera-battery='80']")
    badge.wait_for()
    assert badge.inner_text().strip() == "80 %"
    assert badge.get_attribute("aria-label") == "Bateria 80 %"
    assert "low" not in badge.get_attribute("class")
    # the dot of the open stream sits in the badge, not beside it
    assert badge.locator("[data-stream-dot]").count() == 1
    assert tablet.locator(f"{SHEET} .stage > [data-stream-dot]").count() == 0
    # all the cameras keep only their dots
    tablet.evaluate(f"{CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'cameras' }} }})")
    tablet.wait_for_selector(f"{SHEET} [data-camera-card='image.slup_last_screen'] [data-stream-dot]")
    assert tablet.locator(f"{SHEET} [data-camera-card] [data-camera-battery]").count() == 0


def test_a_low_battery_is_red_in_the_window(tablet):
    with_battery(tablet, "12.6")
    tablet.evaluate(
        f"{CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'camera', entityId: 'image.slup_last_screen' }} }})"
    )
    badge = tablet.locator(f"{SHEET} .stage > [data-camera-battery='13']")
    badge.wait_for()
    assert "low" in badge.get_attribute("class")


def test_a_camera_without_a_battery_level_has_no_badge(tablet):
    with_battery(tablet, "unavailable")
    tablet.evaluate(
        f"{CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'camera', entityId: 'image.slup_last_screen' }} }})"
    )
    tablet.wait_for_selector(f"{SHEET} .stage")
    assert tablet.locator(f"{SHEET} [data-camera-battery]").count() == 0


def test_the_icon_of_a_battery_level(phone):
    icons = run(phone, "return [0, 4, 12, 54, 96, 100].map(c.batteryIcon);")
    assert icons == [
        "mdi:battery-alert-variant-outline",
        "mdi:battery-alert-variant-outline",
        "mdi:battery-10",
        "mdi:battery-50",
        "mdi:battery",
        "mdi:battery",
    ]


def test_the_battery_of_a_picture_comes_from_its_live_camera(phone):
    level = phone.evaluate("""async () => {
        const m = await import('/custom_components/home_dashboard/www/app/model.js');
        const hass = { entities: {
            'image.door': { entity_id: 'image.door', device_id: 'nvr' },
            'camera.door': { entity_id: 'camera.door', device_id: 'doorbell' },
            'sensor.door_battery': { entity_id: 'sensor.door_battery', device_id: 'doorbell' } },
          states: { 'sensor.door_battery': { state: '18', attributes: { device_class: 'battery' } } } };
        return [m.cameraBattery(hass, 'image.door', { cameras: { live: { 'image.door': 'camera.door' } } }),
                m.cameraBattery(hass, 'image.door', { cameras: {} })];
    }""")
    assert level == [{"level": 18, "low": True}, None]


# On a side the picture fills the screen under the header: the badge goes under it, clear of its buttons.
OVERLAP = """(badge) => {
    const box = badge.getBoundingClientRect();
    const hit = (other) => { const o = other.getBoundingClientRect();
        return o.width > 0 && box.left < o.right && o.left < box.right && box.top < o.bottom && o.top < box.bottom; };
    return [...badge.getRootNode().querySelectorAll('header button, .zoom-badge')].filter(hit).map((el) => el.outerHTML.slice(0, 60));
}"""


def clear_of_the_header(page) -> None:
    with_battery(page, "80")
    page.evaluate(
        f"{CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'camera', entityId: 'image.slup_last_screen' }} }})"
    )
    badge = page.locator(f"{SHEET} .stage > [data-camera-battery='80']")
    badge.wait_for()
    assert badge.evaluate(OVERLAP) == []
    assert badge.bounding_box()["y"] >= 56


def test_on_a_tablet_the_battery_is_clear_of_the_header(tablet):
    clear_of_the_header(tablet)


def test_on_a_phone_on_its_side_the_battery_is_clear_of_the_header(phone):
    phone.set_viewport_size({"width": 874, "height": 402})
    clear_of_the_header(phone)
