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
PHONE = {"width": 402, "height": 874}
TABLET = {"width": 1180, "height": 820}
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


def open_page(
    browser, base: str, language: str, viewport: dict, scheme: str = "light", query: str = ""
) -> Page:
    context = browser.new_context(viewport=viewport, device_scale_factor=1.5, color_scheme=scheme)
    page = context.new_page()
    page.route("**/mdi/*.svg", serve_icon)
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
