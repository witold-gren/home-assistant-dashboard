"""The map page and its list."""

from __future__ import annotations

from .test_page import mount
from .test_panels import add_entity

PANEL = "home-dashboard-page [data-map-panel]"


def add_places(page) -> None:
    add_entity(page, "device_tracker.phone", "home", {"friendly_name": "Telefon", "latitude": 52.0, "longitude": 21.0})
    add_entity(page, "device_tracker.silent", "home", {"friendly_name": "Bez pozycji"})
    add_entity(page, "person.a", "home", {"friendly_name": "Alex"})
    add_entity(page, "zone.school", "2", {"friendly_name": "Szkoła", "latitude": 52.1, "longitude": 21.1, "icon": "mdi:school"})


def open_map(page, dashboard: dict | None = None) -> None:
    add_places(page)
    mount(page, dashboard or {}, "map")
    page.wait_for_selector(PANEL)


def tab(page, key: str) -> None:
    page.locator(f"{PANEL} [data-map-tab='{key}']").click()


def test_the_list_starts_with_people(phone):
    open_map(phone)
    assert "selected" in phone.locator(f"{PANEL} [data-map-tab='people']").get_attribute("class")
    assert phone.locator(f"{PANEL} [data-person]").count() > 0


def test_devices_are_those_that_report_a_place(phone):
    open_map(phone)
    tab(phone, "devices")
    assert phone.locator(f"{PANEL} [data-map-row='device_tracker.phone']").count() == 1
    assert phone.locator(f"{PANEL} [data-map-row='device_tracker.silent']").count() == 0


def test_a_zone_says_how_many_people_are_in_it(phone):
    open_map(phone)
    tab(phone, "zones")
    assert "Osoby tutaj: 2" in phone.locator(f"{PANEL} [data-map-row='zone.school']").inner_text()


def test_tapping_a_row_shows_it_on_the_map(phone):
    open_map(phone)
    phone.evaluate("""() => {
        const page = document.querySelector("home-dashboard-page") ?? window.card.shadowRoot.querySelector("home-dashboard-page");
        window.fitted = [];
        const map = { fitBounds: (bounds) => window.fitted.push(bounds) };
        page._cards = [{ shadowRoot: { querySelector: () => map } }];
    }""")
    tab(phone, "zones")
    phone.locator(f"{PANEL} [data-map-row='zone.school'] button").click()
    assert phone.evaluate("window.fitted") == [[[52.1, 21.1], [52.1, 21.1]]]


def drag_grip(page, distance: int) -> None:
    box = page.locator(f"{PANEL} [data-map-grip]").bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x, y + distance / 2)
    page.mouse.move(x, y + distance)
    page.mouse.up()
    page.wait_for_timeout(300)


def panel_height(page) -> float:
    return page.locator(PANEL).bounding_box()["height"]


def test_a_tap_on_the_bar_folds_and_unfolds_the_list(phone):
    open_map(phone)
    phone.locator(f"{PANEL} [data-map-grip]").click()
    assert "folded" in phone.locator(PANEL).get_attribute("class")
    phone.wait_for_timeout(300)
    phone.locator(f"{PANEL} [data-map-grip]").click()
    assert "folded" not in phone.locator(PANEL).get_attribute("class")


def test_dragging_down_leaves_a_thin_bar_and_the_map_on_the_whole_screen(phone):
    open_map(phone)
    drag_grip(phone, 300)
    assert "folded" in phone.locator(PANEL).get_attribute("class")
    assert panel_height(phone) <= 32


def test_dragging_up_brings_the_list_back(phone):
    open_map(phone)
    drag_grip(phone, 300)
    drag_grip(phone, -300)
    assert "folded" not in phone.locator(PANEL).get_attribute("class")
    assert panel_height(phone) > 200


def page_height(page) -> float:
    return page.locator("home-dashboard-page .map-page").bounding_box()["height"]


def test_dragging_up_from_the_middle_covers_the_map(phone):
    open_map(phone)
    drag_grip(phone, -300)
    assert "full" in phone.locator(PANEL).get_attribute("class")
    assert panel_height(phone) == page_height(phone)


def test_from_the_whole_screen_the_list_goes_to_the_middle_or_to_the_bottom(phone):
    open_map(phone)
    drag_grip(phone, -300)
    drag_grip(phone, 300)
    assert "half" in phone.locator(PANEL).get_attribute("class")
    drag_grip(phone, -300)
    drag_grip(phone, 700)
    assert "folded" in phone.locator(PANEL).get_attribute("class")


def test_choosing_something_on_the_whole_screen_brings_the_map_back(phone):
    open_map(phone)
    drag_grip(phone, -300)
    tab(phone, "zones")
    phone.locator(f"{PANEL} [data-map-row='zone.school'] button").click()
    assert "half" in phone.locator(PANEL).get_attribute("class")


def test_a_tap_on_the_bar_of_the_whole_screen_folds_it(phone):
    open_map(phone)
    drag_grip(phone, -300)
    phone.locator(f"{PANEL} [data-map-grip]").click()
    assert "folded" in phone.locator(PANEL).get_attribute("class")


def test_a_short_drag_goes_back_to_where_it_was(phone):
    open_map(phone)
    drag_grip(phone, 40)
    assert "folded" not in phone.locator(PANEL).get_attribute("class")


def test_the_panel_follows_the_finger(phone):
    open_map(phone)
    start = panel_height(phone)
    box = phone.locator(f"{PANEL} [data-map-grip]").bounding_box()
    x, y = box["x"] + 50, box["y"] + 10
    phone.mouse.move(x, y)
    phone.mouse.down()
    phone.mouse.move(x, y + 100)
    assert abs(panel_height(phone) - (start - 100)) < 3
    phone.mouse.up()


def test_the_page_does_not_take_the_gesture_from_the_bar(phone):
    open_map(phone)
    style = phone.locator(f"{PANEL} .map-grab").evaluate("(grab) => getComputedStyle(grab).touchAction")
    assert style == "none"


def test_a_drag_does_not_count_as_a_tap_on_a_tab(phone):
    open_map(phone)
    box = phone.locator(f"{PANEL} [data-map-tab='zones']").bounding_box()
    x, y = box["x"] + 10, box["y"] + 10
    phone.mouse.move(x, y)
    phone.mouse.down()
    phone.mouse.move(x, y + 3)
    phone.mouse.move(x, y + 8)
    phone.mouse.move(x, y)
    phone.mouse.up()
    assert "selected" not in phone.locator(f"{PANEL} [data-map-tab='zones']").get_attribute("class")


def test_a_tablet_ignores_the_drag(tablet):
    open_map(tablet)
    box = tablet.locator(f"{PANEL} [data-map-tab='zones']").bounding_box()
    tablet.mouse.move(box["x"] + 5, box["y"] + 5)
    tablet.mouse.down()
    tablet.mouse.move(box["x"] + 5, box["y"] + 200)
    tablet.mouse.up()
    assert "folded" not in tablet.locator(PANEL).get_attribute("class")


def test_a_tablet_has_a_floating_panel_on_the_left(tablet):
    open_map(tablet)
    box = tablet.locator(PANEL).bounding_box()
    page = tablet.locator("home-dashboard-page .map-page").bounding_box()
    assert box["width"] == 320
    assert box["x"] - page["x"] == 12
    assert box["height"] < page["height"]


def test_the_map_takes_the_room_left_by_the_bars(phone):
    open_map(phone)
    assert phone.locator("home-dashboard-page .map-page").bounding_box()["height"] > 600


def test_what_someone_may_not_see_stays_out_of_the_list(phone):
    open_map(phone, {"access": {}})
    result = phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        return model.buildTrackers(hass(), { denied: ["device_tracker.phone"] }).map((item) => item.entityId);
    }""")
    assert "device_tracker.phone" not in result


def test_the_buttons_of_the_map_move_away_from_the_list(phone):
    open_map(phone)
    result = phone.evaluate("""() => {
        const page = document.querySelector("home-dashboard-page") ?? window.card.shadowRoot.querySelector("home-dashboard-page");
        const host = document.createElement("div");
        const card = host.attachShadow({ mode: "open" });
        const map = document.createElement("ha-map");
        const inner = map.attachShadow({ mode: "open" });
        inner.innerHTML = '<div class="maplibregl-ctrl-top-left"></div>';
        const buttons = document.createElement("div");
        buttons.append(document.createElement("ha-icon-button"));
        card.append(map, buttons);
        page._cards = [host];
        page._placeMapControls(0);
        return [inner.querySelector("style")?.textContent.includes("right: 0"), buttons.style.right];
    }""")
    assert result == [True, "3px"]


def test_a_map_without_those_buttons_stays_as_it_is(phone):
    open_map(phone)
    phone.evaluate("""() => {
        const page = document.querySelector("home-dashboard-page") ?? window.card.shadowRoot.querySelector("home-dashboard-page");
        page._cards = [document.createElement("div")];
        page._placeMapControls(0);
    }""")


def test_the_menu_of_areas_stays_on_the_map(phone):
    open_map(phone)
    assert phone.locator(f"{PANEL} [data-rooms]").count() == 1


def test_the_longest_greeting_fits_one_line_on_a_phone(phone):
    mount(phone, {}, "home")
    box = phone.evaluate("""() => {
        const title = window.card.shadowRoot.querySelector("h1");
        title.querySelector(".title-now").textContent = "Dobry wieczór Aleksander";
        return { height: title.getBoundingClientRect().height, fits: title.scrollWidth <= title.clientWidth };
    }""")
    assert box["height"] < 45
    assert box["fits"] is True
