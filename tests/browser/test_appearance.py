"""The look of the page: background strength, bounce, buttons and own icons, shared and personal."""

from __future__ import annotations

from .test_panels import add_entity
from .test_personal_layout import saved_prefs, with_prefs
from .test_shortcuts import SHEET, mount_admin

APPEARANCE = "/custom_components/home_dashboard/www/app/appearance.js"
ROOM = {
    "id": "r",
    "name": "Pokój",
    "areas": [],
    "home": [],
    "sections": [{"title": "Światła", "tiles": [
        {"entity": "light.strip", "name": "Taśma", "icon": "mdi:lightbulb"},
        {"entity": "switch.fan", "name": "Wiatrak"},
        {"entity": "scene.evening", "name": "Wieczór"},
    ]}],
}


def run(page, body: str, arg=None):
    return page.evaluate(f"async (arg) => {{ const a = await import('{APPEARANCE}'); {body} }}", arg)


def add_room_things(page) -> None:
    add_entity(page, "light.strip", "on", {"friendly_name": "Taśma"})
    add_entity(page, "switch.fan", "off", {"friendly_name": "Wiatrak"})
    add_entity(page, "scene.evening", "unknown", {"friendly_name": "Wieczór"})


def open_look(page, dashboard: dict | None = None, admin: bool = True) -> None:
    mount_admin(page, dashboard or {}, admin=admin)
    page.locator("home-dashboard-page [data-menu]").click()
    page.locator("[data-drawer] [data-look]").click()


def room_tiles(page) -> dict:
    return page.evaluate("""() => Object.fromEntries([...window.card.shadowRoot.querySelectorAll(".tile[data-entity]")]
        .map((tile) => [tile.dataset.entity, { style: tile.getAttribute("style") ?? "",
                                               icon: tile.querySelector("ha-icon")?.icon }]))""")


# Merging ------------------------------------------------------------------------------------------

def test_defaults_keep_the_page_as_it_was(phone):
    look = run(phone, "return a.mergeAppearance();")
    assert look == {
        "background_strength": 40, "bounce": True, "icons": {},
        "tiles": {"opacity": 100, "radius": 20, "fill": "tile", "colours": {},
                  "background": None, "text": None, "icon": None, "icon_background": None},
        "text": {"title": None, "headings": None},
        "chips": {"background": None, "text": None, "opacity": 100, "radius": 14},
        "buttons": {"background": None, "icon": None, "opacity": 100},
        "badges": {"text": None, "icon": None},
        "page": {"background_light": None, "background_dark": None},
        "sheets": {"background": None, "text": None, "controls": None, "cards": None, "opacity": 100, "blur": 0, "scrim": 45},
        "map": {"theme": "auto", "hours": 24},
        "player": {"background": None, "text": None, "opacity": 100, "blur": 0, "radius": 16, "paused_minutes": 10},
        "nav": {"items": None, "style": "docked", "background": None, "icon": None, "active": None,
                "opacity": 100, "blur": 0},
    }
    assert run(phone, "return a.backgroundVeil(a.mergeAppearance());") == 0.6


def test_a_person_changes_only_what_they_choose(phone):
    look = run(phone, """return a.mergeAppearance(
        { background_strength: 70, tiles: { radius: 30, colours: { light: '#ff0000', cover: '#00ff00' } }, icons: { 'light.a': 'mdi:led-strip' } },
        { bounce: false, tiles: { colours: { light: '#0000ff' } }, icons: { 'light.b': 'mdi:lamp' } });""")
    assert look["background_strength"] == 70
    assert look["bounce"] is False
    assert look["tiles"]["radius"] == 30
    assert look["tiles"]["colours"] == {"light": "#0000ff", "cover": "#00ff00"}
    assert look["icons"] == {"light.a": "mdi:led-strip", "light.b": "mdi:lamp"}


def test_values_out_of_range_or_malformed_are_corrected_or_dropped(phone):
    look = run(phone, """return a.mergeAppearance({ background_strength: 140, bounce: 'yes',
        tiles: { opacity: 5, radius: 99, fill: 'stripes', colours: { light: 'red;}', cover: '#123456' } },
        icons: { 'light.a': 'bad icon', 'light.b': 'mdi:lamp' } });""")
    assert look["background_strength"] == 100
    assert look["bounce"] is True
    tiles = look["tiles"]
    assert [tiles["opacity"], tiles["radius"], tiles["fill"], tiles["colours"]] == [20, 36, "tile", {"cover": "#123456"}]
    assert look["icons"] == {"light.b": "mdi:lamp"}


def test_only_what_differs_from_the_base_is_saved(phone):
    for_everyone = run(phone, """const draft = a.mergeAppearance({ background_strength: 80, tiles: { fill: 'icon' } });
        return a.appearanceDiff(draft);""")
    assert for_everyone == {"background_strength": 80, "tiles": {"fill": "icon"}}
    own = run(phone, """const shared = a.mergeAppearance({ background_strength: 80, tiles: { colours: { light: '#ff0000' } } });
        const draft = a.mergeAppearance({ background_strength: 80, bounce: false, tiles: { colours: { light: '#ff0000', fan: '#00ff00' } } });
        return a.appearanceDiff(draft, shared);""")
    assert own == {"bounce": False, "tiles": {"colours": {"fan": "#00ff00"}}}


def test_writing_stays_readable_on_the_chosen_colour(phone):
    assert run(phone, "return [a.inkFor('#ffef9a'), a.inkFor('#20306a')];") == ["#1b1b1f", "#ffffff"]


def test_icons_are_found_by_name_and_by_keyword(phone):
    found = run(phone, """const list = [{ name: 'led-strip', keywords: [] }, { name: 'led-strip-variant', keywords: [] },
        { name: 'lightbulb', keywords: ['lamp'] }, { name: 'floor-lamp', keywords: [] }];
        return [a.searchIcons(list, 'led strip'), a.searchIcons(list, 'lamp'), a.searchIcons(list, ' ')];""")
    assert found == [["mdi:led-strip", "mdi:led-strip-variant"], ["mdi:floor-lamp", "mdi:lightbulb"], []]


# The page -----------------------------------------------------------------------------------------

def test_a_chosen_colour_paints_tiles_of_its_kind_while_they_are_on(phone):
    add_room_things(phone)
    look = {"tiles": {"colours": {"light": "#ff0000", "switch": "#00ff00", "scene": "#0000ff"}}}
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(phone, {"layout": [ROOM], "appearance": look}, "room")
    tiles = room_tiles(phone)
    assert "#ff0000" in tiles["light.strip"]["style"]
    # A switch that is off keeps the plain look; a scene has no off, so it is always coloured.
    assert "#00ff00" not in tiles["switch.fan"]["style"]
    assert "#0000ff" in tiles["scene.evening"]["style"]


def test_the_tile_settings_reach_the_page(phone):
    look = {"background_strength": 75, "tiles": {"opacity": 60, "radius": 8, "fill": "icon"}}
    mount_admin(phone, {"appearance": look})
    page = phone.evaluate("""() => { const page = window.card.shadowRoot.querySelector(".page");
        return { style: page.getAttribute("style"), fill: page.classList.contains("fill-icon") }; }""")
    assert "--hd-tile-opacity: 60%" in page["style"]
    assert "--hd-tile-radius: 8px" in page["style"]
    assert "--hd-veil: 0.25" in page["style"]
    assert page["fill"] is True


def test_own_settings_win_over_the_shared_ones(phone):
    with_prefs(phone, {"appearance": {"background_strength": 100, "tiles": {"fill": "tile"}}})
    mount_admin(phone, {"appearance": {"background_strength": 20, "tiles": {"fill": "icon"}}})
    phone.wait_for_function("/--hd-veil: 0$/.test(window.card.shadowRoot.querySelector('.page').getAttribute('style'))")
    assert not phone.evaluate("window.card.shadowRoot.querySelector('.page').classList.contains('fill-icon')")


def test_an_own_icon_wins_over_the_icon_of_the_layout(phone):
    add_room_things(phone)
    with_prefs(phone, {"appearance": {"icons": {"light.strip": "mdi:led-strip-variant"}}})
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(phone, {"layout": [ROOM], "appearance": {"icons": {"switch.fan": "mdi:fan"}}}, "room")
    phone.wait_for_function("""() => window.card.shadowRoot.querySelector('.tile[data-entity="light.strip"] ha-icon')?.icon
        === 'mdi:led-strip-variant'""")
    tiles = room_tiles(phone)
    assert tiles["switch.fan"]["icon"] == "mdi:fan"


def bounce_in_view(page) -> str:
    return page.evaluate("""async () => {
        const root = document.createElement("hui-root");
        const shadow = root.attachShadow({ mode: "open" });
        shadow.innerHTML = '<div class="header">x</div><div id="view"></div>';
        document.body.appendChild(root);
        window.view = shadow.querySelector("#view");
        await window.dashboard.mount(window.dashboard.hass(), {}, "home", window.view);
        await shadow.querySelector("home-dashboard-chrome").updateComplete;
        return getComputedStyle(window.view).overscrollBehaviorY;
    }""")


def test_the_page_bounces_at_its_ends_by_default(phone):
    assert bounce_in_view(phone) == "contain"


def test_a_person_turns_the_bounce_off(phone):
    with_prefs(phone, {"appearance": {"bounce": False}})
    bounce_in_view(phone)
    phone.wait_for_function("getComputedStyle(window.view).overscrollBehaviorY === 'none'")


# The sheet ----------------------------------------------------------------------------------------

def test_everyone_finds_the_look_in_the_menu(phone):
    open_look(phone, admin=False)
    assert phone.locator(f"{SHEET} [data-tab]").all_inner_texts() == ["Tło", "Przyciski", "Kolory", "Pasek", "Okna", "Ikony"]
    # Without administrator rights there is no choice for everyone.
    assert phone.locator(f"{SHEET} [data-look-everyone]").count() == 0


def test_a_person_saves_their_own_look(phone):
    open_look(phone, {"appearance": {"background_strength": 60}}, admin=False)
    phone.locator(f"{SHEET} [data-look='strength'] input").fill("90")
    phone.locator(f"{SHEET} [data-look='bounce'] input").uncheck()
    phone.locator(f"{SHEET} [data-tab='tiles']").click()
    phone.locator(f"{SHEET} [data-group='look-fill'] [data-choice='icon']").click()
    phone.locator(f"{SHEET} [data-look-save]").click()
    assert saved_prefs(phone)["appearance"] == {"background_strength": 90, "bounce": False, "tiles": {"fill": "icon"}}


def test_an_administrator_saves_the_look_for_everyone(phone):
    open_look(phone)
    assert phone.locator(f"{SHEET} [data-look-everyone] input").is_checked()
    phone.locator(f"{SHEET} [data-tab='tiles']").click()
    phone.locator(f"{SHEET} [data-look='radius'] input").fill("30")
    phone.locator(f"{SHEET} [data-look-colour='cover'] input[type='color']").evaluate(
        "(input) => { input.value = '#336699'; input.dispatchEvent(new Event('change')); }")
    preview = phone.locator(f"{SHEET} [data-look-preview]").get_attribute("style")
    assert "--hd-tile-radius: 30px" in preview
    phone.locator(f"{SHEET} [data-look-save]").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'lovelace/config/save')")
    saved = phone.evaluate("window.saved.find((m) => m.type === 'lovelace/config/save').config.strategy.appearance")
    assert saved == {"tiles": {"radius": 30, "colours": {"cover": "#336699"}}}


def test_an_icon_is_chosen_for_one_device(phone):
    add_entity(phone, "light.strip", "on", {"friendly_name": "Taśma LED"})
    open_look(phone, admin=False)
    phone.evaluate("""() => {
        window.hass.fetchWithAuth = async () => ({ ok: true, json: async () => [
            { name: "led-strip", keywords: [] }, { name: "lightbulb", keywords: [] }] });
    }""")
    phone.locator(f"{SHEET} [data-tab='icons']").click()
    phone.locator(f"{SHEET} [data-look-entity-search]").fill("taśma")
    phone.locator(f"{SHEET} [data-look-entity='light.strip']").click()
    phone.locator(f"{SHEET} [data-look-icon-search]").fill("led")
    phone.locator(f"{SHEET} [data-look-icon='mdi:led-strip']").click()
    assert phone.locator(f"{SHEET} [data-look-own-icon='light.strip']").count() == 1
    phone.locator(f"{SHEET} [data-look-save]").click()
    assert saved_prefs(phone)["appearance"] == {"icons": {"light.strip": "mdi:led-strip"}}


def test_a_person_goes_back_to_the_look_for_everyone(phone):
    with_prefs(phone, {"appearance": {"bounce": False}, "favorites": ["light.x"]})
    open_look(phone, admin=False)
    phone.locator(f"{SHEET} [data-look-reset]").click()
    assert saved_prefs(phone) == {"favorites": ["light.x"]}


# Colours of the page --------------------------------------------------------------------------------

APPLE = {
    "text": {"title": "#ffffff", "headings": "#ffffff"},
    "tiles": {"background": "#1c2a55", "text": "#ffffff", "icon": "#ffffff"},
    "chips": {"background": "#1c2a55", "text": "#ffffff", "opacity": 60, "radius": 24},
    "buttons": {"background": "#1c2a55", "icon": "#ffffff", "opacity": 50},
    "badges": {"text": "#ffffff", "icon": "#ffffff"},
}


def test_colours_nobody_chose_are_left_to_the_light_or_dark_look(phone):
    variables = run(phone, "return a.tileVariables(a.mergeAppearance());")
    assert "--hd-look" not in variables
    assert "--hd-chip-radius: 14px" in variables


def test_chosen_colours_become_properties_of_the_page(phone):
    variables = run(phone, "return a.tileVariables(arg);", APPLE)
    for expected in ("--hd-look-title: #ffffff", "--hd-look-tile-bg: #1c2a55", "--hd-look-chip-border: transparent",
                     "--hd-chip-opacity: 60%", "--hd-chip-radius: 24px", "--hd-button-opacity: 50%",
                     "--hd-look-badge-ring: color-mix(in srgb, #ffffff 45%, transparent)",
                     "--hd-look-tile-muted: color-mix(in srgb, #ffffff 72%, transparent)"):
        assert expected in variables


def test_a_tile_that_is_off_takes_the_chosen_colours(phone):
    add_room_things(phone)
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(phone, {"layout": [ROOM], "appearance": APPLE}, "room")
    colours = phone.evaluate("""() => {
        const tile = window.card.shadowRoot.querySelector('.tile[data-entity="switch.fan"]');
        const heading = window.card.shadowRoot.querySelector('h2');
        return [getComputedStyle(tile).backgroundColor, getComputedStyle(tile).color, getComputedStyle(heading).color];
    }""")
    # The background goes through color-mix for the opacity of tiles, so it is written as srgb.
    assert colours == ["color(srgb 0.109804 0.164706 0.333333)", "rgb(255, 255, 255)", "rgb(255, 255, 255)"]


def test_the_colours_tab_saves_the_chosen_colours(phone):
    open_look(phone)
    phone.locator(f"{SHEET} [data-tab='colours']").click()
    phone.locator(f"{SHEET} [data-look-field='text.headings'] input").evaluate(
        "(input) => { input.value = '#ffffff'; input.dispatchEvent(new Event('change')); }")
    phone.locator(f"{SHEET} [data-look='chip-radius'] input").fill("24")
    phone.locator(f"{SHEET} [data-look-save]").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'lovelace/config/save')")
    saved = phone.evaluate("window.saved.find((m) => m.type === 'lovelace/config/save').config.strategy.appearance")
    assert saved == {"text": {"headings": "#ffffff"}, "chips": {"radius": 24}}


def test_a_page_without_a_background_takes_the_one_of_the_look(phone):
    look = {"page": {"background_light": "linear-gradient(#111111, #222222)", "background_dark": "#000000"}}
    mount_admin(phone, {"appearance": look})
    phone.wait_for_function("window.card.shadowRoot.querySelector('.backdrop')")
    style = phone.evaluate("window.card.shadowRoot.querySelector('.backdrop').getAttribute('style')")
    assert "linear-gradient(#111111, #222222)" in style


def test_a_page_with_its_own_background_keeps_it(phone):
    look = {"page": {"background_light": "#000000"}}
    mount_admin(phone, {"appearance": look, "backgrounds": {"home": {"light": "#123456"}}})
    style = phone.evaluate("window.card.shadowRoot.querySelector('.backdrop').getAttribute('style')")
    assert "#123456" in style


def test_a_look_never_loads_a_picture_for_its_pages(phone):
    page = run(phone, """return a.mergeAppearance({ page: { background_light: 'url(https://x.y/a.jpg)',
        background_dark: 'linear-gradient(#000, url(https://x.y/a.jpg))' } }).page;""")
    assert page == {"background_light": None, "background_dark": None}


def test_a_colour_may_be_see_through(phone):
    look = run(phone, "return a.mergeAppearance({ tiles: { icon_background: '#ffffff26', background: '#ffffff2' } }).tiles;")
    assert look["icon_background"] == "#ffffff26"
    assert look["background"] is None


def test_a_colour_shows_as_a_round_sample_with_its_code(phone):
    open_look(phone, {"appearance": {"buttons": {"background": "#ffffff26"}}})
    phone.locator(f"{SHEET} [data-tab='colours']").click()
    chosen = phone.locator(f"{SHEET} [data-look-field='buttons.background']")
    # A see-through colour says how see-through it is, and its sample lies on a checkerboard.
    assert chosen.locator(".swatch-text").inner_text() == "#FFFFFF · 15%"
    sample = chosen.locator(".swatch-pick")
    assert "--swatch: #ffffff26" in sample.get_attribute("style")
    assert "repeating-conic-gradient" in sample.evaluate("(element) => getComputedStyle(element).backgroundImage")
    size = sample.bounding_box()
    assert round(size["width"]) == round(size["height"]) == 34
    # No colour chosen: a dashed ring and "Default", without a cross.
    default = phone.locator(f"{SHEET} [data-look-field='text.title']")
    assert default.locator(".swatch-text").inner_text() == "Domyślny"
    assert "unset" in default.locator(".swatch-pick").get_attribute("class")
    assert default.locator("[data-look-field-clear]").count() == 0


def test_the_cross_takes_a_colour_back_to_the_default(phone):
    open_look(phone, {"appearance": {"buttons": {"background": "#ffffff26"}}})
    phone.locator(f"{SHEET} [data-tab='colours']").click()
    field = phone.locator(f"{SHEET} [data-look-field='buttons.background']")
    field.locator("[data-look-field-clear]").click()
    assert field.locator(".swatch-text").inner_text() == "Domyślny"


def test_picking_a_colour_keeps_its_see_through_part(phone):
    open_look(phone, {"appearance": {"buttons": {"background": "#ffffff26"}}})
    phone.locator(f"{SHEET} [data-tab='colours']").click()
    field = phone.locator(f"{SHEET} [data-look-field='buttons.background']")
    field.locator("input[type='color']").evaluate("(input) => { input.value = '#336699'; input.dispatchEvent(new Event('change')); }")
    assert field.locator(".swatch-text").inner_text() == "#336699 · 15%"
