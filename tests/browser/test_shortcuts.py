"""Shortcuts, the school screen, backgrounds and opening at start on one device."""

from __future__ import annotations

import pytest

from .test_page import mount
from .test_panels import add_entity, calls

CHROME = "document.querySelector('home-dashboard-chrome')"
SHEET = "home-dashboard-sheet"


def edit_screen(page) -> None:
    page.locator("home-dashboard-page [data-rooms]").click()
    page.locator("[data-sheet-edit]").click()
ADMIN_MOUNT = """async ({ dashboard, page, admin }) => {
    window.saved = [];
    window.uploads = [];
    const hass = window.dashboard.hass({
        user: { name: "User", is_admin: admin },
        fetchWithAuth: async (url, options) => {
            window.uploads.push(url);
            if (window.uploadFails) return { ok: false, status: 413 };
            return { ok: true, json: async () => ({ id: "abc" }) };
        },
        callWS: async (message) => {
            if (message.type === "lovelace/config") {
                return { strategy: { type: "custom:home-dashboard", ...dashboard } };
            }
            if (!["frontend/get_user_data", "config/auth/list"].includes(message.type)) window.saved.push(message);
            return null;
        },
    });
    window.hass = hass;
    window.card = await window.dashboard.mount(hass, dashboard, page);
    document.querySelector("home-dashboard-chrome")._reload = () => {};
}"""
HOST = {
    "kind": "panel",
    "name": "Host",
    "icon": "mdi:server",
    "groups": [{"title": "HA", "rows": [{"entity": "sensor.cpu"}]}],
}
SCHOOL = {"kind": "school", "name": "Rok szkolny", "icon": "mdi:school", "children": ["Lena", "Maja"]}
LESSON = {"number": 1, "start": "08:00", "end": "08:45", "subject": "Matematyka", "classroom": "12", "teacher": "Pani"}


def mount_admin(page, dashboard: dict, name: str = "home", admin: bool = True) -> None:
    page.evaluate(ADMIN_MOUNT, {"dashboard": dashboard, "page": name, "admin": admin})
    page.wait_for_selector("home-dashboard-chrome", state="attached")


def add_school(page) -> None:
    days = [
        {"date": "2026-11-02", "name": "Poniedziałek", "is_today": False, "lessons": [{**LESSON, "subject": "Polski"}]},
        {"date": "2026-11-03", "name": "Wtorek", "is_today": True, "lessons": [LESSON, {**LESSON, "subject": "WF", "canceled": True}]},
        {"date": "2026-11-07", "name": "Sobota", "is_today": False, "lessons": []},
    ]
    add_entity(page, "sensor.rodzinnik_plan_lekcji", "x", {"children": [
        {"child": "Maja", "days": days}, {"child": "Lena", "days": days}, {"child": "Kuba", "days": []},
    ]})
    grade = {"grade": "5", "category": "test", "is_new": True, "proposition": False}
    add_entity(page, "sensor.rodzinnik_oceny", "1", {"children": [{"child": "Lena", "semester": 1, "subjects": [
        {"subject": "Religia", "averages": {"semester_1": 5.75}, "grades": [grade, {**grade, "is_new": False, "proposition": True}]},
    ]}]})
    add_entity(page, "sensor.rodzinnik_terminarz", "x", {"children": [{"child": "Lena", "entries": [
        {"date": "2026-11-06", "kind": "Sprawdzian", "title": "Ułamki", "start": "08:00"},
    ]}]})
    add_entity(page, "sensor.rodzinnik_obiady", "x", {"variants": [
        {"variant": "szkola", "label": "Szkoła", "available": True, "days": [
            {"name": "Wtorek", "meals": [{"meal": "Obiad", "items": [{"name": "Rosół"}, {"name": "Kotlet"}]}]},
        ]},
        {"variant": "brak", "label": "Brak", "available": False, "days": []},
    ]})
    week = {
        "week_start": "2026-11-02",
        "week_end": "2026-11-08",
        "children": [
            {"child": "Ola", "child_color": "#f5ec00", "set": "Salon", "color": "#77bb41", "tasks": ["Kurze", "Zakupy"]},
            {"child": "Kuba", "set": "Zmywarka", "color": "#112233", "tasks": ["Naczynia"]},
            {"child": "Ewa", "free_week": True},
        ],
    }
    later = {"week_start": "2026-11-09", "week_end": "2026-11-15", "children": [{"child": "Ola", "set": "Kuchnia", "tasks": []}]}
    add_entity(page, "sensor.rodzinnik_obowiazki", "x", {**week, "next_week": later})
    add_entity(page, "sensor.rodzinnik_prace", "1", {"jobs": [{"name": "Grabienie", "reward_label": "5 do 10 zł", "description": "Liście"}]})
    add_entity(page, "sensor.rodzinnik_bank", "1", {"currency": "PLN", "children": [{"child": "Ola", "balance": 65, "savings": 10, "debt": 0}]})


def open_school(page) -> None:
    add_school(page)
    mount(page, {"shortcuts": [SCHOOL]})
    page.locator("[data-shortcut='Rok szkolny']").click()
    page.wait_for_selector("home-dashboard-school [data-tab]")


def tab(page, kind: str, key: str) -> None:
    page.locator(f"home-dashboard-school [data-tab='{kind}:{key}']").click()


# Order of the icons ------------------------------------------------------------------------------


def header_icons(page, selector: str) -> list[str]:
    return page.evaluate(
        """(selector) => [...window.card.shadowRoot.querySelector(selector).querySelectorAll("button")]
            .map((button) => Object.keys(button.dataset)[0])""",
        selector,
    )


def test_a_room_header_has_the_intercom_and_the_menu(phone):
    area = phone.evaluate("Object.keys(window.dashboard.snapshot.areas)[0]")
    phone.evaluate(f"window.history.replaceState(null, '', '?room={area}')")
    mount_admin(phone, {"intercom": {"script": "script.a", "areas": [area]}}, "room")
    assert header_icons(phone, ".room-title .intercom") == ["intercomHere", "rooms"]


def test_home_has_the_same_order(phone):
    area = phone.evaluate("Object.keys(window.dashboard.snapshot.areas)[0]")
    mount_admin(phone, {"intercom": {"script": "script.a", "areas": [area]}})
    assert header_icons(phone, ".home-title .intercom") == ["intercomAll", "rooms"]


def test_a_long_room_name_does_not_push_the_icons_off_the_screen(phone):
    layout = [{"id": "r", "name": "Bardzo długa nazwa pokoju", "areas": [], "home": [], "sections": []}]
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(phone, {"layout": layout}, "room")
    assert phone.evaluate("document.documentElement.scrollWidth <= innerWidth")


# Shortcuts ---------------------------------------------------------------------------------------


def test_shortcuts_open_a_block(phone):
    add_entity(phone, "sensor.cpu", "12", {"friendly_name": "Procesor"})
    mount(phone, {"shortcuts": [HOST]})
    phone.locator("[data-shortcut='Host']").click()
    assert "Procesor" in phone.locator(f"{SHEET} [data-field='sensor.cpu']").inner_text()
    assert calls(phone) == []


def test_shortcuts_continue_the_row_of_chips_at_the_same_height(tablet):
    mount(tablet, {"shortcuts": [HOST, {**HOST, "name": "Muzyka"}]})
    boxes = tablet.evaluate("""() => [...window.card.shadowRoot.querySelectorAll(".chip")]
        .map((chip) => { const box = chip.getBoundingClientRect(); return [box.top, box.height]; })""")
    assert len(boxes) > 2
    assert {box[0] for box in boxes} == {boxes[0][0]}
    assert {box[1] for box in boxes} == {boxes[0][1]}
    assert tablet.locator(".chips").count() == 1


def shortcut_colours(page) -> list[str]:
    return page.locator(".chip.shortcut ha-icon").evaluate_all(
        "(icons) => icons.map((icon) => getComputedStyle(icon).color)"
    )


def four_shortcuts() -> list[dict]:
    return [{**HOST, "name": name} for name in ("A", "B", "C", "D")]


def test_every_shortcut_gets_its_own_colour_unlike_the_first_chips(phone):
    mount(phone, {"shortcuts": four_shortcuts()})
    colours = shortcut_colours(phone)
    assert len(set(colours)) == 4
    first = phone.locator(".chip:not(.shortcut) ha-icon").evaluate_all(
        "(icons) => icons.map((icon) => getComputedStyle(icon).color)"
    )
    assert not set(colours) & set(first)


def test_shortcut_colours_change_with_the_mode(phone):
    mount(phone, {"shortcuts": four_shortcuts()})
    light = shortcut_colours(phone)
    phone.emulate_media(color_scheme="dark")
    assert not set(light) & set(shortcut_colours(phone))


def test_a_shortcut_can_choose_its_colour(phone):
    mount(phone, {"shortcuts": [{**HOST, "tone": "pink"}]})
    assert phone.locator(".chip.shortcut ha-icon").get_attribute("class") == "pink"


def test_shortcuts_are_in_the_menu_too(phone):
    add_entity(phone, "sensor.cpu", "12")
    mount(phone, {"shortcuts": [HOST]})
    phone.locator("home-dashboard-page [data-menu]").first.click()
    phone.locator("[data-drawer-shortcut='Host']").click()
    phone.wait_for_selector(f"{SHEET} [data-field='sensor.cpu']")


def test_no_shortcuts_no_row(phone):
    mount(phone)
    assert phone.locator(".chip.shortcut").count() == 0


def test_a_filter_keeps_the_shortcuts_in_the_row(phone):
    phone.evaluate("window.history.replaceState(null, '', '?filter=security')")
    mount(phone, {"shortcuts": [HOST]})
    assert phone.locator(".chips [data-shortcut='Host']").count() == 1


def add_alarm(page, entity_id: str, state: str, **entry) -> str:
    area = page.evaluate("Object.keys(window.dashboard.snapshot.areas)[0]")
    add_entity(page, entity_id, state, {"friendly_name": "Baza Security mode"})
    page.evaluate(
        """({ id, entry }) => {
            window.dashboard.snapshot.entities[id] = { entity_id: id, ...entry };
        }""",
        {"id": entity_id, "entry": {"area_id": area, **entry}},
    )
    return area


def test_the_security_filter_shows_alarm_panels(phone):
    add_alarm(phone, "alarm_control_panel.base", "armed_night")
    phone.evaluate("window.history.replaceState(null, '', '?filter=security')")
    mount(phone)
    assert phone.locator("[data-entity='alarm_control_panel.base']").count() == 1


def test_other_filters_leave_alarm_panels_out(phone):
    add_alarm(phone, "alarm_control_panel.base", "armed_night")
    phone.evaluate("window.history.replaceState(null, '', '?filter=lights')")
    mount(phone)
    assert phone.locator("[data-entity='alarm_control_panel.base']").count() == 0


def test_a_hidden_alarm_panel_stays_hidden(phone):
    add_alarm(phone, "alarm_control_panel.base", "armed_night", hidden=True)
    phone.evaluate("window.history.replaceState(null, '', '?filter=security')")
    mount(phone)
    assert phone.locator("[data-entity='alarm_control_panel.base']").count() == 0


def test_an_alarm_panel_uses_the_name_from_the_layout(phone):
    add_alarm(phone, "alarm_control_panel.base", "armed_away")
    tile = {"entity": "alarm_control_panel.base", "name": "Dom"}
    layout = [{"id": "r", "name": "R", "areas": [], "home": [], "sections": [{"title": "S", "tiles": [tile]}]}]
    phone.evaluate("window.history.replaceState(null, '', '?filter=security')")
    mount(phone, {"layout": layout})
    assert phone.locator("[data-entity='alarm_control_panel.base'] strong").inner_text() == "Dom"


def test_an_alarm_going_off_changes_the_security_chip(phone):
    add_alarm(phone, "alarm_control_panel.base", "triggered")
    mount(phone)
    assert "Alarm: 1" in phone.locator("[data-chip='security']").inner_text()


def test_an_armed_alarm_keeps_the_chip_calm(phone):
    add_alarm(phone, "alarm_control_panel.base", "armed_away")
    mount(phone)
    assert "Alarm" not in phone.locator("[data-chip='security']").inner_text()


def test_a_shortcut_can_hide_in_guest_mode(phone):
    add_entity(phone, "input_boolean.guest", "on")
    mount(phone, {"shortcuts": [{**HOST, "hidden_when": "input_boolean.guest"}]})
    assert phone.locator("[data-shortcut='Host']").count() == 0


def test_an_action_can_call_a_service_of_its_entity(phone):
    add_entity(phone, "vacuum.robot", "docked")
    item = {"kind": "panel", "name": "Odkurzacz", "actions": [
        {"name": "Do bazy", "entity": "vacuum.robot", "service": "vacuum.return_to_base"},
    ]}
    mount(phone, {"shortcuts": [item]})
    phone.locator("[data-shortcut='Odkurzacz']").click()
    phone.locator("[data-action='vacuum.robot']").click()
    (sent,) = calls(phone)
    assert (sent["domain"], sent["service"], sent["data"]) == ("vacuum", "return_to_base", {"entity_id": "vacuum.robot"})


def test_the_card_button_can_have_its_own_name(phone):
    item = {"kind": "panel", "name": "Odkurzacz", "card": {"type": "custom:map"}, "card_label": "Mapa"}
    mount(phone, {"shortcuts": [item]})
    phone.locator("[data-shortcut='Odkurzacz']").click()
    assert "Mapa" in phone.locator("[data-panel-card]").inner_text()


MUSIC = {
    "kind": "panel",
    "name": "Muzyka",
    "fullscreen": True,
    "auto_card": True,
    "admin_card": True,
    "card": {"type": "custom:ingress"},
    "frame": "about:blank",
}


def test_an_administrator_gets_the_card_at_once_on_the_whole_screen(tablet):
    mount_admin(tablet, {"shortcuts": [MUSIC]})
    tablet.locator("[data-shortcut='Muzyka']").dispatch_event("click")
    tablet.wait_for_selector("[data-card='custom:ingress']", state="attached")
    assert tablet.locator(f"{SHEET} section.panel").bounding_box()["width"] == 1180
    assert tablet.locator(f"{SHEET} iframe").count() == 0


def test_others_get_the_plain_page_and_no_card(tablet):
    mount_admin(tablet, {"shortcuts": [MUSIC]}, admin=False)
    tablet.locator("[data-shortcut='Muzyka']").dispatch_event("click")
    tablet.wait_for_selector(f"{SHEET} iframe")
    assert tablet.evaluate("window.createdCards") == []


# School ------------------------------------------------------------------------------------------


def test_children_follow_the_chosen_order_and_nobody_is_lost(phone):
    open_school(phone)
    tabs = phone.locator("home-dashboard-school .tabs").first.locator("button").all_inner_texts()
    assert tabs == ["Lena", "Maja", "Kuba", "Obiady", "Obowiązki", "Prace", "Bank"]


def test_the_plan_opens_on_today(phone):
    open_school(phone)
    rows = phone.locator("home-dashboard-school [data-lesson] strong").all_inner_texts()
    assert rows == ["1. Matematyka", "1. WF"]


def test_another_day_can_be_chosen_and_an_empty_weekend_is_left_out(phone):
    open_school(phone)
    assert phone.locator("home-dashboard-school [data-tab^='day:']").count() == 2
    tab(phone, "day", "0")
    assert phone.locator("home-dashboard-school [data-lesson] strong").all_inner_texts() == ["1. Polski"]


def test_a_cancelled_lesson_is_marked(phone):
    open_school(phone)
    assert "canceled" in phone.locator("home-dashboard-school [data-lesson]").nth(1).get_attribute("class")


def test_grades_show_the_average_new_and_proposed_ones(phone):
    open_school(phone)
    tab(phone, "view", "grades")
    row = phone.locator("home-dashboard-school [data-subject]")
    assert "5,75" in row.inner_text()
    assert row.locator(".grade.new").count() == 1
    assert "5?" in row.inner_text()


def test_the_calendar_lists_what_is_coming(phone):
    open_school(phone)
    tab(phone, "view", "events")
    assert "Sprawdzian: Ułamki" in phone.locator("home-dashboard-school [data-event]").inner_text()


def test_a_child_without_data_says_so(phone):
    open_school(phone)
    tab(phone, "tab", "Kuba")
    assert "Brak danych" in phone.locator("home-dashboard-school .empty").inner_text()


def test_lunch_shows_only_what_is_available(phone):
    open_school(phone)
    tab(phone, "tab", "meals")
    assert phone.locator("home-dashboard-school [data-tab^='variant:']").count() == 1
    assert "Rosół · Kotlet" in phone.locator("home-dashboard-school [data-meal]").inner_text()


def test_chores_show_each_child_with_the_set_and_tasks(phone):
    open_school(phone)
    tab(phone, "tab", "duties")
    card = phone.locator("home-dashboard-school [data-duty='Ola']")
    assert "Salon" in card.inner_text()
    assert card.locator("li").all_inner_texts() == ["Kurze", "Zakupy"]
    assert phone.locator("home-dashboard-school [data-duty]").count() == 3


def test_a_free_week_is_named(phone):
    open_school(phone)
    tab(phone, "tab", "duties")
    assert "Wolny tydzień" in phone.locator("home-dashboard-school [data-duty='Ewa']").inner_text()


def test_weeks_can_be_changed_only_where_there_is_data(phone):
    open_school(phone)
    tab(phone, "tab", "duties")
    label = phone.locator("home-dashboard-school [data-week-label]")
    assert "Ten tydzień" in label.inner_text()
    assert "2.11" in label.inner_text()
    assert phone.locator("home-dashboard-school [data-week='previous']").is_disabled()
    phone.locator("home-dashboard-school [data-week='next']").click()
    assert "Następny tydzień" in label.inner_text()
    assert "Kuchnia" in phone.locator("home-dashboard-school [data-duty='Ola']").inner_text()
    assert phone.locator("home-dashboard-school [data-week='next']").is_disabled()


@pytest.mark.parametrize(
    ("colour", "expected"),
    [
        ("#77bb41", "background: #77bb41; color: #1b1b1f"),
        ("#112233", "background: #112233; color: #ffffff"),
        ("red; x", ""),
        (None, ""),
    ],
)
def test_the_set_label_stays_readable_on_any_colour(phone, colour, expected):
    assert phone.evaluate(
        """async (colour) => {
            const { colourStyle } = await import("/custom_components/home_dashboard/www/app/school.js");
            return colourStyle(colour);
        }""",
        colour,
    ) == expected


def test_jobs_and_bank(phone):
    open_school(phone)
    tab(phone, "tab", "jobs")
    assert "5 do 10 zł" in phone.locator("home-dashboard-school [data-job]").inner_text()
    tab(phone, "tab", "bank")
    text = phone.locator("home-dashboard-school [data-account]").inner_text()
    assert "65,00" in text
    assert "oszczędności" in text


def test_the_school_screen_sends_nothing(phone):
    open_school(phone)
    assert calls(phone) == []


def test_the_school_screen_survives_missing_sensors(phone):
    mount(phone, {"shortcuts": [SCHOOL]})
    phone.locator("[data-shortcut='Rok szkolny']").click()
    assert "Brak danych" in phone.locator("home-dashboard-school .empty").inner_text()


# Backgrounds -------------------------------------------------------------------------------------


def backdrop(page) -> str | None:
    return page.evaluate("""() => window.card.shadowRoot.querySelector(".backdrop")?.getAttribute("style") ?? null""")


def test_no_background_no_layer(phone):
    mount(phone)
    assert backdrop(phone) is None


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("#223344", "background: #223344"),
        ("/api/image/serve/x/original", 'background-image: url("/api/image/serve/x/original"); background-position: center center'),
        ('red; } </style>"', "background: red  /style"),
    ],
)
def test_a_background_cannot_break_out_of_its_style(phone, value, expected):
    assert phone.evaluate(
        """async (value) => {
            const { backgroundStyle } = await import("/custom_components/home_dashboard/www/app/styles.js");
            return backgroundStyle(value);
        }""",
        value,
    ) == expected


def test_home_shows_its_background_and_other_pages_do_not(phone):
    mount(phone, {"background": "#223344"})
    assert "#223344" in backdrop(phone)
    mount(phone, {"background": "#223344"}, "media")
    assert phone.evaluate("""() => window.card.shadowRoot.querySelector(".backdrop")""") is None


def test_the_tiles_stay_above_the_background(phone):
    mount(phone, {"background": "#223344"})
    assert phone.evaluate("""() => {
        const root = window.card.shadowRoot;
        const box = root.querySelector("h1").getBoundingClientRect();
        return root.elementFromPoint(box.left + 4, box.top + 4).closest("h1")?.localName;
    }""") == "h1"


def test_a_room_has_its_own_background(phone):
    layout = [{"id": "r", "name": "R", "areas": [], "home": [], "sections": [], "background": "#112233"}]
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount(phone, {"layout": layout, "background": "#223344"}, "room")
    assert "#112233" in backdrop(phone)


def open_background(page) -> None:
    page.locator("home-dashboard-page [data-rooms]").click()
    page.locator("[data-sheet-background]").click()
    page.wait_for_selector(f"{SHEET} section.panel[data-kind='background']")


def save_background(page) -> None:
    page.locator("[data-background-save]").click()


def shared_saves(page) -> list:
    return page.evaluate("window.saved.filter((message) => message.type === 'lovelace/config/save')")


def own_saves(page) -> list:
    return page.evaluate("window.saved.filter((message) => message.type === 'frontend/set_user_data')")


def test_an_administrator_saves_a_background_for_everyone(phone):
    mount_admin(phone, {"favorites": []})
    open_background(phone)
    phone.locator("[data-swatch]").first.click()
    save_background(phone)
    phone.wait_for_function("window.saved.some((message) => message.type === 'lovelace/config/save')")
    shared = shared_saves(phone)[0]["config"]["strategy"]["backgrounds"]["home"]
    assert "gradient" in shared["light"]
    assert shared["dark"] is None


def test_the_background_can_be_removed(phone):
    mount_admin(phone, {"background": "#223344"})
    open_background(phone)
    phone.locator("[data-background-clear]").click()
    save_background(phone)
    phone.wait_for_function("window.saved.some((message) => message.type === 'lovelace/config/save')")
    strategy = shared_saves(phone)[0]["config"]["strategy"]
    assert "background" not in strategy
    assert strategy["backgrounds"]["home"]["light"] is None


def test_without_the_checkbox_a_background_stays_with_the_account(phone):
    mount_admin(phone, {})
    open_background(phone)
    phone.locator("[data-everyone='light']").uncheck()
    phone.locator("[data-swatch]").first.click()
    save_background(phone)
    phone.wait_for_selector(f"{SHEET} section.panel", state="detached")
    assert "gradient" in own_saves(phone)[-1]["value"]["backgrounds"]["home"]["light"]
    assert "dark" not in own_saves(phone)[-1]["value"]["backgrounds"]["home"]


def test_the_dark_look_is_a_field_of_its_own(phone):
    mount_admin(phone, {})
    open_background(phone)
    phone.locator("[data-look='dark'] .look-preview").click()
    phone.locator("[data-swatch]").first.click()
    save_background(phone)
    phone.wait_for_function("window.saved.some((message) => message.type === 'lovelace/config/save')")
    shared = shared_saves(phone)[0]["config"]["strategy"]["backgrounds"]["home"]
    assert shared["light"] is None
    assert "gradient" in shared["dark"]


def test_someone_else_has_no_checkbox_and_saves_only_for_themselves(phone):
    mount_admin(phone, {}, admin=False)
    open_background(phone)
    assert phone.locator("[data-everyone]").count() == 0
    phone.locator("[data-swatch]").first.click()
    save_background(phone)
    phone.wait_for_selector(f"{SHEET} section.panel", state="detached")
    assert shared_saves(phone) == []
    assert own_saves(phone)


@pytest.mark.parametrize(
    ("shared", "own", "mode", "expected"),
    [
        ({"light": "#111111", "dark": "#222222"}, None, "dark", "#222222"),
        ({"light": "#111111", "dark": None}, None, "dark", None),
        ({"light": "#111111"}, None, "dark", None),
        ({"dark": "#222222"}, None, "light", None),
        ({"light": "#111111"}, {"light": "#333333"}, "light", "#333333"),
        ({"light": "#111111"}, {"light": None}, "light", None),
        ({"light": "#111111"}, {"dark": "#333333"}, "light", "#111111"),
        ("#444444", None, "dark", "#444444"),
    ],
)
def test_what_a_person_sees(phone, shared, own, mode, expected):
    assert phone.evaluate(
        """({ shared, own, mode }) => {
            const { model } = window.dashboard;
            const config = model.normalizeConfig({ backgrounds: { home: shared } });
            const mine = model.personalize(config, "a", own ? { backgrounds: { home: own } } : {});
            return model.pickBackground(mine, "home", null, mode);
        }""",
        {"shared": shared, "own": own, "mode": mode},
    ) == expected


@pytest.mark.parametrize(
    ("shared", "own", "mode", "shape", "expected"),
    [
        ({"light": "#111111", "light_wide": "#222222"}, None, "light", "wide", "#222222"),
        ({"light": "#111111", "light_wide": "#222222"}, None, "light", "tall", "#111111"),
        ({"light": "#111111"}, None, "light", "wide", "#111111"),
        ({"light_wide": "#222222"}, None, "light", "tall", "#222222"),
        ({"light_wide": "#222222"}, None, "dark", "wide", None),
        ({"light_wide": "#222222"}, {"light": "#333333"}, "light", "wide", "#333333"),
        ({"light": "#111111"}, {"light": None}, "light", "wide", None),
        ("#444444", None, "dark", "wide", "#444444"),
    ],
)
def test_each_shape_of_screen_has_its_background(phone, shared, own, mode, shape, expected):
    assert phone.evaluate(
        """({ shared, own, mode, shape }) => {
            const { model } = window.dashboard;
            const config = model.normalizeConfig({ backgrounds: { home: shared } });
            const mine = model.personalize(config, "a", own ? { backgrounds: { home: own } } : {});
            return model.pickBackground(mine, "home", null, mode, shape);
        }""",
        {"shared": shared, "own": own, "mode": mode, "shape": shape},
    ) == expected


def test_the_part_of_the_picture_to_keep(phone):
    assert phone.evaluate(
        """() => {
            const { model } = window.dashboard;
            const pick = (shared, own) => {
                const config = model.normalizeConfig({ backgrounds: { home: shared } });
                return model.pickBackgroundPosition(model.personalize(config, "a", { backgrounds: { home: own } }), "home", null);
            };
            return [pick({ light: "x", position: "top" }, undefined), pick({ position: "top" }, { position: "bottom" }),
                    pick("#123456", undefined), pick({ position: "sideways" }, undefined)];
        }"""
    ) == ["top", "bottom", "center", "center"]
    assert phone.evaluate(
        """async () => (await import("/custom_components/home_dashboard/www/app/styles.js")).backgroundStyle("/a.png", "x; color: red")"""
    ) == 'background-image: url("/a.png"); background-position: center center'


def test_a_wide_background_and_its_part_are_saved_for_everyone(phone):
    mount_admin(phone, {"backgrounds": {"home": {"light": "#101010"}}})
    open_background(phone)
    assert phone.locator(f"{SHEET} [data-group='bg-shape'] [data-choice='tall'].on").count() == 1
    phone.locator(f"{SHEET} [data-group='bg-shape'] [data-choice='wide']").click()
    assert phone.locator(f"{SHEET} [data-look='light'] .look-preview.borrowed").count() == 1
    phone.locator("[data-swatch]").first.click()
    phone.locator(f"{SHEET} [data-group='bg-position'] [data-choice='top']").click()
    save_background(phone)
    phone.wait_for_function("window.saved.some((message) => message.type === 'lovelace/config/save')")
    shared = shared_saves(phone)[0]["config"]["strategy"]["backgrounds"]["home"]
    assert shared["light"] == "#101010"
    assert "gradient" in shared["light_wide"]
    assert "dark_wide" not in shared
    assert shared["position"] == "top"


def test_turning_the_screen_changes_the_background(phone):
    mount_admin(phone, {"backgrounds": {"home": {"light": "#101010", "light_wide": "#202020", "position": "top"}}})
    phone.wait_for_selector("home-dashboard-page .backdrop")
    style = "() => document.querySelector('home-dashboard-page').shadowRoot.querySelector('.backdrop').getAttribute('style')"
    assert "#101010" in phone.evaluate(style)
    phone.set_viewport_size({"width": 900, "height": 600})
    phone.wait_for_function(f"({style})().includes('#202020')")


def test_only_an_administrator_edits_the_screen(phone):
    mount_admin(phone, {}, admin=False)
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.wait_for_selector(f"{SHEET} .panel")
    assert phone.locator("[data-sheet-edit]").count() == 0


def picture(page) -> None:
    page.locator("[data-picture]").set_input_files(
        {"name": "a.png", "mimeType": "image/png", "buffer": b"png"}
    )


def test_a_picture_is_uploaded_and_used(phone):
    mount_admin(phone, {})
    open_background(phone)
    picture(phone)
    phone.wait_for_function(
        """() => document.querySelector("home-dashboard-chrome").shadowRoot.querySelector("home-dashboard-sheet")
            ._bg.light === "/api/image/serve/abc/original" """
    )
    assert phone.evaluate("window.uploads") == ["/api/image/upload"]


def test_a_failed_upload_saves_nothing_and_says_so(phone):
    mount_admin(phone, {})
    phone.evaluate("window.uploadFails = true")
    open_background(phone)
    picture(phone)
    phone.wait_for_selector("[data-upload-problem]")
    assert phone.evaluate("window.saved") == []


def test_a_room_background_is_kept_under_the_room(phone):
    layout = [{"id": "r", "name": "R", "areas": [], "home": [], "sections": [], "background": "#112233"}]
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(phone, {"layout": layout}, "room")
    open_background(phone)
    phone.locator("[data-swatch]").first.click()
    save_background(phone)
    phone.wait_for_function("window.saved.some((message) => message.type === 'lovelace/config/save')")
    strategy = shared_saves(phone)[0]["config"]["strategy"]
    assert "gradient" in strategy["backgrounds"]["r"]["light"]
    assert "background" not in strategy["layout"][0]


# Opening at start --------------------------------------------------------------------------------


def target(page, pathname: str, search: str = "", start: str | None = "/home-dashboard/home", started: bool = False):
    return page.evaluate(
        """async ({ pathname, search, start, started }) => {
            const { startTarget } = await import("/custom_components/home_dashboard/www/loader.js");
            const store = (values) => ({
                getItem: (key) => values[key] ?? null,
                setItem: (key, value) => { values[key] = value; },
            });
            const session = started ? { home_dashboard_started: "1" } : {};
            const local = start ? { home_dashboard_start: start } : {};
            return { target: startTarget({ pathname, search }, store(local), store(session)), session };
        }""",
        {"pathname": pathname, "search": search, "start": start, "started": started},
    )


@pytest.mark.parametrize("pathname", ["/", "/lovelace", "/lovelace/0", "/home"])
def test_a_default_page_opens_the_chosen_dashboard(phone, pathname):
    assert target(phone, pathname)["target"] == "/home-dashboard/home"


def test_the_sign_in_of_the_app_is_kept(phone):
    assert target(phone, "/", "?external_auth=1")["target"] == "/home-dashboard/home?external_auth=1"


def test_a_link_to_another_page_stays(phone):
    assert target(phone, "/config/devices")["target"] is None


def test_it_happens_once_per_start(phone):
    assert target(phone, "/", started=True)["target"] is None
    assert target(phone, "/config")["session"] == {"home_dashboard_started": "1"}


def test_a_device_without_the_choice_is_left_alone(phone):
    result = target(phone, "/", start=None)
    assert result["target"] is None
    assert result["session"] == {}


def test_the_switch_is_stored_on_this_device_only(phone):
    mount_admin(phone, {})
    phone.evaluate(f"{CHROME}.open({{ type: 'settings' }})")
    phone.locator("[data-start-here]").check()
    assert phone.evaluate("localStorage.getItem('home_dashboard_start')").endswith("/home")
    assert phone.evaluate("window.saved") == []
    phone.locator("[data-start-here]").uncheck()
    assert phone.evaluate("localStorage.getItem('home_dashboard_start')") is None


# Scenes ------------------------------------------------------------------------------------------

SCENES = [
    {"entity": "scene.morning", "name": "Dzień dobry", "icon": "mdi:weather-sunny"},
    {"entity": "scene.night", "name": "Dobranoc"},
]


def add_scenes(page) -> None:
    add_entity(page, "scene.morning", "2026-11-05T07:00:00+00:00", {"friendly_name": "Morning"})
    add_entity(page, "scene.night", "unknown", {"friendly_name": "Night"})
    add_entity(page, "scene.movie", "unknown", {"friendly_name": "Movie"})
    add_entity(page, "script.coffee", "off", {"friendly_name": "Coffee"})


def scene_names(page) -> list[str]:
    return page.locator("[data-scenes] .tile strong").all_inner_texts()


def test_scenes_sit_right_under_the_cameras(phone):
    add_scenes(phone)
    mount(phone, {"scenes": SCENES})
    assert scene_names(phone) == ["Dzień dobry", "Dobranoc"]
    assert phone.evaluate("""() => {
        const root = window.card.shadowRoot;
        const cameras = root.querySelector(".cameras").closest("section");
        return cameras.nextElementSibling === root.querySelector("[data-scenes]");
    }""")


def test_a_scene_runs_on_a_tap_and_keeps_its_icon(phone):
    add_scenes(phone)
    mount(phone, {"scenes": SCENES})
    assert phone.evaluate("""() => window.card.shadowRoot.querySelector("[data-scenes] .tile ha-icon").icon""") == "mdi:weather-sunny"
    phone.locator("[data-scenes] .tile").first.click()
    (sent,) = calls(phone)
    assert (sent["domain"], sent["service"], sent["data"]) == ("scene", "turn_on", {"entity_id": "scene.morning"})


def test_a_script_runs_too(phone):
    add_scenes(phone)
    mount(phone, {"scenes": [{"entity": "script.coffee"}]})
    phone.locator("[data-scenes] .tile").first.click()
    (sent,) = calls(phone)
    assert (sent["domain"], sent["service"]) == ("script", "turn_on")


def test_no_scenes_no_section_for_others(phone):
    mount_admin(phone, {}, admin=False)
    assert phone.locator("[data-scenes]").count() == 0


def test_an_administrator_can_start_an_empty_list(phone):
    mount_admin(phone, {})
    assert phone.locator("[data-scenes] .room-link").count() == 1


def test_the_heading_leads_to_the_page_of_the_scenes_and_home_has_no_pencil(phone):
    add_scenes(phone)
    mount_admin(phone, {"scenes": SCENES})
    assert phone.locator("[data-scenes] ha-icon[icon='mdi:chevron-right']").count() == 1
    assert phone.locator("[data-scenes] [data-edit-room]").count() == 0
    phone.locator("[data-scenes] .room-link").click()
    phone.wait_for_function("window.location.search.includes('room=__scenes')")


def test_the_page_of_the_scenes_lists_them_for_everyone(phone):
    add_scenes(phone)
    phone.evaluate("window.history.replaceState(null, '', '?room=__scenes')")
    mount_admin(phone, {"scenes": SCENES}, "room", admin=False)
    assert phone.locator("home-dashboard-page h1").inner_text() == "Sceny"
    assert phone.locator("home-dashboard-page .tile strong").all_inner_texts() == ["Dzień dobry", "Dobranoc"]
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.wait_for_selector(f"{SHEET} .panel")
    assert phone.locator("[data-sheet-edit]").count() == 0


def test_a_filter_hides_the_scenes(phone):
    add_scenes(phone)
    phone.evaluate("window.history.replaceState(null, '', '?filter=lights')")
    mount(phone, {"scenes": SCENES})
    assert phone.locator("[data-scenes]").count() == 0


def open_scene_editor(page) -> None:
    add_scenes(page)
    page.evaluate("window.history.replaceState(null, '', '?room=__scenes')")
    mount_admin(page, {"scenes": SCENES, "favorites": ["light.a"]}, "room")
    edit_screen(page)
    page.wait_for_selector("[data-edit-save]")


def test_the_picker_offers_only_scenes_and_scripts(phone):
    open_scene_editor(phone)
    phone.locator("[data-add-tile]").click()
    offered = phone.locator("[data-pick]").evaluate_all("(rows) => rows.map((row) => row.dataset.pick)")
    assert "scene.movie" in offered
    assert "script.coffee" in offered
    assert "scene.morning" not in offered
    assert {entity.split(".")[0] for entity in offered} == {"scene", "script"}


def test_a_search_stays_within_scenes_and_scripts(phone):
    open_scene_editor(phone)
    add_entity(phone, "light.movie", "off", {"friendly_name": "Movie lamp"})
    phone.locator("[data-add-tile]").click()
    phone.locator("[data-pick-search]").fill("movie")
    assert phone.locator("[data-pick]").evaluate_all("(rows) => rows.map((row) => row.dataset.pick)") == ["scene.movie"]


def test_scenes_are_added_moved_and_saved_apart_from_the_rooms(phone):
    open_scene_editor(phone)
    phone.locator("[data-add-tile]").click()
    phone.locator("[data-pick='script.coffee']").click()
    grip = phone.locator("[data-edit-tile='Dobranoc'] [data-grip]").bounding_box()
    first = phone.locator("[data-edit-tile='Dzień dobry']").bounding_box()
    phone.mouse.move(grip["x"] + 10, grip["y"] + 10)
    phone.mouse.down()
    phone.mouse.move(first["x"] + 20, first["y"] + 20, steps=4)
    phone.mouse.up()
    phone.locator("[data-edit-save]").click()
    phone.wait_for_function("window.saved.length === 1")
    strategy = phone.evaluate("window.saved[0].config.strategy")
    assert [tile["entity"] for tile in strategy["scenes"]] == ["scene.night", "scene.morning", "script.coffee"]
    assert strategy["favorites"] == ["light.a"]
    assert "layout" not in strategy


def test_cancelling_the_scenes_goes_back_to_home(phone):
    open_scene_editor(phone)
    phone.locator("[data-edit-tile='Dobranoc']").click()
    phone.locator("[data-tile-remove]").click()
    phone.locator("[data-edit-cancel]").click()
    assert phone.locator("home-dashboard-page .tile strong").all_inner_texts() == ["Dzień dobry", "Dobranoc"]
    assert phone.evaluate("window.saved") == []


def test_the_room_tabs_are_not_offered_for_scenes(phone):
    open_scene_editor(phone)
    assert phone.locator(".edit-tabs").is_hidden()


# Music page --------------------------------------------------------------------------------------

MUSIC_PAGE = {"card": {"type": "custom:ingress"}, "frame": "about:blank", "admin_card": True}


def nav_pages(page) -> list[str]:
    return page.evaluate(f"""() => [...{CHROME}.shadowRoot.querySelectorAll("nav [data-page]")]
        .map((item) => item.dataset.page)""")


def test_music_takes_the_place_of_media_on_the_bar(phone):
    mount(phone, {"music": MUSIC_PAGE})
    assert nav_pages(phone) == ["home", "music", "energy", "map"]


def test_without_a_music_page_the_bar_stays(phone):
    mount(phone)
    assert nav_pages(phone) == ["home", "media", "energy", "map"]


def test_the_music_page_shows_the_card_to_an_administrator(phone):
    mount_admin(phone, {"music": MUSIC_PAGE}, "music")
    phone.wait_for_selector("[data-card='custom:ingress']", state="attached")
    assert phone.locator("home-dashboard-page iframe").count() == 0


def test_others_get_the_plain_page_on_the_music_page(phone):
    mount_admin(phone, {"music": MUSIC_PAGE}, "music", admin=False)
    assert phone.locator("home-dashboard-page iframe").count() == 1
    assert phone.evaluate("window.createdCards") == []


def test_a_tablet_stays_on_the_music_page(tablet):
    mount_admin(tablet, {"music": MUSIC_PAGE, "idle": {"return_after": 0.05}}, "music")
    path = tablet.evaluate("window.location.pathname")
    tablet.wait_for_timeout(200)
    assert tablet.evaluate("window.location.pathname") == path


MEDIA_SHORTCUT = {"shortcuts": [{"kind": "page", "name": "Media", "icon": "mdi:play", "page": "media"}]}
EMBEDDED = f"{SHEET} home-dashboard-page"


def open_media(page) -> None:
    mount(page, MEDIA_SHORTCUT)
    page.locator("[data-shortcut='Media']").click()
    page.wait_for_selector(f"{EMBEDDED} .sources")


def test_a_shortcut_opens_a_page_in_a_sheet_without_leaving_home(phone):
    path = phone.evaluate("window.location.pathname")
    open_media(phone)
    assert phone.evaluate("window.location.pathname") == path
    assert phone.locator(f"{SHEET} section.panel").get_attribute("data-kind") == "page"
    assert phone.locator(f"{SHEET} [data-grip]").is_visible()


def test_a_page_in_a_sheet_has_no_top_bar_and_keeps_the_navigation_on_home(phone):
    open_media(phone)
    assert phone.locator(f"{EMBEDDED} .top-bar").count() == 0
    assert phone.locator(f"{EMBEDDED} h1").count() == 0
    assert phone.evaluate("document.querySelector('home-dashboard-chrome').page") == "home"


def test_the_handle_takes_a_page_in_a_sheet_down(phone):
    open_media(phone)
    grip = phone.locator(f"{SHEET} [data-grip]").bounding_box()
    phone.mouse.move(grip["x"] + 100, grip["y"] + 8)
    phone.mouse.down()
    phone.mouse.move(grip["x"] + 100, grip["y"] + 400, steps=8)
    phone.mouse.up()
    phone.wait_for_selector(f"{SHEET} section.panel", state="detached")


def test_a_speaker_opened_from_a_page_in_a_sheet_goes_back_to_it(phone):
    open_media(phone)
    phone.locator(f"{EMBEDDED} [data-entity^='media_player.'] .text").first.click()
    phone.wait_for_selector(f"{SHEET} section.panel[data-kind='player']")
    phone.locator(f"{SHEET} header button").first.click()
    phone.wait_for_selector(f"{SHEET} section.panel[data-kind='page']")
    phone.locator(f"{SHEET} header button").first.click()
    phone.wait_for_selector(f"{SHEET} section.panel", state="detached")
    assert phone.evaluate("history.state?.homeDashboardOverlay") in (None, False)


# Block with an open card -------------------------------------------------------------------------


def test_a_block_can_keep_its_card_open_under_the_actions(phone):
    add_entity(phone, "vacuum.robot", "docked")
    item = {
        "kind": "panel",
        "name": "Odkurzacz",
        "card": {"type": "custom:map"},
        "card_open": True,
        "actions": [{"name": "Start", "entity": "vacuum.robot", "service": "vacuum.start"}],
    }
    mount(phone, {"shortcuts": [item]})
    phone.locator("[data-shortcut='Odkurzacz']").click()
    phone.wait_for_selector("[data-card='custom:map']", state="attached")
    assert phone.locator("[data-panel-card]").count() == 0
    action = phone.locator("[data-action='vacuum.robot']").bounding_box()
    card = phone.locator(f"{SHEET} [data-live]").bounding_box()
    assert action["y"] < card["y"]


def test_an_open_card_is_not_stretched_on_a_tablet(tablet):
    item = {"kind": "panel", "name": "Odkurzacz", "fullscreen": True, "card": {"type": "custom:map"}, "card_open": True}
    mount(tablet, {"shortcuts": [item]})
    tablet.locator("[data-shortcut='Odkurzacz']").dispatch_event("click")
    tablet.wait_for_selector("[data-card='custom:map']", state="attached")
    assert tablet.locator(f"{SHEET} [data-live]").evaluate("(card) => getComputedStyle(card).maxWidth") == "760px"


# Host --------------------------------------------------------------------------------------------

HOST_COLUMNS = {
    "kind": "host",
    "name": "Host",
    "icon": "mdi:server",
    "columns": [
        {
            "title": "Serwer",
            "subtitle": "NUC",
            "status": "binary_sensor.server",
            "bars": [
                {"name": "Procesor", "entity": "sensor.cpu"},
                {"name": "Dysk", "entity": "sensor.disk"},
                {"name": "Moc", "entity": "sensor.power", "max": 65, "digits": 1},
            ],
            "info": [
                {"name": "Baza", "entity": "sensor.db", "digits": 1},
                {"name": "Core", "entity": "update.core", "type": "update"},
                {"name": "Nic", "entity": "sensor.nothing"},
            ],
            "machines": [
                {"name": "HA", "status": "binary_sensor.ha", "cpu": "sensor.ha_cpu", "ram": "sensor.ha_ram"},
                {"name": "Emby", "status": "binary_sensor.emby"},
            ],
            "graph": {"type": "custom:mini-graph-card"},
        }
    ],
}


def open_host(page) -> None:
    add_entity(page, "binary_sensor.server", "on")
    add_entity(page, "sensor.cpu", "3", {"unit_of_measurement": "%"})
    add_entity(page, "sensor.disk", "91", {"unit_of_measurement": "%"})
    add_entity(page, "sensor.power", "48.75", {"unit_of_measurement": "W"})
    add_entity(page, "sensor.db", "5025.8", {"unit_of_measurement": "MB"})
    add_entity(page, "update.core", "on", {"installed_version": "1.0", "latest_version": "2.0"})
    add_entity(page, "binary_sensor.ha", "on")
    add_entity(page, "binary_sensor.emby", "off")
    add_entity(page, "sensor.ha_cpu", "3")
    add_entity(page, "sensor.ha_ram", "82")
    mount(page, {"shortcuts": [HOST_COLUMNS]})
    page.locator("[data-shortcut='Host']").click()
    page.wait_for_selector("home-dashboard-host [data-column='Serwer']")


def test_bars_are_coloured_by_how_full_they_are(phone):
    open_host(phone)
    fill = "home-dashboard-host [data-bar='{}'] .fill"
    assert "alert" in phone.locator(fill.format("sensor.disk")).get_attribute("class")
    assert phone.locator(fill.format("sensor.cpu")).get_attribute("class").split() == ["fill"]
    assert "warn" in phone.locator(fill.format("sensor.power")).get_attribute("class")


def test_a_bar_shows_its_value_and_unit(phone):
    open_host(phone)
    assert "48,8" in phone.locator("home-dashboard-host [data-bar='sensor.power']").inner_text()


def test_facts_are_formatted_by_their_type(phone):
    open_host(phone)
    fact = "home-dashboard-host [data-fact='{}']"
    assert "5025,8 MB" in phone.locator(fact.format("sensor.db")).inner_text()
    assert "1.0 → 2.0" in phone.locator(fact.format("update.core")).inner_text()
    assert "\u2013" in phone.locator(fact.format("sensor.nothing")).inner_text()


def test_a_stopped_machine_is_dimmed_and_shows_no_load(phone):
    open_host(phone)
    assert "stopped" in phone.locator("home-dashboard-host [data-machine='Emby']").get_attribute("class")
    assert "82%" in phone.locator("home-dashboard-host [data-machine='HA']").inner_text()


def test_the_graph_comes_from_its_card_and_nothing_is_sent(phone):
    open_host(phone)
    phone.wait_for_selector("[data-card='custom:mini-graph-card']", state="attached")
    assert calls(phone) == []


def test_columns_stand_next_to_each_other_on_a_tablet(tablet):
    add_entity(tablet, "sensor.cpu", "3")
    columns = [{**HOST_COLUMNS["columns"][0], "title": name, "graph": None} for name in ("A", "B", "C")]
    mount(tablet, {"shortcuts": [{**HOST_COLUMNS, "columns": columns}]})
    tablet.locator("[data-shortcut='Host']").dispatch_event("click")
    tops = tablet.locator("home-dashboard-host .column").evaluate_all(
        "(items) => items.map((item) => Math.round(item.getBoundingClientRect().top))"
    )
    assert len(set(tops)) == 1


@pytest.mark.parametrize(
    ("seconds", "expected"),
    [(90000, "1 d 1 h"), (3700, "1 h 1 min"), (120, "2 min"), (-1, "\u2013")],
)
def test_durations_read_like_the_overview(phone, seconds, expected):
    assert phone.evaluate(
        """async (seconds) => {
            const { formatDuration } = await import("/custom_components/home_dashboard/www/app/host.js");
            return formatDuration(seconds);
        }""",
        seconds,
    ) == expected
