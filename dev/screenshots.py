#!/usr/bin/env python3
"""Make the README screenshots from the made-up home in dev/demo.js, in every language."""

from __future__ import annotations

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import threading
import urllib.request

from playwright.sync_api import Page, Route, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "docs" / "screenshots"
ICONS = ROOT / ".demo-icons"
ICON_URL = "https://cdn.jsdelivr.net/npm/@mdi/svg/svg/{}.svg"
TILES = ROOT / ".demo-tiles"
TILE_URL = "https://tile.openstreetmap.org/{}.png"
USER_AGENT = "home-dashboard-screenshots/0.1"
PHONE = {"width": 402, "height": 874}
TABLET = {"width": 1180, "height": 820}
LANDSCAPE = {"width": 874, "height": 402}
SHEET = "home-dashboard-sheet"


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


def serve_icon(route: Route) -> None:
    name = re.sub(r"[^a-z0-9-]", "", route.request.url.rsplit("/", 1)[1].removesuffix(".svg"))
    path = ICONS / f"{name}.svg"
    if not path.exists():
        ICONS.mkdir(exist_ok=True)
        with urllib.request.urlopen(ICON_URL.format(name), timeout=20) as response:
            path.write_bytes(response.read())
    route.fulfill(body=path.read_bytes(), content_type="image/svg+xml")


def serve_tile(route: Route) -> None:
    tile = re.sub(r"[^0-9/]", "", route.request.url.split("/osm/", 1)[1].removesuffix(".png"))
    path = TILES / f"{tile.replace('/', '_')}.png"
    if not path.exists():
        TILES.mkdir(exist_ok=True)
        request = urllib.request.Request(TILE_URL.format(tile), headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=20) as response:
            path.write_bytes(response.read())
    route.fulfill(body=path.read_bytes(), content_type="image/png")


def open_page(
    browser, base: str, language: str, viewport: dict, scheme: str = "light", query: str = ""
) -> Page:
    context = browser.new_context(viewport=viewport, device_scale_factor=1.5, color_scheme=scheme)
    page = context.new_page()
    page.route("**/mdi/*.svg", serve_icon)
    page.route("**/osm/**", serve_tile)
    page.goto(f"{base}/dev/demo.html?language={language}{query}")
    page.wait_for_function("window.demoReady === true")
    page.wait_for_timeout(1200)
    return page


def take(page: Page, folder: Path, name: str) -> None:
    page.wait_for_timeout(700)
    page.screenshot(path=folder / f"{name}.png")
    page.context.close()


def tap(page: Page, selector: str) -> None:
    page.locator(selector).first.click()
    page.wait_for_timeout(600)


def make(browser, base: str, language: str) -> None:
    folder = OUTPUT / language
    folder.mkdir(parents=True, exist_ok=True)
    take(open_page(browser, base, language, PHONE), folder, "home")
    take(open_page(browser, base, language, PHONE, "dark"), folder, "dark")
    take(open_page(browser, base, language, TABLET), folder, "tablet")

    room = "&page=room&room=living"
    take(open_page(browser, base, language, PHONE, query=room), folder, "room")

    page = open_page(browser, base, language, PHONE, query=room)
    tap(page, "home-dashboard-page [data-entity='light.sofa'] .text")
    take(page, folder, "light")

    page = open_page(browser, base, language, PHONE, query=room)
    tap(page, "home-dashboard-page [data-entity='climate.living'] .text")
    take(page, folder, "thermostat")

    page = open_page(browser, base, language, PHONE, query=room)
    tap(page, "home-dashboard-page [data-rooms]")
    tap(page, f"{SHEET} [data-sheet-edit]")
    take(page, folder, "editor")

    page = open_page(browser, base, language, PHONE, query=room)
    tap(page, "home-dashboard-page [data-entity='cover.living'] .text")
    take(page, folder, "blind")

    page = open_page(browser, base, language, PHONE, query="&page=room&room=kitchen")
    tap(page, "home-dashboard-page [data-entity='switch.coffee'] .text")
    take(page, folder, "switch")

    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page .camera")
    page.wait_for_selector(f"{SHEET} home-dashboard-timeline >> .range")
    take(page, folder, "camera")

    # A phone on its side: the camera fills the screen, the line of time comes out with its button.
    page = open_page(browser, base, language, LANDSCAPE)
    tap(page, "home-dashboard-page .camera")
    tap(page, f"{SHEET} [data-open-line]")
    page.wait_for_selector(f"{SHEET} home-dashboard-timeline >> .range")
    take(page, folder, "camera-landscape")

    # All cameras one under another, as the heading Cameras opens them.
    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page [data-cameras-all]")
    take(page, folder, "cameras")

    # The dashboard settings, with turning and talking of a camera opened.
    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page [data-menu]")
    tap(page, "[data-drawer] [data-settings]")
    row = "home-dashboard-settings [data-camera-control] .camera-row"
    page.locator(row).first.scroll_into_view_if_needed()
    tap(page, row)
    page.locator("home-dashboard-settings [data-talk-with]").scroll_into_view_if_needed()
    take(page, folder, "settings")

    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page [data-weather]")
    take(page, folder, "weather")

    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page [data-shortcut='{}']".format("Tramwaje" if language == "pl" else "Trams"))
    take(page, folder, "departures")

    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page [data-shortcut='Status']")
    take(page, folder, "status")

    page = open_page(browser, base, language, PHONE)
    school = "Rok szkolny" if language == "pl" else "School year"
    tap(page, f"home-dashboard-page [data-shortcut='{school}']")
    take(page, folder, "school")

    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page [data-rooms]")
    tap(page, f"{SHEET} [data-sheet-personal]")
    tap(page, f"{SHEET} [data-tab='chips']")
    take(page, folder, "chips")

    page = open_page(browser, base, language, PHONE)
    news = "Wiadomości" if language == "pl" else "News"
    page.locator(f"home-dashboard-page [data-shortcut='{news}']").evaluate("(button) => button.click()")
    take(page, folder, "news")

    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-chrome .mini-open")
    take(page, folder, "player")

    for name in ("music", "energy", "map"):
        take(open_page(browser, base, language, PHONE, query=f"&page={name}"), folder, name)

    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page .top-bar button")
    take(page, folder, "menu")

    for name, shortcut in (("vacuum", 1), ("media", 0)):
        page = open_page(browser, base, language, PHONE)
        button = page.locator("home-dashboard-page [data-shortcut]").nth(shortcut)
        button.evaluate("(button) => button.click()")
        take(page, folder, name)

    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page [data-rooms]")
    tap(page, f"{SHEET} [data-sheet-blocks]")
    take(page, folder, "blocks")

    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page [data-rooms]")
    tap(page, f"{SHEET} [data-sheet-blocks]")
    tap(page, f"{SHEET} [data-block='Status'] [data-block-edit]")
    page.wait_for_selector(f"{SHEET} home-dashboard-block-editor [data-block-save]")
    take(page, folder, "block-editor")

    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page [data-rooms]")
    tap(page, f"{SHEET} [data-sheet-blocks]")
    tap(page, f"{SHEET} [data-block-media]")
    page.wait_for_selector(f"{SHEET} home-dashboard-block-editor [data-block-save]")
    take(page, folder, "media-editor")

    windows = (
        ("notifications", "[data-menu-action='notifications']"),
        ("app", "[data-menu-app]"),
        ("logbook", "[data-link='/logbook']"),
    )
    for name, target in windows:
        page = open_page(browser, base, language, PHONE)
        tap(page, "home-dashboard-page .top-bar button")
        page.locator(target).evaluate("(button) => button.click()")
        page.wait_for_timeout(1000)
        take(page, folder, name)

    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page .top-bar button")
    page.locator("[data-link='/history']").evaluate("(button) => button.click()")
    page.wait_for_selector("home-dashboard-history [data-activity-search]")
    page.locator("home-dashboard-history [data-activity-search]").fill("climate.living")
    tap(page, "home-dashboard-history [data-history-match]")
    take(page, folder, "history")

    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page .top-bar button")
    page.locator("[data-menu-edit]").evaluate("(button) => button.click()")
    page.wait_for_selector(f"{SHEET} home-dashboard-block-editor [data-block-save]")
    page.locator(f"{SHEET} home-dashboard-block-editor summary").first.click()
    take(page, folder, "menu-editor")

    page = open_page(browser, base, language, PHONE, query="&page=room&room=kitchen")
    tap(page, "home-dashboard-page [data-rooms]")
    tap(page, f"{SHEET} [data-sheet-room-view]")
    take(page, folder, "my-view")

    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page [data-rooms]")
    tap(page, f"{SHEET} [data-sheet-personal]")
    tap(page, f"{SHEET} [data-tab='scenes']")
    take(page, folder, "my-scenes")

    make_look(browser, base, language, folder)
    make_apple(browser, base, language, folder)

    rows = (("rooms", None), ("background", "background"), ("access", "access"), ("layout", "personal"))
    for name, row in rows:
        page = open_page(browser, base, language, PHONE)
        tap(page, "home-dashboard-page [data-rooms]")
        if row:
            tap(page, f"{SHEET} [data-sheet-{row}]")
        take(page, folder, name)


LOOK_SHEET = (
    "document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')"
)
SAMPLE_THEMES = {
    "en": [("winter", "Winter"), ("summer", "Summer evening")],
    "pl": [("winter", "Zima"), ("summer", "Letni wieczór")],
}


def open_look(browser, base: str, language: str, tab: str) -> Page:
    page = open_page(browser, base, language, PHONE)
    tap(page, "home-dashboard-page [data-menu]")
    tap(page, "[data-drawer] [data-look]")
    tap(page, f"{SHEET} [data-tab='{tab}']")
    return page


def on_sheet(page: Page, script: str, arg=None) -> None:
    body = f"const sheet = {LOOK_SHEET}; {script}; await sheet.updateComplete;"
    page.evaluate(f"async (arg) => {{ {body} }}", arg)
    page.wait_for_timeout(300)


# The look of the page and its themes, with a few choices made so the pictures show what they do.
def make_look(browser, base: str, language: str, folder: Path) -> None:
    page = open_look(browser, base, language, "background")
    on_sheet(page, "sheet._setLook({ background_strength: 65 })")
    take(page, folder, "look-background")

    page = open_look(browser, base, language, "tiles")
    on_sheet(page, """sheet._setLookTiles({ radius: 28, opacity: 90 });
        sheet._setKindColour('light', '#ff8a3d'); sheet._setKindColour('scene', '#26a69a')""")
    take(page, folder, "look-buttons")

    page = open_look(browser, base, language, "colours")
    on_sheet(page, """sheet._setLookGroup('tiles', { background: '#1c2a55', text: '#ffffff' });
        sheet._setLookGroup('tiles', { icon: '#ffffff' });
        sheet._setLookGroup('text', { headings: '#ffffff' })""")
    take(page, folder, "look-colours")

    page = open_look(browser, base, language, "nav")
    on_sheet(page, "sheet._setLookGroup('nav', { style: 'floating', opacity: 55, blur: 20 })")
    take(page, folder, "look-nav")

    page = open_look(browser, base, language, "sheets")
    on_sheet(page, """sheet._setLookGroup('sheets', { background: '#1d2c5c', text: '#ffffff' });
        sheet._setLookGroup('sheets', { controls: '#2c3d72', opacity: 85, blur: 30 })""")
    take(page, folder, "look-sheets")

    page = open_look(browser, base, language, "icons")
    on_sheet(page, "sheet._setIcon('light.sofa', 'mdi:led-strip-variant');"
                   "sheet._setIcon('cover.living', 'mdi:roller-shade')")
    take(page, folder, "look-icons")

    look = {"tiles": {"radius": 28}}
    names = SAMPLE_THEMES[language]
    themes = [{"id": key, "name": name, "appearance": look, "backgrounds": {}} for key, name in names]
    page = open_look(browser, base, language, "themes")
    on_sheet(page, """sheet.raw = { ...sheet.raw, themes: arg, theme: arg[0].id,
        appearance: { tiles: { radius: 12 } } };
        sheet._themeName = arg[1].name""", themes)
    take(page, folder, "look-themes")

    page = open_look(browser, base, language, "themes")
    on_sheet(page, """sheet._theme = { name: arg.name,
        appearance: { icons: { 'light.sofa': 'mdi:led-strip', 'light.attic': 'mdi:lamp' } },
        backgrounds: {
          home: { name: arg.home, light: 'linear-gradient(160deg, #6a8fd0, #3b2f7a)' },
          living: { name: arg.living, light: 'linear-gradient(160deg, #c77dff, #4b3bf5)' },
          garage: { name: arg.garage, light: 'linear-gradient(160deg, #9ba4b5, #394150)' } } };
        sheet._themeName = arg.name;
        sheet._themeChoices = { home: 'home', living: 'living', garage: null }""",
        {
            "name": SAMPLE_THEMES[language][1][1],
            "home": "Home" if language == "en" else "Strona główna",
            "living": "Living room" if language == "en" else "Salon",
            "garage": "Garage" if language == "en" else "Garaż",
        },
    )
    take(page, folder, "theme-import")


# The Apple Home theme that comes with Home Dashboard, with the example backgrounds of the demo.
def make_apple(browser, base: str, language: str, folder: Path) -> None:
    apple = "&theme=apple"
    take(open_page(browser, base, language, PHONE, query=apple), folder, "apple-home")
    take(open_page(browser, base, language, PHONE, "dark", query=apple), folder, "apple-home-dark")
    room = f"{apple}&page=room&room=living"
    take(open_page(browser, base, language, PHONE, query=room), folder, "apple-room")
    page = open_page(browser, base, language, PHONE, query=room)
    tap(page, "home-dashboard-page [data-entity='light.sofa'] .text")
    take(page, folder, "apple-light")
    take(open_page(browser, base, language, PHONE, query=f"{apple}&page=energy"), folder, "apple-energy")
    take(open_page(browser, base, language, TABLET, query=apple), folder, "apple-tablet")


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        for language in ("en", "pl"):
            make(browser, base, language)
        browser.close()
    server.shutdown()


if __name__ == "__main__":
    main()
