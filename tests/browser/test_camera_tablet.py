"""A camera window on a tablet on its side (a touch screen): the picture on the whole screen at its full width, every
button on it, and the other cameras brought up from the bottom with a button and put away with a drag down."""

from __future__ import annotations

from collections.abc import Iterator

from playwright.sync_api import Page
import pytest

from .conftest import TABLET, open_harness
from .test_shortcuts import mount_admin
from .test_zoom import WIDE

SHEET = "home-dashboard-sheet"


@pytest.fixture
def touch_tablet(browser, base_url: str) -> Iterator[Page]:
    page = open_harness(browser, base_url, TABLET, touch=True)
    yield page
    assert page.errors == []
    page.close()


def open_camera(page: Page) -> str:
    page.route("**/api/*_proxy/**", lambda route: route.fulfill(body=WIDE, content_type="image/svg+xml"))
    mount_admin(page, {})
    camera = page.evaluate("""() => { const { model, hass } = window.dashboard;
        return model.buildCameras(hass(), model.normalizeConfig({}))[0].entityId; }""")
    page.evaluate(
        """(id) => document.querySelector('home-dashboard-chrome').open({ type: 'sheet', sheet: { kind: 'camera', entityId: id } })""",
        camera,
    )
    page.wait_for_function("""() => document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('home-dashboard-sheet').shadowRoot.querySelector('.picture img')?.naturalWidth === 1600""")
    page.wait_for_timeout(150)
    return camera


def box(page: Page, selector: str) -> dict:
    return page.locator(f"{SHEET} {selector}").first.bounding_box()


def test_the_picture_fills_the_width_and_the_header_the_band_above_it(touch_tablet):
    open_camera(touch_tablet)
    picture = box(touch_tablet, ".picture img")
    assert picture["width"] == 1180
    # 16:9 on a 1180 x 820 screen leaves a band above and below; the header fills the one above, its close button in
    # its middle.
    header = box(touch_tablet, "header")
    close = box(touch_tablet, "header > button")
    assert abs(header["height"] - picture["y"]) <= 1
    assert abs((close["y"] + close["height"] / 2) - picture["y"] / 2) <= 1


def test_the_buttons_stand_on_the_picture_and_the_ring_halfway_down_it(touch_tablet):
    open_camera(touch_tablet)
    picture = box(touch_tablet, ".picture img")
    bottom = picture["y"] + picture["height"]
    button = box(touch_tablet, ".line-button")
    assert button["y"] + button["height"] <= bottom - 12 + 1
    touch_tablet.evaluate(f"""async () => {{ const sheet = document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('{SHEET}'); sheet.shadowRoot.querySelector('.camera-body').insertAdjacentHTML('beforeend',
        '<div class="ptz-overlay" data-probe style="position:absolute;right:16px;width:200px;height:200px"></div>'); }}""")
    ring = box(touch_tablet, "[data-probe]")
    assert abs((ring["y"] + ring["height"] / 2) - (picture["y"] + picture["height"] / 2)) <= 1


def test_the_cameras_button_brings_the_others_up_and_a_drag_down_puts_them_away(touch_tablet):
    first = open_camera(touch_tablet)
    thumbs = touch_tablet.locator(f"{SHEET} [data-thumbs]")
    assert not thumbs.is_visible()
    touch_tablet.locator(f"{SHEET} [data-open-cameras]").click()
    touch_tablet.wait_for_timeout(350)
    assert thumbs.is_visible()
    shown = thumbs.bounding_box()
    picture = box(touch_tablet, ".picture img")
    # In the middle of the band under the picture.
    band = picture["y"] + picture["height"]
    assert abs((shown["y"] + shown["height"] / 2) - (band + (820 - band) / 2)) <= 3
    # A drag down on the list puts it away and leaves the window open.
    x, y = shown["x"] + 40, shown["y"] + 4
    touch_tablet.mouse.move(x, y)
    touch_tablet.mouse.down()
    touch_tablet.mouse.move(x + 5, 818, steps=6)
    touch_tablet.mouse.up()
    touch_tablet.wait_for_timeout(350)
    assert not thumbs.is_visible()
    assert touch_tablet.locator(f"{SHEET} .panel[data-kind='camera']").count() == 1
    # Brought up again, a tap on another camera shows it.
    touch_tablet.locator(f"{SHEET} [data-open-cameras]").click()
    touch_tablet.wait_for_timeout(350)
    other = touch_tablet.locator(f"{SHEET} [data-thumb]:not(.current)").first
    other_id = other.get_attribute("data-thumb")
    other.click()
    touch_tablet.wait_for_function(
        f"""(id) => document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('{SHEET}').sheet.entityId === id""",
        arg=other_id,
    )
    assert other_id != first


def test_opening_the_cameras_puts_the_line_of_time_away_and_back(touch_tablet):
    open_camera(touch_tablet)
    body = touch_tablet.locator(f"{SHEET} .camera-body")
    touch_tablet.locator(f"{SHEET} [data-open-line]").click()
    assert "line-open" in body.get_attribute("class")
    touch_tablet.locator(f"{SHEET} [data-open-cameras]").click()
    assert "cameras-open" in body.get_attribute("class")
    assert "line-open" not in body.get_attribute("class")
    touch_tablet.locator(f"{SHEET} [data-open-line]").click()
    assert "cameras-open" not in body.get_attribute("class")


def test_a_computer_with_a_mouse_keeps_its_window_and_the_row_of_cameras(tablet):
    open_camera(tablet)
    assert not tablet.locator(f"{SHEET} [data-open-cameras]").is_visible()
    assert tablet.locator(f"{SHEET} [data-thumbs]").is_visible()


def test_the_window_cannot_be_scrolled_off_its_header(touch_tablet):
    open_camera(touch_tablet)
    # Whatever tries (a focused button, a list scrolled into view), the window stays where it is.
    scrolled = touch_tablet.evaluate(f"""() => {{ const panel = document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('{SHEET}').shadowRoot.querySelector('.panel'); panel.scrollTop = 200;
        panel.querySelector('[data-open-line]')?.focus(); return panel.scrollTop; }}""")
    assert scrolled == 0
    assert box(touch_tablet, "header")["y"] == 0


def test_a_camera_away_keeps_the_place_of_its_picture(touch_tablet):
    mount_admin(touch_tablet, {})
    camera = touch_tablet.evaluate("""() => { const { model, hass } = window.dashboard;
        return model.buildCameras(hass(), model.normalizeConfig({}))[0].entityId; }""")
    touch_tablet.evaluate("""(id) => { const chrome = document.querySelector('home-dashboard-chrome');
        const hass = { ...chrome.hass, states: { ...chrome.hass.states,
            [id]: { ...chrome.hass.states[id], state: 'unavailable', attributes: {} } } };
        chrome.hass = hass; chrome.open({ type: 'sheet', sheet: { kind: 'camera', entityId: id } }); }""", camera)
    touch_tablet.wait_for_selector(f"{SHEET} [data-camera-down]")
    touch_tablet.wait_for_timeout(200)
    empty = box(touch_tablet, ".no-picture")
    assert empty["width"] == 1180 and abs(empty["height"] - 1180 * 9 / 16) <= 1
    # The header fills the band above it, as above a picture.
    header = box(touch_tablet, "header")
    assert abs(header["height"] - empty["y"]) <= 1


def test_a_play_button_in_the_middle_starts_the_live_view(touch_tablet):
    open_camera(touch_tablet)
    play = box(touch_tablet, "[data-play-live]")
    picture = box(touch_tablet, ".picture img")
    assert abs((play["x"] + play["width"] / 2) - (picture["x"] + picture["width"] / 2)) <= 1
    assert abs((play["y"] + play["height"] / 2) - (picture["y"] + picture["height"] / 2)) <= 1
    touch_tablet.locator(f"{SHEET} [data-play-live]").click()
    # The live view comes with its waking circle, and the button is gone while it is on.
    touch_tablet.wait_for_selector(f"{SHEET} [data-live-pill]", state="attached")
    assert touch_tablet.locator(f"{SHEET} [data-play-live]").count() == 0
    assert touch_tablet.locator(f"{SHEET} [data-live-waking]").count() == 1


def test_the_age_of_the_picture_stands_in_its_top_left_corner(touch_tablet):
    open_camera(touch_tablet)
    age = box(touch_tablet, ".age")
    picture = box(touch_tablet, ".picture img")
    assert abs(age["y"] - (picture["y"] + 8)) <= 1
    assert abs(age["x"] - (picture["x"] + 8)) <= 1


def test_a_finger_on_the_play_button_starts_the_live_view_and_the_button_stays_under_it(touch_tablet):
    # The press of a finger is animated, as on an iPad (a headless browser asks for less motion).
    touch_tablet.emulate_media(reduced_motion="no-preference")
    open_camera(touch_tablet)
    touch_tablet.wait_for_timeout(800)  # the window slides in first
    before = box(touch_tablet, "[data-play-live]")
    x, y = before["x"] + before["width"] / 2, before["y"] + before["height"] / 2
    session = touch_tablet.context.new_cdp_session(touch_tablet)
    session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
    touch_tablet.wait_for_timeout(200)
    # Pressed, it shrinks where it is: its middle stays under the finger.
    pressed = box(touch_tablet, "[data-play-live]")
    assert abs((pressed["x"] + pressed["width"] / 2) - x) <= 1 and abs((pressed["y"] + pressed["height"] / 2) - y) <= 1
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    touch_tablet.wait_for_selector(f"{SHEET} [data-live-pill]", state="attached")
