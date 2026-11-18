"""Sections side by side (`page_layout`): Home and the rooms with the headings over the background, the sections in as
many columns as fit, a long section scrolling inside, the cameras two at a time; chosen for every page, for Home or for
one room, on the phone and in the editor."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401
from .test_editor_settings_forms import draft, field
from .test_layout import ids_of, open_room
from .test_page import mount
from .test_shortcuts import SHEET, mount_admin

PAGE = "home-dashboard-page"
MODEL = "/custom_components/home_dashboard/www/app/model.js"


def model(page, script: str, *args):
    return page.evaluate(
        f"async (args) => {{ const m = await import('{MODEL}'); return ({script})(m, ...args); }}",
        list(args),
    )


def columns(page) -> list[list[str]]:
    return page.locator(f"{PAGE} .section-column").evaluate_all(
        "(all) => all.map((column) => [...column.querySelectorAll(':scope > [data-part]')].map((part) => part.dataset.part))"
    )


def long_room(page, count: int = 11, **extra) -> dict:
    tiles = [{"entity": entity} for entity in ids_of(page, "light.", count)]
    return {
        "id": "big",
        "name": "Duży",
        "areas": [],
        "home": tiles,
        "sections": [{"title": "Wszystko", "tiles": tiles}],
        **extra,
    }


# The model -------------------------------------------------------------------------------------


def test_the_layout_of_a_page_comes_from_its_room_home_or_every_page(phone):
    mount(phone)
    config = {
        "page_layout": {"style": "sections", "home": "classic"},
        "layout": [{"id": "a", "page_layout": "classic"}],
    }
    assert model(phone, "(m, c) => m.pageLayout(c, 'home')", config) == "classic"
    assert model(phone, "(m, c) => m.pageLayout(c, 'room', 'a')", config) == "classic"
    assert model(phone, "(m, c) => m.pageLayout(c, 'room', 'b')", config) == "sections"
    assert model(phone, "(m) => m.pageLayout({}, 'home')") == "classic"
    assert model(phone, "(m) => m.pageLayout({ page_layout: { style: 'odd' } }, 'room', 'x')") == "classic"
    assert model(
        phone,
        "(m) => [m.sectionRows({}), m.sectionRows({ page_layout: { rows: 0 } }), m.sectionRows({ page_layout: { rows: -2 } })]",
    ) == [4, 0, 4]


def test_columns_fit_the_width_and_take_the_sections_in_turn(phone):
    mount(phone)
    assert model(phone, "(m) => [354, 911, 1044, 1300, 1420].map(m.sectionColumns)") == [1, 1, 2, 2, 3]
    # each section goes to the column that is shortest so far, in order
    assert model(phone, "(m) => m.sectionsInColumns([300, 100, 100, 100, 50], 2)") == [[0, 4], [1, 2, 3]]
    assert model(phone, "(m) => m.sectionsInColumns([1, 2, 3], 1)") == [[0, 1, 2]]


# Home and the rooms ----------------------------------------------------------------------------


def test_the_classic_layout_stays_the_default(tablet):
    mount(tablet)
    assert tablet.locator(f"{PAGE} .section-columns").count() == 0
    assert tablet.locator(f"{PAGE} .page.sections-view").count() == 0


def test_home_in_sections_has_two_columns_on_a_tablet_and_one_on_a_phone(tablet, phone):
    mount(tablet, {"page_layout": {"style": "sections"}})
    tablet.wait_for_selector(f"{PAGE} [data-section-columns='2']")
    parts = columns(tablet)
    assert len(parts) == 2 and all(parts)
    mount(phone, {"page_layout": {"style": "sections"}})
    phone.wait_for_selector(f"{PAGE} [data-section-columns='1']")
    # one column keeps the order of the page
    order = columns(phone)[0]
    assert order[0] == "cameras" and any(part.startswith("room-") for part in order)


def test_home_alone_in_sections_leaves_the_rooms_as_they_are(tablet):
    area = tablet.evaluate("Object.keys(window.dashboard.snapshot.areas)[0]")
    open_room(tablet, {"page_layout": {"home": "sections"}}, area)
    assert tablet.locator(f"{PAGE} .section-columns").count() == 0
    mount(tablet, {"page_layout": {"home": "sections"}})
    tablet.wait_for_selector(f"{PAGE} .section-columns")


def test_a_room_of_its_own_in_sections(tablet):
    room = long_room(tablet, 4, page_layout="sections")
    open_room(tablet, {"layout": [room]}, "big")
    tablet.wait_for_selector(f"{PAGE} [data-part='section-0'], {PAGE} [data-part^='section-']")
    assert tablet.locator(f"{PAGE} .section-head").first.inner_text().startswith("Wszystko")


def test_the_heading_of_a_room_opens_it(phone):
    mount(phone, {"page_layout": {"style": "sections"}})
    link = phone.locator(f"{PAGE} .section-head [data-room-link]").last
    room = link.get_attribute("data-room-link")
    link.click()
    phone.wait_for_function("window.location.pathname.endsWith('/room')")
    assert f"room={room}" in phone.evaluate("window.location.search")


def test_a_long_section_scrolls_inside_and_says_so(tablet):
    mount(tablet, {"page_layout": {"home": "sections"}, "layout": [long_room(tablet, 11)]})
    part = f"{PAGE} [data-part='room-big']"
    tablet.wait_for_selector(part)
    tiles = tablet.locator(f"{part} .tiles")
    assert "limited" in tiles.get_attribute("class")
    assert tablet.locator(f"{part} [data-section-more]").inner_text().startswith("11")
    box = tiles.bounding_box()
    # four rows of 64 px and three gaps of 8 px
    assert box["height"] == pytest.approx(4 * 64 + 3 * 8, abs=1)
    assert tiles.evaluate("(list) => list.scrollHeight > list.clientHeight")
    tiles.evaluate(
        "(list) => { list.scrollTop = list.scrollHeight; list.dispatchEvent(new Event('scroll')); }"
    )
    assert "end" in tiles.get_attribute("class")


def test_with_no_limit_a_section_shows_every_tile(tablet):
    mount(tablet, {"page_layout": {"home": "sections", "rows": 0}, "layout": [long_room(tablet, 11)]})
    part = f"{PAGE} [data-part='room-big']"
    tablet.wait_for_selector(part)
    assert "limited" not in tablet.locator(f"{part} .tiles").get_attribute("class")
    assert tablet.locator(f"{part} [data-section-more]").count() == 0


def test_cameras_come_two_at_a_time_and_their_heading_opens_them_all(tablet):
    mount(tablet, {"page_layout": {"home": "sections"}})
    part = f"{PAGE} [data-part='cameras']"
    tablet.wait_for_selector(part)
    count = tablet.locator(f"{part} .camera").count()
    pairs = tablet.locator(f"{part} .camera-pair")
    assert pairs.count() == (count + 1) // 2
    first = pairs.first.locator(".camera")
    if count >= 2:
        left, right = first.nth(0).bounding_box(), first.nth(1).bounding_box()
        assert left["width"] == pytest.approx(right["width"], abs=1) and left["y"] == right["y"]
    if count > 2:
        assert tablet.locator(f"{part} [data-section-more]").inner_text().startswith(str(count))
        strip = tablet.locator(f"{part} [data-camera-pairs]")
        assert strip.evaluate("(strip) => strip.scrollWidth > strip.clientWidth")
    # (the rail of the test page lies over the left of the page; in Home Assistant the view moves the page aside)
    tablet.locator(f"{part} [data-section-link='cameras']").dispatch_event("click")
    tablet.wait_for_selector(f"{SHEET} .panel[data-kind='cameras']")


def test_a_tile_that_is_on_is_white_and_one_that_is_off_keeps_the_look(tablet):
    light, other = ids_of(tablet, "light.", 2)
    tablet.evaluate(
        "([a, b]) => { const s = window.dashboard.snapshot.states; s[a].state = 'on'; s[b].state = 'off'; }",
        [light, other],
    )
    room = {
        "id": "r",
        "name": "R",
        "areas": [],
        "home": [{"entity": light}, {"entity": other}],
        "sections": [],
    }
    # over a background of the page; without one the tiles keep their colours
    look = {"appearance": {"page": {"background_light": "linear-gradient(#4a9be8, #2a1b5e)"}}}
    mount(tablet, {"page_layout": {"home": "sections"}, "layout": [room], **look})
    background = "(tile) => getComputedStyle(tile).backgroundColor"
    on = tablet.locator(f"{PAGE} [data-part='room-r'] [data-entity='{light}']").evaluate(background)
    off = tablet.locator(f"{PAGE} [data-part='room-r'] [data-entity='{other}']").evaluate(background)
    assert on in ("color(srgb 1 1 1 / 0.96)", "rgba(255, 255, 255, 0.96)", "rgb(255, 255, 255)"), on
    assert off != on


def test_without_a_background_a_tile_that_is_on_keeps_its_colour(tablet):
    (light,) = ids_of(tablet, "light.")
    tablet.evaluate("(a) => { window.dashboard.snapshot.states[a].state = 'on'; }", light)
    room = {"id": "r", "name": "R", "areas": [], "home": [{"entity": light}], "sections": []}
    mount(tablet, {"page_layout": {"home": "sections"}, "layout": [room]})
    tile = tablet.locator(f"{PAGE} [data-part='room-r'] [data-entity='{light}']")
    assert tile.evaluate("(tile) => getComputedStyle(tile).backgroundColor") not in (
        "rgb(255, 255, 255)",
        "color(srgb 1 1 1 / 0.96)",
    )


def test_a_page_in_a_window_and_the_editing_stay_classic(phone):
    room = long_room(phone, 3, page_layout="sections")
    phone.evaluate("window.history.replaceState(null, '', '?room=big')")
    mount_admin(phone, {"layout": [room]}, "room")
    phone.wait_for_selector(f"{PAGE} .section-columns")
    phone.locator(f"{PAGE} [data-rooms]").click()
    phone.locator(f"{SHEET} [data-sheet-edit]").click()
    phone.wait_for_selector("[data-edit-save]")
    assert phone.locator(f"{PAGE} .section-columns").count() == 0


# Chosen on the phone ---------------------------------------------------------------------------


def test_the_settings_choose_it_for_every_page_home_and_the_rows(phone):
    mount(phone)
    phone.evaluate("() => document.querySelector('home-dashboard-chrome').open({ type: 'settings' })")
    every = "home-dashboard-settings [data-page-layout]"
    phone.wait_for_selector(every)
    assert phone.locator(every).input_value() == "classic"
    phone.locator("home-dashboard-settings [data-page-layout-home]").select_option("sections")
    phone.locator("home-dashboard-settings [data-section-rows]").select_option("3")
    layout = phone.locator("home-dashboard-settings").evaluate("(s) => s._draft.page_layout")
    assert layout == {"home": "sections", "rows": 3}
    phone.locator(every).select_option("sections")
    # Home on "as every page" leaves its own choice out
    phone.locator("home-dashboard-settings [data-page-layout-home]").select_option("auto")
    layout = phone.locator("home-dashboard-settings").evaluate("(s) => s._draft.page_layout")
    assert layout == {"home": None, "rows": 3, "style": "sections"}


def test_editing_a_room_on_the_phone_chooses_its_own_layout(phone):
    room = long_room(phone, 3)
    phone.evaluate("window.history.replaceState(null, '', '?room=big')")
    mount_admin(phone, {"layout": [room]}, "room")
    phone.locator(f"{PAGE} [data-rooms]").click()
    phone.locator(f"{SHEET} [data-sheet-edit]").click()
    choice = f"{PAGE} [data-edit-page-layout]"
    phone.wait_for_selector(choice)
    assert phone.locator(choice).input_value() == "auto"
    phone.locator(choice).select_option("sections")
    phone.locator("[data-edit-save]").click()
    phone.wait_for_function("window.saved.length > 0")
    assert phone.evaluate("window.saved.at(-1).config.strategy.layout[0].page_layout") == "sections"


# Chosen in the editor --------------------------------------------------------------------------


def test_the_editor_chooses_it_for_every_page_home_and_a_room(desktop):  # noqa: F811
    open_editor(desktop)
    select(desktop, "home_settings")
    field(desktop, "page_layout", ".style").locator("select").select_option("sections")
    field(desktop, "page_layout", ".home").locator("select").select_option("classic")
    rows = field(desktop, "page_layout", ".rows").locator("input")
    rows.fill("3")
    rows.dispatch_event("change")
    assert draft(desktop)["page_layout"] == {"style": "sections", "home": "classic", "rows": 3}
    select(desktop, "layout/0")
    desktop.locator(f"{APP} [data-field='page_layout'] [data-option='sections']").click()
    assert draft(desktop)["layout"][0]["page_layout"] == "sections"
    desktop.locator(f"{APP} [data-field='page_layout'] [data-option='default']").click()
    assert "page_layout" not in draft(desktop)["layout"][0]


# The tabs of the pages ---------------------------------------------------------------------------


def test_home_has_the_tabs_of_the_rooms_in_place_of_the_greeting(phone):
    mount(phone, {"page_layout": {"home": "sections"}})
    tabs = phone.locator(f"{PAGE} [data-page-tab]")
    phone.wait_for_selector(f"{PAGE} [data-page-tabs]")
    assert tabs.first.get_attribute("data-page-tab") == "home"
    assert "on" in tabs.first.get_attribute("class")
    assert tabs.count() > 2
    # no greeting, the chips and the buttons stay
    assert phone.locator(f"{PAGE} .home-title h1").count() == 0
    assert phone.locator(f"{PAGE} .chips").count() == 1
    assert phone.locator(f"{PAGE} [data-rooms]").count() == 1
    room = tabs.nth(1).get_attribute("data-page-tab")
    tabs.nth(1).click()
    phone.wait_for_function("window.location.pathname.endsWith('/room')")
    assert f"room={room}" in phone.evaluate("window.location.search")


def test_a_room_in_sections_has_the_tabs_with_its_own_on(tablet):
    room = long_room(tablet, 3, page_layout="sections")
    open_room(tablet, {"layout": [room]}, "big")
    tablet.wait_for_selector(f"{PAGE} [data-page-tab='big'].on")
    assert tablet.locator(f"{PAGE} [data-back]").count() == 0
    tablet.locator(f"{PAGE} [data-page-tab='home']").dispatch_event("click")
    tablet.wait_for_function("window.location.pathname.endsWith('/home')")


def test_the_classic_layout_keeps_the_greeting(phone):
    mount(phone)
    assert phone.locator(f"{PAGE} .home-title h1").count() == 1
    assert phone.locator(f"{PAGE} [data-page-tabs]").count() == 0


def tabs_state(page) -> dict:
    return page.evaluate(
        """() => {
        const row = window.card.shadowRoot.querySelector('[data-page-tabs]');
        const box = row.getBoundingClientRect();
        const tabs = [...row.querySelectorAll('[data-page-tab]')].map((tab) => {
            const r = tab.getBoundingClientRect();
            return { id: tab.dataset.pageTab, on: tab.classList.contains('on'), left: r.left - box.left, right: r.right - box.left };
        });
        return { width: box.width, scroll: row.scrollLeft, tabs, fades: [...row.classList].filter((c) => c.startsWith('more-')) };
    }"""
    )


def test_the_tabs_scroll_only_as_far_as_the_current_one_needs_and_never_cut_a_tab(phone):
    rooms = [
        {"id": f"r{n}", "name": f"Pokój numer {n}", "areas": [], "page_layout": "sections"} for n in range(12)
    ]
    # A room near the start: Home stays in sight, nothing scrolled, a fade says there is more.
    open_room(phone, {"layout": rooms}, "r0")
    phone.wait_for_selector(f"{PAGE} [data-page-tab='r0'].on")
    state = tabs_state(phone)
    assert state["scroll"] == 0
    assert state["fades"] == ["more-end"]
    # The last room: scrolled just enough; the first tab in sight starts at the edge, none is cut.
    open_room(phone, {"layout": rooms}, "r11")
    phone.wait_for_selector(f"{PAGE} [data-page-tab='r11'].on")
    state = tabs_state(phone)
    current = next(tab for tab in state["tabs"] if tab["on"])
    assert current["right"] <= state["width"] + 1
    visible = [tab for tab in state["tabs"] if tab["right"] > 0]
    assert abs(visible[0]["left"]) < 1
    assert "more-start" in state["fades"]
    # Worked out again from where the row already is, the place is the same (it does not drift with the scroll).
    again = phone.evaluate(
        """async () => { const { tabsScroll } = await import('/custom_components/home_dashboard/www/app/page.js');
            const row = window.card.shadowRoot.querySelector('[data-page-tabs]');
            return [tabsScroll(row, row.querySelector('.page-tab.on')), row.scrollLeft]; }"""
    )
    assert abs(again[0] - again[1]) < 1


def test_the_current_tab_comes_back_in_sight_when_the_row_gets_narrower(tablet):
    rooms = [{"id": f"r{n}", "name": f"Pokój {n}", "areas": [], "page_layout": "sections"} for n in range(9)]
    open_room(tablet, {"layout": rooms}, "r8")
    tablet.wait_for_selector(f"{PAGE} [data-page-tab='r8'].on")
    # Narrower after the first look (the status bar opens, buttons come beside it): the current tab is shown again.
    tablet.evaluate(
        """async () => { const row = window.card.shadowRoot.querySelector('[data-page-tabs]');
            row.scrollLeft = 0; row.style.maxWidth = '320px'; window.card.requestUpdate(); await window.card.updateComplete; }"""
    )
    tablet.wait_for_function(
        """() => { const row = window.card.shadowRoot.querySelector('[data-page-tabs]');
            const tab = row.querySelector('.page-tab.on').getBoundingClientRect(); const box = row.getBoundingClientRect();
            return tab.right <= box.right + 1 && tab.left >= box.left - 1; }"""
    )
    # and the first tab in sight is whole, not cut by the left edge
    assert (
        tablet.evaluate(
            """() => { const row = window.card.shadowRoot.querySelector('[data-page-tabs]'); const box = row.getBoundingClientRect();
            const first = [...row.querySelectorAll('[data-page-tab]')].find((t) => t.getBoundingClientRect().right > box.left + 1);
            return first.getBoundingClientRect().left - box.left; }"""
        )
        > -1
    )
    # Moved by hand, the row stays where the person left it.
    tablet.evaluate(
        """async () => { const row = window.card.shadowRoot.querySelector('[data-page-tabs]');
            row.dispatchEvent(new PointerEvent('pointerdown')); row.scrollLeft = 0; window.card.requestUpdate(); await window.card.updateComplete; }"""
    )
    tablet.wait_for_timeout(100)
    assert tablet.evaluate("window.card.shadowRoot.querySelector('[data-page-tabs]').scrollLeft") == 0
