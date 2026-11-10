"""Windows over the page: see-through, blurred and in the colours of the look."""

from __future__ import annotations

from .test_panels import add_entity
from .test_shortcuts import SHEET, mount_admin

GLASS = {"sheets": {"background": "#1d2c5c", "text": "#ffffff", "controls": "#2c3d72", "opacity": 70, "blur": 30, "scrim": 25}}


def run(page, body: str, arg=None):
    return page.evaluate(f"async (arg) => {{ const a = await import('/custom_components/home_dashboard/www/app/appearance.js'); {body} }}", arg)


def test_a_plain_window_keeps_the_colours_of_the_look(phone):
    assert run(phone, "return a.sheetVariables({});") == "--hd-sheet-opacity: 100%; --hd-sheet-blur: 0px; --hd-sheet-scrim: 0.45"


def test_a_glass_window_replaces_the_colours_inside_it(phone):
    variables = run(phone, "return a.sheetVariables(arg);", GLASS)
    for expected in ("--hd-sheet-bg: #1d2c5c", "--hd-sheet-opacity: 70%", "--hd-sheet-blur: 30px", "--hd-sheet-scrim: 0.25",
                     "--hd-ov-text: #ffffff", "--hd-ov-off: #2c3d72", "--hd-ov-surface: #2c3d72"):
        assert expected in variables


def open_lamp(page, look: dict) -> None:
    add_entity(page, "light.lamp", "on", {"friendly_name": "Lampa", "brightness": 200, "supported_color_modes": ["brightness"]})
    mount_admin(page, {"favorites": ["light.lamp"], "appearance": look})
    page.locator("home-dashboard-page [data-entity='light.lamp'] .text").click()
    page.wait_for_selector(f"{SHEET} .panel")


def test_a_window_of_a_device_is_see_through_and_blurred(phone):
    open_lamp(phone, GLASS)
    styles = phone.evaluate("""() => {
        const sheet = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet');
        const cover = getComputedStyle(sheet.shadowRoot.querySelector('.cover'));
        const panel = getComputedStyle(sheet.shadowRoot.querySelector('.panel'));
        return [cover.backdropFilter, cover.backgroundColor, panel.backgroundColor, panel.color];
    }""")
    assert styles[0] == "blur(30px)"
    assert styles[1].startswith("color(srgb 0.11")
    assert styles[2] == "rgba(0, 0, 0, 0)"
    assert styles[3] == "rgb(255, 255, 255)"


def test_the_look_sheet_shows_the_windows_before_saving(phone):
    mount_admin(phone, {})
    phone.locator("home-dashboard-page [data-menu]").click()
    phone.locator("[data-drawer] [data-look]").click()
    phone.locator(f"{SHEET} [data-tab='sheets']").click()
    phone.locator(f"{SHEET} [data-look='sheet-blur'] input").fill("24")
    phone.wait_for_function("""() => document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('home-dashboard-sheet').getAttribute('style').includes('--hd-sheet-blur: 24px')""")
    phone.locator(f"{SHEET} [data-look='sheet-opacity'] input").fill("60")
    phone.locator(f"{SHEET} [data-look-save]").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'lovelace/config/save')")
    saved = phone.evaluate("window.saved.find((m) => m.type === 'lovelace/config/save').config.strategy.appearance")
    assert saved == {"sheets": {"opacity": 60, "blur": 24}}


def test_every_window_takes_the_colours_whatever_element_draws_it(phone):
    open_lamp(phone, GLASS)
    colours = phone.evaluate("""async () => {
        // An element with its own shadow root inside the window, as the weather or the school year.
        const { tokens } = await import('/custom_components/home_dashboard/www/app/styles.js');
        const sheet = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet');
        const inner = document.createElement('div');
        inner.attachShadow({ mode: 'open' }).adoptedStyleSheets = [tokens.styleSheet];
        const probe = document.createElement('span');
        probe.style.cssText = 'color: var(--hd-text); background: var(--hd-surface)';
        inner.shadowRoot.appendChild(probe);
        sheet.shadowRoot.querySelector('.panel').appendChild(inner);
        const style = getComputedStyle(probe);
        return [style.color, style.backgroundColor];
    }""")
    assert colours == ["rgb(255, 255, 255)", "rgb(44, 61, 114)"]


def test_without_a_look_of_windows_the_colours_stay(phone):
    open_lamp(phone, {})
    colour = phone.evaluate("""() => {
        const sheet = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet');
        return getComputedStyle(sheet.shadowRoot.querySelector('.panel')).color;
    }""")
    assert colour == "rgb(27, 27, 31)"


def test_cards_of_home_assistant_can_lose_their_background(phone):
    variables = run(phone, "return a.sheetVariables({ sheets: { cards: '#00000000' } });")
    assert "--ha-card-background: #00000000" in variables
