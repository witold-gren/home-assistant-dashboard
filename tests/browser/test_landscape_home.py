"""Home on a phone on its side, and the menu of Home Assistant kept out of the dashboard."""

from __future__ import annotations

from .test_page import mount

FAKE_APP = """(dock) => {
    const app = document.createElement("home-assistant");
    app.hass = { dockedSidebar: dock };
    app.updates = [];
    app._updateHass = (change) => { app.updates.push(change); app.hass = { ...app.hass, ...change }; };
    app._applyTheme = () => {};
    document.body.appendChild(app);
}"""


def test_the_menu_of_home_assistant_hides_while_the_dashboard_is_open_and_comes_back(phone):
    phone.evaluate(FAKE_APP, "docked")
    mount(phone)
    assert phone.evaluate("document.querySelector('home-assistant').hass.dockedSidebar") == "always_hidden"
    phone.evaluate("document.querySelector('home-dashboard-chrome').remove()")
    assert phone.evaluate("document.querySelector('home-assistant').hass.dockedSidebar") == "docked"


def test_a_menu_already_hidden_is_left_alone(phone):
    phone.evaluate(FAKE_APP, "always_hidden")
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
