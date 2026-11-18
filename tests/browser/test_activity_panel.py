"""Household activity: the dashboard tells each page and window opened, and the owner's panel shows per person
what they opened and switched, for a day and hours."""

from __future__ import annotations

from pathlib import Path
import re

import pytest

from .test_shortcuts import mount_admin

CHROME = "document.querySelector('home-dashboard-chrome')"
PANEL = "home-dashboard-activity"
MODULE = "/custom_components/home_dashboard/www/activity/activity.js"
DATA = {
    "retention_days": 30,
    "people": [
        {
            "id": "jan",
            "name": "Jan",
            "is_admin": True,
            "devices": [
                {"name": "https://home-assistant.io/iOS", "last_used_at": "2026-11-17T10:15:32+00:00"},
                {"name": "http://192.168.1.10:8123/", "last_used_at": "2026-11-16T10:15:32+00:00"},
            ],
        },
        {"id": "bartek", "name": "Bartek", "is_admin": False, "devices": []},
        {"id": "ola", "name": "Ola", "is_admin": False, "devices": []},
    ],
    "entries": [
        {
            "at": "2026-11-17T06:50:00+00:00",
            "user_id": "ola",
            "kind": "change",
            "entity_id": "cover.pokoj_dziewczyn",
            "state": "closing",
        },
        {
            "at": "2026-11-17T06:55:00+00:00",
            "user_id": "jan",
            "kind": "change",
            "entity_id": "button.slup_obrot",
            "state": "2026-11-17T06:55:00.123+00:00",
        },
        {
            "at": "2026-11-17T07:00:00+00:00",
            "user_id": "bartek",
            "kind": "page",
            "name": "home",
            "device": "iPhone (app)",
        },
        {
            "at": "2026-11-17T07:01:00+00:00",
            "user_id": "bartek",
            "kind": "window",
            "name": "light: Biurko",
            "entity_id": "light.biurko",
            "device": "iPhone (app)",
        },
        {
            "at": "2026-11-17T07:02:00+00:00",
            "user_id": "bartek",
            "kind": "change",
            "entity_id": "light.biurko",
            "state": "on",
        },
        {
            "at": "2026-11-17T07:05:00+00:00",
            "user_id": "bartek",
            "kind": "window",
            "name": "light: Biurko",
            "entity_id": "light.biurko",
            "device": "iPhone (app)",
        },
        {
            "at": "2026-11-17T08:00:00+00:00",
            "user_id": "jan",
            "kind": "page",
            "name": "energy",
            "device": "Mac (browser)",
        },
    ],
}


def told(page) -> list[dict]:
    return page.evaluate("window.seen")


def test_the_dashboard_tells_each_page_and_window_once(phone):
    mount_admin(phone, {})
    phone.wait_for_function("window.seen.length > 0")
    (first,) = told(phone)
    assert first["kind"] == "page" and first["name"]
    assert first["device"].endswith("(browser)")
    phone.evaluate(f"() => {CHROME}.open({{ type: 'drawer' }})")
    phone.wait_for_function("window.seen.length === 2")
    assert told(phone)[1] == {**told(phone)[1], "kind": "window", "name": "menu"}
    # the same page again at once is not told twice
    phone.evaluate(f"() => {{ {CHROME}.requestUpdate(); }}")
    phone.wait_for_timeout(200)
    assert len(told(phone)) == 2


def test_a_window_of_a_device_says_what_it_shows(phone):
    mount_admin(phone, {})
    entity = phone.evaluate(
        "Object.keys(window.dashboard.snapshot.states).find((id) => id.startsWith('light.'))"
    )
    phone.evaluate(
        f"(id) => {CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'light', entityId: id }} }})", entity
    )
    phone.wait_for_function("window.seen.some((m) => m.kind === 'window')")
    (window,) = [message for message in told(phone) if message["kind"] == "window"]
    assert window["name"].startswith("light: ") and window["entity_id"] == entity


def open_panel(page, answer=None, error=None, stored=None) -> None:
    page.evaluate(
        """async ({ module, answer, error, stored }) => {
            localStorage.clear();
            for (const [key, value] of Object.entries(stored ?? {})) localStorage.setItem(key, JSON.stringify(value));
            await import(module);
            window.asked = [];
            const panel = document.createElement('home-dashboard-activity');
            panel.hass = { language: 'pl', locale: { language: 'pl' }, states: {
                'light.biurko': { entity_id: 'light.biurko', state: 'on', attributes: { friendly_name: 'Biurko Bartka' } },
                'cover.pokoj_dziewczyn': { entity_id: 'cover.pokoj_dziewczyn', state: 'open',
                    attributes: { friendly_name: 'Pokój Dziewczyn Roleta Pokój Dziewczyn Roleta' } },
                'button.slup_obrot': { entity_id: 'button.slup_obrot', state: 'x', attributes: { friendly_name: 'Słup obrót' } } },
              entities: {
                'light.biurko': { entity_id: 'light.biurko', area_id: 'bartek' },
                'cover.pokoj_dziewczyn': { entity_id: 'cover.pokoj_dziewczyn', device_id: 'roleta' },
                'button.slup_obrot': { entity_id: 'button.slup_obrot' } },
              devices: { roleta: { id: 'roleta', area_id: 'dziewczyny' } },
              areas: { bartek: { area_id: 'bartek', name: 'Pokój Bartka' }, dziewczyny: { area_id: 'dziewczyny', name: 'Pokój dziewczyn' } },
              formatEntityState: (stateObj, state) => ({ on: 'włączony', closing: 'zamykanie' })[state] ?? state,
              connection: { subscribeMessage: async (callback, message) => {
                window.live = { callback, message, stopped: false };
                return () => { window.live.stopped = true; }; } },
              callWS: async (message) => { window.asked.push(message);
                if (error) throw { code: error, message: error };
                return structuredClone(answer); } };
            document.body.replaceChildren(panel);
        }""",
        {"module": MODULE, "answer": answer, "error": error, "stored": stored},
    )
    page.wait_for_function(f"document.querySelector('{PANEL}')?.shadowRoot?.querySelector('main')")


def shown(page) -> list[str]:
    return page.locator(f"{PANEL} [data-entry]").evaluate_all(
        "(all) => all.map((e) => e.dataset.who + ':' + e.dataset.entry)"
    )


def test_one_timeline_of_everybody_newest_first_by_day(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    assert shown(tablet) == [
        "jan:page",
        "bartek:window",
        "bartek:change",
        "bartek:window",
        "bartek:page",
        "jan:change",
        "ola:change",
    ]
    assert tablet.locator(f"{PANEL} .day").count() == 1
    assert "listopada 2026" in tablet.locator(f"{PANEL} .day").inner_text()


def test_the_people_are_a_list_with_colours_and_counts(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    people = tablet.locator(f"{PANEL} [data-person]")
    assert people.evaluate_all("(all) => all.map((p) => p.dataset.person)") == ["bartek", "jan", "ola"]
    assert tablet.locator(f"{PANEL} [data-person='bartek'] [data-count]").inner_text() == "4"
    # the device most recently used, in words
    assert "aplikacja iOS" in tablet.locator(f"{PANEL} [data-person='jan']").inner_text()


def test_people_are_chosen_and_the_choice_is_kept(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-person='bartek'] input").uncheck()
    assert all(not who.startswith("bartek:") for who in shown(tablet))
    assert tablet.evaluate("JSON.parse(localStorage.getItem('home-dashboard-activity-people'))") == [
        "jan",
        "ola",
    ]
    tablet.locator(f"{PANEL} [data-nobody]").click()
    tablet.wait_for_selector(f"{PANEL} [data-choose]")
    tablet.locator(f"{PANEL} [data-everybody]").click()
    assert len(shown(tablet)) == 7


def test_a_choice_made_before_is_used_again(tablet):
    open_panel(tablet, DATA, stored={"home-dashboard-activity-people": ["ola"]})
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    assert shown(tablet) == ["ola:change"]


def test_kinds_are_filtered(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-kind='change'] input").uncheck()
    assert all(not who.endswith(":change") for who in shown(tablet)) and len(shown(tablet)) == 4


def test_changes_read_as_in_home_assistant(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    texts = tablet.locator(f"{PANEL} [data-entry='change'] b").all_inner_texts()
    assert "Biurko Bartka → włączony" in texts
    assert "Pokój Dziewczyn Roleta → zamykanie" in texts
    assert "Słup obrót → naciśnięto" in texts
    window = tablet.locator(f"{PANEL} [data-entry='window'] b").first.inner_text()
    assert window == "Biurko"
    assert "Strona główna" in tablet.locator(f"{PANEL} [data-who='bartek'][data-entry='page'] b").inner_text()


def test_a_preset_range_and_the_arrows_ask_for_their_moments(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-range]").click()
    tablet.locator(f"{PANEL} [data-preset='yesterday']").click()
    tablet.wait_for_function("window.asked.length === 2")
    asked = tablet.evaluate("window.asked.at(-1)")
    hours = tablet.evaluate(
        "(m) => [(new Date(m.end) - new Date(m.start)) / 3600000, new Date(m.start).getHours()]", asked
    )
    assert hours == [24, 0]
    tablet.locator(f"{PANEL} [data-earlier]").click()
    tablet.wait_for_function("window.asked.length === 3")
    moved = tablet.evaluate("(new Date(window.asked[1].start) - new Date(window.asked[2].start)) / 3600000")
    assert moved == 24


def test_a_range_of_its_own_is_chosen_in_the_window(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-range]").click()
    # one day: tapped twice, then the hours of both ends
    tablet.locator(f"{PANEL} [data-day='2026-11-16']").click()
    tablet.locator(f"{PANEL} [data-day='2026-11-16']").click()
    tablet.locator(f"{PANEL} [data-from-time]").fill("16:00")
    tablet.locator(f"{PANEL} [data-to-time]").fill("19:00")
    tablet.locator(f"{PANEL} [data-pick]").click()
    tablet.wait_for_function("window.asked.length === 2")
    asked = tablet.evaluate("window.asked.at(-1)")
    hours = tablet.evaluate(
        "(m) => [new Date(m.start).getDate(), new Date(m.start).getHours(), new Date(m.end).getHours()]",
        asked,
    )
    assert hours == [16, 16, 19]
    assert tablet.locator(f"{PANEL} [data-picker]").count() == 0


def test_the_layout_uses_the_whole_width(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    box = tablet.locator(f"{PANEL} .timeline li").first.bounding_box()
    width = tablet.evaluate("innerWidth")
    assert box["x"] + box["width"] > width - 30


def test_on_a_phone_the_filters_open_with_a_button(phone):
    open_panel(phone, DATA)
    phone.wait_for_selector(f"{PANEL} [data-entry]")
    assert not phone.locator(f"{PANEL} [data-person='bartek']").is_visible()
    phone.locator(f"{PANEL} [data-filters]").click()
    assert phone.locator(f"{PANEL} [data-person='bartek']").is_visible()


def test_somebody_else_is_told_it_is_only_for_the_owner(tablet):
    open_panel(tablet, error="not_allowed")
    tablet.wait_for_selector(f"{PANEL} [data-problem]")
    assert "tylko właściciel" in tablet.locator(f"{PANEL} [data-problem]").inner_text()
    assert tablet.locator(f"{PANEL} [data-entry]").count() == 0


def test_a_time_nobody_used_says_so(tablet):
    open_panel(tablet, {**DATA, "entries": []})
    tablet.wait_for_selector(f"{PANEL} [data-nothing]")


def test_the_help_leads_to_the_chapter_of_the_guide(tablet):
    open_panel(tablet, DATA)
    href = tablet.locator(f"{PANEL} [data-docs]").get_attribute("href")
    assert href.endswith("/pl/guide/#household-activity")


def test_with_writing_down_off_the_dashboard_tells_nothing(phone):
    phone.evaluate("() => { window.dashboard.snapshot.activityRecord = false; }")
    mount_admin(phone, {})
    phone.evaluate(f"() => {CHROME}.open({{ type: 'drawer' }})")
    phone.wait_for_timeout(500)
    assert told(phone) == []


def choices(page, name: str) -> list[str]:
    return page.locator(f"{PANEL} [data-section='{name}'] [data-choice]").evaluate_all(
        "(all) => all.map((c) => c.dataset.choice.split(':')[1] + '=' + c.querySelector('.count').textContent)"
    )


def test_devices_and_rooms_are_listed_with_their_counts(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    assert choices(tablet, "devices") == ["lights=3", "covers=1", "buttons=1"]
    assert choices(tablet, "rooms") == ["bartek=3", "dziewczyny=1", "-=1"]
    assert "Bez pokoju" in tablet.locator(f"{PANEL} [data-choice='_rooms:-']").inner_text()


def test_only_lights_leaves_the_pages_and_other_devices_out(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-none='_groups']").click()
    tablet.wait_for_selector(f"{PANEL} [data-nothing]")
    tablet.locator(f"{PANEL} [data-choice='_groups:lights'] input").check()
    assert shown(tablet) == ["bartek:window", "bartek:change", "bartek:window"]
    assert tablet.evaluate("JSON.parse(localStorage.getItem('home-dashboard-activity-groups'))") == ["lights"]
    tablet.locator(f"{PANEL} [data-all='_groups']").click()
    assert len(shown(tablet)) == 7


def test_a_room_shows_what_was_done_there(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-none='_rooms']").click()
    tablet.locator(f"{PANEL} [data-choice='_rooms:dziewczyny'] input").check()
    assert shown(tablet) == ["ola:change"]


def test_the_search_finds_a_device_or_a_person(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-search]").fill("roleta")
    assert shown(tablet) == ["ola:change"]
    tablet.locator(f"{PANEL} [data-search]").fill("jan")
    assert shown(tablet) == ["jan:page", "jan:change"]
    tablet.locator(f"{PANEL} [data-search]").fill("bartka")
    assert set(shown(tablet)) == {"bartek:window", "bartek:change"}


def test_a_section_folds_and_stays_folded(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-fold='rooms']").click()
    assert tablet.locator(f"{PANEL} [data-section='rooms'] [data-choice]").count() == 0
    assert tablet.evaluate("JSON.parse(localStorage.getItem('home-dashboard-activity-folded'))") == ["rooms"]


def test_a_range_reaching_now_is_live(tablet):
    today = {**DATA, "entries": []}
    open_panel(tablet, today)
    tablet.wait_for_selector(f"{PANEL} [data-live]")
    assert tablet.evaluate("window.live.message") == {"type": "home_dashboard/activity/subscribe"}
    tablet.evaluate("""() => window.live.callback({ at: new Date().toISOString(), user_id: 'ola', kind: 'change',
        entity_id: 'light.biurko', state: 'on' })""")
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    assert shown(tablet) == ["ola:change"]
    assert tablet.locator(f"{PANEL} [data-person='ola'] [data-count]").inner_text() == "1"


def test_a_range_in_the_past_is_not_live(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-live]")
    tablet.locator(f"{PANEL} [data-range]").click()
    tablet.locator(f"{PANEL} [data-preset='yesterday']").click()
    tablet.wait_for_function("window.asked.length === 2")
    tablet.wait_for_function("window.live.stopped === true")
    assert tablet.locator(f"{PANEL} [data-live]").count() == 0


def test_without_live_in_home_assistant_the_panel_does_not_say_live(tablet):
    open_panel(tablet, DATA)
    tablet.evaluate("""() => { const panel = document.querySelector('home-dashboard-activity');
        panel.hass = { ...panel.hass, connection: { subscribeMessage: async () => { throw { code: 'unknown_command' }; } } };
        panel._setRange(...[new Date(Date.now() - 3600000), new Date()]); }""")
    tablet.wait_for_function("window.asked.length === 2")
    tablet.wait_for_timeout(300)
    assert tablet.locator(f"{PANEL} [data-live]").count() == 0


def test_a_room_is_told_with_its_name(phone):
    phone.evaluate("() => history.replaceState(null, '', location.pathname + '?room=salon')")
    mount_admin(phone, {"layout": [{"id": "salon", "name": "Salon", "sections": []}]})
    phone.wait_for_function("window.seen.length > 0")
    assert told(phone)[0]["name"].endswith("/Salon")
    assert told(phone)[0]["page"].endswith("?room=salon")


def test_an_id_browser_mod_made_up_is_not_a_device_name(phone):
    labels = phone.evaluate("""async () => { const m = await import('/custom_components/home_dashboard/www/app/usage.js');
        localStorage.setItem('browser_mod-browser-id', 'browser_mod_86352a1b_9c0d');
        const made = m.deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0) Home Assistant/2026.11');
        localStorage.setItem('browser_mod-browser-id', 'hall_ipad');
        const named = m.deviceLabel('Mozilla/5.0 (iPhone)');
        localStorage.removeItem('browser_mod-browser-id');
        return [made, named]; }""")
    assert labels == ["iPhone (app)", "hall_ipad"]


def test_the_owner_finds_the_activity_in_the_menu_of_the_dashboard(phone):
    phone.evaluate("() => { window.dashboard.snapshot.activityViewer = true; }")
    mount_admin(phone, {})
    phone.evaluate(f"() => {CHROME}.open({{ type: 'drawer' }})")
    phone.locator("[data-drawer] [data-household]").click()
    phone.wait_for_selector("home-dashboard-sheet .panel[data-kind='household']")
    phone.wait_for_selector(f"home-dashboard-sheet {PANEL}[embedded]")
    assert phone.locator("home-dashboard-sheet header h2").inner_text() == "Aktywność domowników"
    # the view of the panel without its own bar: the window has its header
    assert not phone.locator(f"home-dashboard-sheet {PANEL} .bar").is_visible()


def test_nobody_else_sees_it_in_the_menu(phone):
    mount_admin(phone, {})
    phone.evaluate(f"() => {CHROME}.open({{ type: 'drawer' }})")
    phone.wait_for_selector("[data-drawer]")
    assert phone.locator("[data-drawer] [data-household]").count() == 0


def test_in_the_window_of_a_phone_the_open_filters_push_the_timeline_down(phone):
    phone.evaluate("() => { window.dashboard.snapshot.activityViewer = true; }")
    mount_admin(phone, {})
    phone.evaluate(
        "(data) => { const call = window.hass.callWS; window.hass.callWS = async (m) =>"
        " m.type === 'home_dashboard/activity/get' ? structuredClone(data) : call(m); }",
        DATA,
    )
    phone.evaluate(f"() => {CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'household' }} }})")
    view = f"home-dashboard-sheet {PANEL}"
    phone.wait_for_selector(f"{view} [data-entry]")
    phone.locator(f"{view} [data-filters]").click()
    boxes = phone.evaluate(
        """() => { const sheet = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet');
          const root = sheet.shadowRoot.querySelector('home-dashboard-activity').shadowRoot;
          const box = (selector) => root.querySelector(selector).getBoundingClientRect();
          const filters = box('.filters');
          const last = [...root.querySelectorAll('.filters section')].at(-1).getBoundingClientRect();
          return { filters: filters.bottom, last: last.bottom, top: box('.top').top, day: box('.day').top }; }"""
    )
    # the bar with the Filters button first, the filters under it, then the timeline
    assert boxes["last"] <= boxes["filters"] + 1
    assert boxes["top"] < boxes["filters"] <= boxes["day"] + 1


def open_picker_in_window(page) -> str:
    page.evaluate("() => { window.dashboard.snapshot.activityViewer = true; }")
    mount_admin(page, {})
    page.evaluate(
        "(data) => { const call = window.hass.callWS; window.hass.callWS = async (m) =>"
        " m.type === 'home_dashboard/activity/get' ? structuredClone(data) : call(m); }",
        DATA,
    )
    page.evaluate(f"() => {CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'household' }} }})")
    view = f"home-dashboard-sheet {PANEL}"
    page.wait_for_selector(f"{view} [data-entry]")
    # a look of windows of glass: see-through controls, white writing and a white accent
    page.locator(view).evaluate(
        "(el) => { el.style.setProperty('--hd-ov-surface', 'rgba(255, 255, 255, 0.12)');"
        " el.style.setProperty('--hd-ov-text', 'rgb(255, 255, 255)');"
        " el.style.setProperty('--hd-ov-accent', 'rgb(255, 255, 255)'); }"
    )
    page.locator(f"{view} [data-range]").click()
    return view


@pytest.mark.parametrize(
    ("scheme", "surface", "text"),
    [("light", "rgb(255, 255, 255)", "rgb(27, 27, 31)"), ("dark", "rgb(30, 31, 36)", "rgb(228, 228, 234)")],
)
def test_in_the_window_the_picker_of_the_range_is_white_or_dark_as_the_look(tablet, scheme, surface, text):
    # The picker lies over the timeline: whatever glass the window has, it is a plain window of the light or the
    # dark look, with its writing and a readable Choose button.
    tablet.emulate_media(color_scheme=scheme)
    view = open_picker_in_window(tablet)
    style = tablet.locator(f"{view} [data-picker]").evaluate(
        "(el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.color]; }"
    )
    assert style == [surface, text], style
    pick = tablet.locator(f"{view} [data-pick]").evaluate(
        "(el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.color]; }"
    )
    assert pick == [text, surface], pick


def test_on_a_phone_the_picker_of_the_range_fits_the_screen(phone):
    view = open_picker_in_window(phone)
    width, height = phone.viewport_size["width"], phone.viewport_size["height"]
    box = phone.locator(f"{view} [data-picker]").bounding_box()
    assert box["x"] >= 0 and box["x"] + box["width"] <= width, box
    assert box["y"] + box["height"] <= height, box
    # the ready ranges are chips in a few rows, the Choose button can be tapped
    presets = phone.locator(f"{view} [data-preset]")
    rows = {round(presets.nth(i).bounding_box()["y"]) for i in range(presets.count())}
    assert len(rows) <= 3, rows
    hit = phone.locator(f"{view} [data-pick]").evaluate(
        "(el) => { const r = el.getBoundingClientRect();"
        " return el.getRootNode().elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el; }"
    )
    assert hit


def test_the_month_picks_a_range_of_days_and_a_whole_last_day(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-range]").click()
    picker = f"{PANEL} [data-picker]"
    # the month of the range shown, days after today cannot be chosen
    month = tablet.locator(f"{picker} [data-month]").get_attribute("data-month")
    tablet.locator(f"{picker} [data-month-prev]").click()
    assert tablet.locator(f"{picker} [data-month]").get_attribute("data-month") < month
    tablet.locator(f"{picker} [data-month-next]").click()
    future = tablet.locator(f"{picker} .day-cell:not(.other):disabled").count()
    today = tablet.evaluate("new Date().getDate()")
    days_in_month = tablet.evaluate(
        "(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); })()"
    )
    if month == tablet.evaluate(
        "(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; })()"
    ):
        assert future == days_in_month - today
    # the end tapped before the start: the two swap
    days = tablet.locator(f"{picker} .day-cell:not(.other):not(:disabled)")
    days.nth(2).click()
    days.nth(0).click()
    assert tablet.locator(f"{picker} .day-cell.from").get_attribute("data-day") == days.nth(0).get_attribute(
        "data-day"
    )
    assert tablet.locator(f"{picker} .day-cell.to").get_attribute("data-day") == days.nth(2).get_attribute(
        "data-day"
    )
    assert tablet.locator(f"{picker} .day-cell.in").count() == 1
    tablet.locator(f"{picker} [data-pick]").click()
    asked = tablet.evaluate("window.asked.at(-1)")
    span = tablet.evaluate(
        "(m) => [new Date(m.start).getHours(), (new Date(m.end) - new Date(m.start)) / 3600000]", asked
    )
    # three whole days: from midnight to the midnight after the last one
    assert span == [0, 72]


def test_windows_read_by_their_names_not_by_their_kinds(tablet):
    # The dashboard tells a window by its kind ("menu", "camera: Iwiny Słup"); the panel names it for a person.
    windows = ["menu", "settings", "household", "camera: Iwiny Słup", "something-new"]
    entries = [
        {
            "at": f"2026-11-17T07:0{i}:00+00:00",
            "user_id": "jan",
            "kind": "window",
            "name": name,
            "device": "Mac",
        }
        for i, name in enumerate(windows)
    ]
    open_panel(tablet, {**DATA, "entries": entries})
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    lines = tablet.locator(f"{PANEL} [data-entry]").evaluate_all(
        "(all) => all.map((e) => [e.querySelector('b').textContent.trim(),"
        " e.querySelector('small').textContent.split('·')[1].trim(), e.querySelector('ha-icon').icon])"
    )
    assert lines == [
        ["something-new", "Okno", "mdi:card-text-outline"],
        ["Iwiny Słup", "Kamera", "mdi:cctv"],
        ["Aktywność domowników", "Okno", "mdi:account-clock-outline"],
        ["Ustawienia dashboardu", "Okno", "mdi:cog-outline"],
        ["Menu boczne", "Okno", "mdi:menu"],
    ]


def test_every_window_of_the_dashboard_has_a_name_in_the_panel():
    www = Path(__file__).parents[2] / "custom_components/home_dashboard/www"
    sheet = (www / "app/sheet.js").read_text()
    renderers = sheet[
        sheet.index("const renderers = {") : sheet.index("};", sheet.index("const renderers = {"))
    ]
    kinds = set(re.findall(r'^\s+"?([a-z-]+)"?: this\._render', renderers, re.M))
    activity = (www / "activity/activity.js").read_text()
    table = activity[
        activity.index("const WINDOWS = {") : activity.index("};", activity.index("const WINDOWS = {"))
    ]
    named = set(re.findall(r'^\s+"?([a-z-]+)"?: \["mdi:', table, re.M))
    assert len(kinds) > 40
    assert kinds | {"menu", "settings"} <= named, sorted(kinds - named)
