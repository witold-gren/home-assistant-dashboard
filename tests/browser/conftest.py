"""Run the frontend in Google Chrome against the anonymised snapshot of a real installation."""

from __future__ import annotations

from collections.abc import Iterator
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import threading

from playwright.sync_api import Page, sync_playwright
import pytest

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(__file__).parent / "output"
PHONE = {"width": 402, "height": 874}
TABLET = {"width": 1180, "height": 820}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


@pytest.fixture(scope="session")
def base_url() -> Iterator[str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


@pytest.fixture(scope="session")
def browser():
    if not shutil.which("google-chrome") and not Path("/Applications/Google Chrome.app").exists():
        pytest.skip("Google Chrome not installed")
    with sync_playwright() as playwright:
        instance = playwright.chromium.launch(channel="chrome", headless=True)
        yield instance
        instance.close()


def open_harness(browser, base_url: str, viewport: dict, motion: str = "reduce", touch: bool = False) -> Page:
    page = browser.new_page(viewport=viewport, reduced_motion=motion, has_touch=touch)
    page.errors = []
    page.on("pageerror", lambda error: page.errors.append(str(error)))
    page.goto(f"{base_url}/tests/js/harness.html")
    page.wait_for_function("window.dashboardReady === true")
    return page


@pytest.fixture
def phone(browser, base_url: str) -> Iterator[Page]:
    page = open_harness(browser, base_url, PHONE)
    yield page
    assert page.errors == []
    page.close()


@pytest.fixture
def moving_phone(browser, base_url: str) -> Iterator[Page]:
    """A phone with a touch screen and animations, which the other tests switch off."""
    page = open_harness(browser, base_url, PHONE, motion="no-preference", touch=True)
    yield page
    assert page.errors == []
    page.close()


@pytest.fixture
def tablet(browser, base_url: str) -> Iterator[Page]:
    page = open_harness(browser, base_url, TABLET)
    yield page
    assert page.errors == []
    page.close()
