"""On a tablet the school year, the news and the status use the whole screen: jobs and accounts as tiles, the week
of lessons side by side, the news in two columns, the groups of the status beside each other."""

from __future__ import annotations

from .test_news import ARTICLE, SHORTCUT
from .test_overview import cold_item
from .test_page import mount
from .test_panels import add_entity
from .test_shortcuts import LESSON, SCHOOL, add_school, tab

SHEET = "home-dashboard-sheet"
SCHOOL_SCREEN = "home-dashboard-school"


def open_school_on(page) -> None:
    add_school(page)
    jobs = [{"name": f"Praca {n}", "reward_label": f"{n} zł", "description": "Opis"} for n in range(1, 6)]
    add_entity(page, "sensor.rodzinnik_prace", "5", {"jobs": jobs})
    children = [{"child": name, "balance": 10 * n, "savings": 0, "debt": 0} for n, name in enumerate(["Ola", "Ada", "Ewa", "Iza"], 1)]
    add_entity(page, "sensor.rodzinnik_bank", "4", {"currency": "PLN", "children": children})
    mount(page, {"shortcuts": [SCHOOL]})
    page.locator("[data-shortcut='Rok szkolny']").dispatch_event("click")
    page.wait_for_selector(f"{SCHOOL_SCREEN} [data-tab]")


def tops(page, selector: str) -> list:
    return [round(box["y"]) for box in (element.bounding_box() for element in page.locator(selector).all())]


def test_jobs_and_accounts_stand_as_tiles_four_in_a_row(tablet):
    open_school_on(tablet)
    tab(tablet, "tab", "jobs")
    rows = tops(tablet, f"{SCHOOL_SCREEN} [data-job]")
    assert rows[:4] == [rows[0]] * 4 and rows[4] > rows[0]
    tab(tablet, "tab", "bank")
    assert len(set(tops(tablet, f"{SCHOOL_SCREEN} [data-account]"))) == 1


def test_the_whole_week_of_lessons_stands_side_by_side_without_day_tabs(tablet):
    open_school_on(tablet)
    days = tablet.locator(f"{SCHOOL_SCREEN} [data-plan-day]")
    # The empty Saturday stays out, as on a phone.
    assert days.evaluate_all("(days) => days.map((day) => day.dataset.planDay)") == ["Poniedziałek", "Wtorek"]
    assert len(set(tops(tablet, f"{SCHOOL_SCREEN} [data-plan-day]"))) == 1
    assert tablet.locator(f"{SCHOOL_SCREEN} [data-tab^='day:']").count() == 0
    assert tablet.locator(f"{SCHOOL_SCREEN} [data-plan-day='Wtorek'] [data-lesson]").count() == 2


def test_a_phone_keeps_one_day_at_a_time(phone):
    add_school(phone)
    mount(phone, {"shortcuts": [SCHOOL]})
    phone.locator("[data-shortcut='Rok szkolny']").click()
    phone.wait_for_selector(f"{SCHOOL_SCREEN} [data-tab]")
    assert phone.locator(f"{SCHOOL_SCREEN} [data-plan-week]").count() == 0
    assert phone.locator(f"{SCHOOL_SCREEN} [data-tab^='day:']").count() == 2
    assert LESSON


def test_the_news_use_the_whole_screen_in_two_columns(tablet):
    add_entity(tablet, "sensor.home", "x", {"news": [ARTICLE, {**ARTICLE, "title": "Drugi"}], "release": "W"})
    add_entity(tablet, "sensor.world", "x", {"news": []})
    mount(tablet, {"shortcuts": [SHORTCUT]})
    tablet.locator("home-dashboard-page [data-shortcut='Wiadomości']").dispatch_event("click")
    tablet.wait_for_selector(f"{SHEET} home-dashboard-news article")
    assert "whole" in tablet.locator(f"{SHEET} .panel").get_attribute("class")
    first, second = tablet.locator(f"{SHEET} home-dashboard-news article").all()
    assert abs(first.bounding_box()["y"] - second.bounding_box()["y"]) < 1
    assert first.bounding_box()["width"] > 450


def test_the_status_uses_the_whole_screen_with_its_items_side_by_side(tablet):
    add_entity(tablet, "climate.bed", "auto", {"current_temperature": 17.5})
    add_entity(tablet, "climate.salon", "auto", {"current_temperature": 17, "friendly_name": "Salon"})
    sections = [{"title": "Uwaga", "alert": True, "items": [cold_item()]}]
    mount(tablet, {"shortcuts": [{"kind": "overview", "name": "Status", "icon": "mdi:check", "sections": sections}]})
    tablet.locator("home-dashboard-page [data-shortcut='Status']").dispatch_event("click")
    tablet.wait_for_selector(f"{SHEET} home-dashboard-overview [data-status-now]")
    assert "whole" in tablet.locator(f"{SHEET} .panel").get_attribute("class")
    first, second = tablet.locator(f"{SHEET} home-dashboard-overview [data-status-row]").all()[:2]
    assert abs(first.bounding_box()["y"] - second.bounding_box()["y"]) < 1

