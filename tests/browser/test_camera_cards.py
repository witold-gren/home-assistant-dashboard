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


def columns(page) -> int:
    return page.locator(f"{SHEET} [data-camera-cards]").evaluate(
        "(grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length"
    )


def test_a_tablet_shows_them_on_the_whole_black_screen_three_in_a_row(tablet):
    open_cards(tablet)
    panel = tablet.locator(f"{SHEET} .panel[data-kind='cameras']")
    assert "whole" in panel.get_attribute("class")
    assert panel.evaluate("(panel) => getComputedStyle(panel).backgroundColor") == "rgb(0, 0, 0)"
    assert columns(tablet) == 3
    # The name stands at the top of each picture.
    card = tablet.locator(f"{SHEET} [data-camera-card]").first
    assert card.locator("strong").bounding_box()["y"] - card.bounding_box()["y"] < 40


def test_the_button_in_the_header_changes_the_columns_on_this_device(tablet):
    open_cards(tablet)
    button = tablet.locator(f"{SHEET} [data-camera-columns]")
    assert button.inner_text().strip() == "3"
    for expected in (4, 5, 2, 3):
        button.click()
        assert columns(tablet) == expected
        assert tablet.evaluate("localStorage.getItem('home-dashboard-camera-columns')") == str(expected)
    tablet.evaluate("localStorage.removeItem('home-dashboard-camera-columns')")


def test_the_settings_choose_the_columns_and_the_device_its_own(tablet):
    tablet.evaluate("localStorage.removeItem('home-dashboard-camera-columns')")
    mount_admin(tablet, {"cameras": {"columns": 5}})
    tablet.locator("home-dashboard-page [data-cameras-all]").dispatch_event("click")
    tablet.wait_for_selector(f"{SHEET} [data-camera-cards]")
    assert columns(tablet) == 5
    # A choice made on this device stands over the settings'.
    tablet.locator(f"{SHEET} [data-camera-columns]").click()
    assert columns(tablet) == 2
    tablet.evaluate("localStorage.removeItem('home-dashboard-camera-columns')")


def test_a_phone_keeps_them_one_under_another_without_the_button(phone):
    open_cards(phone)
    assert columns(phone) == 1
    assert phone.locator(f"{SHEET} [data-camera-columns]").count() == 0
    assert "whole" not in phone.locator(f"{SHEET} .panel[data-kind='cameras']").get_attribute("class")


def open_featured(page) -> None:
    page.evaluate("localStorage.setItem('home-dashboard-camera-layout', 'featured')")
    open_cards(page)
    page.wait_for_selector(f"{SHEET} .camera-cell.big")


def live_cards(page) -> list:
    return page.evaluate("window.createdCards.filter((card) => card.camera_view === 'live').map((card) => card.entity)")


def test_one_big_camera_plays_live_by_itself_over_two_rows(tablet):
    open_featured(tablet)
    cells = tablet.locator(f"{SHEET} .camera-cell")
    big, small = cells.nth(0), cells.nth(1)
    assert "big" in big.get_attribute("class")
    b, s = big.bounding_box(), small.bounding_box()
    assert b["width"] > 1.9 * s["width"]
    assert b["height"] > 1.9 * s["height"]
    tablet.wait_for_function("window.createdCards.some((card) => card.camera_view === 'live')")
    assert len(live_cards(tablet)) == 1
    assert tablet.locator(f"{SHEET} [data-wall-live] > [data-card]").count() == 1
    tablet.evaluate("localStorage.removeItem('home-dashboard-camera-layout')")


def test_a_tap_puts_a_small_camera_in_the_big_place_and_lets_the_other_go(tablet):
    open_featured(tablet)
    tablet.wait_for_function("window.createdCards.some((card) => card.camera_view === 'live')")
    first = tablet.locator(f"{SHEET} .camera-cell.big [data-camera-card]").get_attribute("data-camera-card")
    # A small camera that has a live view of its own.
    other_id = tablet.evaluate(f"""() => {{ const {{ model, hass }} = window.dashboard;
        const config = model.normalizeConfig({{}});
        const ids = [...document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('{SHEET}').shadowRoot
            .querySelectorAll('.camera-cell:not(.big) [data-camera-card]')].map((card) => card.dataset.cameraCard);
        return ids.find((id) => model.liveCameraFor(hass(), id, config)); }}""")
    tablet.locator(f"{SHEET} [data-camera-card='{other_id}']").click()
    tablet.wait_for_function("window.createdCards.filter((card) => card.camera_view === 'live').length === 2")
    assert tablet.locator(f"{SHEET} .camera-cell.big [data-camera-card]").get_attribute("data-camera-card") == other_id
    # One player only: the one of the camera that left the big place is gone, and no window opened.
    assert tablet.locator(f"{SHEET} [data-wall-live] > [data-card]").count() == 1
    assert tablet.locator(f"{SHEET} .panel[data-kind='cameras']").count() == 1
    assert first != other_id
    tablet.evaluate("localStorage.removeItem('home-dashboard-camera-layout')")


def test_the_corner_button_opens_the_window_of_the_camera_and_the_wall_lets_it_go(tablet):
    open_featured(tablet)
    tablet.wait_for_function("window.createdCards.some((card) => card.camera_view === 'live')")
    expand = tablet.locator(f"{SHEET} .camera-cell:not(.big) [data-camera-expand]").first
    target = expand.get_attribute("data-camera-expand")
    expand.click()
    tablet.wait_for_selector(f"{SHEET} .panel[data-kind='camera']")
    assert tablet.evaluate(f"document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('{SHEET}').sheet.entityId") == target
    assert tablet.evaluate(f"document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('{SHEET}')._wallLive") is None
    # The arrow goes back to the cameras, in the same layout.
    tablet.locator(f"{SHEET} [data-back]").click()
    tablet.wait_for_selector(f"{SHEET} .camera-cell.big")
    tablet.evaluate("localStorage.removeItem('home-dashboard-camera-layout')")


def test_the_header_switches_the_layout_and_the_grid_has_no_corner_buttons(tablet):
    open_cards(tablet)
    assert tablet.locator(f"{SHEET} [data-camera-expand]").count() == 0
    tablet.locator(f"{SHEET} [data-camera-layout]").click()
    tablet.wait_for_selector(f"{SHEET} .camera-cell.big")
    assert tablet.evaluate("localStorage.getItem('home-dashboard-camera-layout')") == "featured"
    tablet.locator(f"{SHEET} [data-camera-layout]").click()
    tablet.wait_for_selector(f"{SHEET} .camera-cell.big", state="detached")
    tablet.wait_for_function(f"!document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('{SHEET}')._wallLive")
    tablet.evaluate("localStorage.removeItem('home-dashboard-camera-layout')")


SMALL = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#654"/></svg>'


def test_a_small_picture_does_not_narrow_the_strip_on_a_tablet(tablet):
    # The last frame of an unavailable camera may be small (320 px): Safari fitted the strip to it and cut the column.
    tablet.route("**/api/*_proxy/**", lambda route: route.fulfill(body=SMALL, content_type="image/svg+xml"))
    mount_admin(tablet, {})
    tablet.wait_for_selector("home-dashboard-page .cameras [data-camera] img")
    sizes = tablet.evaluate("""() => { const root = window.card.shadowRoot;
        const columns = [...root.querySelectorAll('.camera-column')];
        return { widths: columns.map((column) => getComputedStyle(column).width),
            cameras: columns.flatMap((column) => [...column.querySelectorAll('.camera')].map((camera) =>
                Math.abs(camera.getBoundingClientRect().width - column.getBoundingClientRect().width) < 1)) }; }""")
    assert all(width in ("412px", "205px") for width in sizes["widths"])
    assert all(sizes["cameras"])


def test_the_corners_of_the_strip_are_round_and_clipped(tablet):
    mount_admin(tablet, {})
    clip = tablet.evaluate("""() => { const first = window.card.shadowRoot.querySelector('.camera-column:first-child .camera');
        const style = getComputedStyle(first); return [style.borderTopLeftRadius, style.clipPath]; }""")
    assert clip[0] == "24px"
    assert "round 24px" in clip[1]
