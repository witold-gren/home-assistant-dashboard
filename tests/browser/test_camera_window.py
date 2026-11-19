"""The window of a camera opened from outside: by an automation (motion seen) or by the address of a notification."""

from __future__ import annotations

from .test_camera_controls import ADD_DEVICE
from .test_shortcuts import mount_admin

CHROME = "document.querySelector('home-dashboard-chrome')"
SHEET = "home-dashboard-sheet"
EVENT = {
    "entity_id": "camera.slup",
    "picture": "image.slup_last_event",
    "title": "Ruch przy słupie",
    "close_after": 15,
    "live_limit": 600,
}


def setup(page, cameras: dict | None = None, browser_id: str | None = "hall_ipad") -> None:
    page.evaluate(ADD_DEVICE)
    page.evaluate("""() => { const snapshot = window.dashboard.snapshot;
        snapshot.entities['image.slup_last_event'] = { entity_id: 'image.slup_last_event', device_id: 'ptz_device', hidden: false };
        snapshot.states['image.slup_last_event'] = { entity_id: 'image.slup_last_event', state: '2026-11-17T10:00:00',
            attributes: { friendly_name: 'Słup Last event', entity_picture: '/api/image_proxy/image.slup_last_event?event=1' } }; }""")
    if browser_id:
        page.evaluate("(id) => localStorage.setItem('browser_mod-browser-id', id)", browser_id)
    mount_admin(page, {"cameras": {"tiles": ["image.slup_last_screen"], **(cameras or {})}})
    page.wait_for_function("(globalThis.cameraSubscriptions ?? []).length > 0")


def show(page, **change) -> None:
    page.evaluate("(camera) => window.showCamera(camera)", {"request": 7, **EVENT, **change})


def closed(page) -> list[dict]:
    return page.evaluate("window.saved.filter((message) => message.type === 'home_dashboard/camera/closed')")


def wait_closed(page) -> dict:
    page.wait_for_function("window.saved.some((message) => message.type === 'home_dashboard/camera/closed')")
    (message,) = closed(page)
    return message


def sheet_open(page) -> bool:
    return page.evaluate(
        f"Boolean({CHROME}.shadowRoot.querySelector('{SHEET}')?.shadowRoot.querySelector('.panel'))"
    )


def test_the_dashboard_listens_with_the_id_of_its_device(phone):
    setup(phone)
    (subscription,) = phone.evaluate("globalThis.cameraSubscriptions.map((each) => each.message)")
    assert subscription == {"type": "home_dashboard/camera/subscribe", "browser_id": "hall_ipad"}


def test_without_browser_mod_it_listens_for_everyone(phone):
    setup(phone, browser_id=None)
    assert phone.evaluate("globalThis.cameraSubscriptions[0].message.browser_id") is None


def test_motion_opens_the_camera_window_with_the_picture_of_the_event_and_its_title(phone):
    setup(phone)
    show(phone)
    phone.wait_for_selector(f"{SHEET} .panel[data-kind='camera']")
    assert phone.evaluate(f"{CHROME}._overlay.sheet.entityId") == "image.slup_last_screen"
    assert phone.locator(f"{SHEET} header h2").inner_text() == "Ruch przy słupie"
    assert (
        phone.locator(f"{SHEET} .picture img")
        .first.get_attribute("src")
        .endswith("image.slup_last_event?event=1")
    )
    assert closed(phone) == []


def test_the_window_closes_by_itself_and_says_so(phone):
    setup(phone)
    show(phone, close_after=1)
    phone.wait_for_selector(f"{SHEET} .panel")
    message = wait_closed(phone)
    assert not sheet_open(phone)
    assert message == {
        "type": "home_dashboard/camera/closed",
        "request": 7,
        "entity_id": "camera.slup",
        "reason": "timeout",
        "browser_id": "hall_ipad",
        "live": False,
    }


def hide_page(page, hidden: bool) -> None:
    page.evaluate(
        """(hidden) => {
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
            document.dispatchEvent(new Event('visibilitychange'));
        }""",
        hidden,
    )


def test_a_window_on_a_dark_screen_counts_its_time_once_it_is_seen(phone):
    setup(phone)
    hide_page(phone, True)
    show(phone, close_after=1)
    phone.wait_for_selector(f"{SHEET} .panel")
    phone.wait_for_timeout(1600)
    assert sheet_open(phone) and closed(phone) == []
    hide_page(phone, False)
    phone.wait_for_timeout(400)
    assert sheet_open(phone)
    assert wait_closed(phone)["reason"] == "timeout"


def test_a_screen_that_goes_dark_again_gives_the_window_its_full_time(phone):
    setup(phone)
    show(phone, close_after=1)
    phone.wait_for_selector(f"{SHEET} .panel")
    phone.wait_for_timeout(600)
    hide_page(phone, True)
    phone.wait_for_timeout(1000)
    hide_page(phone, False)
    phone.wait_for_timeout(600)
    assert sheet_open(phone) and closed(phone) == []
    assert wait_closed(phone)["reason"] == "timeout"


def test_the_live_view_keeps_it_open_and_closing_says_it_was_watched(phone):
    setup(phone)
    show(phone, close_after=1)
    phone.locator("[data-timeline-live]").click()
    phone.wait_for_timeout(1500)
    assert sheet_open(phone)
    assert closed(phone) == []
    phone.get_by_label("Zamknij").first.click()
    message = wait_closed(phone)
    assert (message["reason"], message["live"]) == ("closed", True)


def test_a_touch_keeps_it_open_until_the_longest_live_view(phone):
    setup(phone)
    show(phone, close_after=1, live_limit=2)
    phone.locator(f"{SHEET} .panel").click(position={"x": 30, "y": 300})
    phone.wait_for_timeout(1300)
    assert sheet_open(phone)
    assert wait_closed(phone)["reason"] == "timeout"


def test_esc_closes_it_and_says_so(phone):
    setup(phone)
    show(phone, close_after=0)
    phone.wait_for_selector(f"{SHEET} .panel")
    phone.keyboard.press("Escape")
    assert wait_closed(phone)["reason"] == "closed"


def test_a_window_already_there_is_not_taken_away(phone):
    setup(phone)
    phone.evaluate(f"() => {CHROME}.open({{ type: 'settings' }})")
    show(phone)
    assert wait_closed(phone)["reason"] == "busy"
    assert phone.evaluate(f"{CHROME}._overlay.type") == "settings"


def test_a_second_motion_does_not_replace_the_first(phone):
    setup(phone)
    show(phone, close_after=0)
    phone.wait_for_selector(f"{SHEET} .panel")
    show(phone, request=8, title="Drugi")
    assert wait_closed(phone)["request"] == 8
    assert phone.locator(f"{SHEET} header h2").inner_text() == "Ruch przy słupie"


def test_a_camera_hidden_from_this_dashboard_is_not_shown(phone):
    setup(phone, cameras={"hide": ["image.slup_last_screen"], "tiles": []})
    show(phone)
    assert wait_closed(phone)["reason"] == "hidden"
    assert not sheet_open(phone)


def test_a_camera_home_assistant_does_not_know_is_said(phone):
    setup(phone)
    show(phone, entity_id="camera.nowhere")
    assert wait_closed(phone)["reason"] == "unknown_camera"


def test_a_notification_opens_the_camera_live_and_the_address_forgets_it(phone):
    phone.evaluate("() => history.replaceState(null, '', location.pathname + '?camera=camera.slup&live=1')")
    setup(phone)
    phone.wait_for_selector(f"{SHEET} .panel[data-kind='camera']")
    phone.wait_for_selector("[data-card='picture-entity']", state="attached")
    assert phone.evaluate("window.createdCards.at(-1).entity") == "camera.slup"
    assert "camera=" not in phone.url


def test_a_live_view_asked_for_starts_at_once_and_still_closes_in_time(phone):
    setup(phone)
    show(phone, entity_id="camera.slup", picture=None, close_after=1, live=True)
    phone.wait_for_selector("[data-card='picture-entity']", state="attached")
    assert phone.evaluate("window.createdCards.at(-1).camera_view") == "live"
    message = wait_closed(phone)
    assert (message["reason"], message["live"]) == ("timeout", True)
    assert not sheet_open(phone)


def test_the_doorbell_comes_first_and_takes_the_place_of_a_motion_window(phone):
    setup(phone)
    show(phone, close_after=0)
    phone.wait_for_selector(f"{SHEET} .panel")
    show(phone, request=8, title="Dzwonek", picture=None, live=True, interrupt=True, close_after=0)
    phone.wait_for_selector("[data-card='picture-entity']", state="attached")
    assert phone.locator(f"{SHEET} header h2").inner_text() == "Dzwonek"
    (replaced,) = closed(phone)
    assert (replaced["request"], replaced["reason"]) == (7, "replaced")
    phone.keyboard.press("Escape")
    phone.wait_for_function(
        "window.saved.filter((m) => m.type === 'home_dashboard/camera/closed').length === 2"
    )
    assert closed(phone)[1]["request"] == 8


def test_even_the_doorbell_does_not_take_the_settings_away(phone):
    setup(phone)
    phone.evaluate(f"() => {CHROME}.open({{ type: 'settings' }})")
    show(phone, interrupt=True, live=True)
    assert wait_closed(phone)["reason"] == "busy"
    assert phone.evaluate(f"{CHROME}._overlay.type") == "settings"


ADD_EUFY = """() => { const snapshot = window.dashboard.snapshot;
    snapshot.devices.eufy_room = { id: 'eufy_room', name: 'Pokój eufy', area_id: Object.keys(snapshot.areas)[0] };
    for (const [id, state, picture] of [['camera.room_eufy', 'idle', '/api/camera_proxy/camera.room_eufy'],
                                        ['image.room_eufy_last_screen', '2026-11-17T10:00:00', '/api/image_proxy/x']]) {
        snapshot.entities[id] = { entity_id: id, device_id: 'eufy_room', hidden: false };
        snapshot.states[id] = { entity_id: id, state, attributes: { friendly_name: id, entity_picture: picture } };
    } }"""


def test_a_camera_shown_through_another_opens_the_window_of_that_one(phone):
    # The eufy camera of a room is hidden, its Frigate camera is shown and takes its turning (cameras.controls).
    phone.evaluate(ADD_EUFY)
    setup(
        phone,
        cameras={
            "hide": ["image.room_eufy_last_screen", "camera.room_eufy"],
            "controls": {"image.slup_last_screen": "camera.room_eufy"},
        },
    )
    show(phone, entity_id="camera.room_eufy", close_after=0)
    phone.wait_for_selector(f"{SHEET} .panel[data-kind='camera']")
    assert phone.evaluate(f"{CHROME}._overlay.sheet.entityId") == "image.slup_last_screen"
    phone.keyboard.press("Escape")
    wait_closed(phone)
    show(phone, request=8, entity_id="image.room_eufy_last_screen", close_after=0)
    phone.wait_for_selector(f"{SHEET} .panel[data-kind='camera']")
    assert phone.evaluate(f"{CHROME}._overlay.sheet.entityId") == "image.slup_last_screen"


def test_a_camera_shown_through_a_hidden_one_is_not_shown(phone):
    phone.evaluate(ADD_EUFY)
    setup(
        phone,
        cameras={
            "tiles": [],
            "hide": [
                "image.room_eufy_last_screen",
                "camera.room_eufy",
                "image.slup_last_screen",
                "camera.slup",
            ],
            "controls": {"image.slup_last_screen": "camera.room_eufy"},
        },
    )
    show(phone, entity_id="camera.room_eufy")
    assert wait_closed(phone)["reason"] == "hidden"
    assert not sheet_open(phone)
