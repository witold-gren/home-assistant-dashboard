"""Dark colours that follow the system setting."""

from __future__ import annotations

from collections.abc import Iterator

from playwright.sync_api import Page
import pytest

from .conftest import PHONE, TABLET
from .test_page import mount
from .test_shortcuts import SHEET, mount_admin, open_background

CONTRAST_TEXT = 4.5
CONTRAST_ICON = 3



def as_rgb(value: str) -> str:
    """A colour mixed for the opacity of the look is written as srgb; the same colour as rgb."""
    if not value.startswith("color(srgb "):
        return value
    red, green, blue = (round(float(part) * 255) for part in value[len("color(srgb "):-1].split()[:3])
    return f"rgb({red}, {green}, {blue})"

def open_dark(browser, base_url: str, viewport: dict) -> Page:
    page = browser.new_page(viewport=viewport, color_scheme="dark")
    page.errors = []
    page.on("pageerror", lambda error: page.errors.append(str(error)))
    page.goto(f"{base_url}/tests/js/harness.html")
    page.wait_for_function("window.dashboardReady === true")
    return page


@pytest.fixture
def dark(browser, base_url: str) -> Iterator[Page]:
    page = open_dark(browser, base_url, PHONE)
    yield page
    assert page.errors == []
    page.close()


@pytest.fixture
def dark_tablet(browser, base_url: str) -> Iterator[Page]:
    page = open_dark(browser, base_url, TABLET)
    yield page
    assert page.errors == []
    page.close()


def token(page, name: str) -> str:
    return page.evaluate(
        "(name) => getComputedStyle(window.card).getPropertyValue(name).trim()",
        name,
    )


def luminance(colour: str) -> float:
    value = colour.lstrip("#")
    channels = [int(value[index : index + 2], 16) / 255 for index in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(first: str, second: str) -> float:
    high, low = sorted((luminance(first), luminance(second)), reverse=True)
    return (high + 0.05) / (low + 0.05)


def test_the_system_setting_picks_the_colours(dark, phone):
    mount(dark)
    mount(phone)
    assert token(dark, "--hd-background") == "#121316"
    assert token(phone, "--hd-background") == "#fbfaff"


def test_changing_the_system_setting_needs_no_reload(phone):
    mount(phone)
    phone.emulate_media(color_scheme="dark")
    assert token(phone, "--hd-background") == "#121316"


@pytest.mark.parametrize(
    "fill", ["background", "surface", "off", "climate", "light", "security", "cover", "media", "appliance"]
)
def test_text_is_readable_on_every_surface(dark, fill):
    mount(dark)
    assert contrast(token(dark, "--hd-text"), token(dark, f"--hd-{fill}")) >= CONTRAST_TEXT


def test_muted_text_is_readable(dark):
    mount(dark)
    for fill in ("background", "surface", "off"):
        assert contrast(token(dark, "--hd-text-muted"), token(dark, f"--hd-{fill}")) >= CONTRAST_TEXT


@pytest.mark.parametrize(
    ("ink", "fill"),
    [
        ("--hd-off-ink", "--hd-off-icon"),
        ("--hd-light-ink", "--hd-light-icon"),
        ("--hd-cover-ink", "--hd-cover-icon"),
        ("--hd-media-ink", "--hd-media-icon"),
        ("--hd-climate-ink", "--hd-climate"),
        ("--hd-security-ink", "--hd-security"),
        ("--hd-appliance-ink", "--hd-appliance"),
        ("--hd-light-accent", "--hd-light"),
        ("--hd-cover-accent", "--hd-cover"),
        ("--hd-media-accent", "--hd-media"),
    ],
)
def test_icons_stand_out_from_their_circles(dark, ink, fill):
    mount(dark)
    assert contrast(token(dark, ink), token(dark, fill)) >= CONTRAST_ICON


@pytest.mark.parametrize("tone", ["green", "purple", "teal", "pink"])
def test_shortcut_icons_stand_out_in_both_modes(dark, phone, tone):
    mount(dark)
    mount(phone)
    for page in (dark, phone):
        assert contrast(token(page, f"--hd-chip-{tone}"), token(page, "--hd-surface")) >= CONTRAST_ICON


@pytest.mark.parametrize("ink", ["#ffffff"])
@pytest.mark.parametrize("fill", ["--hd-climate-icon", "--hd-security-icon", "--hd-appliance-icon"])
def test_white_icons_stand_out_from_their_circles(dark, ink, fill):
    mount(dark)
    assert contrast(ink, token(dark, fill)) >= CONTRAST_ICON


def test_no_light_surface_is_left_on_the_page(dark_tablet):
    mount(dark_tablet)
    bright = dark_tablet.evaluate("""() => {
        const walk = (root) => [...root.querySelectorAll("*")].flatMap((node) =>
            [node, ...(node.shadowRoot ? walk(node.shadowRoot) : [])]);
        return walk(window.card.shadowRoot).concat(walk(document.querySelector("home-dashboard-chrome").shadowRoot))
            .filter((node) => {
                const match = getComputedStyle(node).backgroundColor.match(/^rgb\\((\\d+), (\\d+), (\\d+)\\)/);
                return match && match.slice(1).every((value) => Number(value) > 200)
                    && !node.closest?.(".icon");
            })
            .map((node) => `${node.localName}.${node.className}`);
    }""")
    assert bright == []


def test_the_message_field_is_dark_too(dark):
    mount(dark, {"intercom": {"script": "script.announce", "areas": ["x"]}})
    area = dark.evaluate("Object.keys(window.dashboard.snapshot.areas)[0]")
    mount(dark, {"intercom": {"script": "script.announce", "areas": [area]}})
    dark.locator("[data-intercom-all]").first.click()
    field = dark.locator("home-dashboard-sheet home-dashboard-intercom input")
    assert field.evaluate("(input) => getComputedStyle(input).backgroundColor") == "rgb(30, 31, 36)"


def view_rule(page) -> str:
    return page.evaluate("""async () => {
        const { viewBackground } = await import("/custom_components/home_dashboard/www/app/styles.js");
        return viewBackground();
    }""")


def push_mode(page, mode: str) -> None:
    page.evaluate(
        """(mode) => document.querySelector("home-dashboard-chrome")._applySettings({ color_mode: mode })""",
        mode,
    )


def test_the_chosen_mode_beats_a_light_system(phone):
    mount(phone)
    push_mode(phone, "dark")
    assert token(phone, "--hd-background") == "#121316"
    assert "@media" not in view_rule(phone)
    assert "#121316" in view_rule(phone)


def test_the_chosen_mode_beats_a_dark_system(dark):
    mount(dark)
    push_mode(dark, "light")
    assert token(dark, "--hd-background") == "#fbfaff"
    assert "#121316" not in view_rule(dark)


def test_automatic_goes_back_to_the_system(dark):
    mount(dark)
    push_mode(dark, "light")
    push_mode(dark, "auto")
    assert token(dark, "--hd-background") == "#121316"


def test_the_change_reaches_an_open_sheet(phone):
    mount(phone)
    phone.locator("[data-rooms]").click()
    phone.wait_for_selector("home-dashboard-sheet section.panel")
    push_mode(phone, "dark")
    background = phone.locator("home-dashboard-sheet .backdrop").evaluate(
        "(cover) => getComputedStyle(cover).backgroundColor"
    )
    assert as_rgb(background) == "rgb(18, 19, 22)"


def test_the_page_opens_with_the_last_mode_before_it_connects(phone, base_url):
    mount(phone)
    push_mode(phone, "dark")
    phone.goto(f"{base_url}/tests/js/harness.html")
    phone.wait_for_function("window.dashboardReady === true")
    colours = phone.evaluate("""async () => {
        const { tokens } = await import("/custom_components/home_dashboard/www/app/styles.js");
        return tokens.cssText;
    }""")
    assert "color-scheme: dark" in colours


def test_the_page_subscribes_once_and_stops_when_it_goes(phone):
    count = phone.evaluate("""async () => {
        let subscribed = 0;
        let stopped = 0;
        const hass = window.dashboard.hass();
        hass.connection.subscribeMessage = async () => {
            subscribed += 1;
            return () => { stopped += 1; };
        };
        window.hass = hass;
        window.card = await window.dashboard.mount(hass, {}, "home");
        const chrome = document.querySelector("home-dashboard-chrome");
        chrome.hass = { ...hass };
        await chrome.updateComplete;
        chrome.remove();
        await new Promise((resolve) => setTimeout(resolve));
        return { subscribed, stopped };
    }""")
    assert count == {"subscribed": 1, "stopped": 1}


def test_an_older_integration_leaves_the_page_on_automatic(phone):
    phone.evaluate("""async () => {
        const hass = window.dashboard.hass();
        hass.connection.subscribeMessage = async () => { throw new Error("unknown_command"); };
        window.hass = hass;
        window.card = await window.dashboard.mount(hass, {}, "home");
    }""")
    phone.wait_for_selector("home-dashboard-chrome", state="attached")
    assert token(phone, "--hd-background") == "#fbfaff"


def test_the_map_follows_the_chosen_mode(phone):
    mount(phone)
    push_mode(phone, "dark")
    mount(phone, None, "map")
    phone.wait_for_function("window.createdCards.some((card) => card.type === 'map')")
    assert phone.evaluate("window.createdCards.find((card) => card.type === 'map').theme_mode") == "dark"


def test_the_map_follows_the_system(dark):
    dark.evaluate("""async () => {
        window.hass = window.dashboard.hass();
        window.card = await window.dashboard.mount(window.hass, {}, "map");
    }""")
    dark.wait_for_function("window.createdCards.length > 0")
    assert dark.evaluate("window.createdCards[0].theme_mode") == "dark"


def open_look(page) -> None:
    mount_admin(page, {})
    open_background(page)
    page.wait_for_selector(f"{SHEET} [data-color-modes]")


def test_someone_chooses_a_dark_look_for_themselves(phone):
    open_look(phone)
    phone.locator(f"{SHEET} [data-color-mode='dark']").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'frontend/set_user_data')")
    assert phone.evaluate("window.saved.at(-1).value.color_mode") == "dark"
    assert token(phone, "--hd-background") == "#121316"
    assert "on" in phone.locator(f"{SHEET} [data-color-mode='dark']").get_attribute("class")


def test_a_personal_look_beats_the_option_of_the_integration(phone):
    open_look(phone)
    phone.locator(f"{SHEET} [data-color-mode='dark']").click()
    push_mode(phone, "light")
    assert token(phone, "--hd-background") == "#121316"


def test_the_system_look_can_be_chosen_back(phone):
    open_look(phone)
    phone.locator(f"{SHEET} [data-color-mode='dark']").click()
    phone.locator(f"{SHEET} [data-color-mode='auto']").click()
    assert phone.evaluate("window.saved.at(-1).value.color_mode") == "auto"
    assert token(phone, "--hd-background") != "#121316"


def test_without_a_choice_the_option_of_the_integration_holds(phone):
    open_look(phone)
    push_mode(phone, "dark")
    assert token(phone, "--hd-background") == "#121316"


def test_the_three_looks_stand_in_one_row(phone):
    open_look(phone)
    tops = phone.locator(f"{SHEET} [data-color-mode]").evaluate_all(
        "(items) => items.map((item) => Math.round(item.getBoundingClientRect().top))"
    )
    assert len(set(tops)) == 1
