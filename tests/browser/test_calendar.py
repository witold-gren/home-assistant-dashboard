"""Today's events of the home's and a person's calendars: badges under the weather of the status bar (all-day ones
softly, the others with their hour and "now", gone once over), a month on a tablet, a list of days on a phone from
the list of areas, and the person's own calendars under the gear."""

from __future__ import annotations

from datetime import datetime, timedelta

from .test_page import mount
from .test_panels import add_entity
from .test_shortcuts import SHEET
from .test_status_panel import mount as mount_status

MODULE = "/custom_components/home_dashboard/www/app/calendar.js"
PANEL = "home-dashboard-status-panel"
HOME = ["calendar.family", "calendar.rocznice"]


def run(page, body: str, arg=None):
    return page.evaluate(f"async (arg) => {{ const c = await import('{MODULE}'); {body} }}", arg)


def stamp(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%S")


def add_calendars(page) -> None:
    for entity_id, name in [
        ("calendar.family", "Family"),
        ("calendar.rocznice", "Rocznice rodzinne"),
        ("calendar.kuba", "Kalendarz Kuby"),
    ]:
        add_entity(page, entity_id, "off", {"friendly_name": name})
    # Noon today on a fixed clock: the events a few hours either side stay today at any hour the tests run.
    now = datetime.now().replace(hour=12, minute=0, second=0, microsecond=0)
    today = now.date()
    page.clock.set_fixed_time(now.timestamp())
    page.evaluate(
        "(events) => { window.calendarEvents = events; }",
        {
            "calendar.family": [
                {
                    "summary": "Skończone",
                    "start": stamp(now - timedelta(hours=3)),
                    "end": stamp(now - timedelta(hours=2)),
                },
                {
                    "summary": "Zakupy",
                    "start": stamp(now - timedelta(minutes=30)),
                    "end": stamp(now + timedelta(minutes=30)),
                    "location": "Auchan",
                },
                {
                    "summary": "Planowanie",
                    "start": stamp(now + timedelta(hours=2)),
                    "end": stamp(now + timedelta(hours=3)),
                    "description": "Cały tydzień",
                },
                {
                    "summary": "Jutro",
                    "start": stamp(now + timedelta(days=1)),
                    "end": stamp(now + timedelta(days=1, hours=1)),
                },
            ],
            "calendar.rocznice": [
                {
                    "summary": "Rocznica ślubu",
                    "start": today.isoformat(),
                    "end": (today + timedelta(days=1)).isoformat(),
                }
            ],
            "calendar.kuba": [
                {
                    "summary": "Kuba basen",
                    "start": stamp(now + timedelta(hours=1)),
                    "end": stamp(now + timedelta(hours=2)),
                }
            ],
        },
    )


# The pure parts ---------------------------------------------------------------------------------------------------


def test_events_of_home_assistant_are_read_and_today_keeps_what_is_left(phone):
    result = run(
        phone,
        """
        const now = new Date(2026, 10, 14, 17, 12);
        const events = [
            c.readEvent({ summary: 'Po', start: '2026-11-14T15:00:00', end: '2026-11-14T16:00:00' }, 'calendar.a'),
            c.readEvent({ summary: 'Trwa', start: '2026-11-14T17:00:00', end: '2026-11-14T18:00:00' }, 'calendar.a'),
            c.readEvent({ summary: 'Potem', start: { dateTime: '2026-11-14T20:30:00' }, end: { dateTime: '2026-11-14T21:30:00' } }, 'calendar.a'),
            c.readEvent({ summary: 'Rocznica', start: { date: '2026-11-14' }, end: { date: '2026-11-15' } }, 'calendar.b'),
            c.readEvent({ summary: 'Wczoraj', start: '2026-11-13', end: '2026-11-14' }, 'calendar.b'),
        ];
        const shown = (hide) => c.todayEvents(events, now, hide).map((e) => e.summary);
        return { end: shown('end'), start: shown('start'), allDay: events[3].allDay, now: c.isNow(events[1], now),
                 until: [c.untilText(events[2], now, 'pl'), c.untilText(c.readEvent({ summary: 'x', start: '2026-11-14T18:00:00' }, 'a'), now, 'pl')],
                 progress: Math.round(c.progressOf(events[1], now) * 100) };
    """,
    )
    assert result["end"] == ["Rocznica", "Trwa", "Potem"]
    assert result["start"] == ["Rocznica", "Potem"]
    assert result["allDay"] is True and result["now"] is True
    assert result["until"] == ["za 3 h", "za 48 min"]
    assert result["progress"] == 20


def test_a_month_has_six_weeks_from_monday_and_a_list_skips_empty_days(phone):
    result = run(
        phone,
        """
        const weeks = c.monthWeeks(2026, 10);
        const events = [c.readEvent({ summary: 'A', start: '2026-11-16T10:00:00', end: '2026-11-16T11:00:00' }, 'x')];
        const days = c.agendaDays(events, new Date(2026, 10, 14), 14);
        return { first: weeks[0][0].date.getDate(), out: weeks[0][0].out, rows: weeks.length, cols: weeks[0].length,
                 days: days.map((d) => [d.day.getDate(), d.events.length]),
                 titles: [c.dayTitle(new Date(2026, 10, 14), new Date(2026, 10, 14, 9), 'pl'), c.dayTitle(new Date(2026, 10, 15), new Date(2026, 10, 14), 'pl')] };
    """,
    )
    assert (result["first"], result["out"], result["rows"], result["cols"]) == (26, True, 6, 7)
    assert result["days"] == [[14, 0], [16, 1]]
    assert result["titles"][0].startswith("Dziś — sobota") and result["titles"][1].startswith(
        "Jutro — niedziela"
    )


def test_a_person_sees_the_homes_calendars_and_their_own(phone):
    add_calendars(phone)
    result = run(
        phone,
        """
        const hass = window.dashboard.hass();
        const config = { status_panel: { calendars: ['calendar.family', 'calendar.rocznice', 'calendar.gone'], calendar_colors: { 'calendar.family': '#00ff00' } } };
        return [c.shownCalendars(hass, config, {}), c.shownCalendars(hass, config, { calendars: { own: ['calendar.kuba'] } }),
                c.shownCalendars(hass, config, { calendars: { home: false, own: ['calendar.kuba', 'calendar.gone'] } }),
                c.calendarColour(hass, config, 'calendar.family'), c.calendarColour(hass, config, 'calendar.kuba') !== ''];
    """,
    )
    assert result[0] == HOME
    assert result[1] == [*HOME, "calendar.kuba"]
    assert result[2] == ["calendar.kuba"]
    assert result[3] == "#00ff00" and result[4] is True


# The status bar of a tablet --------------------------------------------------------------------------------------


def open_bar(tablet, extra=None):
    add_calendars(tablet)
    mount_status(tablet, {"status_panel": {"calendars": HOME, **(extra or {})}})
    tablet.wait_for_selector(f"{PANEL} [data-calendar-event]")


def badges(tablet):
    return tablet.locator(f"{PANEL} [data-calendar-event]").evaluate_all(
        "(items) => items.map((item) => [item.querySelector('strong').textContent, item.className.trim().split(/\\s+/)])"
    )


def test_today_shows_under_the_weather_all_day_first_and_now(tablet):
    open_bar(tablet)
    shown = badges(tablet)
    assert [name for name, _ in shown] == ["Rocznica ślubu", "Zakupy", "Planowanie"]
    assert "all-day" in shown[0][1] and "now" in shown[1][1] and "now" not in shown[2][1]
    order = tablet.locator(f"{PANEL} [data-status-widget]").evaluate_all(
        "(items) => items.map((item) => item.dataset.statusWidget)"
    )
    assert order.index("calendar") == order.index("weather") + 1
    # the person's own calendar is not the tablet's
    assert tablet.locator(f"{PANEL} [data-calendar-event]", has_text="Kuba").count() == 0


def test_a_limit_leaves_the_rest_as_more(tablet):
    open_bar(tablet, {"calendar_limit": 2})
    assert len(badges(tablet)) == 2
    assert tablet.locator(f"{PANEL} [data-calendar-more]").inner_text().strip() == "+1 więcej"


def test_without_calendars_there_is_no_part(tablet):
    add_calendars(tablet)
    mount_status(tablet, {})
    tablet.wait_for_selector(f"{PANEL} [data-status-widget='weather']")
    assert tablet.locator(f"{PANEL} [data-status-widget='calendar']").count() == 0


def test_a_tap_opens_the_month_with_the_day_beside_it(tablet):
    open_bar(tablet)
    tablet.locator(f"{PANEL} [data-calendar-event]").first.click()
    tablet.wait_for_selector(f"{SHEET} [data-cal-month]")
    today = datetime.now().date().isoformat()
    day = tablet.locator(f"{SHEET} [data-cal-date='{today}']")
    assert "today" in day.get_attribute("class")
    assert day.locator(".cal-pill.all-day").inner_text() == "Rocznica ślubu"
    agenda = tablet.locator(f"{SHEET} [data-cal-agenda]")
    agenda.locator("[data-cal-event]", has_text="Planowanie").wait_for()
    assert "Cały tydzień" in agenda.inner_text()
    # the legend hides a calendar for a while
    tablet.locator(f"{SHEET} [data-cal-filter='calendar.rocznice']").click()
    assert day.locator(".cal-pill.all-day").count() == 0
    tablet.locator(f"{SHEET} [data-cal-next]").click()
    assert tablet.locator(f"{SHEET} [data-cal-date='{today}']").count() in (0, 1)


# A phone: from the list of areas -----------------------------------------------------------------------------------


def open_list(phone, prefs=None):
    add_calendars(phone)
    if prefs:
        phone.evaluate(
            "(prefs) => { const hass = window.dashboard.hass; window.dashboard.hass = (o) => { const h = hass(o); "
            "const ws = h.callWS; return { ...h, callWS: async (m) => m.type === 'frontend/get_user_data' ? { value: prefs } : ws(m) }; }; }",
            prefs,
        )
    mount(phone, {"status_panel": {"calendars": HOME}})
    phone.locator("[data-rooms]").click()
    phone.wait_for_selector(f"{SHEET} [data-calendar-link] [data-calendar-count]")


def test_the_list_of_areas_says_what_today_holds_and_opens_the_list(phone):
    open_list(phone)
    link = phone.locator(f"{SHEET} [data-calendar-link]")
    assert link.locator("[data-calendar-count]").inner_text() == "3"
    assert "Rocznica ślubu" in link.inner_text()
    link.click()
    phone.wait_for_selector(f"{SHEET} [data-cal-list] [data-cal-event]")
    days = phone.locator(f"{SHEET} [data-cal-day]")
    assert days.count() == 2
    first = days.first
    assert "Rocznica ślubu" in first.locator(".all-day").inner_text()
    assert "past" in first.locator("[data-cal-event]", has_text="Skończone").get_attribute("class")
    assert "Cały tydzień" in first.inner_text()


def test_the_gear_adds_a_persons_own_calendar(phone):
    open_list(phone)
    phone.locator(f"{SHEET} [data-calendar-link]").click()
    phone.locator(f"{SHEET} [data-cal-settings]").click()
    phone.locator(f"{SHEET} [data-cal-own='calendar.kuba']").check()
    saved = phone.evaluate(
        "window.hass.calls.filter((c) => c.type === 'ws' && c.message.type === 'frontend/set_user_data').map((c) => c.message.value.calendars)"
    )
    assert saved[-1] == {"home": True, "own": ["calendar.kuba"]}
    phone.locator(f"{SHEET} [data-cal-back]").click()
    phone.locator(f"{SHEET} [data-cal-event]", has_text="Kuba basen").wait_for()
    phone.locator(f"{SHEET} [data-cal-settings]").click()
    phone.locator(f"{SHEET} [data-cal-home]").uncheck()
    phone.locator(f"{SHEET} [data-cal-back]").click()
    phone.locator(f"{SHEET} [data-cal-list]").wait_for()
    phone.locator(f"{SHEET} [data-cal-event]", has_text="Planowanie").wait_for(state="detached")
    assert phone.locator(f"{SHEET} [data-cal-event]", has_text="Kuba basen").count() == 1


def test_the_gear_stands_in_line_with_the_content(tablet, phone):
    """It kept the room of an empty end of the header after it and the header's own smaller margin."""
    open_bar(tablet)
    tablet.locator(f"{PANEL} [data-calendar-event]").first.click()
    tablet.wait_for_selector(f"{SHEET} [data-cal-next]")
    gear = tablet.locator(f"{SHEET} [data-cal-settings]").bounding_box()
    following = tablet.locator(f"{SHEET} [data-cal-next]").bounding_box()
    assert abs((gear["x"] + gear["width"]) - (following["x"] + following["width"])) <= 1
    open_list(phone)
    phone.locator(f"{SHEET} [data-calendar-link]").click()
    phone.wait_for_selector(f"{SHEET} [data-cal-event]")
    gear = phone.locator(f"{SHEET} [data-cal-settings]").bounding_box()
    event = phone.locator(f"{SHEET} [data-cal-event]").first.bounding_box()
    assert abs((gear["x"] + gear["width"]) - (event["x"] + event["width"])) <= 1


# After a restart of Home Assistant --------------------------------------------------------------------------


def test_a_calendar_that_cannot_be_read_is_not_kept_as_empty(phone):
    mount(phone)
    add_calendars(phone)
    result = run(
        phone,
        """const hass = { callApi: async () => { throw new Error('starting'); } };
        const day = new Date(); day.setHours(0, 0, 0, 0); const next = new Date(day.getTime() + 86400000);
        const first = await c.cachedEvents(hass, ['calendar.family'], day, next);
        let asked = 0; const ready = { callApi: async () => { asked += 1; return []; } };
        await c.cachedEvents(ready, ['calendar.family'], day, next);
        return { incomplete: first.incomplete === true, asked };""",
    )
    assert result == {"incomplete": True, "asked": 1}


def test_todays_events_come_back_when_home_assistant_is_back(tablet):
    add_calendars(tablet)
    tablet.evaluate("window.calendarFails = true")
    mount_status(tablet, {"status_panel": {"calendars": HOME}})
    tablet.wait_for_selector(PANEL)
    tablet.wait_for_timeout(200)
    assert tablet.locator(f"{PANEL} [data-calendar-event]").count() == 0
    # Home Assistant is up again and the connection says it is ready: no reload of the page needed.
    tablet.evaluate(
        f"() => {{ window.calendarFails = false; document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('{PANEL}')?._onReconnect?.() ?? document.querySelector('{PANEL}')?._onReconnect(); }}"
    )
    tablet.wait_for_selector(f"{PANEL} [data-calendar-event]")
    assert [name for name, _ in badges(tablet)] == ["Rocznica ślubu", "Zakupy", "Planowanie"]
