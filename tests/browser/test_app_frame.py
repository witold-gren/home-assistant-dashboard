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


def test_the_music_page_can_be_an_app(phone):
    dashboard = {"music": {"addon": "abc_music"}}
    phone.evaluate(MOUNT.replace('"home")', '"music")'), {"dashboard": dashboard, "info": RUNNING, "fails": False, "admin": False})
    phone.locator(f"home-dashboard-page {APP} [data-app-frame]").wait_for(state="attached")
    endpoints = phone.evaluate("window.ws.filter((m) => m.type === 'supervisor/api').map((m) => m.endpoint)")
    assert "/addons/abc_music/info" in endpoints


def test_the_music_app_fills_the_page(phone):
    dashboard = {"music": {"addon": "abc_music"}}
    phone.evaluate(MOUNT.replace('"home")', '"music")'), {"dashboard": dashboard, "info": RUNNING, "fails": False, "admin": False})
    frame = phone.locator(f"home-dashboard-page {APP} [data-app-frame]")
    frame.wait_for(state="attached")
    assert frame.bounding_box()["height"] > 600


NAV = "document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('nav')"


def open_full_music(page, info: dict = RUNNING, music: dict | None = None) -> None:
    dashboard = {"music": music or {"addon": "abc_music", "fullscreen": True}}
    page.evaluate(MOUNT.replace('"home")', '"music")'), {"dashboard": dashboard, "info": info, "fails": False, "admin": False})
    page.evaluate("""() => {
        window.navigated = [];
        document.querySelector("home-dashboard-chrome")._navigate = (target) => window.navigated.push(target.key);
    }""")


def app_frame(page):
    page.locator(f"home-dashboard-page {APP} [data-app-frame]").wait_for(state="attached")
    return next(frame for frame in page.frames if frame != page.main_frame)


def test_full_music_hides_the_bottom_bar_and_fills_the_screen(phone):
    open_full_music(phone)
    app_frame(phone)
    phone.wait_for_function(f"{NAV}.classList.contains('tucked')")
    assert phone.locator(f"home-dashboard-page {APP} [data-app-frame]").bounding_box()["height"] > 800


def test_the_menu_button_of_the_app_goes_home(phone):
    open_full_music(phone)
    app_frame(phone).evaluate("parent.postMessage({ type: 'home-assistant/toggle-menu' }, '*')")
    phone.wait_for_function("window.navigated.length === 1")
    assert phone.evaluate("window.navigated") == ["home"]


def test_a_message_from_elsewhere_goes_nowhere(phone):
    open_full_music(phone)
    app_frame(phone)
    phone.evaluate("window.postMessage({ type: 'home-assistant/toggle-menu' }, '*')")
    phone.wait_for_timeout(200)
    assert phone.evaluate("window.navigated") == []


def test_music_that_cannot_open_keeps_the_bottom_bar(phone):
    open_full_music(phone, info={**RUNNING, "state": "stopped"})
    phone.locator(f"{APP} [data-app-link]").wait_for()
    phone.wait_for_timeout(500)
    assert phone.evaluate(f"{NAV}.classList.contains('tucked')") is False


def test_music_without_the_option_keeps_the_bottom_bar(phone):
    open_full_music(phone, music={"addon": "abc_music"})
    app_frame(phone)
    phone.wait_for_timeout(500)
    assert phone.evaluate(f"{NAV}.classList.contains('tucked')") is False


def test_the_bottom_bar_comes_back_on_the_next_page(phone):
    open_full_music(phone)
    app_frame(phone)
    phone.wait_for_function(f"{NAV}.classList.contains('tucked')")
    phone.evaluate("""async () => {
        window.card = await window.dashboard.mount(window.hass, { music: { addon: "abc_music", fullscreen: true } }, "home");
    }""")
    phone.wait_for_function(f"!{NAV}.classList.contains('tucked')")
    phone.wait_for_timeout(600)
    assert phone.evaluate(f"{NAV}.classList.contains('tucked')") is False


def test_full_music_reaches_the_bottom_of_the_screen(phone):
    open_full_music(phone)
    app_frame(phone)
    phone.wait_for_function(f"{NAV}.classList.contains('tucked')")
    box = phone.locator(f"home-dashboard-page {APP} [data-app-frame]").bounding_box()
    assert box["y"] + box["height"] == phone.viewport_size["height"]


def test_coming_back_to_a_kept_page_hides_the_bottom_bar_again(phone):
    open_full_music(phone)
    frame = app_frame(phone)
    phone.wait_for_function(f"{NAV}.classList.contains('tucked')")
    phone.evaluate("""() => {
        const card = window.card;
        window.keptParent = card.parentNode;
        card.remove();
    }""")
    phone.wait_for_function(f"!{NAV}.classList.contains('tucked')")
    phone.evaluate("window.keptParent.append(window.card)")
    phone.wait_for_function(f"{NAV}.classList.contains('tucked')")
    assert frame is not None


def test_the_menu_button_works_after_coming_back(phone):
    open_full_music(phone)
    app_frame(phone)
    phone.evaluate("""() => {
        window.keptParent = window.card.parentNode;
        window.card.remove();
        window.keptParent.append(window.card);
    }""")
    phone.wait_for_function(f"{NAV}.classList.contains('tucked')")
    next(frame for frame in phone.frames if frame != phone.main_frame).evaluate(
        "parent.postMessage({ type: 'home-assistant/toggle-menu' }, '*')"
    )
    phone.wait_for_function("window.navigated.length === 1")


def test_the_side_bar_keeps_up_with_a_sidebar_that_stops_late(tablet):
    tablet.evaluate(MOUNT, {"dashboard": {}, "info": RUNNING, "fails": False, "admin": True})
    result = tablet.evaluate("""async () => {
        const chrome = document.querySelector("home-dashboard-chrome");
        const root = document.createElement("div");
        root.style.cssText = "position: fixed; left: 256px; width: 100px; height: 10px";
        document.body.append(root);
        chrome.root = root;
        chrome._followRoot();
        await new Promise((done) => setTimeout(done, 300));
        root.style.left = "56px";
        await new Promise((done) => setTimeout(done, 200));
        const left = chrome._left;
        chrome.root = null;
        root.remove();
        return left;
    }""")
    assert result == 56


def test_full_music_runs_under_the_clock_and_gets_room_inside(phone):
    open_full_music(phone)
    frame = app_frame(phone)
    phone.wait_for_selector("home-dashboard-page .page.under-clock")
    assert phone.locator(f"home-dashboard-page {APP} [data-app-frame]").bounding_box()["y"] == 0
    assert frame.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--hd-inset')").endswith("px")


def test_music_without_the_option_stays_below_the_clock(phone):
    open_full_music(phone, music={"addon": "abc_music"})
    app_frame(phone)
    phone.wait_for_timeout(500)
    assert phone.locator("home-dashboard-page .page.under-clock").count() == 0


def test_a_frame_from_another_address_stays_below_the_clock(phone):
    dashboard = {"music": {"addon": "abc_music", "fullscreen": True, "frame": "http://127.0.0.1:9/"}}
    phone.evaluate(MOUNT.replace('"home")', '"music")'), {"dashboard": dashboard, "info": RUNNING, "fails": True, "admin": False})
    phone.locator(f"home-dashboard-page {APP} [data-app-frame]").wait_for(state="attached")
    phone.wait_for_timeout(600)
    assert phone.locator("home-dashboard-page .page.under-clock").count() == 0


def test_the_bars_find_the_page_again_after_the_phone_turns(phone):
    phone.evaluate(MOUNT, {"dashboard": {}, "info": RUNNING, "fails": False, "admin": True})
    result = phone.evaluate("""async () => {
        const chrome = document.querySelector("home-dashboard-chrome");
        const root = document.createElement("div");
        root.style.cssText = "position: fixed; left: 56px; width: 100px; height: 10px";
        document.body.append(root);
        chrome.root = root;
        chrome._followRoot();
        await new Promise((done) => setTimeout(done, 1000));
        const turned = chrome._left;
        // Upright again, long after: the page moved back without changing its size.
        root.style.left = "0px";
        window.dispatchEvent(new Event("resize"));
        await new Promise((done) => setTimeout(done, 200));
        const back = chrome._left;
        root.style.left = "30px";
        document.dispatchEvent(new Event("visibilitychange"));
        await new Promise((done) => setTimeout(done, 200));
        const visible = chrome._left;
        chrome.root = null;
        root.remove();
        return [turned, back, visible];
    }""")
    assert result == [56, 0, 30]
