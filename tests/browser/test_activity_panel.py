"""Household activity: the dashboard tells each page and window opened, and the owner's panel shows per person
what they opened and switched, for a day and hours."""

from __future__ import annotations

from .test_shortcuts import mount_admin

CHROME = "document.querySelector('home-dashboard-chrome')"
PANEL = "home-dashboard-activity"
MODULE = "/custom_components/home_dashboard/www/activity/activity.js"
DATA = {
    "retention_days": 30,
    "people": [
        {
            "id": "witold",
            "name": "Witold",
            "is_admin": True,
            "devices": [
                {"name": "https://home-assistant.io/iOS", "last_used_at": "2026-11-17T10:15:32+00:00"},
                {"name": "http://192.168.1.10:8123/", "last_used_at": "2026-11-16T10:15:32+00:00"},
            ],
        },
        {"id": "adam", "name": "Adam", "is_admin": False, "devices": []},
        {"id": "zosia", "name": "Zosia", "is_admin": False, "devices": []},
    ],
    "entries": [
        {
            "at": "2026-11-17T06:50:00+00:00",
            "user_id": "zosia",
            "kind": "change",
            "entity_id": "cover.pokoj_dziewczyn",
            "state": "closing",
        },
        {
            "at": "2026-11-17T06:55:00+00:00",
            "user_id": "witold",
            "kind": "change",
            "entity_id": "button.slup_obrot",
            "state": "2026-11-17T06:55:00.123+00:00",
        },
        {
            "at": "2026-11-17T07:00:00+00:00",
            "user_id": "adam",
            "kind": "page",
            "name": "home",
            "device": "iPhone (app)",
        },
        {
            "at": "2026-11-17T07:01:00+00:00",
            "user_id": "adam",
            "kind": "window",
            "name": "light: Biurko",
            "entity_id": "light.biurko",
            "device": "iPhone (app)",
        },
        {
            "at": "2026-11-17T07:02:00+00:00",
            "user_id": "adam",
            "kind": "change",
            "entity_id": "light.biurko",
            "state": "on",
        },
        {
            "at": "2026-11-17T07:05:00+00:00",
            "user_id": "adam",
            "kind": "window",
            "name": "light: Biurko",
            "entity_id": "light.biurko",
            "device": "iPhone (app)",
        },
        {
            "at": "2026-11-17T08:00:00+00:00",
            "user_id": "witold",
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
                'light.biurko': { entity_id: 'light.biurko', state: 'on', attributes: { friendly_name: 'Biurko Adama' } },
                'cover.pokoj_dziewczyn': { entity_id: 'cover.pokoj_dziewczyn', state: 'open',
                    attributes: { friendly_name: 'Pokój Dziewczyn Roleta Pokój Dziewczyn Roleta' } },
                'button.slup_obrot': { entity_id: 'button.slup_obrot', state: 'x', attributes: { friendly_name: 'Słup obrót' } } },
              entities: {
                'light.biurko': { entity_id: 'light.biurko', area_id: 'adam' },
                'cover.pokoj_dziewczyn': { entity_id: 'cover.pokoj_dziewczyn', device_id: 'roleta' },
                'button.slup_obrot': { entity_id: 'button.slup_obrot' } },
              devices: { roleta: { id: 'roleta', area_id: 'dziewczyny' } },
              areas: { adam: { area_id: 'adam', name: 'Pokój Adama' }, dziewczyny: { area_id: 'dziewczyny', name: 'Pokój dziewczyn' } },
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
        "witold:page",
        "adam:window",
        "adam:change",
        "adam:window",
        "adam:page",
        "witold:change",
        "zosia:change",
    ]
    assert tablet.locator(f"{PANEL} .day").count() == 1
    assert "listopada 2026" in tablet.locator(f"{PANEL} .day").inner_text()


def test_the_people_are_a_list_with_colours_and_counts(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    people = tablet.locator(f"{PANEL} [data-person]")
    assert people.evaluate_all("(all) => all.map((p) => p.dataset.person)") == ["adam", "witold", "zosia"]
    assert tablet.locator(f"{PANEL} [data-person='adam'] [data-count]").inner_text() == "4"
    # the device most recently used, in words
    assert "aplikacja iOS" in tablet.locator(f"{PANEL} [data-person='witold']").inner_text()


def test_people_are_chosen_and_the_choice_is_kept(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-person='adam'] input").uncheck()
    assert all(not who.startswith("adam:") for who in shown(tablet))
    assert tablet.evaluate("JSON.parse(localStorage.getItem('home-dashboard-activity-people'))") == [
        "witold",
        "zosia",
    ]
    tablet.locator(f"{PANEL} [data-nobody]").click()
    tablet.wait_for_selector(f"{PANEL} [data-choose]")
    tablet.locator(f"{PANEL} [data-everybody]").click()
    assert len(shown(tablet)) == 7


def test_a_choice_made_before_is_used_again(tablet):
    open_panel(tablet, DATA, stored={"home-dashboard-activity-people": ["zosia"]})
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    assert shown(tablet) == ["zosia:change"]


def test_kinds_are_filtered(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-kind='change'] input").uncheck()
    assert all(not who.endswith(":change") for who in shown(tablet)) and len(shown(tablet)) == 4


def test_changes_read_as_in_home_assistant(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    texts = tablet.locator(f"{PANEL} [data-entry='change'] b").all_inner_texts()
    assert "Biurko Adama → włączony" in texts
    assert "Pokój Dziewczyn Roleta → zamykanie" in texts
    assert "Słup obrót → naciśnięto" in texts
    window = tablet.locator(f"{PANEL} [data-entry='window'] b").first.inner_text()
    assert window == "Biurko"
    assert "Strona główna" in tablet.locator(f"{PANEL} [data-who='adam'][data-entry='page'] b").inner_text()


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
    tablet.locator(f"{PANEL} [data-from]").fill("2026-11-16T16:00")
    tablet.locator(f"{PANEL} [data-to]").fill("2026-11-16T19:00")
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
    assert not phone.locator(f"{PANEL} [data-person='adam']").is_visible()
    phone.locator(f"{PANEL} [data-filters]").click()
    assert phone.locator(f"{PANEL} [data-person='adam']").is_visible()


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
    assert choices(tablet, "rooms") == ["adam=3", "dziewczyny=1", "-=1"]
    assert "Bez pokoju" in tablet.locator(f"{PANEL} [data-choice='_rooms:-']").inner_text()


def test_only_lights_leaves_the_pages_and_other_devices_out(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-none='_groups']").click()
    tablet.wait_for_selector(f"{PANEL} [data-nothing]")
    tablet.locator(f"{PANEL} [data-choice='_groups:lights'] input").check()
    assert shown(tablet) == ["adam:window", "adam:change", "adam:window"]
    assert tablet.evaluate("JSON.parse(localStorage.getItem('home-dashboard-activity-groups'))") == ["lights"]
    tablet.locator(f"{PANEL} [data-all='_groups']").click()
    assert len(shown(tablet)) == 7


def test_a_room_shows_what_was_done_there(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-none='_rooms']").click()
    tablet.locator(f"{PANEL} [data-choice='_rooms:dziewczyny'] input").check()
    assert shown(tablet) == ["zosia:change"]


def test_the_search_finds_a_device_or_a_person(tablet):
    open_panel(tablet, DATA)
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    tablet.locator(f"{PANEL} [data-search]").fill("roleta")
    assert shown(tablet) == ["zosia:change"]
    tablet.locator(f"{PANEL} [data-search]").fill("witold")
    assert shown(tablet) == ["witold:page", "witold:change"]
    tablet.locator(f"{PANEL} [data-search]").fill("adama")
    assert set(shown(tablet)) == {"adam:window", "adam:change"}


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
    tablet.evaluate("""() => window.live.callback({ at: new Date().toISOString(), user_id: 'zosia', kind: 'change',
        entity_id: 'light.biurko', state: 'on' })""")
    tablet.wait_for_selector(f"{PANEL} [data-entry]")
    assert shown(tablet) == ["zosia:change"]
    assert tablet.locator(f"{PANEL} [data-person='zosia'] [data-count]").inner_text() == "1"


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
