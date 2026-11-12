"""The swipe from the left edge: the menu of the dashboard on Home, the way back anywhere else."""

from __future__ import annotations

from .test_page import mount
from .test_sheets import open_menu

# The app of Home Assistant turns its edge swipe into this event on the main element of Home Assistant.
FAKE_APP = """() => {
    const app = document.createElement("home-assistant");
    app.attachShadow({ mode: "open" });
    const main = document.createElement("home-assistant-main");
    app.shadowRoot.appendChild(main);
    document.body.appendChild(app);
    window.menuOpened = 0;
    main.addEventListener("hass-toggle-menu", () => window.menuOpened++);
}"""

SWIPE = """() => document.querySelector("home-assistant").shadowRoot.querySelector("home-assistant-main")
    .dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }))"""


def mount_with_app(page, name="home"):
    page.evaluate(FAKE_APP)
    if name == "room":
        room = page.evaluate("Object.keys(window.dashboard.snapshot.areas)[0]")
        page.evaluate("(id) => history.replaceState(null, '', `/tests/room?room=${id}`)", room)
    mount(page, None, name)


def test_on_home_the_swipe_opens_the_menu_of_the_dashboard_instead(phone):
    mount_with_app(phone)
    phone.evaluate(SWIPE)
    phone.wait_for_selector("[data-drawer]")
    assert phone.evaluate("window.menuOpened") == 0


def test_in_a_room_the_swipe_goes_back_home_instead(phone):
    mount_with_app(phone, "room")
    phone.evaluate(SWIPE)
    phone.wait_for_function("location.pathname.endsWith('/home')")
    assert phone.evaluate("window.menuOpened") == 0


def test_on_another_page_the_swipe_goes_back_home(phone):
    mount_with_app(phone, "energy")
    phone.evaluate(SWIPE)
    phone.wait_for_function("location.pathname.endsWith('/home')")
    assert phone.evaluate("window.menuOpened") == 0


def test_with_a_window_open_the_swipe_closes_it(phone):
    mount_with_app(phone)
    open_menu(phone)
    phone.evaluate(SWIPE)
    phone.wait_for_selector("[data-drawer]", state="detached")
    assert phone.evaluate("window.menuOpened") == 0


def test_the_menu_ends_with_the_profile_of_the_person(phone):
    mount(phone)
    open_menu(phone)
    profile = phone.locator("[data-profile]")
    name = phone.evaluate("window.hass.user.name")
    assert profile.inner_text().strip() == f"Profil {name}".strip()
    last = phone.evaluate("""() => { const buttons = [...document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelectorAll('[data-drawer] button')]; return buttons.at(-1).hasAttribute('data-profile'); }""")
    assert last
    profile.click()
    phone.wait_for_function("location.pathname === '/profile'")


def test_the_rooms_come_right_after_the_pages(phone):
    mount(phone)
    open_menu(phone)
    order = phone.evaluate("""() => [...document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelectorAll('[data-drawer] button:not([data-drawer-back])')].map((b) => b.hasAttribute('data-go') ? 'page'
            : b.hasAttribute('data-jump') ? 'room' : 'other')""")
    pages = order.count("page")
    rooms = order.count("room")
    assert rooms
    assert order[:pages] == ["page"] * pages
    assert order[pages:pages + rooms] == ["room"] * rooms
