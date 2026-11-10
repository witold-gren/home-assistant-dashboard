"""Recordings of a Frigate camera: days at the top, a line of time at the bottom, and one picture in between.

The picture, the live view and a recording take each other's place, so the window never shows two of them.
"""

from __future__ import annotations

import datetime

from .test_shortcuts import mount_admin

SHEET = "home-dashboard-sheet"
TIMELINE = f"{SHEET} home-dashboard-timeline"
DAYS = f"{SHEET} home-dashboard-recording-days"

YESTERDAY = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()

SETUP = """(arg) => {
    const snapshot = window.dashboard.snapshot;
    const area = Object.keys(snapshot.areas)[0];
    snapshot.devices.frigate_device = { id: "frigate_device", name: "Garaż", area_id: area };
    snapshot.entities["camera.garage"] = { entity_id: "camera.garage", device_id: "frigate_device", platform: "frigate", hidden: false };
    snapshot.states["camera.garage"] = { entity_id: "camera.garage", state: "idle", attributes: {
        friendly_name: "Garaż", camera_name: "garage", client_id: "frigate", entity_picture: "/api/camera_proxy/camera.garage" } };
    // Seconds from the local midnight of the day with recordings.
    const [y, m, d] = arg.day.split("-").map(Number);
    const at = (seconds) => new Date(y, m - 1, d).getTime() / 1000 + seconds;
    window.at = at;
    const segments = (arg.segments ?? [[28800, 28810], [28810, 28820], [32400, 32460]])
        .map(([start, end]) => ({ start_time: at(start), end_time: at(end) }));
    const events = [{ id: "e1", label: "car", sub_label: null, start_time: at(28805), end_time: at(28815) }];
    window.asked = [];
    const original = window.dashboard.hass;
    window.dashboard.hass = (overrides) => original({ ...overrides, callWS: async (message) => {
        window.asked.push(message);
        if (message.type === "frigate/recordings/summary") return JSON.stringify(arg.days);
        if (message.type === "frigate/recordings/get") return JSON.stringify(segments);
        if (message.type === "frigate/events/get") return JSON.stringify(events);
        if (message.type === "auth/sign_path") return { path: `${message.path}?authSig=x` };
        return null;
    } });
}"""


def run(page, body: str):
    return page.evaluate(f"async () => {{ const r = await import('/custom_components/home_dashboard/www/app/recordings.js'); {body} }}")


def signed(page) -> list[str]:
    return page.evaluate("window.asked.filter((m) => m.type === 'auth/sign_path').map((m) => m.path)")


def at(page, seconds: int) -> int:
    return page.evaluate(f"window.at({seconds})")


def open_garage(page, days=None, segments=None) -> None:
    page.evaluate(SETUP, {"day": YESTERDAY, "days": days if days is not None else [{"day": YESTERDAY, "events": 1}],
                          "segments": segments})
    mount_admin(page, {"cameras": {"tiles": ["camera.garage"]}})
    page.evaluate("""() => document.querySelector('home-dashboard-chrome')
        .open({ type: 'sheet', sheet: { kind: 'camera', entityId: 'camera.garage' } })""")
    if days is None or days:
        page.wait_for_selector(f"{TIMELINE} .range")


def sheet(page, script: str):
    return page.evaluate(f"""() => {{ const sheet = document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('home-dashboard-sheet'); {script} }}""")


def scroll_line_to(page, seconds: int) -> None:
    sheet(page, f"""sheet.shadowRoot.querySelector('home-dashboard-timeline').shadowRoot
        .querySelector('[data-timeline-track]').scrollLeft = ({seconds} / 3600) * 360;""")


# Pure parts -----------------------------------------------------------------------------------


def test_a_frigate_camera_is_known_by_its_attributes_or_its_device(phone):
    phone.evaluate(SETUP, {"day": YESTERDAY, "days": []})
    found = run(phone, """const h = window.dashboard.hass();
        h.entities['image.garage_last'] = { entity_id: 'image.garage_last', device_id: 'frigate_device' };
        return [r.frigateCamera(h, 'camera.garage'), r.frigateCamera(h, 'image.garage_last'),
                r.frigateCamera(h, Object.keys(h.states).find((id) => id.startsWith('light.')))];""")
    assert found == [{"instance": "frigate", "camera": "garage"}, {"instance": "frigate", "camera": "garage"}, None]


def test_a_day_covers_its_local_midnights_and_a_week_starts_on_monday(phone):
    bounds = run(phone, "return r.dayBounds('2026-11-09');")
    assert bounds["before"] - bounds["after"] == 86400
    assert run(phone, "return r.weekOf('2026-11-12');") == [f"2026-11-{day:02d}" for day in range(9, 16)]
    assert run(phone, "return r.weekOf('2026-11-09')[0];") == "2026-11-09"
    assert run(phone, "return r.shiftDay('2026-10-31', 1);") == "2026-11-01"


def test_pieces_close_together_make_one_stretch(phone):
    ranges = run(phone, """return r.recordedRanges([
        { start_time: 30, end_time: 40 }, { start_time: 0, end_time: 10 }, { start_time: 11, end_time: 20 }]);""")
    assert ranges == [{"start": 0, "end": 20}, {"start": 30, "end": 40}]


def test_a_moment_plays_where_it_was_recorded_or_from_the_next_stretch(phone):
    clips = run(phone, """const ranges = [{ start: 0, end: 20 }, { start: 100, end: 2000 }];
        return [r.clipAt(ranges, 5.6), r.clipAt(ranges, 50), r.clipAt(ranges, 150), r.clipAt(ranges, 2500)];""")
    assert clips == [{"start": 5, "end": 20}, {"start": 100, "end": 700}, {"start": 150, "end": 750}, None]


# Window ---------------------------------------------------------------------------------------


def test_days_are_at_the_top_and_the_line_of_time_at_the_bottom(phone):
    open_garage(phone)
    assert phone.locator(f"{DAYS} [data-recording-day='{YESTERDAY}'].on.has").count() == 1
    assert phone.locator(f"{DAYS} [data-recording-day]").count() == 7
    days = phone.locator(DAYS).bounding_box()
    picture = phone.locator(f"{SHEET} .stage").bounding_box()
    thumbs = phone.locator(f"{SHEET} [data-thumbs]")
    line = phone.locator(TIMELINE).bounding_box()
    assert days["y"] + days["height"] <= picture["y"]
    assert picture["y"] + picture["height"] <= line["y"]
    if thumbs.count():
        assert thumbs.bounding_box()["y"] < line["y"]
    assert line["width"] <= 402
    assert phone.locator(f"{TIMELINE} .range").count() == 2
    assert phone.locator(f"{TIMELINE} [data-timeline-event='e1']").count() == 1


def test_there_is_no_yellow_live_button_only_the_one_of_the_line(phone):
    open_garage(phone)
    assert phone.locator(f"{SHEET} [data-start-live]").count() == 0
    assert phone.locator(f"{TIMELINE} [data-timeline-live]").count() == 1


def test_a_frigate_camera_without_recordings_has_greyed_days_and_an_empty_line(phone):
    open_garage(phone, days=[], segments=[])
    phone.wait_for_selector(f"{DAYS}[empty]", state="attached")
    phone.wait_for_function("window.asked.some((m) => m.type === 'frigate/recordings/get')")
    assert phone.locator(DAYS).is_visible()
    assert phone.locator(f"{DAYS} [data-recording-day]:not([disabled])").count() == 0
    assert phone.locator(f"{TIMELINE} .range").count() == 0
    assert phone.locator(f"{SHEET} [data-start-live]").count() == 0


def test_play_starts_the_recording_in_place_of_the_picture(phone):
    open_garage(phone)
    # Another day opens at its last recording.
    assert phone.locator(f"{TIMELINE} [data-timeline-time] strong").inner_text() == "09:00:00"
    phone.locator(f"{TIMELINE} [data-timeline-play]").click()
    phone.wait_for_selector(f"{SHEET} .stage video[data-clip]", state="attached")
    start = at(phone, 32400)
    assert f"/garage/start/{start}/end/{start + 60}" in signed(phone)[-1]
    assert phone.locator(f"{SHEET} .stage .picture").count() == 0
    assert phone.locator(f"{SHEET} video[data-clip]").get_attribute("src").endswith("?authSig=x")


def test_moving_the_line_plays_from_the_moment_under_it(phone):
    open_garage(phone)
    # One point of the line is ten seconds.
    scroll_line_to(phone, 28810)
    phone.wait_for_function("window.asked.some((m) => m.type === 'auth/sign_path')")
    assert f"/garage/start/{at(phone, 28810)}/end/{at(phone, 28820)}" in signed(phone)[-1]
    assert phone.locator(f"{TIMELINE} [data-timeline-time] strong").inner_text().startswith("08:00:1")


def test_a_moment_without_recording_plays_the_next_stretch(phone):
    open_garage(phone)
    scroll_line_to(phone, 30000)
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-time] small")
    phone.wait_for_function("window.asked.some((m) => m.type === 'auth/sign_path')")
    assert f"/garage/start/{at(phone, 32400)}/" in signed(phone)[-1]


def test_an_event_on_the_line_plays_from_its_start(phone):
    open_garage(phone)
    phone.locator(f"{TIMELINE} [data-timeline-event='e1']").evaluate("(button) => button.click()")
    phone.wait_for_function("window.asked.some((m) => m.type === 'auth/sign_path')")
    assert f"/garage/start/{at(phone, 28805)}/end/{at(phone, 28820)}" in signed(phone)[-1]


def test_the_end_of_a_part_plays_the_next_stretch(phone):
    open_garage(phone)
    phone.locator(f"{TIMELINE} [data-timeline-event='e1']").evaluate("(button) => button.click()")
    phone.wait_for_selector(f"{SHEET} video[data-clip]", state="attached")
    phone.locator(f"{SHEET} video[data-clip]").dispatch_event("ended")
    phone.wait_for_function("window.asked.filter((m) => m.type === 'auth/sign_path').length === 2")
    assert f"/garage/start/{at(phone, 32400)}/" in signed(phone)[-1]


def test_live_and_recording_take_each_others_place(phone):
    open_garage(phone)
    phone.locator(f"{TIMELINE} [data-timeline-play]").click()
    phone.wait_for_selector(f"{SHEET} video[data-clip]", state="attached")
    phone.locator(f"{TIMELINE} [data-timeline-live]").click()
    phone.wait_for_selector(f"{SHEET} .stage [data-live]", state="attached")
    assert phone.locator(f"{SHEET} video[data-clip]").count() == 0
    assert phone.locator(f"{TIMELINE} [data-timeline-live].on").count() == 1
    # LIVE is said once on the line, not again over it.
    assert phone.locator(f"{TIMELINE} [data-timeline-time]").evaluate("(time) => getComputedStyle(time).visibility") == "hidden"
    # Going back to a recording ends the live view, which lets a camera on a battery rest.
    phone.locator(f"{TIMELINE} [data-timeline-event='e1']").evaluate("(button) => button.click()")
    phone.wait_for_selector(f"{SHEET} video[data-clip]", state="attached")
    assert phone.locator(f"{SHEET} [data-live]").count() == 0
    assert sheet(phone, "return sheet._live;") is False


def test_another_day_loads_its_recordings(phone):
    today = datetime.date.today().isoformat()
    open_garage(phone, days=[{"day": YESTERDAY, "events": 1}, {"day": today, "events": 2}])
    phone.wait_for_selector(f"{DAYS} [data-recording-day='{today}'].on")
    if phone.locator(f"{DAYS} [data-recording-day='{YESTERDAY}']").count() == 0:
        phone.locator(f"{DAYS} [data-week='-1']").click()
    phone.locator(f"{DAYS} [data-recording-day='{YESTERDAY}']").click()
    phone.wait_for_selector(f"{DAYS} [data-recording-day='{YESTERDAY}'].on")
    phone.wait_for_function("window.asked.filter((m) => m.type === 'frigate/recordings/get').length === 2")


def test_the_sound_button_mutes_and_a_long_press_sets_the_volume(phone):
    open_garage(phone)
    phone.locator(f"{TIMELINE} [data-timeline-play]").click()
    video = phone.locator(f"{SHEET} video[data-clip]")
    video.wait_for(state="attached")
    sound = phone.locator(f"{SHEET} header [data-sound]")
    # Grey until the recording is known to carry sound.
    assert sound.is_disabled()
    video.evaluate("""(v) => { Object.defineProperty(v, 'webkitAudioDecodedByteCount', { get: () => 4096 });
        v.dispatchEvent(new Event('timeupdate')); }""")
    assert sound.get_attribute("aria-pressed") == "false"
    assert video.evaluate("(v) => v.muted") is True
    sound.click()
    assert sound.get_attribute("aria-pressed") == "true"
    assert video.evaluate("(v) => v.muted") is False
    box = sound.bounding_box()
    phone.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    phone.mouse.down()
    phone.wait_for_selector(f"{SHEET} [data-sound-level]")
    phone.mouse.up()
    phone.locator(f"{SHEET} [data-sound-level] input").fill("0.4")
    # The level is set on the gain the sound goes through (sound.js), the video itself stays unmuted.
    assert sheet(phone, "return sheet._volume;") == 0.4
    assert video.evaluate("(v) => v.muted") is False


def test_other_cameras_look_the_same_with_an_empty_line(phone):
    mount_admin(phone, {})
    phone.locator("home-dashboard-page .camera:not(.offline)").first.click()
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-live]")
    assert phone.locator(f"{DAYS}[empty]").count() == 1
    assert phone.locator(f"{TIMELINE} .range").count() == 0
    assert phone.locator(f"{SHEET} [data-start-live]").count() == 0
    assert phone.evaluate("(window.asked ?? []).filter((m) => m.type.startsWith('frigate/')).length") == 0
    # Play never starts the live view: with nothing recorded it cannot be pressed.
    assert phone.locator(f"{TIMELINE} [data-timeline-play]").is_disabled()


def test_live_jumps_to_today_and_the_end_of_the_line(phone):
    today = datetime.date.today().isoformat()
    open_garage(phone)
    assert phone.locator(f"{DAYS} [data-recording-day='{YESTERDAY}'].on").count() == 1
    phone.locator(f"{TIMELINE} [data-timeline-live]").click()
    phone.wait_for_function("window.asked.filter((m) => m.type === 'frigate/recordings/get').length === 2")
    phone.wait_for_selector(f"{DAYS} [data-recording-day='{today}'].on", state="attached")
    assert sheet(phone, "return sheet._recordingDay;") == today
    # The mark of the line stands at this moment, at the end of today.
    shown = phone.locator(f"{TIMELINE}").evaluate("(line) => line._shown")
    now = phone.evaluate("Date.now() / 1000")
    assert abs(now - shown) < 5
    phone.wait_for_function("""() => {
        const track = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')
            .shadowRoot.querySelector('home-dashboard-timeline').shadowRoot.querySelector('[data-timeline-track]');
        const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
        return Math.abs(track.scrollLeft - ((Date.now() - midnight) / 3600000) * 360) < 3;
    }""")


def test_holding_the_line_shows_the_whole_day_and_letting_go_plays_the_chosen_moment(phone):
    open_garage(phone)
    window = phone.locator(f"{TIMELINE} [data-timeline-window]").bounding_box()
    x, y = window["x"] + window["width"] / 2, window["y"] + window["height"] / 2
    phone.mouse.move(x, y)
    phone.mouse.down()
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-day]")
    assert phone.locator(f"{TIMELINE} [data-timeline-day] .range").count() == 2
    # Squeezing alone moves nothing: the mark stays at 09:00, where the line opened.
    assert phone.locator(f"{TIMELINE} [data-timeline-time] strong").inner_text() == "09:00:00"
    mark = phone.locator(f"{TIMELINE} .playhead").bounding_box()
    assert abs(mark["x"] - (window["x"] + window["width"] * 9 / 24)) < 3
    # Once the finger moves, the mark is under it: an eighth of the line is 03:00, a third is 08:00.
    phone.mouse.move(window["x"] + window["width"] / 8, y, steps=5)
    assert phone.locator(f"{TIMELINE} [data-timeline-time] strong").inner_text().startswith("03:00")
    mark = phone.locator(f"{TIMELINE} .playhead").bounding_box()
    assert abs(mark["x"] + mark["width"] / 2 - (window["x"] + window["width"] / 8)) < 3
    phone.mouse.move(window["x"] + window["width"] / 3, y, steps=5)
    assert phone.locator(f"{TIMELINE} [data-timeline-time] strong").inner_text().startswith("08:00")
    phone.mouse.up()
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-day]", state="detached")
    phone.wait_for_function("window.asked.some((m) => m.type === 'auth/sign_path')")
    assert f"/garage/start/{at(phone, 28800)}/" in signed(phone)[-1]
    # Back at the usual scale, the mark stands at the chosen moment.
    phone.wait_for_function("""() => {
        const track = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')
            .shadowRoot.querySelector('home-dashboard-timeline').shadowRoot.querySelector('[data-timeline-track]');
        return Math.abs(track.scrollLeft - 8 * 360) < 3;
    }""")


def test_a_short_press_or_a_drag_keeps_the_usual_line(phone):
    open_garage(phone)
    window = phone.locator(f"{TIMELINE} [data-timeline-window]").bounding_box()
    x, y = window["x"] + window["width"] / 2, window["y"] + window["height"] / 2
    phone.mouse.move(x, y)
    phone.mouse.down()
    phone.mouse.move(x - 30, y, steps=3)
    phone.wait_for_timeout(600)
    phone.mouse.up()
    assert phone.locator(f"{TIMELINE} [data-timeline-day]").count() == 0


def test_a_swipe_on_the_days_turns_the_week(phone):
    today = datetime.date.today()
    old = (today - datetime.timedelta(days=21)).isoformat()
    open_garage(phone, days=[{"day": old, "events": 1}, {"day": today.isoformat(), "events": 1}])
    days = phone.locator(DAYS).bounding_box()
    y = days["y"] + days["height"] / 2

    def swipe(start, end):
        phone.mouse.move(days["x"] + start, y)
        phone.mouse.down()
        phone.mouse.move(days["x"] + end, y, steps=4)
        phone.mouse.up()

    first = phone.locator(f"{DAYS} [data-recording-day]").first.get_attribute("data-recording-day")
    swipe(300, 150)  # to the left: a later week, which is not there yet
    assert phone.locator(f"{DAYS} [data-recording-day]").first.get_attribute("data-recording-day") == first
    swipe(150, 300)  # to the right: the week before
    earlier = phone.locator(f"{DAYS} [data-recording-day]").first.get_attribute("data-recording-day")
    assert earlier == (datetime.date.fromisoformat(first) - datetime.timedelta(days=7)).isoformat()
    swipe(300, 150)
    assert phone.locator(f"{DAYS} [data-recording-day]").first.get_attribute("data-recording-day") == first
    # A swipe does not pick a day.
    assert phone.locator(f"{DAYS} [data-recording-day='{today.isoformat()}'].on").count() == 1


def test_play_past_the_last_recording_plays_that_recording_not_the_live_view(phone):
    open_garage(phone)
    scroll_line_to(phone, 80000)
    phone.wait_for_timeout(600)
    before = len(signed(phone))
    phone.locator(f"{TIMELINE} [data-timeline-play]").click()
    phone.wait_for_function(f"window.asked.filter((m) => m.type === 'auth/sign_path').length > {before}")
    assert f"/garage/start/{at(phone, 32400)}/" in signed(phone)[-1]
    assert phone.locator(f"{SHEET} [data-live]").count() == 0


def test_the_end_of_the_last_recording_goes_back_to_the_picture(phone):
    open_garage(phone)
    phone.locator(f"{TIMELINE} [data-timeline-play]").click()
    phone.wait_for_selector(f"{SHEET} video[data-clip]", state="attached")
    phone.locator(f"{SHEET} video[data-clip]").dispatch_event("ended")
    phone.wait_for_selector(f"{SHEET} .stage .picture", state="attached")
    assert phone.locator(f"{SHEET} video[data-clip]").count() == 0
    assert phone.locator(f"{SHEET} [data-live]").count() == 0


def test_a_recording_puts_the_controls_of_turning_away(phone):
    open_garage(phone)
    sheet(phone, "sheet._ptzOpen = true;")
    phone.locator(f"{TIMELINE} [data-timeline-play]").click()
    phone.wait_for_selector(f"{SHEET} video[data-clip]", state="attached")
    assert sheet(phone, "return sheet._ptzOpen;") is False


# A stand-in for the card helpers of Home Assistant: a player whose video starts moving when the test says so.
FAKE_PLAYER = """() => {
    window.loadCardHelpers = async () => ({ createCardElement: () => {
        const card = document.createElement('div');
        const video = document.createElement('video');
        let moving = false;
        Object.defineProperty(video, 'readyState', { get: () => (moving ? 4 : 0) });
        Object.defineProperty(video, 'videoWidth', { get: () => (moving ? 1280 : 0) });
        Object.defineProperty(video, 'paused', { get: () => !moving });
        window.startVideo = () => (moving = true);
        card.appendChild(video);
        return card;
    } });
}"""


def test_the_last_picture_stays_until_the_live_view_moves(phone):
    phone.evaluate(FAKE_PLAYER)
    open_garage(phone)
    phone.locator(f"{TIMELINE} [data-timeline-live]").click()
    phone.wait_for_selector(f"{SHEET} .stage [data-live] video", state="attached")
    # The camera is waking: its last picture is shown, the player waits unseen behind it.
    assert phone.locator(f"{SHEET} .live-wrap:not(.shown) [data-live-poster]").count() == 1
    assert phone.locator(f"{SHEET} [data-live]").evaluate("(live) => getComputedStyle(live).opacity") == "0"
    phone.evaluate("window.startVideo()")
    phone.wait_for_selector(f"{SHEET} [data-live-poster]", state="detached")
    assert phone.locator(f"{SHEET} [data-live]").evaluate("(live) => getComputedStyle(live).opacity") == "1"


def test_a_new_live_view_starts_again_from_the_picture(phone):
    phone.evaluate(FAKE_PLAYER)
    open_garage(phone)
    phone.locator(f"{TIMELINE} [data-timeline-live]").click()
    phone.wait_for_selector(f"{SHEET} .stage [data-live] video", state="attached")
    phone.evaluate("window.startVideo()")
    phone.wait_for_selector(f"{SHEET} [data-live-poster]", state="detached")
    sheet(phone, "sheet._stopLive();")
    phone.locator(f"{TIMELINE} [data-timeline-live]").click()
    phone.wait_for_selector(f"{SHEET} .live-wrap:not(.shown) [data-live-poster]", state="attached")


# A stand-in for the card of Home Assistant: it makes its camera player muted, and like the real WebRTC player
# that one keeps the sound of the stream only when it is not muted at the moment the stream connects.
CHROME_SHEET = "document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')"

MUTED_CARD = """() => {
    if (!customElements.get('ha-camera-stream')) {
        customElements.define('ha-camera-stream', class extends HTMLElement {
            constructor() {
                super();
                this._muted = true;
                this.video = document.createElement('video');
                this.video.muted = true;
                // A stream with a real sound track, as WebRTC gives one.
                this.video.srcObject = new AudioContext().createMediaStreamDestination().stream;
                this.attachShadow({ mode: 'open' }).appendChild(this.video);
            }
            get muted() { return this._muted; }
            // Like a Lit render, an unmuted player unmutes its video a little later.
            set muted(value) { this._muted = value; this.updateComplete = Promise.resolve().then(() => (this.video.muted = value)); }
        });
    }
    window.loadCardHelpers = async () => ({ createCardElement: () => {
        const card = document.createElement('div');
        card.attachShadow({ mode: 'open' }).appendChild(document.createElement('ha-camera-stream'));
        window.connectStream = () => !card.shadowRoot.querySelector('ha-camera-stream').muted;
        return card;
    } });
}"""


def test_the_live_view_takes_the_sound_but_plays_it_only_after_the_sound_button(phone):
    phone.evaluate(MUTED_CARD)
    open_garage(phone)
    phone.locator(f"{TIMELINE} [data-timeline-live]").click()
    phone.wait_for_function("window.connectStream && window.connectStream()")
    # The stream connecting now keeps its sound, and the video is still silent.
    phone.wait_for_timeout(200)
    video = phone.locator(f"{SHEET} .stage [data-live] video")
    assert video.evaluate("(v) => v.muted") is True
    phone.wait_for_function(f"!{CHROME_SHEET}.shadowRoot.querySelector('header [data-sound]').disabled")
    phone.locator(f"{SHEET} header [data-sound]").click()
    phone.wait_for_timeout(200)
    # Heard through the gain: the sheet plays the sound, the video itself stays silent so it is not heard twice.
    assert sheet(phone, "return sheet._muted;") is False
    assert phone.locator(f"{SHEET} header [data-sound]").get_attribute("aria-pressed") == "true"


def test_the_live_pill_stays_grey_until_the_video_moves(phone):
    phone.evaluate(FAKE_PLAYER)
    open_garage(phone)
    phone.locator(f"{TIMELINE} [data-timeline-live]").click()
    phone.wait_for_selector(f"{SHEET} [data-live-pill].waiting")
    grey = phone.locator(f"{SHEET} [data-live-pill]").evaluate("(pill) => getComputedStyle(pill).backgroundColor")
    assert grey == "rgb(99, 99, 102)"
    phone.evaluate("window.startVideo()")
    phone.wait_for_selector(f"{SHEET} [data-live-pill]:not(.waiting)")
    lit = phone.locator(f"{SHEET} [data-live-pill]").evaluate("(pill) => getComputedStyle(pill).backgroundColor")
    assert lit != grey


def test_on_a_phone_on_its_side_the_live_view_stays_in_the_middle(phone):
    phone.evaluate(FAKE_PLAYER)
    phone.set_viewport_size({"width": 874, "height": 402})
    open_garage(phone)
    phone.locator(f"{SHEET} [data-corner-live]").click()
    phone.wait_for_selector(f"{SHEET} .stage [data-live] video", state="attached")
    phone.evaluate("window.startVideo()")
    phone.wait_for_selector(f"{SHEET} .live-wrap.shown")
    box = phone.locator(f"{SHEET} [data-live]").bounding_box()
    # Narrower than the screen (16:9 of its height): as much room on the left as on the right.
    assert box["width"] < 874
    assert abs(box["x"] - (874 - box["x"] - box["width"])) <= 2


def test_saying_there_is_no_recording_does_not_move_the_window(phone):
    open_garage(phone)
    line = phone.locator(TIMELINE)
    moments = line.evaluate("""(line) => {
        const ranges = line._ranges;
        return { inside: ranges[0].start + 1, gap: ranges.length > 1 ? ranges[0].end + 1 : ranges[0].start - 600 };
    }""")
    heights = {}
    for name, moment in moments.items():
        line.evaluate("async (line, time) => { line._shown = time; await line.updateComplete; }", moment)
        heights[name] = phone.locator(f"{TIMELINE} [data-timeline-time]").bounding_box()["height"]
    assert heights["inside"] == heights["gap"]
    assert phone.locator(f"{TIMELINE} [data-timeline-gap]").count() == 1


def live_button(phone) -> tuple[str, str]:
    button = phone.locator(f"{TIMELINE} [data-timeline-live]")
    return button.inner_text().strip(), button.evaluate("(b) => getComputedStyle(b).color")


def test_live_turns_into_disconnect_and_back(phone):
    phone.evaluate(FAKE_PLAYER)
    open_garage(phone)
    grey = live_button(phone)
    assert grey == ("NA ŻYWO", "rgb(142, 142, 147)")
    phone.locator(f"{TIMELINE} [data-timeline-live]").click()
    phone.wait_for_selector(f"{SHEET} .stage [data-live] video", state="attached")
    # Orange at once, while the camera wakes.
    assert live_button(phone) == ("NA ŻYWO", "rgb(255, 159, 10)")
    phone.evaluate("window.startVideo()")
    phone.wait_for_function(f"{CHROME_SHEET}.shadowRoot.querySelector('home-dashboard-timeline').connected === true")
    assert live_button(phone) == ("ROZŁĄCZ", "rgb(255, 159, 10)")
    # Pressed, the camera lets go and the window stays, with the line to look through.
    phone.locator(f"{TIMELINE} [data-timeline-live]").click()
    phone.wait_for_selector(f"{SHEET} .stage [data-live]", state="detached")
    assert live_button(phone) == grey
    assert sheet(phone, "return sheet._live;") is False
    assert phone.locator(f"{SHEET} .panel").count() == 1


def test_moving_the_line_lets_the_camera_go(phone):
    phone.evaluate(FAKE_PLAYER)
    open_garage(phone)
    phone.locator(f"{TIMELINE} [data-timeline-live]").click()
    phone.wait_for_selector(f"{SHEET} .stage [data-live] video", state="attached")
    phone.locator(TIMELINE).evaluate("(line) => line.dispatchEvent(new CustomEvent('timeline-scrub'))")
    phone.wait_for_selector(f"{SHEET} .stage [data-live]", state="detached")
    assert live_button(phone)[0] == "NA ŻYWO"


def test_tapping_live_does_not_move_the_window(phone):
    phone.evaluate(FAKE_PLAYER)
    open_garage(phone)
    before = phone.locator(TIMELINE).bounding_box()
    phone.locator(f"{TIMELINE} [data-timeline-live]").click()
    phone.wait_for_selector(f"{SHEET} .stage [data-live] video", state="attached")
    # The time over the line hides but keeps its room: nothing above or below it moves.
    assert phone.locator(TIMELINE).bounding_box() == before
