"""Events on the school screen: the important ones at the top and every one in the lesson plan."""

from __future__ import annotations

from datetime import date, timedelta

from .test_page import mount
from .test_panels import add_entity
from .test_shortcuts import SCHOOL, add_school

SCREEN = "home-dashboard-school"
TODAY = date.today().isoformat()
TOMORROW = (date.today() + timedelta(days=1)).isoformat()
LATER = (date.today() + timedelta(days=2)).isoformat()


def event(title: str, day: str = TODAY, important: bool = True, **rest) -> dict:
    return {"date": day, "title": title, "start": None, "end": None, "place": "", "description": "",
            "instead_of_lessons": False, "important": important, **rest}


def open_with(page, librus: list, plan_day: dict | None = None) -> None:
    add_school(page)
    add_entity(page, "sensor.rodzinnik_librus", "0", {"children": librus})
    if plan_day:
        lesson = {"number": 1, "start": "08:00", "end": "08:45", "subject": "Polski", "type": "lesson"}
        day = {"date": TODAY, "name": "Poniedziałek", "is_today": True, "lessons": [lesson], **plan_day}
        add_entity(page, "sensor.rodzinnik_plan_lekcji", "x", {"children": [{"child": "Lena", "days": [day]}]})
    mount(page, {"shortcuts": [SCHOOL]})
    page.locator("[data-shortcut='Rok szkolny']").click()
    page.wait_for_selector(f"{SCREEN} [data-tab]")


def important(page, key: str) -> list:
    return page.locator(f"{SCREEN} [data-important='{key}'] strong").all_inner_texts()


def test_important_events_of_today_and_tomorrow_stand_at_the_top_for_all_children(phone):
    open_with(phone, [
        {"child": "Lena", "events": [event("Galowy"), event("Basen", TOMORROW)]},
        {"child": "Maja", "events": [event("Wycieczka")]},
    ])
    assert important(phone, "school_today") == ["Galowy", "Wycieczka"]
    assert important(phone, "school_tomorrow") == ["Basen"]
    first = phone.locator(f"{SCREEN} .content > *").first
    assert first.get_attribute("data-important") == "school_today"


def test_the_child_is_named_beside_the_event(phone):
    open_with(phone, [{"child": "Lena", "events": [event("Galowy", place="szkoła")]}])
    text = phone.locator(f"{SCREEN} [data-important='school_today'] small").last.inner_text()
    assert "Lena" in text
    assert "szkoła" in text


def test_an_ordinary_event_stays_out_of_the_top(phone):
    open_with(phone, [{"child": "Lena", "events": [event("Zwykłe", important=False)]}])
    assert phone.locator(f"{SCREEN} [data-important]").count() == 0


def test_a_later_event_stays_out_of_the_top(phone):
    open_with(phone, [{"child": "Lena", "events": [event("Później", LATER)]}])
    assert phone.locator(f"{SCREEN} [data-important]").count() == 0


def test_an_event_from_two_accounts_of_a_child_shows_once(phone):
    open_with(phone, [{"child": "Lena", "events": [event("Galowy")]}, {"child": "Lena", "events": [event("Galowy")]}])
    assert important(phone, "school_today") == ["Galowy"]


def test_two_children_with_the_same_event_both_show(phone):
    open_with(phone, [{"child": "Lena", "events": [event("Galowy")]}, {"child": "Maja", "events": [event("Galowy")]}])
    assert important(phone, "school_today") == ["Galowy", "Galowy"]


def test_the_top_stays_on_every_tab(phone):
    open_with(phone, [{"child": "Lena", "events": [event("Galowy")]}])
    phone.locator(f"{SCREEN} [data-tab='tab:meals']").click()
    assert important(phone, "school_today") == ["Galowy"]


def test_tomorrow_crosses_the_end_of_a_month(phone):
    result = phone.evaluate("""async () => {
        const { importantEvents } = await import("/custom_components/home_dashboard/www/app/school.js");
        const events = [{ date: "2026-12-01", title: "A", important: true }];
        return importantEvents([{ child: "L", events }], new Date(2026, 10, 30, 23, 0)).tomorrow.length;
    }""")
    assert result == 1


def test_a_screen_without_the_sensor_still_opens(phone):
    add_school(phone)
    mount(phone, {"shortcuts": [SCHOOL]})
    phone.locator("[data-shortcut='Rok szkolny']").click()
    phone.wait_for_selector(f"{SCREEN} [data-tab]")
    assert phone.locator(f"{SCREEN} [data-important]").count() == 0


def test_the_plan_shows_an_event_of_the_day_even_if_it_is_not_important(phone):
    open_with(phone, [], {"events": [event("Strój galowy", important=False)]})
    rows = phone.locator(f"{SCREEN} [data-day-event]")
    assert rows.count() == 1
    assert "Strój galowy" in rows.inner_text()
    assert phone.locator(f"{SCREEN} [data-lesson]").count() == 1


def test_the_plan_gives_the_hours_and_place_of_an_event(phone):
    open_with(phone, [], {"events": [event("Wycieczka", start="07:30", end="18:00", place="Karpacz")]})
    text = phone.locator(f"{SCREEN} .content [data-day-event]").last.inner_text()
    assert "07:30" in text
    assert "18:00" in text
    assert "Karpacz" in text


def test_a_day_instead_of_lessons_crosses_out_the_lessons_and_says_so(phone):
    open_with(phone, [], {"no_lessons": True, "events": [event("Wycieczka", instead_of_lessons=True)]})
    assert "canceled" in phone.locator(f"{SCREEN} [data-lesson]").get_attribute("class")
    assert "zamiast lekcji" in phone.locator(f"{SCREEN} .content [data-day-event]").last.inner_text()


def test_extra_activities_stay_on_a_day_without_lessons(phone):
    add_school(phone)
    extra = {"start": "16:00", "end": "17:00", "subject": "Basen", "type": "extra"}
    day = {"date": TODAY, "name": "Poniedziałek", "is_today": True, "lessons": [extra], "no_lessons": True, "events": []}
    add_entity(phone, "sensor.rodzinnik_plan_lekcji", "x", {"children": [{"child": "Lena", "days": [day]}]})
    mount(phone, {"shortcuts": [SCHOOL]})
    phone.locator("[data-shortcut='Rok szkolny']").click()
    phone.wait_for_selector(f"{SCREEN} [data-lesson]")
    assert "canceled" not in phone.locator(f"{SCREEN} [data-lesson]").get_attribute("class")


def open_calendar(page, librus: list) -> None:
    open_with(page, librus)
    page.locator(f"{SCREEN} [data-tab='view:events']").click()


def calendar(page) -> list:
    return page.locator(f"{SCREEN} [data-event] strong").all_inner_texts()


def test_the_calendar_adds_the_events_of_the_child_in_date_order(phone):
    open_calendar(phone, [{"child": "Lena", "events": [event("Wcześniej", "2026-11-01"), event("Później", "2026-11-20")]}])
    assert calendar(phone) == ["Wcześniej", "Sprawdzian: Ułamki", "Później"]


def test_the_calendar_leaves_out_the_events_of_other_children(phone):
    open_calendar(phone, [{"child": "Maja", "events": [event("Cudze")]}])
    assert calendar(phone) == ["Sprawdzian: Ułamki"]


def test_an_event_from_two_accounts_shows_once_in_the_calendar(phone):
    both = {"child": "Lena", "events": [event("Galowy", "2026-11-20")]}
    open_calendar(phone, [both, both])
    assert calendar(phone).count("Galowy") == 1


def test_a_calendar_with_only_an_event_is_not_empty(phone):
    open_calendar(phone, [{"child": "Lena", "events": [event("Galowy")]}])
    phone.locator(f"{SCREEN} [data-tab='tab:Maja']").click()
    assert phone.locator(f"{SCREEN} [data-event]").count() == 0


def test_a_weekend_day_with_an_event_is_shown(phone):
    result = phone.evaluate("""async () => {
        const { shownDays } = await import("/custom_components/home_dashboard/www/app/school.js");
        return shownDays([{ name: "Sobota", lessons: [], events: [{ title: "Zawody" }] }, { name: "Niedziela", lessons: [], events: [] }]).length;
    }""")
    assert result == 1
