"""A phone on its side: the camera on the whole screen, the days and the line of time waiting at its edges."""

from __future__ import annotations

import os

from .test_recordings import DAYS, SHEET, TIMELINE, YESTERDAY, open_garage

WIDE = {"width": 874, "height": 402}


def box(page, selector: str) -> dict:
    return page.locator(selector).bounding_box()


def open_on_its_side(page) -> None:
    page.set_viewport_size(WIDE)
    open_garage(page)
    page.wait_for_timeout(300)


def test_the_camera_fills_the_screen_with_its_name_over_it(phone):
    open_on_its_side(phone)
    stage = box(phone, f"{SHEET} .stage")
    assert stage["height"] >= 400 and stage["width"] >= 870
    header = box(phone, f"{SHEET} header")
    assert header["y"] <= stage["y"] + 1 and header["y"] + header["height"] > stage["y"]
    assert phone.locator(f"{SHEET} [data-thumbs]").is_hidden()
    phone.screenshot(path=os.environ["SHOT"]) if os.environ.get("SHOT") else None


def drag(page, selector: str, dy: int) -> None:
    area = box(page, selector)
    x, y = area["x"] + area["width"] / 2, area["y"] + area["height"] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x, y + dy, steps=5)
    page.mouse.up()
    page.wait_for_timeout(400)


def test_the_calendar_button_brings_the_days_below_the_header(phone):
    open_on_its_side(phone)
    days = box(phone, DAYS)
    assert days["y"] + days["height"] <= 0
    calendar = phone.locator(f"{SHEET} header [data-open-days]")
    assert phone.locator(f"{SHEET} header [data-open-days] + [data-corner-live]").count() == 1
    calendar.click()
    phone.wait_for_timeout(400)
    days = box(phone, DAYS)
    # Near the top edge, narrower than the screen, with the calendar and LIVE out of the way.
    assert 0 <= days["y"] <= 16 and days["width"] < 874 * 0.75
    assert calendar.evaluate("(button) => getComputedStyle(button).visibility") == "hidden"
    assert phone.locator(f"{SHEET} header [data-corner-live]").evaluate("(b) => getComputedStyle(b).visibility") == "hidden"
    # A pick puts them away; so does a swipe up.
    phone.locator(f"{DAYS} [data-recording-day='{YESTERDAY}']").click()
    phone.wait_for_timeout(400)
    assert box(phone, DAYS)["y"] + box(phone, DAYS)["height"] <= 0
    calendar.click()
    phone.wait_for_timeout(400)
    drag(phone, DAYS, -80)
    assert box(phone, DAYS)["y"] + box(phone, DAYS)["height"] <= 0


def test_the_line_button_brings_the_line_and_a_swipe_down_hides_it(phone):
    open_on_its_side(phone)
    assert box(phone, TIMELINE)["y"] >= 402
    button = box(phone, f"{SHEET} [data-open-line]")
    assert button["x"] > 700 and button["y"] > 300
    phone.locator(f"{SHEET} [data-open-line]").click()
    phone.wait_for_timeout(400)
    line = box(phone, TIMELINE)
    assert line["y"] + line["height"] <= 402 and line["width"] < 874 * 0.75
    assert phone.locator(f"{SHEET} [data-open-line]").evaluate("(b) => getComputedStyle(b).visibility") == "hidden"
    drag(phone, f"{TIMELINE} [data-timeline-time]", 80)
    assert box(phone, TIMELINE)["y"] >= 402


def test_live_sits_in_the_header_by_the_sound(phone):
    open_on_its_side(phone)
    assert phone.locator(f"{SHEET} header [data-corner-live] + [data-sound]").count() == 1
    phone.locator(f"{SHEET} [data-corner-live]").click()
    phone.wait_for_selector(f"{SHEET} .stage [data-live]", state="attached")
    assert phone.locator(f"{SHEET} [data-corner-live].on").count() == 1


def test_upright_has_none_of_these_buttons(phone):
    open_garage(phone)
    for selector in ("[data-open-days]", "[data-open-line]", "[data-corner-live]"):
        assert phone.locator(f"{SHEET} {selector}").is_hidden()


def test_the_live_player_may_be_as_tall_as_the_screen(phone):
    open_on_its_side(phone)
    phone.locator(f"{SHEET} [data-corner-live]").click()
    phone.wait_for_selector(f"{SHEET} .stage [data-live]", state="attached")
    limit = phone.locator(f"{SHEET} [data-live]").evaluate("(live) => getComputedStyle(live).getPropertyValue('--video-max-height').trim()")
    assert limit == "100dvh"


def test_a_tap_on_the_picture_puts_both_bars_away(phone):
    open_on_its_side(phone)
    phone.locator(f"{SHEET} [data-open-line]").click()
    phone.locator(f"{SHEET} header [data-open-days]").click()
    phone.wait_for_timeout(400)
    assert box(phone, DAYS)["y"] >= 0 and box(phone, TIMELINE)["y"] < 402
    phone.mouse.click(437, 200)
    phone.wait_for_timeout(400)
    assert box(phone, DAYS)["y"] + box(phone, DAYS)["height"] <= 0
    assert box(phone, TIMELINE)["y"] >= 402


def test_upright_a_tap_on_the_picture_changes_nothing(phone):
    open_garage(phone)
    phone.evaluate("""() => { const sheet = document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('home-dashboard-sheet'); sheet._daysOpen = true; sheet._lineOpen = true; }""")
    phone.locator(f"{SHEET} .stage").click()
    state = phone.evaluate("""() => { const sheet = document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('home-dashboard-sheet'); return [sheet._daysOpen, sheet._lineOpen]; }""")
    assert state == [True, True]
