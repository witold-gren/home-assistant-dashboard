"""Variant B of picking a moment in a recording: the line of the day zoomed to the clip that plays. Chosen for all
cameras (`cameras.clip_picker`) or for one camera (`cameras.clip_picker_with`), in the settings of the dashboard."""

from __future__ import annotations

from .test_camera_controls import ADD_DEVICE
from .test_camera_quick import ADD_QUICK
from .test_clip_bar import LENGTH, PLAY, sheet_value, video_time
from .test_recorded_live import FOLDER, YESTERDAY, setup as setup_recorded
from .test_shortcuts import mount_admin

SHEET = "home-dashboard-sheet"
TIMELINE = f"{SHEET} home-dashboard-timeline"
MODEL = "/custom_components/home_dashboard/www/app/model.js"


def open_camera(page, cameras: dict) -> None:
    page.evaluate(ADD_DEVICE)
    page.evaluate(ADD_QUICK, ["siren", "light", "night"])
    mount_admin(page, {"cameras": {"tiles": ["image.slup_last_screen"], **cameras}})
    page.evaluate("""() => document.querySelector('home-dashboard-chrome')
        .open({ type: 'sheet', sheet: { kind: 'camera', entityId: 'image.slup_last_screen' } })""")
    page.wait_for_selector(f"{TIMELINE}", state="attached")


def play(page) -> int:
    start = page.evaluate(PLAY, LENGTH)
    page.wait_for_selector(f"{SHEET} video[data-clip]", state="attached")
    return start


def test_the_variant_is_the_camera_s_own_or_the_one_for_all(phone):
    picked = phone.evaluate(f"""async () => {{
        const {{ clipPicker }} = await import('{MODEL}');
        const config = (cameras) => ({{ cameras }});
        return [
          clipPicker(config({{}}), 'image.a'),
          clipPicker(config({{ clip_picker: 'zoom' }}), 'image.a'),
          clipPicker(config({{ clip_picker: 'zoom', clip_picker_with: {{ 'image.a': 'bar' }} }}), 'image.a'),
          clipPicker(config({{ clip_picker_with: {{ 'camera.a': 'zoom' }} }}), 'image.a', 'camera.a'),
          clipPicker(config({{ clip_picker: 'wobble', clip_picker_with: {{ 'image.a': 'nope' }} }}), 'image.a'),
        ];
    }}""")
    assert picked == ["bar", "zoom", "bar", "zoom", "bar"]


def test_zoomed_there_is_no_clip_bar_but_a_button_that_zooms_and_one_back(phone):
    open_camera(phone, {"clip_picker": "zoom"})
    play(phone)
    assert phone.locator(f"{TIMELINE} [data-clip-bar]").count() == 0
    phone.locator(f"{TIMELINE} [data-clip-zoom]").click()
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-zoomed]")
    # the clip with 5 s on either side fills the line
    window = phone.locator(f"{TIMELINE} [data-timeline-window]").bounding_box()["width"]
    clip = phone.locator(f"{TIMELINE} [data-zoom-clip]").bounding_box()["width"]
    assert abs(clip - window * LENGTH / (LENGTH + 10)) < 2
    assert "0:50" in phone.locator(f"{TIMELINE} [data-clip-unzoom]").inner_text()
    phone.locator(f"{TIMELINE} [data-clip-unzoom]").click()
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-zoomed]", state="detached")
    assert phone.locator(f"{TIMELINE} [data-clip-zoom]").count() == 1


def test_zoomed_the_line_moves_inside_the_clip_and_plays_where_it_stops(phone):
    open_camera(phone, {"clip_picker": "zoom"})
    start = play(phone)
    phone.locator(f"{TIMELINE} [data-clip-zoom]").click()
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-zoomed]")
    phone.locator(TIMELINE).evaluate("""(line) => {
        const track = line.shadowRoot.querySelector('[data-timeline-track]');
        const { origin, perSecond } = line._scale();
        track.scrollLeft = (line.clip.start + 20 - origin) * perSecond;
    }""")
    phone.wait_for_function(
        f"""() => {{ const sheet = document.querySelector('home-dashboard-chrome').shadowRoot
            .querySelector('home-dashboard-sheet'); return sheet._playhead - {start} === 20; }}"""
    )
    assert video_time(phone) == 20
    # still zoomed: the line stays on the clip
    assert phone.locator(f"{TIMELINE} [data-timeline-zoomed]").count() == 1


def test_the_end_of_the_recordings_and_live_bring_the_day_back(phone):
    open_camera(phone, {"clip_picker": "zoom"})
    play(phone)
    phone.locator(f"{TIMELINE} [data-clip-zoom]").click()
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-zoomed]")
    sheet_value(phone, "(sheet._clip = null, sheet._playhead = null, true)")
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-zoomed]", state="detached")
    play(phone)
    assert phone.locator(f"{TIMELINE} [data-timeline-zoomed]").count() == 0


def test_one_camera_may_have_the_other_variant(phone):
    open_camera(phone, {"clip_picker": "zoom", "clip_picker_with": {"image.slup_last_screen": "bar"}})
    play(phone)
    phone.wait_for_selector(f"{TIMELINE} [data-clip-bar]")
    assert phone.locator(f"{TIMELINE} [data-clip-zoom]").count() == 0


def test_one_camera_may_be_zoomed_while_the_rest_have_the_bar(phone):
    open_camera(phone, {"clip_picker_with": {"image.slup_last_screen": "zoom"}})
    play(phone)
    phone.wait_for_selector(f"{TIMELINE} [data-clip-zoom]")
    assert phone.locator(f"{TIMELINE} [data-clip-bar]").count() == 0


def test_a_tap_on_a_recording_of_the_day_plays_it_and_zooms_to_it(phone):
    setup_recorded(phone)
    mount_admin(phone, {"cameras": {"tiles": ["image.slup_last_screen"], "clip_picker": "zoom"}})
    phone.evaluate("""() => document.querySelector('home-dashboard-chrome')
        .open({ type: 'sheet', sheet: { kind: 'camera', entityId: 'image.slup_last_screen' } })""")
    phone.wait_for_selector(f"{TIMELINE} .range")
    # the day opens at its last recording (09:30:00 to 09:30:45), right under the mark
    phone.locator(f"{TIMELINE} .range").last.click()
    phone.wait_for_function("window.asked.some((m) => m.type === 'media_source/resolve_media')")
    resolved = phone.evaluate(
        "window.asked.find((m) => m.type === 'media_source/resolve_media').media_content_id"
    )
    assert resolved == f"{FOLDER}/{YESTERDAY}/093000-093045.mp4"
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-zoomed]")


def test_the_settings_choose_it_for_all_and_for_one_camera(phone):
    open_camera(phone, {})
    phone.evaluate("() => document.querySelector('home-dashboard-chrome').open({ type: 'settings' })")
    select = "home-dashboard-settings [data-clip-picker]"
    phone.wait_for_selector(select)
    assert phone.locator(select).input_value() == "bar"
    phone.locator(select).select_option("zoom")
    draft = phone.locator("home-dashboard-settings").evaluate("(s) => s._draft.cameras.clip_picker")
    assert draft == "zoom"
    phone.locator("home-dashboard-settings [data-camera-control] .camera-row").first.click()
    own = "home-dashboard-settings [data-clip-picker-with]"
    phone.wait_for_selector(own)
    # "as for all cameras" names what that is
    assert (
        "Linia przybliżona" in phone.locator(f"{own} option[value='auto']").inner_text()
        or "zoomed" in phone.locator(f"{own} option[value='auto']").inner_text()
    )
    phone.locator(own).select_option("bar")
    camera = phone.locator("home-dashboard-settings [data-camera-control]").first.get_attribute(
        "data-camera-control"
    )
    assert phone.locator("home-dashboard-settings").evaluate("(s) => s._draft.cameras.clip_picker_with") == {
        camera: "bar"
    }
    phone.locator(own).select_option("auto")
    assert phone.locator("home-dashboard-settings").evaluate("(s) => s._draft.cameras.clip_picker_with") == {}


def test_held_still_the_zoomed_line_shows_seconds_and_the_mark_follows_the_finger(phone):
    open_camera(phone, {"clip_picker": "zoom"})
    start = play(phone)
    phone.locator(f"{TIMELINE} [data-clip-zoom]").click()
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-zoomed]")
    box = phone.locator(f"{TIMELINE} [data-timeline-window]").bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    phone.mouse.move(x, y)
    phone.mouse.down()
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-zoomed].fine")
    # never the whole day while zoomed
    assert phone.locator(f"{TIMELINE} [data-timeline-day]").count() == 0
    # 30 s over the width: a tick for each second
    assert phone.locator(f"{TIMELINE} .track.fine .tick").count() >= 20
    # a sixth of the width is 5 s later
    phone.mouse.move(x + box["width"] / 6, y, steps=4)
    phone.mouse.up()
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-zoomed].fine", state="detached")
    assert sheet_value(phone, "sheet._playhead") - start == 5
    assert video_time(phone) == 5


def open_recorded_zoomed(page):
    setup_recorded(page)
    mount_admin(page, {"cameras": {"tiles": ["image.slup_last_screen"], "clip_picker": "zoom"}})
    page.evaluate("""() => document.querySelector('home-dashboard-chrome')
        .open({ type: 'sheet', sheet: { kind: 'camera', entityId: 'image.slup_last_screen' } })""")
    page.wait_for_selector(f"{TIMELINE} .range")
    page.locator(f"{TIMELINE} .range").last.click()
    page.wait_for_selector(f"{SHEET} video[data-clip]", state="attached")
    page.wait_for_selector(f"{TIMELINE} [data-timeline-zoomed]")


def scroll_to(page, seconds_after_first: float) -> None:
    page.locator(TIMELINE).evaluate(
        """(line, after) => {
            const track = line.shadowRoot.querySelector('[data-timeline-track]');
            const { origin, perSecond } = line._scale();
            track.scrollLeft = (line._ranges[0].start + after - origin) * perSecond;
        }""",
        seconds_after_first,
    )


def resolved(page) -> list:
    return page.evaluate(
        "window.asked.filter((m) => m.type === 'media_source/resolve_media').map((m) => m.media_content_id.split('/').pop())"
    )


def test_zoomed_the_recordings_around_are_on_the_line_and_a_move_onto_one_plays_it(phone):
    open_recorded_zoomed(phone)
    assert resolved(phone) == ["093000-093045.mp4"]
    # both recordings of the day are on the zoomed line, the one that plays in orange
    assert phone.locator(f"{TIMELINE} [data-timeline-zoomed] .range:not(.current)").count() == 2
    # a gap between them plays nothing
    scroll_to(phone, 3000)
    phone.wait_for_timeout(700)
    assert resolved(phone) == ["093000-093045.mp4"]
    # the recording before: it plays from there, and the line stays zoomed
    scroll_to(phone, 30)
    phone.wait_for_function("window.asked.filter((m) => m.type === 'media_source/resolve_media').length > 1")
    assert resolved(phone)[-1] == "080000-080130.mp4"
    phone.wait_for_timeout(300)
    assert phone.locator(f"{TIMELINE} [data-timeline-zoomed]").count() == 1


def test_zoomed_a_recording_that_ends_stops_there(phone):
    open_recorded_zoomed(phone)
    scroll_to(phone, 30)
    phone.wait_for_function("window.asked.filter((m) => m.type === 'media_source/resolve_media').length > 1")
    phone.wait_for_timeout(300)
    phone.locator(f"{SHEET} video[data-clip]").dispatch_event("ended")
    phone.wait_for_timeout(300)
    # no jump to the next recording of the day; the clip stays, paused at its end, and the line zoomed
    assert resolved(phone) == ["093000-093045.mp4", "080000-080130.mp4"]
    assert sheet_value(phone, "Boolean(sheet._clip) && sheet._clipPaused") is True
    assert phone.locator(f"{TIMELINE} [data-timeline-zoomed]").count() == 1


def test_the_orange_badge_brings_the_day_back_and_is_easy_to_tap(phone):
    open_camera(phone, {"clip_picker": "zoom"})
    play(phone)
    badge = phone.locator(f"{TIMELINE} [data-clip-zoom]")
    assert badge.bounding_box()["height"] >= 22
    badge.click()
    phone.wait_for_selector(f"{TIMELINE} [data-clip-unzoom]")
    assert phone.locator(f"{TIMELINE} [data-timeline-unzoom]").count() == 0
    phone.locator(f"{TIMELINE} [data-clip-unzoom]").click()
    phone.wait_for_selector(f"{TIMELINE} [data-timeline-zoomed]", state="detached")
