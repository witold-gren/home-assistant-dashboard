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


# The menu drawn out by a finger from the left edge, with the animations on.
CHROME = "document.querySelector('home-dashboard-chrome')"
TOUCH = """([type, x, y]) => {
    const touch = new Touch({ identifier: 1, target: document.body, clientX: x, clientY: y });
    const live = type === 'touchend' || type === 'touchcancel' ? [] : [touch];
    window.dispatchEvent(new TouchEvent(type, { touches: live, changedTouches: [touch], bubbles: true }));
}"""


def drag(page, *xs, end="touchend", y=300, pause=20):
    page.evaluate(TOUCH, ["touchstart", xs[0], y])
    for x in xs[1:]:
        page.evaluate(TOUCH, ["touchmove", x, y])
        page.wait_for_timeout(pause)
    if end:
        page.evaluate(TOUCH, [end, xs[-1], y])


def in_the_app(page):
    mount_with_app(page)
    page.evaluate(f"{CHROME}.edgeDrag = true")


def drawer_x(page) -> float:
    return page.locator("[data-drawer]").evaluate("(d) => d.getBoundingClientRect().left")


def test_the_menu_follows_the_finger_from_the_left_edge(moving_phone):
    in_the_app(moving_phone)
    drag(moving_phone, 5, 40, 80, end=None)
    moving_phone.wait_for_selector("[data-drawer]")
    moving_phone.wait_for_timeout(50)
    width = moving_phone.locator("[data-drawer]").evaluate("(d) => d.offsetWidth")
    # Pulled 75 px: the menu shows 75 px of itself
    assert abs(drawer_x(moving_phone) - (75 - width)) < 2
    moving_phone.evaluate(TOUCH, ["touchend", 80, 300])


def test_let_go_past_a_third_it_opens_and_short_of_it_it_goes_back(moving_phone):
    in_the_app(moving_phone)
    drag(moving_phone, 5, 60, 160, 220)
    moving_phone.wait_for_timeout(400)
    assert drawer_x(moving_phone) == 0
    moving_phone.evaluate(f"{CHROME}.close()")
    moving_phone.wait_for_selector("[data-drawer]", state="detached")
    moving_phone.wait_for_timeout(100)
    drag(moving_phone, 5, 20, 40, 50, pause=150)  # slowly, not a flick
    moving_phone.wait_for_selector("[data-drawer]", state="detached")


def test_the_app_taking_the_swipe_over_opens_the_menu_and_its_late_swipe_is_ignored(moving_phone):
    in_the_app(moving_phone)
    drag(moving_phone, 5, 30, 50, end="touchcancel")
    moving_phone.wait_for_timeout(400)
    assert drawer_x(moving_phone) == 0
    # The app tells of its swipe when the finger is lifted: the menu stays open, Home Assistant hears nothing
    moving_phone.evaluate(SWIPE)
    moving_phone.wait_for_timeout(300)
    assert moving_phone.locator("[data-drawer]").count() == 1
    assert moving_phone.evaluate("window.menuOpened") == 0


def test_away_from_the_edge_or_in_a_browser_a_finger_draws_nothing(moving_phone):
    mount_with_app(moving_phone)
    drag(moving_phone, 5, 60, 160, 220)  # a browser: the edge is its way back
    in_the_app_now = moving_phone.evaluate(f"{CHROME}.edgeDrag = true")  # noqa: F841
    drag(moving_phone, 120, 200, 300)  # not from the edge
    moving_phone.wait_for_timeout(300)
    assert moving_phone.locator("[data-drawer]").count() == 0


def test_the_menu_slides_in_and_out(moving_phone):
    mount_with_app(moving_phone)
    moving_phone.evaluate(SWIPE)
    moving_phone.wait_for_selector("[data-drawer]")
    assert moving_phone.locator("[data-drawer]").evaluate("(d) => getComputedStyle(d).animationName") == "drawer-in"
    moving_phone.evaluate(f"() => {{ {CHROME}.close(); }}")
    moving_phone.wait_for_timeout(100)
    # Still there, sliding away, then gone
    assert moving_phone.locator("[data-drawer]").count() == 1
    moving_phone.wait_for_selector("[data-drawer]", state="detached")
