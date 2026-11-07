"""Add-ons in a window of the dashboard."""

from __future__ import annotations

SHEET = "home-dashboard-sheet"
APP = "home-dashboard-app"
ITEM = {"name": "Frigate", "icon": "mdi:cctv", "addon": "abc_frigate"}
MENU = {"menu": {"groups": [{"items": [ITEM]}]}}
RUNNING = {"ingress_url": "/api/hassio_ingress/token/", "state": "started", "name": "Frigate"}
MOUNT = """async ({ dashboard, info, fails, admin }) => {
    window.ws = [];
    const hass = window.dashboard.hass({
        user: { id: "me", name: "User", is_admin: admin },
        callWS: async (message) => {
            window.ws.push(message);
            if (message.type === "supervisor/api") {
                if (fails) throw new Error("Unauthorized");
                if (message.endpoint === "/ingress/session") return { session: "abc" };
                if (message.endpoint.endsWith("/info")) return info;
                return {};
            }
            if (message.type === "lovelace/config") return { strategy: { type: "custom:home-dashboard", ...dashboard } };
            return null;
        },
    });
    window.hass = hass;
    window.card = await window.dashboard.mount(hass, dashboard, "home");
}"""


def open_from_menu(page, dashboard: dict = MENU, info: dict = RUNNING, fails: bool = False, admin: bool = True) -> None:
    page.evaluate(MOUNT, {"dashboard": dashboard, "info": info, "fails": fails, "admin": admin})
    page.locator("home-dashboard-page [data-menu]").first.click()
    page.locator("[data-menu-app='abc_frigate']").click()
    page.wait_for_selector(f"{SHEET} {APP}")


def test_a_running_app_opens_in_a_frame_with_a_session(phone):
    open_from_menu(phone)
    frame = phone.locator(f"{APP} [data-app-frame]")
    frame.wait_for(state="attached")
    assert frame.get_attribute("src") == RUNNING["ingress_url"]
    endpoints = phone.evaluate("window.ws.filter((m) => m.type === 'supervisor/api').map((m) => m.endpoint)")
    assert endpoints == ["/ingress/session", "/addons/abc_frigate/info"]


def test_the_window_has_the_name_of_the_app(phone):
    open_from_menu(phone)
    assert phone.locator(f"{SHEET} header h2").inner_text() == "Frigate"
    assert "whole" in phone.locator(f"{SHEET} section.panel").get_attribute("class")


def test_an_app_that_is_off_says_so_and_links_to_home_assistant(phone):
    open_from_menu(phone, info={**RUNNING, "state": "stopped"})
    message = phone.locator(f"{APP} [data-app-message]")
    message.locator("a").wait_for()
    assert "nie jest uruchomiona" in message.inner_text()
    assert message.locator("a").get_attribute("href") == "/abc_frigate"


def test_an_app_without_an_interface_says_so(phone):
    open_from_menu(phone, info={"state": "started"})
    phone.locator(f"{APP} [data-app-link]").wait_for()
    assert "nie ma interfejsu" in phone.locator(f"{APP} [data-app-message]").inner_text()


def test_no_rights_end_in_a_message_and_not_an_error(phone):
    open_from_menu(phone, fails=True, admin=False)
    phone.locator(f"{APP} [data-app-link]").wait_for()
    assert "administratora" in phone.locator(f"{APP} [data-app-message]").inner_text()


def test_a_fallback_address_is_used_when_the_session_fails(phone):
    item = {**ITEM, "frame": "http://example.test/"}
    open_from_menu(phone, {"menu": {"groups": [{"items": [item]}]}}, fails=True, admin=False)
    frame = phone.locator(f"{APP} [data-app-frame]")
    frame.wait_for(state="attached")
    assert frame.get_attribute("src") == "http://example.test/"


def test_an_app_can_be_a_shortcut_on_home(phone):
    shortcut = {"kind": "app", "name": "Frigate", "icon": "mdi:cctv", "addon": "abc_frigate"}
    phone.evaluate(MOUNT, {"dashboard": {"shortcuts": [shortcut]}, "info": RUNNING, "fails": False, "admin": True})
    phone.locator("home-dashboard-page [data-shortcut='Frigate']").click()
    phone.locator(f"{APP} [data-app-frame]").wait_for(state="attached")


def test_the_idle_timer_leaves_an_open_app_alone(phone):
    result = phone.evaluate("""async () => {
        const { holdsScreen } = await import("/custom_components/home_dashboard/www/app/chrome.js");
        return holdsScreen({ type: "sheet", sheet: { kind: "app", item: {} } });
    }""")
    assert result is True
