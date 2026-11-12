"""The departures shortcut and its screen."""

from __future__ import annotations

from .test_page import mount
from .test_panels import add_entity

SHEET = "home-dashboard-sheet"
SCREEN = "home-dashboard-departures"


def trip(line: str, direction: str, departure: str, minutes: int, delay: int = 0) -> dict:
    return {"line": line, "direction": direction, "departure": departure, "time_to_departure": minutes, "delay": delay}


def shortcut(*entities: str) -> dict:
    return {"shortcuts": [{"kind": "departures", "name": "Tramwaje", "icon": "mdi:tram", "entities": list(entities)}]}


def open_departures(page, sensors: dict) -> None:
    for entity_id, trips in sensors.items():
        add_entity(page, entity_id, "ok", {"list": trips})
    mount(page, shortcut(*sensors))
    page.locator("home-dashboard-page [data-shortcut='Tramwaje']").click()
    page.wait_for_selector(f"{SHEET} {SCREEN}")


def two_lines(page) -> None:
    open_departures(
        page,
        {
            "sensor.tram_8": [trip("8", "PORT", "12:16", 9), trip("8", "PORT", "12:36", 29)],
            "sensor.tram_22": [trip("22", "RYNEK", "12:11", 4), trip("22", "RYNEK", "12:31", 24)],
        },
    )


def test_the_next_departure_is_the_soonest_of_all_lines(phone):
    two_lines(phone)
    text = phone.locator(f"{SCREEN} [data-departures-next]").text_content()
    assert "4 min" in text
    assert "22" in text
    assert "12:11" in text


def test_every_line_keeps_its_place_and_shows_all_its_times(phone):
    two_lines(phone)
    lines = phone.locator(f"{SCREEN} [data-departures-line]")
    assert lines.count() == 2
    assert "8" in lines.nth(0).locator("h3 b").text_content()
    assert lines.nth(0).locator("[data-departure]").count() == 2
    assert "12:36" in lines.nth(0).text_content()


def test_a_shouted_stop_name_becomes_a_normal_one(phone):
    two_lines(phone)
    assert phone.locator(f"{SCREEN} [data-departures-line] h3 span").first.inner_text() == "Port"


def test_a_stop_with_more_lines_splits_them(phone):
    open_departures(phone, {"sensor.stop": [trip("8", "A", "12:00", 1), trip("16", "B", "12:01", 2)]})
    assert phone.locator(f"{SCREEN} [data-departures-line]").count() == 2


def test_a_departing_tram_says_now(phone):
    open_departures(phone, {"sensor.tram_8": [trip("8", "A", "12:00", 0)]})
    assert "teraz" in phone.locator(f"{SCREEN} [data-departures-next] strong").text_content()


def test_a_delay_shows_only_from_a_whole_minute(phone):
    open_departures(phone, {"sensor.tram_8": [trip("8", "A", "12:00", 5, 30), trip("8", "A", "12:20", 25, 180)]})
    late = phone.locator(f"{SCREEN} .late")
    assert late.count() == 1
    assert "3 min" in late.text_content()


def test_no_departures_says_so(phone):
    open_departures(phone, {"sensor.tram_8": []})
    assert phone.locator(f"{SCREEN} [data-departures-empty]").count() == 1
    assert phone.locator(f"{SCREEN} [data-departures-next]").count() == 0


def test_a_missing_sensor_does_not_break_the_screen(phone):
    mount(phone, shortcut("sensor.gone"))
    phone.locator("home-dashboard-page [data-shortcut='Tramwaje']").click()
    phone.wait_for_selector(f"{SCREEN} [data-departures-empty]")


def test_the_screen_follows_the_sensor(phone):
    two_lines(phone)
    phone.evaluate("""() => {
        const chrome = document.querySelector("home-dashboard-chrome");
        const states = { ...chrome.hass.states };
        const stateObj = states["sensor.tram_22"];
        const list = [{ ...stateObj.attributes.list[0], time_to_departure: 2 }];
        states["sensor.tram_22"] = { ...stateObj, attributes: { ...stateObj.attributes, list } };
        chrome.hass = { ...chrome.hass, states };
    }""")
    phone.wait_for_function(
        """() => document.querySelector("home-dashboard-chrome").shadowRoot.querySelector("home-dashboard-sheet")
            .shadowRoot.querySelector("home-dashboard-departures").shadowRoot
            .querySelector("[data-departures-next] strong").textContent.includes("2 min")"""
    )


def test_the_times_of_a_longer_list_scroll_inside_their_row(phone):
    trips = [trip("8", "A", f"12:{index}0", index) for index in range(6)]
    open_departures(phone, {"sensor.tram_8": trips})
    assert phone.locator(f"{SCREEN} .times").evaluate("(row) => row.scrollWidth > row.clientWidth")
    assert phone.evaluate("document.documentElement.scrollWidth <= innerWidth")


def test_a_tablet_on_its_side_shows_the_departures_on_the_whole_screen(tablet):
    sensors = {
        "sensor.tram_8": [trip("8", "KARŁOWICE", f"20:{16 + 20 * i}", 7 + 20 * i) for i in range(5)],
        "sensor.tram_22": [trip("22", "Pilczyce", "20:20", 11, delay=180), trip("22", "Pilczyce", "20:40", 31)],
    }
    open_departures(tablet, sensors)
    tablet.wait_for_selector("home-dashboard-departures [data-departures-wide]")
    assert "whole" in tablet.locator("home-dashboard-sheet section.panel").get_attribute("class")
    # Every time the timetable gives, five for the 8.
    assert tablet.locator("home-dashboard-departures [data-departures-line='8|karłowice'] [data-departure]").count() == 5
    # All the lines in one order of departure; the delay shows.
    rows = tablet.locator("home-dashboard-departures [data-departures-coming-row]").all_text_contents()
    assert "Pilczyce" in rows[1] and "3 min" in tablet.locator("home-dashboard-departures [data-departures-line='22|Pilczyce']").text_content()
    # The line of time stretches to show the last departure, up to two hours: 87 minutes → 90.
    assert "90" in tablet.locator("home-dashboard-departures [data-departures-timeline] h4").text_content()
    assert tablet.locator("home-dashboard-departures [data-departures-mark='8|karłowice']").count() == 5


def test_each_line_has_one_colour_or_the_one_chosen(phone):
    colours = phone.evaluate("""async () => { const d = await import('/custom_components/home_dashboard/www/app/departures.js');
        const lines = [{ line: '8' }, { line: '16' }, { line: '8' }, { line: '22' }];
        return [[...d.lineColours(lines)], [...d.lineColours(lines, { 16: '#123456' })]]; }""")
    assert [line for line, _ in colours[0]] == ["8", "16", "22"]
    assert dict(colours[1])["16"] == "#123456"


def test_an_upright_tablet_keeps_the_list(tablet):
    tablet.set_viewport_size({"width": 820, "height": 1180})
    two_lines(tablet)
    assert tablet.locator("home-dashboard-departures [data-departures-wide]").count() == 0


def test_the_notices_of_the_timetable_show_while_there_are_any(phone):
    add_entity(phone, "binary_sensor.news", "on", {"list": ["Objazd linii 8 przez Krakowską.", ""]})
    add_entity(phone, "sensor.tram_8", "ok", {"list": [trip("8", "PORT", "12:16", 9)]})
    mount(phone, {"shortcuts": [{"kind": "departures", "name": "Tramwaje", "icon": "mdi:tram",
                                 "entities": ["sensor.tram_8"], "news": "binary_sensor.news"}]})
    phone.locator("home-dashboard-page [data-shortcut='Tramwaje']").click()
    phone.wait_for_selector(f"{SCREEN} [data-departures-news]")
    assert phone.locator(f"{SCREEN} [data-departures-news] p").all_text_contents() == ["Objazd linii 8 przez Krakowską."]


def test_without_notices_there_is_no_card(phone):
    add_entity(phone, "binary_sensor.news", "off", {"list": []})
    two_lines(phone)
    assert phone.locator(f"{SCREEN} [data-departures-news]").count() == 0
