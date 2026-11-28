"""A chosen day of the forecast in the weather window: a tap on one of the next days."""

from __future__ import annotations

from datetime import datetime, timedelta
import os

from .test_panels import add_entity
from .test_weather import MOUNT, WEATHER, add_both, open_weather

NOW = datetime.now().replace(hour=15, minute=0, second=0, microsecond=0)
MIDNIGHT = NOW.replace(hour=0)
DAYS = [
    ("cloudy", 4, 1, 0.0),
    ("rainy", 5, -0.2, 2.4),
    ("cloudy", 3, -3, 0),
    ("snowy", -0.4, -2, 1.1),
    ("sunny", -2, -4, 0),
    ("sunny", -3, -7, 0),
]


def iso(moment: datetime) -> str:
    return moment.astimezone().isoformat()


def forecasts(hours: int = 48) -> dict:
    return {
        "hourly": [
            {
                "datetime": iso(NOW + timedelta(hours=index)),
                "condition": "rainy" if index == 12 else "cloudy",
                "temperature": -0.2 if index < 6 else 2.0 if index < 12 else 5.0,
                "precipitation": 0.8 if index == 12 else 0,
            }
            for index in range(hours)
        ],
        "daily": [
            {
                "datetime": iso(MIDNIGHT + timedelta(days=index, hours=12)),
                "condition": condition,
                "temperature": high,
                "templow": low,
                "precipitation": rain,
                "wind_speed": 12.2,
                "humidity": 83,
            }
            for index, (condition, high, low, rain) in enumerate(DAYS)
        ],
    }


def prepare(page, history: bool = False, hours: int = 48, language: str = "pl") -> None:
    page.clock.set_fixed_time(NOW.timestamp())
    add_both(page)
    if history:
        add_entity(page, "sensor.balcony", "3.4", {"unit_of_measurement": "°C"})
    mount = MOUNT.replace("connection: {", "callWS: async () => ({}), connection: {")
    dashboard = {"weather": {"history": {"temperature": "sensor.balcony", "limit": 3}}} if history else {}
    page.evaluate(mount, {"dashboard": dashboard, "language": language, "forecasts": forecasts(hours)})
    page.wait_for_function("document.querySelector('home-dashboard-chrome') !== null")
    open_weather(page)


def choose(page, ahead: int) -> None:
    page.locator(f"{WEATHER} [data-weather-column='{ahead}']").click()


def shown(page) -> str:
    return page.locator(f"{WEATHER} [data-weather-shown]").inner_text()


def shot(page, name: str) -> None:
    if os.environ.get("WEATHER_SHOTS"):
        page.screenshot(path=f"{os.environ['WEATHER_SHOTS']}/{name}.png")


def test_a_day_with_hours_is_drawn_by_the_hour(tablet):
    prepare(tablet, history=True)
    tablet.wait_for_selector(f"{WEATHER} [data-weather-chart]")
    choose(tablet, 1)
    assert shown(tablet).lower().startswith("jutro")
    labels = tablet.locator(f"{WEATHER} svg.chart text.hour").all_text_contents()
    assert labels[0] == "00:00" and labels[-1] == "21:00"
    assert tablet.locator(f"{WEATHER} [data-weather-hours-note]").count() == 0
    # From 0:00 to 2:59 there are 2 degrees; then 5.
    assert "3 h" in tablet.locator(f"{WEATHER} [data-weather-day-part='cold']").inner_text()
    assert tablet.locator(f"{WEATHER} [data-weather-limit]").count() == 1
    # With all the hours the numbers are theirs, not those of the daily forecast (2.4 mm, -0.2 degrees).
    assert "0,8 mm" in tablet.locator(f"{WEATHER} [data-weather-day-part='rain']").inner_text()
    assert "2° – 5°" in tablet.locator(f"{WEATHER} [data-weather-day-part='range']").inner_text()
    assert tablet.locator(f"{WEATHER} [data-weather-column='1']").get_attribute("aria-pressed") == "true"
    last = tablet.locator(f"{WEATHER} [data-weather-column='5']").bounding_box()
    shot(tablet, "tomorrow")
    assert last["y"] + last["height"] <= 820


def test_a_day_with_part_of_its_hours_says_where_they_end(tablet):
    prepare(tablet, history=True)
    choose(tablet, 2)
    assert "14:00" in tablet.locator(f"{WEATHER} [data-weather-hours-note]").inner_text()
    assert tablet.locator(f"{WEATHER} [data-weather-chart]").count() == 1
    # Hours under the limit would count only a part of the day.
    assert tablet.locator(f"{WEATHER} [data-weather-day-part='cold']").count() == 0
    shot(tablet, "partial")


def test_a_day_without_hours_is_shown_among_the_days(tablet):
    prepare(tablet, history=True)
    choose(tablet, 3)
    tablet.wait_for_selector(f"{WEATHER} [data-weather-days-chart] .chosen")
    assert "nie sięga" in tablet.locator(f"{WEATHER} [data-weather-hours-note]").inner_text()
    parts = tablet.locator(f"{WEATHER} [data-weather-day-parts]").inner_text()
    assert "1,1 mm" in parts and "12,2 km/h" in parts and "83 %" in parts
    last = tablet.locator(f"{WEATHER} [data-weather-column='5']").bounding_box()
    shot(tablet, "far")
    assert last["y"] + last["height"] <= 820


def test_the_arrows_reach_from_the_measured_days_to_the_last_day(tablet):
    prepare(tablet, history=True)
    later = tablet.locator(f"{WEATHER} [data-weather-go='later']")
    earlier = tablet.locator(f"{WEATHER} [data-weather-go='earlier']")
    for _ in range(5):
        later.click()
    assert later.is_disabled()
    tablet.locator(f"{WEATHER} [data-weather-go='forecast']").click()
    assert shown(tablet) == "Najbliższe 24 godziny"
    later.click()
    earlier.click()
    assert shown(tablet) == "Najbliższe 24 godziny"
    earlier.click()
    assert shown(tablet) == "Dziś" and tablet.locator(f"{WEATHER} [data-weather-past]").count() == 1
    later.click()
    later.click()
    assert shown(tablet).lower().startswith("jutro")


def test_today_returns_to_the_next_24_hours(tablet):
    prepare(tablet)
    choose(tablet, 3)
    choose(tablet, 0)
    assert shown(tablet) == "Najbliższe 24 godziny"
    assert tablet.locator(f"{WEATHER} [data-weather-days-chart]").count() == 0


def test_without_measured_days_the_arrows_stop_at_the_next_24_hours(tablet):
    prepare(tablet)
    assert tablet.locator(f"{WEATHER} [data-weather-go='earlier']").is_disabled()
    choose(tablet, 1)
    tablet.locator(f"{WEATHER} [data-weather-go='earlier']").click()
    assert tablet.locator(f"{WEATHER} [data-weather-go='earlier']").is_disabled()
    assert tablet.locator(f"{WEATHER} [data-weather-limit]").count() == 0


def test_a_small_number_under_zero_is_not_minus_zero(tablet):
    prepare(tablet)
    texts = tablet.locator(f"{WEATHER} svg.chart text.temperature").all_text_contents()
    assert texts[0] == "0°"
    assert "-0°" not in tablet.locator(f"{WEATHER} .strip").inner_text()


def test_a_phone_opens_the_hours_under_the_row(phone):
    prepare(phone)
    rows = phone.locator(f"{WEATHER} [data-weather-day]")
    rows.nth(1).click()
    details = phone.locator(f"{WEATHER} [data-weather-day-details]")
    assert details.locator("[data-weather-hour]").count() == 24
    assert rows.nth(1).get_attribute("aria-expanded") == "true"
    shot(phone, "phone")
    rows.nth(4).click()
    assert details.count() == 1 and details.locator("[data-weather-hour]").count() == 0
    assert "nie sięga" in details.inner_text()
    assert phone.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    rows.nth(4).click()
    assert details.count() == 0


def test_the_clock_change_does_not_move_a_day(phone):
    ahead = phone.evaluate(
        """async () => { const m = await import('/custom_components/home_dashboard/www/app/weather-days.js');
        const now = new Date(2026, 9, 24, 23, 30);
        return [new Date(2026, 9, 24, 1), new Date(2026, 9, 25, 12), new Date(2026, 9, 26, 0), new Date(2026, 9, 23, 23)]
            .map((d) => m.daysAhead(d.toISOString(), now)); }"""
    )
    assert ahead == [0, 1, 2, -1]


def test_every_view_has_the_same_frame(tablet):
    """The chart and the days under it keep their size; only the drawing inside changes."""
    prepare(tablet, history=True)
    chart = f"{WEATHER} .chart-card"
    tablet.wait_for_selector(f"{WEATHER} [data-weather-chart]")

    def sizes() -> tuple:
        tablet.wait_for_timeout(100)
        card = tablet.locator(chart).bounding_box()
        days = tablet.locator(f"{WEATHER} .days-card").bounding_box()
        plot = tablet.locator(f"{WEATHER} .plot").bounding_box()
        # The measured days have no readings here: a line in place of the drawing.
        if tablet.locator(f"{WEATHER} .plot svg").count():
            svg = tablet.locator(f"{WEATHER} .plot svg").bounding_box()
            assert abs(svg["height"] - plot["height"]) < 1
        return round(card["y"]), round(card["height"]), round(days["y"]), round(days["height"])

    first = sizes()
    views = {"next 24 hours": first}
    choose(tablet, 1)
    views["tomorrow"] = sizes()
    choose(tablet, 2)
    views["part of a day"] = sizes()
    choose(tablet, 4)
    views["days"] = sizes()
    tablet.locator(f"{WEATHER} [data-weather-go='forecast']").click()
    tablet.locator(f"{WEATHER} [data-weather-go='earlier']").click()
    tablet.wait_for_selector(f"{WEATHER} [data-weather-past]")
    views["measured"] = sizes()
    # The 14 days that were and today, in the strip with the next days.
    assert tablet.locator(f"{WEATHER} [data-weather-past-day]").count() == 15
    assert all(size == first for size in views.values()), views
    # The columns stay inside their card, with the margin of its sides under them.
    margins = tablet.locator(f"{WEATHER} .days-card").evaluate(
        """(card) => { const box = card.getBoundingClientRect(); const columns = [...card.querySelectorAll(".column")];
            const bottom = Math.max(...columns.map((c) => c.getBoundingClientRect().bottom));
            const left = parseFloat(getComputedStyle(card).paddingLeft);
            return { below: box.bottom - bottom, left,
                     inside: columns.every((c) => c.scrollHeight <= c.clientHeight + 1) }; }"""
    )
    assert margins["inside"] and abs(margins["below"] - margins["left"]) <= 1, margins
    # A legend in every view, and the whole window on the screen.
    assert tablet.locator(f"{WEATHER} .legend span").count() >= 2
    assert first[2] + first[3] <= 820


def strip_state(page) -> dict:
    return page.locator(f"{WEATHER} .strip").evaluate(
        """(strip) => { const box = strip.getBoundingClientRect(); const pad = parseFloat(getComputedStyle(strip).paddingLeft);
            const seen = [...strip.querySelectorAll(".column")].filter((c) => { const r = c.getBoundingClientRect();
                return r.left >= box.left + pad - 1 && r.right <= box.right - pad + 1; });
            return { left: strip.scrollLeft, seen: seen.map((c) => c.dataset.weatherColumn ?? `past${c.dataset.weatherPastDay}`) }; }"""
    )


def test_the_strip_scrolls_without_the_chart_and_a_tap_chooses_the_day(tablet):
    prepare(tablet, history=True)
    tablet.wait_for_selector(f"{WEATHER} [data-weather-past-day='14']", state="attached")
    tablet.wait_for_timeout(100)
    # It opens at the next days: six columns in sight, the days that were to the left.
    assert strip_state(tablet)["seen"] == ["0", "1", "2", "3", "4", "5"]
    tablet.locator(f"{WEATHER} .strip").evaluate("(strip) => strip.scrollTo({ left: 0 })")
    tablet.wait_for_timeout(100)
    assert strip_state(tablet)["seen"][0] == "past14"
    assert shown(tablet) == "Najbliższe 24 godziny"
    tablet.locator(f"{WEATHER} [data-weather-past-day='13']").click()
    tablet.wait_for_selector(f"{WEATHER} [data-weather-past]")
    assert tablet.locator(f"{WEATHER} [data-weather-past-day='13']").get_attribute("aria-pressed") == "true"
    # The arrows move the chart; the strip follows when the day is out of sight.
    left = strip_state(tablet)["left"]
    for _ in range(12):
        tablet.locator(f"{WEATHER} [data-weather-go='later']").click()
    tablet.wait_for_timeout(600)
    assert shown(tablet) == "Wczoraj"
    assert "past1" in strip_state(tablet)["seen"] and strip_state(tablet)["left"] > left


def test_a_phone_has_the_measured_days_as_a_strip_from_today(phone):
    prepare(phone, history=True)
    phone.wait_for_selector(f"{WEATHER} [data-weather-past-day='14']", state="attached")
    phone.wait_for_timeout(100)
    seen = strip_state(phone)["seen"]
    assert len(seen) == 4 and seen[-1] == "past0"
    assert phone.evaluate("document.documentElement.scrollWidth <= window.innerWidth")


def test_today_is_a_shade_lighter(tablet):
    prepare(tablet, history=True)
    tablet.wait_for_selector(f"{WEATHER} [data-weather-past-day='14']", state="attached")
    current = tablet.locator(f"{WEATHER} .strip .column.current")
    assert current.evaluate_all(
        "(c) => c.map((b) => b.dataset.weatherColumn ?? `past${b.dataset.weatherPastDay}`)"
    ) == [
        "past0",
        "0",
    ]
    shade = "(b) => getComputedStyle(b).backgroundImage"
    assert "gradient" in current.first.evaluate(shade)
    assert tablet.locator(f"{WEATHER} [data-weather-column='1']").evaluate(shade) == "none"
