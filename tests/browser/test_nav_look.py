"""The bar at the bottom: what it holds, where it sits and its colours, all from the look of the page."""

from __future__ import annotations

from .test_personal_layout import with_prefs
from .test_shortcuts import SHEET, mount_admin

CHROME = "document.querySelector('home-dashboard-chrome')"
ROOMS = [{"id": "laundry", "name": "Pralnia", "areas": [], "home": [], "sections": []}]


def entries(page, items, rooms=None):
    return page.evaluate(
        """({ items, rooms }) => window.dashboard.chrome.navEntries(items, {
            pages: [{ key: 'home', icon: 'mdi:home', path: 'home' }], rooms: rooms ?? [], areas: {} })
            .map((entry) => [entry.key, entry.name ?? entry.label, entry.room ?? entry.page?.key ?? (entry.menu ? 'menu' : null)])""",
        {"items": items, "rooms": rooms},
    )


def bar(page) -> dict:
    return page.evaluate(f"""() => {{
        const nav = {CHROME}.shadowRoot.querySelector('nav');
        return {{ items: [...nav.querySelectorAll('[data-page]')].map((item) => item.dataset.page),
                 active: [...nav.querySelectorAll('.item.active')].map((item) => item.dataset.page),
                 floating: nav.classList.contains('floating'), style: nav.getAttribute('style') }};
    }}""")


def test_without_a_choice_the_bar_keeps_its_pages(phone):
    assert entries(phone, None) == [["home", "nav_home", "home"]]


def test_the_bar_holds_pages_scenes_the_menu_and_rooms(phone):
    result = entries(phone, ["scenes", "room:laundry", "energy", "menu", "room:gone"], [{"id": "laundry", "name": "Pralnia"}])
    assert result == [["scenes", "personal_scenes", "__scenes"], ["room:laundry", "Pralnia", "laundry"],
                      ["energy", "nav_energy", "energy"], ["menu", "menu", "menu"]]


def test_a_list_of_entries_must_fit_the_bar(phone):
    looks = phone.evaluate("""async () => {
        const a = await import('/custom_components/home_dashboard/www/app/appearance.js');
        return [['home'], ['home', 'map', 'home'], ['home', 'x', 'map'], ['home', 'map', 'energy', 'media', 'scenes', 'menu']]
            .map((items) => a.mergeAppearance({ nav: { items } }).nav.items);
    }""")
    assert looks == [None, ["home", "map"], ["home", "map"], None]


def test_the_chosen_entries_and_style_reach_the_bar(phone):
    look = {"nav": {"items": ["home", "scenes", "room:laundry", "menu"], "style": "floating",
                    "background": "#1c2a55", "icon": "#ffffff", "opacity": 60, "blur": 20}}
    phone.evaluate("window.history.replaceState(null, '', '?room=laundry')")
    mount_admin(phone, {"layout": ROOMS, "appearance": look}, "room")
    phone.wait_for_function(f"{CHROME}.shadowRoot.querySelectorAll('nav [data-page]').length === 4")
    result = bar(phone)
    assert result["items"] == ["home", "scenes", "room:laundry", "menu"]
    assert result["active"] == ["room:laundry"]
    assert result["floating"] is True
    for expected in ("--hd-nav-bg: #1c2a55", "--hd-nav-icon: #ffffff", "--hd-nav-opacity: 60%", "--hd-nav-blur: 20px"):
        assert expected in result["style"]


def test_home_stays_marked_in_a_room_that_is_not_in_the_bar(phone):
    phone.evaluate("window.history.replaceState(null, '', '?room=laundry')")
    mount_admin(phone, {"layout": ROOMS, "appearance": {"nav": {"items": ["home", "scenes"]}}}, "room")
    phone.wait_for_function(f"{CHROME}.shadowRoot.querySelectorAll('nav [data-page]').length === 2")
    assert bar(phone)["active"] == ["home"]


def test_the_menu_in_the_bar_opens_the_menu(phone):
    mount_admin(phone, {"appearance": {"nav": {"items": ["home", "menu"]}}})
    phone.locator("home-dashboard-chrome nav [data-page='menu']").click()
    phone.wait_for_selector("home-dashboard-chrome .drawer")


def test_a_person_can_have_a_bar_of_their_own(phone):
    with_prefs(phone, {"appearance": {"nav": {"items": ["home", "map"]}}})
    mount_admin(phone, {"appearance": {"nav": {"items": ["home", "energy", "scenes"]}}})
    phone.wait_for_function(f"{CHROME}.shadowRoot.querySelectorAll('nav [data-page]').length === 2")
    assert bar(phone)["items"] == ["home", "map"]


def test_the_bar_tab_saves_entries_and_style(phone):
    mount_admin(phone, {"layout": ROOMS})
    phone.locator("home-dashboard-page [data-menu]").click()
    phone.locator("[data-drawer] [data-look]").click()
    phone.locator(f"{SHEET} [data-tab='nav']").click()
    phone.locator(f"{SHEET} [data-nav-item='map'] [data-nav-remove]").click()
    phone.locator(f"{SHEET} [data-nav-add] select").select_option("room:laundry")
    phone.locator(f"{SHEET} [data-nav-item='room:laundry'] [data-nav-up]").click()
    phone.locator(f"{SHEET} [data-group='nav-style'] [data-choice='floating']").click()
    phone.locator(f"{SHEET} [data-look='nav-blur'] input").fill("18")
    phone.locator(f"{SHEET} [data-look-save]").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'lovelace/config/save')")
    saved = phone.evaluate("window.saved.find((m) => m.type === 'lovelace/config/save').config.strategy.appearance")
    assert saved == {"nav": {"items": ["home", "media", "room:laundry", "energy"], "style": "floating", "blur": 18}}
