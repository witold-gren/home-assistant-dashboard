"""The window of notifications."""

from __future__ import annotations

from .test_shortcuts import SHEET

SCREEN = "home-dashboard-notifications"
OLD = {"notification_id": "old", "title": "Stare", "message": "Treść", "created_at": "2026-11-01T08:00:00+00:00"}
NEW = {"notification_id": "new", "title": "Nowe", "message": "**Ważne**: zobacz [ustawienia](/config)", "created_at": "2026-11-07T08:00:00+00:00"}
MOUNT = """async ({ notifications }) => {
    window.watch = null;
    window.unwatched = 0;
    window.calls = [];
    const hass = window.dashboard.hass({
        user: { id: "me", name: "User", is_admin: true },
        callService: async (domain, service, data) => { window.calls.push([domain, service, data]); },
        connection: {
            subscribeMessage: async (callback, message) => {
                if (message.type === "persistent_notification/subscribe") {
                    window.watch = callback;
                    callback({ type: "current", notifications });
                }
                return () => { if (message.type === "persistent_notification/subscribe") window.unwatched += 1; };
            },
        },
    });
    window.hass = hass;
    window.card = await window.dashboard.mount(hass, { menu: { groups: [{ items: [
        { name: "Powiadomienia", icon: "mdi:bell", action: "notifications" },
    ] }] } }, "home");
}"""


def open_window(page, *items: dict) -> None:
    page.evaluate(MOUNT, {"notifications": {item["notification_id"]: item for item in items}})
    page.locator("home-dashboard-page [data-menu]").first.click()
    page.locator("[data-menu-action='notifications']").click()
    page.wait_for_selector(f"{SHEET} {SCREEN} .content")


def ids(page) -> list:
    return page.locator(f"{SCREEN} [data-notification]").evaluate_all("(rows) => rows.map((row) => row.dataset.notification)")


def test_nothing_to_show_says_so(phone):
    open_window(phone)
    assert "Brak powiadomień" in phone.locator(f"{SCREEN} [data-notifications-empty]").inner_text()


def test_the_newest_stands_first(phone):
    open_window(phone, OLD, NEW)
    assert ids(phone) == ["new", "old"]


def test_a_new_notification_appears_while_the_window_is_open(phone):
    open_window(phone, OLD)
    phone.evaluate("(item) => window.watch({ type: 'added', notifications: { new: item } })", NEW)
    phone.wait_for_selector(f"{SCREEN} [data-notification='new']")


def test_a_removed_notification_disappears(phone):
    open_window(phone, OLD, NEW)
    phone.evaluate("(item) => window.watch({ type: 'removed', notifications: { old: item } })", OLD)
    phone.wait_for_selector(f"{SCREEN} [data-notification='old']", state="detached")
    assert ids(phone) == ["new"]


def test_dismissing_asks_the_server(phone):
    open_window(phone, OLD)
    phone.locator(f"{SCREEN} [data-notification-dismiss]").click()
    assert phone.evaluate("window.calls") == [["persistent_notification", "dismiss", {"notification_id": "old"}]]


def test_dismissing_all_needs_a_second_tap(phone):
    open_window(phone, OLD, NEW)
    clear = phone.locator(f"{SCREEN} [data-notifications-clear]")
    clear.click()
    assert phone.evaluate("window.calls") == []
    clear.click()
    assert phone.evaluate("window.calls") == [["persistent_notification", "dismiss_all", {}]]


def test_one_notification_has_no_dismiss_all(phone):
    open_window(phone, OLD)
    assert phone.locator(f"{SCREEN} [data-notifications-clear]").count() == 0


def test_a_message_shows_bold_text_and_a_link(phone):
    open_window(phone, NEW)
    row = phone.locator(f"{SCREEN} [data-notification='new']")
    assert row.locator("p b").inner_text() == "Ważne"
    assert row.locator("p a").get_attribute("href") == "/config"


def test_a_message_cannot_bring_html_or_a_script_link(phone):
    bad = {**OLD, "message": "<img src=x onerror=alert(1)> [klik](javascript:alert(1))"}
    open_window(phone, bad)
    row = phone.locator(f"{SCREEN} [data-notification='old']")
    assert row.locator("img").count() == 0
    assert row.locator("a").count() == 0
    assert "<img" in row.locator("p").inner_text()


def test_a_home_assistant_link_goes_through_the_dashboard(phone):
    open_window(phone, NEW)
    phone.evaluate("""() => {
        window.links = [];
        document.querySelector("home-dashboard-chrome")._pickLink = (path) => window.links.push(path);
    }""")
    phone.locator(f"{SCREEN} p a").click()
    assert phone.evaluate("window.links") == ["/config"]


def test_closing_the_window_ends_the_subscription(phone):
    open_window(phone, OLD)
    phone.locator(f"{SHEET} header button").first.click()
    phone.wait_for_function("window.unwatched === 1")
