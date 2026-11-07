"""The overview shortcut and its screen."""

from __future__ import annotations

from .test_page import mount
from .test_panels import add_entity

SHEET = "home-dashboard-sheet"
SCREEN = "home-dashboard-overview"
SUNDAY = "2026-11-08T12:00:00"
MONDAY = "2026-11-09T12:00:00"
JULY_SUNDAY = "2026-07-05T12:00:00"


def item_says(page, item: dict, now: str = MONDAY):
    return page.evaluate(
        """async ({ item, now }) => {
            const { overviewItem } = await import("/custom_components/home_dashboard/www/app/overview.js");
            return overviewItem(window.dashboard.hass(), item, new Date(now));
        }""",
        {"item": item, "now": now},
    )


def open_status(page, sections: list) -> None:
    mount(page, {"shortcuts": [{"kind": "overview", "name": "Status", "icon": "mdi:check", "sections": sections}]})
    page.locator("home-dashboard-page [data-shortcut='Status']").click()
    page.wait_for_selector(f"{SHEET} {SCREEN} [data-status-now]")


def cold_section() -> list:
    return [{"title": "Uwaga", "alert": True, "items": [cold_item()]}]


def cold_item() -> dict:
    return {"name": "Zimno", "icon": "mdi:snowflake", "attribute": "current_temperature", "unit": "°", "below": 19,
            "entities": [{"entity": "climate.bed", "name": "Sypialnia"}, "climate.salon"]}


def add_rooms(page) -> None:
    add_entity(page, "climate.bed", "auto", {"current_temperature": 17.5})
    add_entity(page, "climate.salon", "auto", {"current_temperature": 21, "friendly_name": "Salon"})


def test_only_the_entities_in_the_wanted_state_are_listed(phone):
    add_entity(phone, "binary_sensor.a", "on", {"friendly_name": "Okno A"})
    add_entity(phone, "binary_sensor.b", "off", {"friendly_name": "Okno B"})
    said = item_says(phone, {"name": "Okna", "icon": "x", "entities": ["binary_sensor.a", "binary_sensor.b"]})
    assert [row["name"] for row in said["rows"]] == ["Okno A"]
    assert said["count"] == 1


def test_an_item_with_nothing_to_say_is_gone(phone):
    add_entity(phone, "binary_sensor.b", "off", {})
    assert item_says(phone, {"name": "Okna", "icon": "x", "entities": ["binary_sensor.b"]}) is None


def test_a_room_below_the_limit_shows_with_its_own_name_and_value(phone):
    add_rooms(phone)
    said = item_says(phone, cold_item())
    assert [(row["name"], row["value"]) for row in said["rows"]] == [("Sypialnia", "17,5°")]


def test_a_limit_is_not_reached_at_the_exact_value(phone):
    add_entity(phone, "sensor.range", "100", {"unit_of_measurement": "km"})
    assert item_says(phone, {"name": "Paliwo", "icon": "x", "entities": ["sensor.range"], "below": 100}) is None


def test_the_unit_of_the_sensor_is_used(phone):
    add_entity(phone, "sensor.range", "80", {"unit_of_measurement": "km", "friendly_name": "Zasięg"})
    said = item_says(phone, {"name": "Paliwo", "icon": "x", "entities": ["sensor.range"], "below": 100})
    assert said["rows"][0]["value"] == "80 km"


def test_a_sensor_without_a_number_never_counts_as_low(phone):
    add_entity(phone, "sensor.range", "unavailable", {"unit_of_measurement": "km"})
    add_entity(phone, "sensor.empty", "", {"unit_of_measurement": "km"})
    item = {"name": "Paliwo", "icon": "x", "entities": ["sensor.range", "sensor.empty", "sensor.gone"], "below": 100}
    assert item_says(phone, item) is None


def test_batteries_are_found_by_themselves_and_only_percentages_count(phone):
    add_entity(phone, "sensor.door_battery", "8", {"unit_of_measurement": "%", "friendly_name": "Drzwi"})
    add_entity(phone, "sensor.lock", "4", {"unit_of_measurement": "%", "device_class": "battery"})
    add_entity(phone, "sensor.robot_battery_voltage", "3", {"unit_of_measurement": "V"})
    add_entity(phone, "sensor.remote_battery", "50", {"unit_of_measurement": "%"})
    said = item_says(phone, {"name": "Baterie", "icon": "x", "auto": "battery", "below": 11})
    assert [row["entity"] for row in said["rows"]] == ["sensor.lock", "sensor.door_battery"]


def test_a_list_from_an_attribute_uses_the_chosen_fields(phone):
    devices = [{"nazwa": "Krzesło", "obszar": "Jadalnia", "od": "2026-11-06T20:24:44+00:00"}]
    add_entity(phone, "sensor.gone", "1", {"urzadzenia": devices})
    item = {"name": "Niedostępne", "icon": "x",
            "list": {"entity": "sensor.gone", "attribute": "urzadzenia", "name": "nazwa", "detail": "obszar", "since": "od"}}
    said = item_says(phone, item)
    assert said["count"] == 1
    assert said["rows"][0]["name"] == "Krzesło"
    assert said["rows"][0]["detail"] == "Jadalnia"
    assert said["rows"][0]["value"]


def test_an_empty_list_is_gone(phone):
    add_entity(phone, "sensor.gone", "0", {"urzadzenia": []})
    item = {"name": "N", "icon": "x", "list": {"entity": "sensor.gone", "attribute": "urzadzenia", "name": "nazwa"}}
    assert item_says(phone, item) is None


def test_a_working_device_shows_its_label_and_only_facts_with_a_value(phone):
    add_entity(phone, "sensor.washer", "Running", {})
    add_entity(phone, "sensor.program", "Bawełna", {})
    add_entity(phone, "sensor.left", "—", {})
    add_entity(phone, "sensor.start", "0", {})
    item = {"name": "Pralka", "icon": "x", "entity": "sensor.washer", "state": ["Running"], "labels": {"Running": "Pierze"},
            "facts": [{"name": "Program", "entity": "sensor.program"}, {"name": "Zostało", "entity": "sensor.left"},
                      {"name": "Start za", "entity": "sensor.start", "unit": "min"}]}
    said = item_says(phone, item)
    assert said["text"] == "Pierze"
    assert said["facts"] == [{"name": "Program", "value": "Bawełna"}]


def test_a_resting_device_is_gone(phone):
    add_entity(phone, "sensor.washer", "Off", {})
    assert item_says(phone, {"name": "P", "icon": "x", "entity": "sensor.washer", "state": ["Running"]}) is None


def test_a_text_can_belong_to_one_day_of_the_week(phone):
    item = {"name": "Msze", "icon": "x", "text": "8.00, 10.00", "weekdays": [7]}
    assert item_says(phone, item, SUNDAY)["text"] == "8.00, 10.00"
    assert item_says(phone, item, MONDAY) is None


def test_a_text_can_belong_to_chosen_months(phone):
    item = {"name": "Msze", "icon": "x", "text": "lato", "weekdays": [7], "months": [7, 8]}
    assert item_says(phone, item, JULY_SUNDAY)["text"] == "lato"
    assert item_says(phone, item, SUNDAY) is None


def test_the_screen_shows_the_time_and_says_when_all_is_well(phone):
    add_entity(phone, "climate.bed", "auto", {"current_temperature": 21})
    add_entity(phone, "climate.salon", "auto", {"current_temperature": 21})
    open_status(phone, cold_section())
    assert ":" in phone.locator(f"{SCREEN} [data-status-now] strong").text_content()
    assert "Wszystko w porządku" in phone.locator(f"{SCREEN} [data-status-summary]").text_content()
    assert phone.locator(f"{SCREEN} [data-status-section]").count() == 0


def test_the_summary_counts_what_needs_a_look(phone):
    add_rooms(phone)
    add_entity(phone, "binary_sensor.a", "on", {"friendly_name": "Okno"})
    calm = {"title": "W domu", "items": [{"name": "Okna", "icon": "x", "entities": ["binary_sensor.a"]}]}
    open_status(phone, [*cold_section(), calm])
    assert "Do sprawdzenia: 1" in phone.locator(f"{SCREEN} [data-status-summary]").text_content()
    assert phone.locator(f"{SCREEN} [data-status-section]").count() == 2


def test_a_row_opens_the_details_of_its_entity(phone):
    add_rooms(phone)
    open_status(phone, cold_section())
    phone.evaluate("""() => {
        window.opened = [];
        document.querySelector("home-dashboard-chrome").addEventListener("hass-more-info", (event) => window.opened.push(event.detail.entityId));
    }""")
    phone.locator(f"{SCREEN} [data-status-row='climate.bed']").click()
    phone.wait_for_function("window.opened.length === 1")
    assert phone.evaluate("window.opened") == ["climate.bed"]


def test_the_screen_follows_the_states(phone):
    add_rooms(phone)
    open_status(phone, cold_section())
    phone.evaluate("""() => {
        const chrome = document.querySelector("home-dashboard-chrome");
        const states = { ...chrome.hass.states };
        states["climate.bed"] = { ...states["climate.bed"], attributes: { current_temperature: 21 } };
        chrome.hass = { ...chrome.hass, states };
    }""")
    phone.wait_for_selector(f"{SCREEN} [data-status-item='Zimno']", state="detached")


def test_an_alert_tile_is_red_and_a_calm_one_is_not(phone):
    add_window(phone)
    calm = {"title": "W domu", "items": [{"name": "Okna", "icon": "x", "entities": ["binary_sensor.a"]}]}
    open_status(phone, [*cold_section(), calm])
    assert "alert" in phone.locator(f"{SCREEN} [data-status-row='climate.bed']").get_attribute("class")
    assert "alert" not in phone.locator(f"{SCREEN} [data-status-row='binary_sensor.a']").get_attribute("class")


def test_a_group_opens_by_itself_and_can_be_folded(phone):
    add_window(phone)
    open_status(phone, [{"title": "W domu", "items": [{"name": "Okna", "icon": "x", "entities": ["binary_sensor.a"]}]}])
    group = phone.locator(f"{SCREEN} details[data-status-item='Okna']")
    assert group.get_attribute("open") is not None
    group.locator("summary").click()
    assert group.get_attribute("open") is None


def test_a_tablet_keeps_the_window_of_the_other_screens(tablet):
    add_rooms(tablet)
    open_status(tablet, cold_section())
    assert "whole" not in tablet.locator(f"{SHEET} section.panel").get_attribute("class")


def bottom_section() -> dict:
    return {"alert": True, "bottom": True, "items": [{"name": "Niedostępne", "icon": "x", "entities": ["binary_sensor.a"]}]}


def add_window(page) -> None:
    add_rooms(page)
    add_entity(page, "binary_sensor.a", "on", {"friendly_name": "Okno"})


def test_a_bottom_section_stays_last_wherever_it_stands_in_the_config(phone):
    add_window(phone)
    open_status(phone, [bottom_section(), *cold_section()])
    tops = phone.locator(f"{SCREEN} [data-status-item]").evaluate_all(
        "(items) => Object.fromEntries(items.map((item) => [item.dataset.statusItem, item.getBoundingClientRect().top]))"
    )
    assert tops["Niedostępne"] > tops["Zimno"]


def test_a_bottom_section_still_counts_in_the_summary(phone):
    add_window(phone)
    open_status(phone, [bottom_section(), *cold_section()])
    assert "Do sprawdzenia: 2" in phone.locator(f"{SCREEN} [data-status-summary]").text_content()


def test_a_section_without_a_title_has_no_heading(phone):
    add_window(phone)
    open_status(phone, [bottom_section()])
    assert phone.locator(f"{SCREEN} h3").count() == 0


def test_nothing_runs_past_the_edge_of_a_phone(phone):
    add_rooms(phone)
    open_status(phone, cold_section())
    assert phone.evaluate("document.documentElement.scrollWidth <= innerWidth")
