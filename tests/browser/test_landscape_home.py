"""Home on a phone on its side, and the menu of Home Assistant kept out of the dashboard."""

from __future__ import annotations

from .test_page import mount

FAKE_APP = """([dock, kiosk]) => {
    const app = document.createElement("home-assistant");
    // A Home Assistant with the kiosk mode has it in hass (false); an older one has no such key
    app.hass = kiosk ? { dockedSidebar: dock, kioskMode: false } : { dockedSidebar: dock };
    app.updates = [];
    app._updateHass = (change) => { app.updates.push(change); app.hass = { ...app.hass, ...change }; };
    app._applyTheme = () => {};
    document.body.appendChild(app);
}"""
HASS = "document.querySelector('home-assistant').hass"


def go(page, path: str) -> None:
    page.evaluate("""(path) => { history.pushState(null, '', path);
        window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } })); }""", path)


def test_the_menu_of_home_assistant_hides_by_the_kiosk_mode_never_by_the_users_choice(phone):
    phone.evaluate(FAKE_APP, ["docked", True])
    mount(phone)
    assert phone.evaluate(f"{HASS}.kioskMode") is True
    phone.evaluate("document.querySelector('home-dashboard-chrome').remove()")
    assert phone.evaluate(f"{HASS}.kioskMode") is False
    # The user's own place of the menu, which Home Assistant saves, is never touched
    changes = phone.evaluate("document.querySelector('home-assistant').updates")
    assert not any("dockedSidebar" in change for change in changes)


def test_another_page_of_home_assistant_has_its_menu_back_and_the_dashboard_hides_it_again(phone):
    phone.evaluate(FAKE_APP, ["docked", True])
    mount(phone)
    home = phone.evaluate("location.pathname")
    go(phone, "/config/dashboard")
    assert phone.evaluate(f"{HASS}.kioskMode") is False
    go(phone, home)
    assert phone.evaluate(f"{HASS}.kioskMode") is True
    phone.evaluate("history.back()")
    phone.wait_for_function(f"{HASS}.kioskMode === false")


def test_a_kiosk_mode_set_by_someone_else_is_left_alone(phone):
    phone.evaluate("""() => { const app = document.createElement('home-assistant');
        app.hass = { dockedSidebar: 'docked', kioskMode: true }; app.updates = [];
        app._updateHass = (change) => { app.updates.push(change); app.hass = { ...app.hass, ...change }; };
        app._applyTheme = () => {}; document.body.appendChild(app); }""")
    mount(phone)
    phone.evaluate("document.querySelector('home-dashboard-chrome').remove()")
    assert phone.evaluate(f"{HASS}.kioskMode") is True
    changes = phone.evaluate("document.querySelector('home-assistant').updates")
    assert not any("kioskMode" in change or "dockedSidebar" in change for change in changes)


def test_an_older_home_assistant_has_its_menu_hidden_and_given_back(phone):
    phone.evaluate(FAKE_APP, ["docked", False])
    mount(phone)
    assert phone.evaluate(f"{HASS}.dockedSidebar") == "always_hidden"
    go(phone, "/config/dashboard")
    assert phone.evaluate(f"{HASS}.dockedSidebar") == "docked"


def test_a_menu_already_hidden_is_left_alone_by_an_older_home_assistant(phone):
    phone.evaluate(FAKE_APP, ["always_hidden", False])
    mount(phone)
    phone.evaluate("document.querySelector('home-dashboard-chrome').remove()")
    changes = phone.evaluate("document.querySelector('home-assistant').updates")
    assert not any("dockedSidebar" in change for change in changes)


def test_a_phone_on_its_side_stays_a_phone_with_three_tiles_in_a_row(phone):
    phone.set_viewport_size({"width": 874, "height": 402})
    mount(phone)
    assert phone.evaluate("window.matchMedia('(min-width: 900px) and (min-height: 501px)').matches") is False
    columns = phone.evaluate("""() => {
        const grid = window.card.shadowRoot.querySelector('.tiles:not(.row)');
        return getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    }""")
    assert columns == 3


def test_a_wide_phone_on_its_side_is_not_a_tablet_either(phone):
    phone.set_viewport_size({"width": 956, "height": 440})
    mount(phone)
    assert phone.evaluate("(async () => (await import('/custom_components/home_dashboard/www/app/chrome.js')).currentLayout())()") == "phone"
