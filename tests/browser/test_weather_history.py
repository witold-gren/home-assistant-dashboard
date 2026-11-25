"""The days that were in the weather window: the home's own sensors behind the chart of the forecast."""

from __future__ import annotations

from datetime import datetime

from .test_panels import add_entity
from .test_weather import FORECASTS, MOUNT, WEATHER, add_both, mount_weather, open_weather

HISTORY = {"temperature": "sensor.balcony", "rain": "sensor.rain_today", "limit": 3}
MODULE = "/custom_components/home_dashboard/www/app/weather-history.js"
ROWS = """(now) => {
    const hour = 3600000, out = { temperatures: [], rains: [] };
    const d = new Date(now); const first = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7).getTime();
    for (let t = first; t + hour <= now - hour; t += hour) {
        const h = new Date(t).getHours(), back = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate())
            - new Date(new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate())) / 86400000);
        // Yesterday (and its night) the hour 18 and the hour 4 of today fall to 1.5; the rest is warm.
        const cold = (back === 1 && h === 18) || (back === 0 && h === 4);
        if (back === 3 && (h === 10 || h === 11)) continue;
        out.temperatures.push({ start: t, mean: cold ? 2.5 : 6, min: cold ? 1.5 : 5, max: cold ? 3.5 : 8 });
        out.rains.push({ start: t, change: back === 2 && h === 13 ? 1.4 : back === 2 && h === 14 ? -3 : 0 });
    }
    return out;
}"""


def prepare(page, history=HISTORY, dashboard=None, fail=False, forecast=True) -> None:
    now = datetime.now().replace(hour=15, minute=0, second=0, microsecond=0)
    page.clock.set_fixed_time(now.timestamp())
    if forecast:
        add_both(page)
    else:
        add_entity(page, "weather.home_station", "cloudy", {"temperature": 5.3, "supported_features": 0})
    add_entity(page, "sensor.balcony", "3.4", {"unit_of_measurement": "°C"})
    add_entity(page, "sensor.rain_today", "0.5", {"unit_of_measurement": "mm"})
    page.evaluate(
        f"""(fail) => {{ window.asked = []; window.statistics = async (message) => {{
            window.asked.push(message); if (fail) throw new Error('no recorder');
            const rows = ({ROWS})(Date.now()); const id = message.statistic_ids[0];
            return {{ [id]: id === 'sensor.balcony' ? rows.temperatures : rows.rains }}; }}; }}""",
        fail,
    )
    mount = MOUNT.replace(
        "connection: {",
        "callWS: async (message) => message.type === 'recorder/statistics_during_period' ? window.statistics(message) : null,"
        "connection: {",
    )
    page.evaluate(
        mount,
        {
            "dashboard": {"weather": {"history": history}, **(dashboard or {})},
            "language": "pl",
            "forecasts": FORECASTS,
        },
    )
    page.wait_for_function("document.querySelector('home-dashboard-chrome') !== null")
    open_weather(page)


def go(page, key: str) -> None:
    page.locator(f"{WEATHER} [data-weather-go='{key}']").click()


def shown(page) -> str:
    return page.locator(f"{WEATHER} [data-weather-shown]").inner_text()


def test_days_have_their_day_the_night_after_it_and_the_rain(phone):
    days = phone.evaluate(
        f"""async () => {{ const m = await import('{MODULE}');
        const now = new Date(2026, 10, 24, 15); const rows = ({ROWS})(now.getTime());
        return m.pastDays(rows.temperatures, rows.rains, {{ now, limit: 3 }}); }}"""
    )
    assert len(days) == 8
    today, yesterday, before, gap = days[0], days[1], days[2], days[3]
    assert yesterday["day"] == {"min": 5, "max": 8}
    # The night of yesterday is 18:00 to 6:00 of today; the limit counts the day and that night.
    assert yesterday["night"] == {"min": 1.5, "max": 8} and yesterday["cold"] == 2
    assert today["cold"] == 0 and today["night"] is None and today["dayOpen"] and today["nightOpen"]
    assert not yesterday["nightOpen"]
    # A reset of the counter is no negative rain.
    assert before["total"] == 1.4
    assert gap["missing"] == 2 and yesterday["missing"] == 0 and today["missing"] == 0


def test_without_a_limit_or_rain_neither_is_counted(phone):
    day = phone.evaluate(
        f"""async () => {{ const m = await import('{MODULE}');
        return m.pastDays([], [], {{ now: new Date(2026, 10, 24, 15), hasRain: false }})[1]; }}"""
    )
    assert day["cold"] is None and day["total"] is None and day["all"] is None and day["missing"] == 24


def test_a_gap_is_not_bridged(phone):
    pieces = phone.evaluate(
        f"""async () => {{ const m = await import('{MODULE}'); const h = 3600000;
        return m.unbroken([0, h, 4 * h, 5 * h].map((time) => ({{ time }}))).map((p) => p.length); }}"""
    )
    assert pieces == [2, 2]


def test_the_arrows_go_back_seven_days_and_return_to_the_forecast(tablet):
    prepare(tablet)
    tablet.wait_for_selector(f"{WEATHER} [data-weather-chart]")
    assert tablet.locator(f"{WEATHER} [data-weather-go='later']").is_disabled()
    assert tablet.evaluate("window.asked.length") == 0
    go(tablet, "earlier")
    tablet.wait_for_selector(f"{WEATHER} [data-weather-past] svg")
    assert shown(tablet) == "Dziś"
    go(tablet, "earlier")
    assert shown(tablet) == "Wczoraj"
    assert "1,5" in tablet.locator(f"{WEATHER} [data-weather-part='night']").inner_text()
    assert "2 h" in tablet.locator(f"{WEATHER} [data-weather-cold]").inner_text()
    assert tablet.locator(f"{WEATHER} [data-weather-limit]").count() == 1
    for _ in range(6):
        go(tablet, "earlier")
    assert tablet.locator(f"{WEATHER} [data-weather-go='earlier']").is_disabled()
    # One question per sensor for all the days.
    asked = tablet.evaluate("window.asked")
    assert [(a["statistic_ids"], a["period"]) for a in asked] == [
        (["sensor.balcony"], "hour"),
        (["sensor.rain_today"], "hour"),
    ]
    go(tablet, "forecast")
    tablet.wait_for_selector(f"{WEATHER} [data-weather-chart]")
    assert tablet.locator(f"{WEATHER} [data-weather-past]").count() == 0


def test_the_week_takes_the_place_of_the_next_days_and_a_column_opens_its_day(tablet):
    prepare(tablet)
    go(tablet, "earlier")
    columns = tablet.locator(f"{WEATHER} [data-weather-past-day]")
    columns.first.wait_for()
    assert columns.evaluate_all("(c) => c.map((b) => b.dataset.weatherPastDay)") == list("76543210")
    assert tablet.locator(f"{WEATHER} [data-weather-column]").count() == 0
    tablet.locator(f"{WEATHER} [data-weather-past-day='2']").click()
    assert "1,4 mm" in tablet.locator(f"{WEATHER} [data-weather-past-total]").inner_text()
    assert tablet.locator(f"{WEATHER} [data-weather-measured-rain]").count() == 1
    tablet.locator(f"{WEATHER} [data-weather-past-day='3']").click()
    assert "2" in tablet.locator(f"{WEATHER} [data-weather-missing]").inner_text()
    # The whole window still fits the screen.
    last = columns.last.bounding_box()
    assert last["y"] + last["height"] <= 820


def test_dragging_the_chart_moves_through_the_days(tablet):
    prepare(tablet)

    def drag(by: int) -> None:
        box = tablet.locator(f"{WEATHER} .chart-card svg.chart").bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        tablet.mouse.move(x, y)
        tablet.mouse.down()
        tablet.mouse.move(x + by, y, steps=4)
        tablet.mouse.up()

    tablet.wait_for_selector(f"{WEATHER} [data-weather-chart]")
    drag(150)
    tablet.wait_for_selector(f"{WEATHER} [data-weather-past] svg")
    assert shown(tablet) == "Dziś"
    drag(150)
    assert shown(tablet) == "Wczoraj"
    drag(20)
    assert shown(tablet) == "Wczoraj"
    drag(-150)
    assert shown(tablet) == "Dziś"


def test_a_phone_has_the_measured_days_under_the_forecast(phone):
    prepare(phone)
    phone.wait_for_selector(f"{WEATHER} [data-weather-past] svg")
    assert shown(phone) == "Dziś"
    assert phone.locator(f"{WEATHER} [data-weather-hour]").count() == 2
    assert phone.locator(f"{WEATHER} [data-weather-go='later']").is_disabled()
    go(phone, "earlier")
    assert shown(phone) == "Wczoraj"
    assert phone.evaluate("document.documentElement.scrollWidth <= window.innerWidth")


def test_without_a_forecast_the_measured_days_are_there(tablet):
    prepare(tablet, forecast=False)
    tablet.wait_for_selector(f"{WEATHER} [data-weather-past] svg")
    assert shown(tablet) == "Dziś"
    assert tablet.locator(f"{WEATHER} [data-weather-go='forecast']").count() == 0


def test_without_history_there_are_no_arrows(tablet):
    add_both(tablet)
    mount_weather(tablet)
    open_weather(tablet)
    tablet.wait_for_selector(f"{WEATHER} [data-weather-chart]")
    assert tablet.locator(f"{WEATHER} [data-weather-go]").count() == 0


def test_a_sensor_hidden_from_a_person_shows_no_history(tablet):
    prepare(tablet, dashboard={"access": {"person": {"hide": ["sensor.balcony"]}}})
    tablet.wait_for_selector(f"{WEATHER} [data-weather-chart]")
    assert tablet.locator(f"{WEATHER} [data-weather-go]").count() == 0


def test_a_failed_question_says_so(tablet):
    prepare(tablet, fail=True)
    go(tablet, "earlier")
    tablet.locator(f"{WEATHER} [data-weather-past]", has_text="Nie udało się").wait_for()
