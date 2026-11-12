"""The scale: a tile in a room with who weighed last, and a window with each person's body from BodyMiScale."""

from __future__ import annotations

import pytest

from .test_panels import add_entity, room_with

MODULE = "/custom_components/home_dashboard/www/app/scale.js"
SHEET = "home-dashboard-sheet"
SCALE = {"kind": "scale", "name": "Waga", "icon": "mdi:scale-bathroom", "entity": "sensor.scale_mass"}
JAN = {
    "friendly_name": "Jan",
    "weight": 80.4,
    "ideal": 74.0,
    "bmi": 24.5,
    "bmi_label": "normal_or_healthy_weight",
    "body_fat": 20.12,
    "muscle_mass": 60.0,
    "water": 55.3,
    "bone_mass": 3.2,
    "visceral_fat": 9.4,
    "protein": 18.1,
    "lean_body_mass": 64.2,
    "basal_metabolism": 1700.4,
    "metabolic_age": 35.2,
    "body_score": 80.6,
    "body_type": "balanced",
    "fat_mass_to_lose": 2.5,
    "last_measurement_time": "2026-11-10T07:30:00+00:00",
}
ANNA = {**JAN, "friendly_name": "Anna", "weight": 58.0, "ideal": 57.0, "bmi": 31.0, "bmi_label": "moderate_obesity",
        "last_measurement_time": "2026-11-01T07:30:00+00:00"}

# Daily means of Jan's weight, as the recorder gives them.
STATISTICS = """async (message) => {
    if (message.type === 'frontend/get_user_data') return null;
    if (message.type === 'recorder/statistics_during_period') {
        window.asked = [...(window.asked ?? []), message];
        const day = 86400000; const now = Date.now();
        return { [message.statistic_ids[0]]: [0, 1, 2, 3].map((index) => ({ start: now - (4 - index) * day, mean: 81 - index * 0.3 })) };
    }
    return null;
}"""

MOUNT = """async ({ dashboard, statistics }) => {
    window.hass = window.dashboard.hass({ callWS: eval(statistics) });
    window.card = await window.dashboard.mount(window.hass, dashboard, 'home');
}"""


def setup(page) -> None:
    add_entity(page, "sensor.scale_mass", "80.4", {"unit_of_measurement": "kg"})
    add_entity(page, "bodymiscale.jan", "ok", JAN)
    add_entity(page, "bodymiscale.anna", "ok", ANNA)
    add_entity(page, "sensor.jan_weight", "80.4", {"unit_of_measurement": "kg"})
    add_entity(page, "sensor.anna_weight", "58", {"unit_of_measurement": "kg"})
    dashboard = {"shortcuts": [SCALE], **room_with({"shortcut": "Waga"})}
    page.evaluate(MOUNT, {"dashboard": dashboard, "statistics": STATISTICS})
    page.wait_for_function("document.querySelector('home-dashboard-chrome') !== null")


def open_scale(page) -> None:
    setup(page)
    page.locator("home-dashboard-page [data-tile='Waga']").click()
    page.wait_for_selector(f"{SHEET} home-dashboard-scale >> [data-scale-hero]")


def run(page, body: str, arg=None):
    return page.evaluate(f"async (arg) => {{ const s = await import('{MODULE}'); {body} }}", arg)


def test_the_tile_says_who_weighed_last_and_their_body(phone):
    setup(phone)
    tile = phone.locator("home-dashboard-page [data-tile='Waga']")
    assert "Jan" in tile.inner_text()
    assert tile.locator(".stats b").all_inner_texts() == ["80,4 kg", "24,5", "20,1 %", "60,0 kg"]


def test_the_window_opens_on_the_last_person_with_everything_about_them(phone):
    open_scale(phone)
    scale = phone.locator(f"{SHEET} home-dashboard-scale")
    assert scale.locator("[data-scale-person].selected").get_attribute("data-scale-person") == "bodymiscale.jan"
    hero = scale.locator("[data-scale-hero]").inner_text()
    assert "80,4" in hero and "74,0 kg" in hero
    assert scale.locator("[data-scale-difference]").inner_text().strip() == "+6,4 kg"
    assert "Prawidłowa" in scale.locator("[data-scale-bmi]").inner_text()
    assert scale.locator("[data-scale-metric]").count() == 11
    assert "36 lat" not in scale.locator("[data-scale-metric='metabolic_age']").inner_text()
    assert "35 lat" in scale.locator("[data-scale-metric='metabolic_age']").inner_text()
    assert "Zrównoważona" in scale.locator("[data-scale-metric='body_type']").inner_text()
    assert "Na wadze teraz: 80,4 kg" in scale.locator("[data-scale-now]").inner_text()


def test_the_line_of_weight_comes_from_the_person_s_weight_sensor(phone):
    open_scale(phone)
    phone.wait_for_selector(f"{SHEET} home-dashboard-scale >> [data-scale-chart] polyline")
    asked = phone.evaluate("window.asked")
    assert asked[-1]["statistic_ids"] == ["sensor.jan_weight"]
    assert asked[-1]["types"] == ["mean"] and asked[-1]["period"] == "day"
    phone.locator(f"{SHEET} home-dashboard-scale >> [data-scale-days='90']").click()
    phone.wait_for_function("window.asked.length >= 2")
    asked = phone.evaluate("window.asked")
    span = (asked[-1]["end_time"], asked[-1]["start_time"])
    days = phone.evaluate("([end, start]) => Math.round((Date.parse(end) - Date.parse(start)) / 86400000)", list(span))
    assert days == 90


def test_choosing_a_person_shows_them(phone):
    open_scale(phone)
    phone.locator(f"{SHEET} home-dashboard-scale >> [data-scale-person='bodymiscale.anna']").click()
    scale = phone.locator(f"{SHEET} home-dashboard-scale")
    assert "58,0" in scale.locator("[data-scale-hero]").inner_text()
    assert "Otyłość umiarkowana" in scale.locator("[data-scale-bmi]").inner_text()
    phone.wait_for_function("window.asked.some((message) => message.statistic_ids[0] === 'sensor.anna_weight')")


def test_a_phone_shows_one_column_and_a_tablet_two(phone, tablet):
    def boxes(page):
        open_scale(page)
        return page.evaluate("""() => { const root = document.querySelector('home-dashboard-chrome').shadowRoot
            .querySelector('home-dashboard-sheet').shadowRoot.querySelector('home-dashboard-scale').shadowRoot;
            const box = (selector) => root.querySelector(selector).getBoundingClientRect().toJSON();
            return { hero: box('[data-scale-hero]'), metrics: box('[data-scale-metrics]'), width: innerWidth }; }""")

    small = boxes(phone)
    assert small["metrics"]["top"] > small["hero"]["bottom"]
    assert small["metrics"]["right"] <= small["width"]
    wide = boxes(tablet)
    assert wide["metrics"]["left"] > wide["hero"]["right"]


@pytest.mark.parametrize(("bmi", "band"), [(17, "under"), (22, "normal"), (27.5, "over"), (32, "obese"), (40, "obese")])
def test_bmi_stands_in_its_band(phone, bmi, band):
    place = run(phone, "return s.bmiPlace(arg);", bmi)
    assert place["band"] == band
    assert 0 <= place["at"] <= 1


def test_people_can_be_listed_with_their_own_weight_sensor(phone):
    setup(phone)
    people = run(phone, """const hass = window.hass;
        return s.scalePeople(hass, { people: [{ entity: 'bodymiscale.anna', name: 'Ania', weight: 'sensor.other' }] })
            .map((person) => [person.name, person.weightSensor]);""")
    assert people == [["Ania", "sensor.other"]]
    found = run(phone, "return s.scalePeople(window.hass, {}).map((person) => person.weightSensor).sort();")
    assert found == ["sensor.anna_weight", "sensor.jan_weight"]


def test_values_are_shown_with_their_units_or_a_dash(phone):
    texts = run(phone, """return [s.metricText('pl', 1700.4, 'kcal', 0), s.metricText('pl', null, 'kg', 1),
        s.metricText('en', 35.2, 'age', 0)];""")
    assert texts == ["1700 kcal", "\u2013", "35 years"]


def test_a_weight_that_never_changed_says_there_were_no_weighings(phone):
    changed = run(phone, """const point = (value) => ({ at: 0, value });
        return [s.weightChanged([point(38.5), point(38.5), point(38.52)]), s.weightChanged([point(80), point(79.5)]),
            s.weightChanged([])];""")
    assert changed == [False, True, False]


def test_on_a_tablet_the_window_stands_in_the_middle_not_on_the_whole_screen(tablet):
    open_scale(tablet)
    box = tablet.locator(f"{SHEET} .panel[data-kind='scale']").bounding_box()
    width = tablet.evaluate("innerWidth")
    assert box["width"] <= 860
    assert box["x"] > 0 and box["x"] + box["width"] < width
