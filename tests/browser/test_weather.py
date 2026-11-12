"""The weather chip and its screen."""

from __future__ import annotations

from .test_panels import add_entity

SHEET = "home-dashboard-sheet"
WEATHER = "home-dashboard-weather"
STATION = {"temperature": 5.3, "humidity": 80, "pressure": 1031.4, "pressure_unit": "hPa", "supported_features": 0}
SERVICE = {"temperature": 3.0, "wind_speed": 4.7, "wind_speed_unit": "km/h", "supported_features": 3}
MOUNT = """async ({ dashboard, language, forecasts }) => {
    window.subscribed = [];
    window.unsubscribed = 0;
    const hass = window.dashboard.hass({
        language,
        user: { id: "person", name: "User", is_admin: true },
        connection: {
            subscribeMessage: async (callback, message) => {
                if (message.type === "weather/subscribe_forecast") {
                    window.subscribed.push(message);
                    callback({ forecast: forecasts[message.forecast_type] });
                }
                return () => { window.unsubscribed += 1; };
            },
        },
    });
    window.hass = hass;
    window.card = await window.dashboard.mount(hass, dashboard, "home");
}"""
FORECASTS = {
    "hourly": [
        {"datetime": "2026-11-06T20:00:00+00:00", "condition": "rainy", "temperature": 2.2, "precipitation": 1.5},
        {"datetime": "2026-11-06T21:00:00+00:00", "condition": "cloudy", "temperature": 1.8, "precipitation": 0},
    ],
    "daily": [
        {"datetime": "2026-11-07T11:00:00+00:00", "condition": "sunny", "temperature": 9, "templow": 1},
        {"datetime": "2026-11-08T11:00:00+00:00", "condition": "snowy", "temperature": 2},
    ],
}


def mount_weather(page, dashboard: dict | None = None, language: str = "en") -> None:
    page.evaluate(MOUNT, {"dashboard": dashboard or {}, "language": language, "forecasts": FORECASTS})
    page.wait_for_function("document.querySelector('home-dashboard-chrome') !== null")


def add_both(page) -> None:
    add_entity(page, "weather.home_station", "partlycloudy", STATION)
    add_entity(page, "weather.service", "sunny", SERVICE)


def open_weather(page) -> None:
    # The harness has no margin for the tablet's rail, so the rail lies over the first chip.
    page.locator("home-dashboard-page [data-weather]").evaluate("(chip) => chip.click()")
    page.wait_for_selector(f"{WEATHER} [data-weather-now]")


def test_no_weather_entity_means_no_chip(phone):
    mount_weather(phone)
    assert phone.locator("home-dashboard-page [data-chip='climate']").count() == 1
    assert phone.locator("home-dashboard-page [data-weather]").count() == 0


def test_weather_is_the_first_chip(phone):
    add_both(phone)
    mount_weather(phone)
    first = phone.locator("home-dashboard-page .chips > button").first
    assert first.get_attribute("data-weather") is not None
    assert "Weather" in first.inner_text()
    assert "5.3°" in first.inner_text()


def test_the_label_follows_the_language(phone):
    add_both(phone)
    mount_weather(phone, language="pl")
    assert "Pogoda" in phone.locator("home-dashboard-page [data-weather]").inner_text()


def test_the_chip_can_be_turned_off(phone):
    add_both(phone)
    mount_weather(phone, {"weather": False})
    assert phone.locator("home-dashboard-page [data-weather]").count() == 0


def test_the_chip_uses_the_configured_entity(phone):
    add_both(phone)
    mount_weather(phone, {"weather": {"entity": "weather.service"}})
    assert "3.0°" in phone.locator("home-dashboard-page [data-weather]").inner_text()


def test_hidden_from_a_person_means_no_chip(phone):
    add_both(phone)
    mount_weather(phone, {"access": {"person": {"hide": ["weather.home_station"]}}})
    assert phone.locator("home-dashboard-page [data-weather]").count() == 0


def test_the_chip_follows_the_temperature(phone):
    add_both(phone)
    mount_weather(phone)
    phone.evaluate(
        """() => {
            window.card.hass = window.dashboard.withState(window.hass, "weather.home_station", {
                state: "rainy", attributes: { temperature: 7.1 },
            });
        }"""
    )
    phone.locator("home-dashboard-page [data-weather]", has_text="7.1°").wait_for()


def test_the_chip_opens_the_screen_and_forecasts_come_from_the_service(phone):
    add_both(phone)
    mount_weather(phone)
    open_weather(phone)
    subscribed = phone.evaluate("window.subscribed")
    assert {item["forecast_type"] for item in subscribed} == {"hourly", "daily"}
    assert {item["entity_id"] for item in subscribed} == {"weather.service"}
    assert phone.locator(f"{WEATHER} [data-weather-hour]").count() == 2
    assert phone.locator(f"{WEATHER} [data-weather-day]").count() == 2


def test_the_screen_shows_the_station_and_fills_gaps_from_the_service(phone):
    add_both(phone)
    mount_weather(phone)
    open_weather(phone)
    assert "5.3°" in phone.locator(f"{WEATHER} [data-weather-now]").inner_text()
    assert "1,031.4 hPa" in phone.locator(f"{WEATHER} [data-weather-fact='pressure']").inner_text()
    assert "4.7 km/h" in phone.locator(f"{WEATHER} [data-weather-fact='wind_speed']").inner_text()
    assert phone.locator(f"{WEATHER} [data-weather-fact='uv_index']").count() == 0


def test_closing_the_screen_ends_the_subscriptions(phone):
    add_both(phone)
    mount_weather(phone)
    open_weather(phone)
    phone.locator(f"{SHEET} .scrim").evaluate("(scrim) => scrim.click()")
    phone.wait_for_function("window.unsubscribed === 2")


def test_without_a_forecast_the_screen_says_so(phone):
    add_entity(phone, "weather.home_station", "cloudy", STATION)
    mount_weather(phone)
    open_weather(phone)
    assert phone.evaluate("window.subscribed") == []
    assert phone.locator(f"{WEATHER} [data-weather-empty]").count() == 1


def test_the_hours_scroll_inside_the_screen_on_a_phone(phone):
    add_both(phone)
    mount_weather(phone)
    open_weather(phone)
    assert phone.evaluate("document.documentElement.scrollWidth <= window.innerWidth")


def test_an_upright_tablet_keeps_the_phone_screen(tablet):
    tablet.set_viewport_size({"width": 820, "height": 1180})
    add_both(tablet)
    mount_weather(tablet)
    open_weather(tablet)
    assert tablet.locator(f"{WEATHER} [data-weather-day]").count() == 2
    assert tablet.locator(f"{WEATHER} [data-weather-wide]").count() == 0


def test_a_tablet_on_its_side_shows_the_weather_on_the_whole_screen(tablet):
    add_both(tablet)
    mount_weather(tablet)
    open_weather(tablet)
    assert tablet.locator(f"{WEATHER} [data-weather-wide]").count() == 1
    assert "whole" in tablet.locator("home-dashboard-sheet section.panel").get_attribute("class")
    # The next day as a chart: the rain of the first hour as a rain bar, and the total under it.
    tablet.wait_for_selector(f"{WEATHER} [data-weather-chart]")
    assert tablet.locator(f"{WEATHER} [data-weather-rain]").evaluate_all("(bars) => bars.map((b) => b.dataset.weatherRain)") == ["rain"]
    assert "1.5 mm" in tablet.locator(f"{WEATHER} [data-weather-total]").inner_text()
    # The next days as columns side by side.
    tops = tablet.locator(f"{WEATHER} [data-weather-column]").evaluate_all(
        "(columns) => columns.map((c) => Math.round(c.getBoundingClientRect().top))")
    assert len(tops) == 2 and tops[0] == tops[1]
    # The chart reaches down at least to the end of the readings beside it.
    chart = tablet.locator(f"{WEATHER} [data-weather-chart]").bounding_box()
    side = tablet.locator(f"{WEATHER} .side").bounding_box()
    assert chart["y"] + chart["height"] >= side["y"] + side["height"] - 1
    # Everything on the screen, nothing below it.
    last = tablet.locator(f"{WEATHER} [data-weather-column]").last.bounding_box()
    assert last["y"] + last["height"] <= 820


def test_snow_and_rain_with_snow_are_told_apart(phone):
    kinds = phone.evaluate("""async () => { const w = await import('/custom_components/home_dashboard/www/app/weather.js');
        return ['rainy', 'pouring', 'snowy', 'snowy-rainy'].map(w.precipitationKind); }""")
    assert kinds == ["rain", "rain", "snow", "mix"]

