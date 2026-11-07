"""History and the logbook in windows of the dashboard."""

from __future__ import annotations

from .test_panels import add_entity
from .test_shortcuts import SHEET, mount_admin

LOGBOOK = "home-dashboard-logbook"
HISTORY = "home-dashboard-history"
WS = """(entries) => {
    const original = window.dashboard.hass;
    window.logbook = [];
    window.dashboard.hass = (overrides) => {
        const instance = original(overrides);
        const answer = instance.callWS;
        instance.callWS = (message) => {
            if (message.type !== "logbook/get_events") return answer(message);
            window.logbook.push(message);
            return Promise.resolve(entries);
        };
        return instance;
    };
}"""


def open_window(page, path: str, entries: list | None = None, dashboard: dict | None = None, admin: bool = False) -> None:
    page.evaluate(WS, entries or [])
    mount_admin(page, dashboard or {}, admin=admin)
    page.locator("home-dashboard-page [data-menu]").first.click()
    page.locator(f"[data-link='{path}']").click()
    page.wait_for_selector(f"{SHEET} .content")


def rows(page) -> list:
    return page.locator(f"{LOGBOOK} [data-logbook-row] strong").all_inner_texts()


def named() -> list:
    return [
        {"when": 100, "entity_id": "light.a", "state": "on"},
        {"when": 200, "entity_id": "light.b", "name": "Lampa", "message": "włączono"},
    ]


def add_lights(page) -> None:
    add_entity(page, "light.a", "on", {"friendly_name": "Sufit"})
    add_entity(page, "light.b", "on", {"friendly_name": "Biurko"})


def test_someone_who_is_not_an_administrator_stays_in_the_dashboard(phone):
    open_window(phone, "/logbook")
    assert phone.locator(f"{SHEET} {LOGBOOK}").count() == 1
    assert "/logbook" not in phone.evaluate("window.location.pathname")


def test_the_logbook_lists_the_newest_first_with_names(phone):
    add_lights(phone)
    open_window(phone, "/logbook", named())
    phone.wait_for_selector(f"{LOGBOOK} [data-logbook-row]")
    assert rows(phone) == ["Lampa", "Sufit"]


def test_the_logbook_asks_only_for_the_devices_of_the_dashboard(phone):
    open_window(phone, "/logbook")
    phone.wait_for_function("window.logbook.length === 1")
    message = phone.evaluate("window.logbook[0]")
    assert isinstance(message["entity_ids"], list)
    assert message["entity_ids"]


def test_a_longer_time_asks_again(phone):
    open_window(phone, "/logbook")
    phone.wait_for_function("window.logbook.length === 1")
    phone.locator(f"{LOGBOOK} [data-hours='24']").click()
    phone.wait_for_function("window.logbook.length === 2")
    first, second = phone.evaluate("window.logbook.map((m) => new Date(m.end_time) - new Date(m.start_time))")
    assert second > first * 20


def test_the_search_narrows_the_logbook(phone):
    add_lights(phone)
    open_window(phone, "/logbook", named())
    phone.wait_for_selector(f"{LOGBOOK} [data-logbook-row]")
    phone.locator(f"{LOGBOOK} [data-activity-search]").fill("lampa")
    assert rows(phone) == ["Lampa"]


def test_what_someone_may_not_see_stays_out_of_the_logbook(phone):
    add_lights(phone)
    result = phone.evaluate(
        """async (entries) => {
            const { logbookRows } = await import("/custom_components/home_dashboard/www/app/activity.js");
            const config = { ...window.dashboard.model.normalizeConfig({}), denied: ["light.a"] };
            return logbookRows(window.dashboard.hass(), config, entries).map((row) => row.name);
        }""",
        named(),
    )
    assert result == ["Lampa"]


def test_a_row_reads_like_the_logbook_of_home_assistant(phone):
    add_lights(phone)
    open_window(phone, "/logbook", [{"when": 100, "entity_id": "light.a", "state": "on"}])
    row = phone.locator(f"{LOGBOOK} [data-logbook-row]")
    row.wait_for()
    assert "→" in row.locator("p").inner_text()
    assert row.locator("time").inner_text().count(":") == 2
    assert "active" in row.locator(".dot").get_attribute("class")


def test_a_message_has_no_arrow(phone):
    open_window(phone, "/logbook", [{"when": 100, "name": "Dom", "message": "uruchomiono", "domain": "homeassistant"}])
    row = phone.locator(f"{LOGBOOK} [data-logbook-row]")
    row.wait_for()
    assert row.locator("i").count() == 0
    assert row.locator("p").inner_text() == "Dom uruchomiono"


def test_the_cause_of_a_change_is_named(phone):
    add_lights(phone)
    entries = [
        {"when": 300, "entity_id": "light.a", "state": "on", "context_entity_id": "light.b", "context_state": "on"},
        {"when": 200, "entity_id": "light.a", "state": "off", "context_event_type": "automation_triggered", "context_name": "Wieczór"},
    ]
    open_window(phone, "/logbook", entries)
    phone.wait_for_selector(f"{LOGBOOK} [data-logbook-row]")
    texts = phone.locator(f"{LOGBOOK} [data-logbook-row] small").all_inner_texts()
    assert "Przez zmianę stanu: Biurko" in texts
    assert "Przez automatyzację: Wieczór" in texts


def test_rows_stand_under_the_title_of_their_day(phone):
    result = phone.evaluate("""async () => {
        const { logbookDays } = await import("/custom_components/home_dashboard/www/app/activity.js");
        const now = Date.now() / 1000;
        return logbookDays([{ when: now }, { when: now - 60 }, { when: now - 200000 }]).map((day) => day.rows.length);
    }""")
    assert result[-1] == 1
    assert sum(result) == 3


def test_today_is_named_in_the_title(phone):
    add_lights(phone)
    phone.evaluate("window.now = Date.now() / 1000")
    open_window(phone, "/logbook", [{"when": phone.evaluate("window.now"), "entity_id": "light.a", "state": "on"}])
    phone.wait_for_selector(f"{LOGBOOK} [data-logbook-row]")
    assert phone.locator(f"{LOGBOOK} [data-logbook-day] h3").inner_text().startswith("Dzisiaj · ")


def test_an_empty_time_says_so(phone):
    open_window(phone, "/logbook")
    phone.wait_for_selector(f"{LOGBOOK} [data-activity-empty]")


def test_the_history_starts_by_asking_for_entities(phone):
    open_window(phone, "/history")
    assert phone.locator(f"{SHEET} {HISTORY} [data-activity-empty]").count() == 1


def test_a_picked_entity_gets_a_graph_and_is_saved_with_the_account(phone):
    add_lights(phone)
    open_window(phone, "/history")
    phone.locator(f"{HISTORY} [data-activity-search]").fill("sufit")
    phone.locator(f"{HISTORY} [data-history-match='light.a']").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'frontend/set_user_data')")
    assert phone.evaluate("window.saved.at(-1).value.history") == ["light.a"]
    phone.wait_for_function(
        """() => document.querySelector("home-dashboard-chrome").shadowRoot.querySelector("home-dashboard-sheet")
            .shadowRoot.querySelector("home-dashboard-history").shadowRoot
            .querySelector("[data-history-graph]").children.length === 1"""
    )


def test_a_picked_entity_can_be_taken_away(phone):
    add_lights(phone)
    open_window(phone, "/history")
    phone.locator(f"{HISTORY} [data-activity-search]").fill("sufit")
    phone.locator(f"{HISTORY} [data-history-match='light.a']").click()
    phone.locator(f"{HISTORY} [data-history-picked='light.a']").click()
    assert phone.evaluate("window.saved.at(-1).value.history") == []


def test_the_history_does_not_offer_what_someone_may_not_see(phone):
    add_lights(phone)
    result = phone.evaluate("""async () => {
        const { historyMatches } = await import("/custom_components/home_dashboard/www/app/activity.js");
        const ids = (query) => historyMatches(window.dashboard.hass(), { denied: ["light.a"] }, query, []).map((row) => row.id);
        return [ids("Sufit"), ids("Biurko")];
    }""")
    assert result == [[], ["light.b"]]


def test_the_links_stand_in_the_new_order(phone):
    mount_admin(phone, {}, admin=True)
    phone.locator("home-dashboard-page [data-menu]").first.click()
    links = phone.locator("[data-drawer] [data-link]").evaluate_all("(items) => items.map((item) => item.dataset.link)")
    assert links[:2] == ["/history", "/logbook"]


def test_a_person_without_settings_sees_no_empty_section(phone):
    mount_admin(phone, {}, admin=False)
    phone.locator("home-dashboard-page [data-menu]").first.click()
    phone.wait_for_selector("[data-drawer]")
    empty = phone.locator("[data-drawer] ul").evaluate_all("(lists) => lists.filter((list) => !list.children.length).length")
    assert empty == 0
    neighbours = phone.locator("[data-drawer] hr").evaluate_all(
        "(lines) => lines.filter((line) => line.nextElementSibling?.tagName === 'HR').length"
    )
    assert neighbours == 0
