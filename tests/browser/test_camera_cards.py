"""The heading Cameras on Home opens all cameras one under another; a camera opened from there goes back to them."""

from __future__ import annotations

from .test_shortcuts import mount_admin

SHEET = "home-dashboard-sheet"


def open_cards(page) -> list:
    mount_admin(page, {})
    shown = page.locator("home-dashboard-page .cameras [data-camera]").evaluate_all(
        "(cameras) => cameras.map((camera) => camera.dataset.camera)"
    )
    # The test page lies under the tablet's side bar, which the real layout keeps beside it: click the heading itself.
    page.locator("home-dashboard-page [data-cameras-all]").dispatch_event("click")
    page.wait_for_selector(f"{SHEET} [data-camera-cards]")
    return shown


def cards(page) -> list:
    return page.locator(f"{SHEET} [data-camera-card]").evaluate_all("(cards) => cards.map((card) => card.dataset.cameraCard)")


def test_the_heading_of_cameras_opens_them_all_one_under_another(phone):
    shown = open_cards(phone)
    assert shown
    assert sorted(cards(phone)) == sorted(shown)
    first, second = phone.locator(f"{SHEET} [data-camera-card]").all()[:2]
    a, b = first.bounding_box(), second.bounding_box()
    # One under another, as wide as the window, 16:9.
    assert b["y"] > a["y"] + a["height"] - 1
    assert abs(a["width"] / a["height"] - 16 / 9) < 0.05
    assert first.locator("strong").inner_text()


def test_a_tablet_shows_two_side_by_side(tablet):
    open_cards(tablet)
    first, second = tablet.locator(f"{SHEET} [data-camera-card]").all()[:2]
    assert abs(first.bounding_box()["y"] - second.bounding_box()["y"]) < 1


def test_a_camera_opened_from_the_list_goes_back_to_it(phone):
    open_cards(phone)
    camera = cards(phone)[0]
    phone.locator(f"{SHEET} [data-camera-card='{camera}']").click()
    phone.wait_for_selector(f"{SHEET} home-dashboard-timeline", state="attached")
    assert phone.locator(f"{SHEET} header [data-back]").count() == 1
    phone.locator(f"{SHEET} header [data-back]").click()
    phone.wait_for_selector(f"{SHEET} [data-camera-cards]")
    assert cards(phone)


def test_a_camera_opened_from_the_page_still_closes(phone):
    mount_admin(phone, {})
    phone.locator("home-dashboard-page .cameras [data-camera]").first.click()
    phone.wait_for_selector(f"{SHEET} home-dashboard-timeline", state="attached")
    assert phone.locator(f"{SHEET} header [data-back]").count() == 0


def test_the_window_scrolls_as_a_whole_with_its_heading(phone):
    open_cards(phone)
    # The list has no scrolling box of its own: the window scrolls, and the heading goes up with the cards.
    assert phone.locator(f"{SHEET} [data-camera-cards]").evaluate("(list) => getComputedStyle(list).overflowY") == "visible"
    heading = phone.locator(f"{SHEET} header").bounding_box()["y"]
    phone.locator(f"{SHEET} .panel").evaluate("(panel) => panel.scrollBy(0, 200)")
    phone.wait_for_timeout(100)
    assert phone.locator(f"{SHEET} header").bounding_box()["y"] < heading - 100
