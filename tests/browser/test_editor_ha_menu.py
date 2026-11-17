"""The menu of Home Assistant in the editor: hidden when it opens, its menu button shows and hides it, and it comes
back on any other page; always by the kiosk mode, never by the user's own place of the menu (ha-menu.js)."""

from __future__ import annotations

from .test_editor_app import APP, desktop, open_editor  # noqa: F401
from .test_landscape_home import FAKE_APP, HASS, go


def open_in_home_assistant(page, dock: str = "docked", kiosk: bool = True, phone: bool = False) -> None:
    """The editor in a Home Assistant. The harness empties the body when it opens, so the app stands outside it."""
    page.evaluate(FAKE_APP, [dock, kiosk])
    page.evaluate("() => document.documentElement.appendChild(document.querySelector('home-assistant'))")
    if phone:
        page.evaluate("""() => { const app = document.querySelector('home-assistant');
            const root = app.attachShadow({ mode: 'open' }); const main = document.createElement('home-assistant-main');
            main.narrow = true; root.appendChild(main); window.toggles = 0;
            window.addEventListener('hass-toggle-menu', () => window.toggles++); }""")
    open_editor(page)


def menu_button(page) -> None:
    page.locator(f"{APP} [data-ha-menu]").click()


def changes(page) -> list:
    return page.evaluate("document.querySelector('home-assistant').updates")


def test_the_editor_opens_with_the_menu_of_home_assistant_hidden(desktop):  # noqa: F811
    open_in_home_assistant(desktop)
    assert desktop.evaluate(f"{HASS}.kioskMode") is True
    assert not any("dockedSidebar" in change for change in changes(desktop))


def test_the_menu_button_shows_the_menu_and_hides_it_again(desktop):  # noqa: F811
    open_in_home_assistant(desktop)
    menu_button(desktop)
    assert desktop.evaluate(f"{HASS}.kioskMode") is False
    menu_button(desktop)
    assert desktop.evaluate(f"{HASS}.kioskMode") is True


def test_the_menu_comes_back_when_the_editor_closes_or_another_page_opens(desktop):  # noqa: F811
    open_in_home_assistant(desktop)
    editor = desktop.evaluate("location.pathname")
    go(desktop, "/config/dashboard")
    assert desktop.evaluate(f"{HASS}.kioskMode") is False
    go(desktop, editor)
    assert desktop.evaluate(f"{HASS}.kioskMode") is True
    desktop.evaluate(f"document.querySelector('{APP}').remove()")
    assert desktop.evaluate(f"{HASS}.kioskMode") is False


def test_a_menu_shown_by_hand_stays_while_the_editor_is_open(desktop):  # noqa: F811
    open_in_home_assistant(desktop)
    menu_button(desktop)
    go(desktop, desktop.evaluate("location.pathname") + "?x=1")
    assert desktop.evaluate(f"{HASS}.kioskMode") is False


def test_on_a_phone_the_menu_button_opens_the_drawer_of_home_assistant(desktop):  # noqa: F811
    open_in_home_assistant(desktop, phone=True)
    menu_button(desktop)
    assert desktop.evaluate(f"{HASS}.kioskMode") is False
    assert desktop.evaluate("window.toggles") == 1
    # Open again: the drawer closes by Home Assistant, the kiosk mode stays off
    menu_button(desktop)
    assert desktop.evaluate("window.toggles") == 2
    assert desktop.evaluate(f"{HASS}.kioskMode") is False


def test_an_older_home_assistant_gets_its_place_of_the_menu_back(desktop):  # noqa: F811
    open_in_home_assistant(desktop, kiosk=False)
    assert desktop.evaluate(f"{HASS}.dockedSidebar") == "always_hidden"
    desktop.evaluate(f"document.querySelector('{APP}').remove()")
    assert desktop.evaluate(f"{HASS}.dockedSidebar") == "docked"
