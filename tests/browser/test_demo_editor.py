"""The made-up home of the screenshots opens in the editor on a computer (dev/demo-editor.html), its preview frames
showing dev/demo.html, so `dev/screenshots.py editor` can make the pictures of docs/editor.md."""

from __future__ import annotations

APP = "home-dashboard-editor-app"
BLANK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>'


def open_demo(browser, base_url, query: str = ""):
    page = browser.new_page(viewport={"width": 1600, "height": 960})
    # No icons from the network in the tests.
    page.route("**/mdi/*.svg", lambda route: route.fulfill(body=BLANK, content_type="image/svg+xml"))
    page.route("**/osm/**", lambda route: route.fulfill(body=b"", content_type="image/png"))
    page.goto(f"{base_url}/dev/demo-editor.html?language=en{query}")
    page.wait_for_function("window.demoReady === true")
    return page


def test_the_made_up_home_opens_in_the_editor_with_its_preview(browser, base_url):
    page = open_demo(browser, base_url)
    page.locator(f"{APP} [data-node='layout/0']").wait_for()
    assert page.locator(f"{APP} [data-node='layout/0']").first.inner_text().startswith("Living room")
    frame = page.locator(f"{APP} iframe[data-frame='tablet']").get_attribute("src")
    assert frame.startswith("/dev/demo.html?") and "hd_preview=1" in frame
    content = page.locator(f"{APP} iframe[data-frame='tablet']").element_handle().content_frame()
    content.wait_for_function("document.querySelector('home-dashboard-page') !== null")
    page.close()


def test_the_demo_starts_without_a_dashboard_or_with_no_rooms(browser, base_url):
    page = open_demo(browser, base_url, "&new=1")
    page.locator(f"{APP} [data-create-dashboard]").wait_for()
    page.close()
    page = open_demo(browser, base_url, "&empty=1")
    page.locator(f"{APP} [data-generate-start]").wait_for()
    page.close()
