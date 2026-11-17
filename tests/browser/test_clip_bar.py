"""The bar of the clip: a moment inside the recording that plays, picked to the second, over the line of the day,
without moving the buttons of a camera on a battery (siren, light, night vision, recordings, line of time)."""

from __future__ import annotations

from .test_camera_quick import open_camera

SHEET = "home-dashboard-sheet"
TIMELINE = f"{SHEET} home-dashboard-timeline"
TRACK = f"{TIMELINE} [data-clip-track]"
LENGTH = 50

PLAY = """(length) => {
    const sheet = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet');
    const start = Math.floor(Date.now() / 1000) - 3600;
    sheet._clip = { start, end: start + length, url: '/clip.mp4' };
    sheet._playhead = start;
    return start;
}"""


def sheet_value(page, expression: str):
    return page.evaluate(
        f"() => {{ const sheet = document.querySelector('home-dashboard-chrome').shadowRoot"
        f".querySelector('home-dashboard-sheet'); return {expression}; }}"
    )


def play(page, length: int = LENGTH) -> int:
    start = page.evaluate(PLAY, length)
    page.wait_for_selector(TRACK)
    return start


def video_time(page) -> float:
    return page.locator(f"{SHEET} video[data-clip]").evaluate("(video) => video.currentTime")


def at_share(page, share: float) -> tuple[float, float]:
    box = page.locator(TRACK).bounding_box()
    return box["x"] + box["width"] * share, box["y"] + box["height"] / 2


def test_the_bar_is_there_only_while_a_recording_plays(phone):
    open_camera(phone)
    assert phone.locator(f"{TIMELINE} [data-clip-bar]").count() == 0
    play(phone)
    assert phone.locator(f"{TIMELINE} [data-clip-bar]").count() == 1
    # its ends are the clock of the start and of the end of the recording
    start, end = phone.locator(f"{TIMELINE} [data-clip-start]"), phone.locator(f"{TIMELINE} [data-clip-end]")
    assert ":" in start.inner_text() and start.inner_text() != end.inner_text()
    assert phone.locator(TRACK).get_attribute("aria-valuemax") == str(LENGTH)
    sheet_value(phone, "(sheet._clip = null, true)")
    phone.wait_for_selector(f"{TIMELINE} [data-clip-bar]", state="detached")


def test_a_tap_or_drag_shows_the_moment_and_letting_go_plays_from_there(phone):
    open_camera(phone)
    start = play(phone)
    phone.mouse.move(*at_share(phone, 0.2))
    phone.mouse.down()
    phone.mouse.move(*at_share(phone, 0.5), steps=4)
    # while the finger is on the bar the picture follows it and the bubble says where it is
    assert phone.locator(f"{TIMELINE} [data-clip-bubble]").inner_text().startswith("0:25 / 0:50 ·")
    assert video_time(phone) == 25
    assert phone.locator(f"{SHEET} video[data-clip]").evaluate("(video) => video.paused")
    phone.mouse.up()
    assert phone.locator(f"{TIMELINE} [data-clip-bubble]").count() == 0
    assert video_time(phone) == 25
    assert sheet_value(phone, "sheet._playhead") - start == 25
    assert phone.locator(TRACK).get_attribute("aria-valuenow") == "25"


def test_held_still_the_bar_shows_seconds_and_the_finger_picks_one(phone):
    open_camera(phone)
    start = play(phone, 600)
    phone.mouse.move(*at_share(phone, 0.5))
    phone.mouse.down()
    phone.wait_for_selector(f"{TIMELINE} [data-clip-bar].fine")
    assert phone.locator(f"{TIMELINE} [data-clip-hint]").count() == 1
    # 30 s over the whole width: a sixth of it is 5 s
    width = phone.locator(TRACK).bounding_box()["width"]
    x, y = at_share(phone, 0.5)
    phone.mouse.move(x + width / 6, y, steps=5)
    phone.mouse.up()
    assert sheet_value(phone, "sheet._playhead") - start == 305
    assert phone.locator(f"{TIMELINE} [data-clip-bar].fine").count() == 0


def test_the_arrows_move_by_a_second_and_with_shift_by_ten(phone):
    open_camera(phone)
    start = play(phone)
    phone.locator(TRACK).focus()
    phone.keyboard.press("ArrowRight")
    assert sheet_value(phone, "sheet._playhead") - start == 1
    phone.keyboard.press("Shift+ArrowRight")
    assert sheet_value(phone, "sheet._playhead") - start == 11
    phone.keyboard.press("ArrowLeft")
    assert sheet_value(phone, "sheet._playhead") - start == 10
    # never past the ends of the recording
    for _ in range(6):
        phone.keyboard.press("Shift+ArrowRight")
    assert sheet_value(phone, "sheet._playhead") - start == LENGTH - 1
    assert video_time(phone) == LENGTH - 1


def test_a_mouse_over_the_bar_tells_the_moment_without_playing_it(phone):
    open_camera(phone)
    start = play(phone)
    phone.mouse.move(*at_share(phone, 0.8))
    assert phone.locator(f"{TIMELINE} [data-clip-bubble]").inner_text().startswith("0:40 / 0:50")
    assert sheet_value(phone, "sheet._playhead") == start
    phone.mouse.move(5, 5)
    assert phone.locator(f"{TIMELINE} [data-clip-bubble]").count() == 0


def rect(page, selector: str) -> dict:
    return page.locator(selector).first.evaluate(
        "(el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }"
    )


def overlap(a: dict, b: dict) -> bool:
    return (
        a["left"] < b["right"]
        and b["left"] < a["right"]
        and a["top"] < b["bottom"]
        and b["top"] < a["bottom"]
    )


def inside(page, box: dict) -> bool:
    size = page.viewport_size
    return (
        box["left"] >= 0
        and box["top"] >= 0
        and box["right"] <= size["width"]
        and box["bottom"] <= size["height"]
    )


def test_upright_the_buttons_of_a_battery_camera_stay_whole_over_the_line(phone):
    open_camera(phone, viewport={"width": 402, "height": 874})
    play(phone)
    line = rect(phone, TIMELINE)
    assert inside(phone, line)
    for quick in ("siren", "light", "night"):
        assert phone.locator(f"{SHEET} [data-quick='{quick}']").is_visible(), quick
        button = rect(phone, f"{SHEET} [data-quick='{quick}']")
        assert inside(phone, button) and not overlap(button, line), quick
    assert not overlap(rect(phone, f"{SHEET} video[data-clip]"), line)


def test_on_its_side_the_bar_comes_out_with_the_line_and_the_corner_buttons_come_back(phone):
    open_camera(phone, viewport={"width": 874, "height": 402})
    play(phone)
    # with the line put away the buttons stand in the corner as without a recording
    for quick in ("siren", "light", "night"):
        assert phone.locator(f"{SHEET} [data-quick='{quick}']").is_visible(), quick
        assert inside(phone, rect(phone, f"{SHEET} [data-quick='{quick}']")), quick
    phone.locator(f"{SHEET} [data-open-line]").click()
    phone.wait_for_timeout(400)
    assert inside(phone, rect(phone, TIMELINE))
    assert inside(phone, rect(phone, f"{TIMELINE} [data-clip-bar]"))
    # on a phone the line covers the corner, so the buttons step aside while it is out, as they always have
    assert not phone.locator(f"{SHEET} [data-quick='siren']").is_visible()
    phone.mouse.click(300, 180)
    phone.wait_for_timeout(400)
    assert phone.locator(f"{SHEET} [data-quick='siren']").is_visible()


def test_on_a_tablet_the_bar_fits_with_the_buttons(tablet):
    open_camera(tablet)
    play(tablet)
    if tablet.locator(f"{SHEET} [data-open-line]").is_visible():
        tablet.locator(f"{SHEET} [data-open-line]").click()
        tablet.wait_for_timeout(400)
    line = rect(tablet, TIMELINE)
    assert inside(tablet, line)
    # on a tablet the buttons stay by the line, out of its way
    for quick in ("siren", "light", "night"):
        assert tablet.locator(f"{SHEET} [data-quick='{quick}']").is_visible(), quick
        button = rect(tablet, f"{SHEET} [data-quick='{quick}']")
        assert inside(tablet, button) and not overlap(button, line), quick
