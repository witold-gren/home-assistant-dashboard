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
    page.evaluate(SETUP, {"recording": True, "folder": "media-source://media_source/media/eufy/T86P2ABC", "path": None,
                          "yesterday": YESTERDAY, "longAgo": LONG_AGO})
    page.evaluate(STREAM, {"state": state})
    mount_admin(page, {"cameras": {"tiles": ["image.slup_last_screen"]}})


def run(page, body: str):
    return page.evaluate(f"async () => {{ const c = await import('{MODULE}'); {body} }}")


def test_sessions_are_read_from_the_history(phone):
    result = run(phone, """return c.sessionsOf([{ s: 'off', lu: 0 }, { s: 'on', lu: 10 }, { s: 'off', lu: 40 },
        { s: 'on', lu: 100 }, { s: 'on', lu: 120 }], 160000);""")
    assert result == [{"start": 100000, "end": None, "seconds": 60}, {"start": 10000, "end": 40000, "seconds": 30}]
    assert run(phone, "return [c.sensorKind('binary_sensor.a_camera_link'), c.sensorKind('binary_sensor.a_streaming'),"
                      " c.sensorKind('binary_sensor.a_recording_live_view')];") == ["link", "stream", "recording"]
    assert run(phone, "return [5, 125, 5400].map((s) => c.formatSeconds(s, 'pl'));") == ["5 s", "2 min 5 s", "1 h 30 min"]


def test_a_camera_with_an_open_stream_has_a_red_dot_on_home(phone):
    setup(phone, "on")
    phone.wait_for_selector("home-dashboard-page [data-camera='image.slup_last_screen'] [data-stream-dot]")


def test_without_a_stream_there_is_no_dot(phone):
    setup(phone, "off")
    phone.wait_for_selector("home-dashboard-page [data-camera='image.slup_last_screen']")
    assert phone.locator("home-dashboard-page [data-camera='image.slup_last_screen'] [data-stream-dot]").count() == 0


def test_the_dot_shows_in_all_cameras_and_in_the_window(tablet):
    setup(tablet, "on")
    tablet.evaluate(f"{CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'cameras' }} }})")
    tablet.wait_for_selector(f"{SHEET} [data-camera-card='image.slup_last_screen'] [data-stream-dot]")
    tablet.evaluate(f"{CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'camera', entityId: 'image.slup_last_screen' }} }})")
    tablet.wait_for_selector(f"{SHEET} .stage > [data-stream-dot]")


def test_the_settings_have_a_log_of_connections(phone):
    setup(phone, "on")
    phone.evaluate(f"{CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'camera', entityId: 'image.slup_last_screen' }} }})")
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
