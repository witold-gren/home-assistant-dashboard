"""A camera that went away: its window keeps the last picture, dimmed, says the camera is unavailable, and recovers."""

from __future__ import annotations

import base64

from .test_camera_controls import open_slup

SHEET = "home-dashboard-sheet"
SHEET_JS = "document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')"


# A 1x1 PNG: the pictures of cameras load, as they do in Home Assistant.
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==")


def open_camera(page) -> None:
    page.route("**/api/*_proxy/**", lambda route: route.fulfill(body=PNG, content_type="image/png"))
    open_slup(page)
    page.wait_for_function(f"{SHEET_JS}.shadowRoot.querySelector('.picture img')?.naturalWidth === 1")


def set_state(page, entity_id: str, state: str) -> None:
    page.evaluate(f"""async ([id, state]) => {{
        const chrome = document.querySelector('home-dashboard-chrome');
        const hass = {{ ...chrome.hass, states: {{ ...chrome.hass.states, [id]: {{ ...chrome.hass.states[id], state,
            attributes: state === 'unavailable' ? {{ friendly_name: 'Słup' }} : chrome.hass.states[id].attributes }} }} }};
        window.dashboard.snapshot.states[id] = hass.states[id];
        chrome.hass = hass;
        const sheet = {SHEET_JS}; sheet.hass = hass; await sheet.updateComplete; }}""", [entity_id, state])


def test_a_camera_that_goes_away_keeps_its_last_picture_and_says_so(phone):
    open_camera(phone)
    picture = phone.locator(f"{SHEET} .picture img").get_attribute("src")
    assert phone.locator(f"{SHEET} [data-camera-down]").count() == 0
    set_state(phone, "image.slup_last_screen", "unavailable")
    phone.wait_for_selector(f"{SHEET} [data-camera-down]")
    assert phone.locator(f"{SHEET} [data-camera-down]").inner_text() == "Kamera jest niedostępna"
    # The same window, not a black one: the last picture under a dim veil, and no live view to start.
    assert phone.locator(f"{SHEET} .picture img").get_attribute("src") == picture
    assert phone.locator(f"{SHEET} home-dashboard-timeline").count() == 1
    assert phone.locator(f"{SHEET} home-dashboard-timeline").evaluate("(line) => line.canLive") is False
    set_state(phone, "image.slup_last_screen", "2026-11-10T18:00:00")
    phone.wait_for_selector(f"{SHEET} [data-camera-down]", state="detached")


def test_a_live_camera_that_goes_away_ends_the_live_view(phone):
    open_camera(phone)
    phone.evaluate(f"async () => {{ const sheet = {SHEET_JS}; sheet._live = true; await sheet.updateComplete; }}")
    set_state(phone, "camera.slup", "unavailable")
    phone.wait_for_selector(f"{SHEET} [data-camera-down]")
    assert phone.evaluate(f"{SHEET_JS}._live") is False


def test_a_picture_that_does_not_load_is_asked_for_again(phone):
    open_camera(phone)
    phone.locator(f"{SHEET} .picture img").dispatch_event("error")
    phone.wait_for_selector(f"{SHEET} [data-camera-down]")
    # Asked for again after five seconds; once it loads, the camera is back without anyone doing anything.
    phone.wait_for_selector(f"{SHEET} [data-camera-down]", state="detached", timeout=8000)
