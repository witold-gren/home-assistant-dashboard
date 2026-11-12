"""What moves: sheets, the blind on its way, the fixed background and the change of a filter."""

from __future__ import annotations

import pytest

from .test_controls import controls
from .test_page import mount
from .test_sheets import find_id, open_tile, playing_speaker, service_calls, set_state

SHEET = "home-dashboard-sheet"
OPEN_STOP_AND_POSITION = 15
NO_STOP = 7



def as_rgb(value: str) -> str:
    """A colour mixed for the opacity of the look is written as srgb; the same colour as rgb."""
    if not value.startswith("color(srgb "):
        return value
    red, green, blue = (round(float(part) * 255) for part in value[len("color(srgb "):-1].split()[:3])
    return f"rgb({red}, {green}, {blue})"

def touch(page, points: list[tuple[float, float]]) -> None:
    """A real finger: the browser decides about scrolling and clicks as it would on a phone."""
    client = page.context.new_cdp_session(page)
    x, y = points[0]
    client.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
    for x, y in points[1:]:
        client.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y}]})
        page.wait_for_timeout(30)
    client.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


def settled_box(page, selector: str) -> dict:
    page.wait_for_timeout(400)
    return page.locator(selector).bounding_box()


def open_cover(page, position: int = 0, state: str = "closed", features: int = OPEN_STOP_AND_POSITION) -> str:
    cover = find_id(page, "cover.")
    set_state(page, cover, state, {"current_position": position, "supported_features": features})
    mount(page)
    page.locator(f"home-dashboard-page [data-entity='{cover}'] .text").click()
    page.wait_for_selector(f"{SHEET} .panel")
    return cover


def blind_height(page) -> float:
    return page.locator(f"{SHEET} .blind").evaluate("(blind) => parseFloat(blind.style.height)")


# The blind ------------------------------------------------------------------------------------


def test_the_estimate_follows_the_clock_and_stops_at_the_target(phone):
    assert controls(
        phone,
        """(() => {
            const motion = c.startCoverMotion(0, 100, 1000);
            const half = c.COVER_TRAVEL_MS / 2;
            return [c.coverEstimate(motion, 1000), c.coverEstimate(motion, 1000 + half),
                    c.coverEstimate(motion, 1000 + half * 9)];
        })()""",
    ) == [0, 50, 100]


def test_a_short_way_takes_a_short_time(phone):
    assert controls(phone, "c.startCoverMotion(40, 50, 0).duration / c.COVER_TRAVEL_MS") == pytest.approx(0.1)


def test_a_blind_seen_moving_is_estimated_from_when_it_started(phone):
    assert controls(
        phone,
        """(() => {
            const stateObj = { state: "closing", last_changed: "2026-11-06T10:00:00Z", attributes: { current_position: 100 } };
            const motion = c.followCover(null, stateObj, Date.parse("2026-11-06T10:00:10Z"));
            return [motion.from, motion.to, motion.started === Date.parse(stateObj.last_changed)];
        })()""",
    ) == [100, 0, True]


def test_the_estimate_ends_when_the_entity_reports_the_stop(phone):
    assert controls(
        phone,
        """(() => {
            const moving = { state: "opening", attributes: { current_position: 0 } };
            const seen = c.followCover(c.startCoverMotion(0, 100, 0), moving, 10);
            return c.followCover(seen, { state: "open", attributes: { current_position: 0 } }, 20);
        })()""",
    ) is None


def test_a_blind_that_never_reports_moving_is_estimated_until_its_position_changes(phone):
    assert controls(
        phone,
        """(() => {
            const motion = c.startCoverMotion(0, 100, 0);
            const still = { state: "closed", attributes: { current_position: 0 } };
            const arrived = { state: "open", attributes: { current_position: 100 } };
            return [c.followCover(motion, still, 1000) === motion, c.followCover(motion, arrived, 2000),
                    c.followCover(motion, still, c.COVER_TRAVEL_MS + 60000)];
        })()""",
    ) == [True, None, None]


def test_a_blind_turned_back_starts_from_where_it_seems_to_be(phone):
    assert controls(
        phone,
        """(() => {
            const motion = c.startCoverMotion(0, 100, 0);
            const closing = { state: "closing", attributes: { current_position: 0 } };
            const turned = c.followCover(motion, closing, c.COVER_TRAVEL_MS / 2);
            return [turned.from, turned.to];
        })()""",
    ) == [50, 0]


def test_the_blind_moves_as_soon_as_the_button_is_pressed(phone):
    open_cover(phone)
    assert blind_height(phone) == 100
    phone.locator(f"{SHEET} .actions button").first.click()
    assert service_calls(phone) == [("cover", "open_cover")]
    phone.wait_for_function(
        """() => document.querySelector("home-dashboard-chrome").shadowRoot.querySelector("home-dashboard-sheet")
            .shadowRoot.querySelector(".info").textContent.includes("Otwieranie")"""
    )
    phone.wait_for_timeout(1000)
    assert blind_height(phone) < 100
    assert "moving" in phone.locator(f"{SHEET} .actions button").first.get_attribute("class")


def test_a_blind_already_on_its_way_shows_the_progress(phone):
    cover = find_id(phone, "cover.")
    phone.evaluate(
        "(id) => { window.dashboard.snapshot.states[id].last_changed = new Date(Date.now() - 17500).toISOString(); }",
        cover,
    )
    open_cover(phone, 0, "opening")
    assert 40 < 100 - blind_height(phone) < 70


def test_stop_holds_the_blind_where_it_seems_to_be(phone):
    open_cover(phone)
    phone.locator(f"{SHEET} .actions button").first.click()
    phone.wait_for_timeout(1000)
    phone.locator(f"{SHEET} .actions button").nth(1).click()
    # The last step of the movement may still be drawn under load: read where it stopped once it has.
    phone.wait_for_timeout(300)
    held = blind_height(phone)
    phone.wait_for_timeout(600)
    assert blind_height(phone) == held
    assert held < 100
    assert ("cover", "stop_cover") in service_calls(phone)


def test_a_blind_without_stop_has_the_button_off(phone):
    open_cover(phone, features=NO_STOP)
    assert phone.locator(f"{SHEET} .actions button").nth(1).is_disabled()


# Sheets ---------------------------------------------------------------------------------------


def covers_the_screen(page) -> bool:
    box = settled_box(page, f"{SHEET} section.panel")
    size = page.viewport_size
    return (box["x"], box["y"], box["width"], box["height"]) == (0, 0, size["width"], size["height"])


@pytest.mark.parametrize("prefix", ["climate.", "cover."])
def test_every_control_sheet_opens_on_the_whole_screen_of_a_phone(phone, prefix):
    mount(phone)
    open_tile(phone, find_id(phone, prefix))
    assert covers_the_screen(phone)
    assert phone.locator(f"{SHEET} [data-grip]").is_visible()


def test_the_player_opens_on_the_whole_screen_of_a_phone(phone):
    playing_speaker(phone)
    mount(phone)
    phone.locator(".mini-open").click()
    phone.wait_for_selector(f"{SHEET} .panel")
    assert covers_the_screen(phone)
    assert phone.locator(f"{SHEET} [data-grip]").count() == 1


def test_a_sheet_follows_the_light_or_dark_page_and_a_camera_stays_black(phone):
    mount(phone, {})
    colour = "(element) => getComputedStyle(element).backgroundColor"
    open_tile(phone, find_id(phone, "cover."))
    page_colour = phone.evaluate("getComputedStyle(window.card).backgroundColor")
    # On a phone the cover under the panel carries the background, so a see-through look is laid once.
    assert as_rgb(phone.locator(f"{SHEET} .backdrop").evaluate(colour)) == page_colour
    phone.locator(f"{SHEET} header button").first.click()
    phone.wait_for_selector(f"{SHEET} section.panel", state="detached")
    phone.locator("home-dashboard-page .camera").first.click()
    phone.wait_for_selector(f"{SHEET} section.panel")
    assert phone.locator(f"{SHEET} section.panel").evaluate(colour) == "rgb(23, 24, 26)"


def test_a_sheet_on_a_tablet_stays_a_window_in_the_middle(tablet):
    mount(tablet)
    open_tile(tablet, find_id(tablet, "cover."))
    box = settled_box(tablet, f"{SHEET} section.panel")
    assert box["width"] == 520
    assert tablet.locator(f"{SHEET} .backdrop").is_hidden()


def test_the_handle_takes_the_sheet_down_with_a_mouse(phone):
    open_cover(phone)
    grip = settled_box(phone, f"{SHEET} [data-grip]")
    phone.mouse.move(grip["x"] + 100, grip["y"] + 8)
    phone.mouse.down()
    phone.mouse.move(grip["x"] + 100, grip["y"] + 400, steps=8)
    phone.mouse.up()
    phone.wait_for_selector(f"{SHEET} section.panel", state="detached")


def test_a_finger_on_the_sheet_pulls_it_down_and_closes_it(moving_phone):
    open_cover(moving_phone)
    box = settled_box(moving_phone, f"{SHEET} header")
    x, y = box["x"] + 160, box["y"] + 30
    touch(moving_phone, [(x, y + step * 40) for step in range(10)])
    moving_phone.wait_for_selector(f"{SHEET} section.panel", state="detached")
    assert moving_phone.evaluate("history.state?.homeDashboardOverlay") in (None, False)


def test_a_short_pull_puts_the_sheet_back(moving_phone):
    open_cover(moving_phone)
    before = settled_box(moving_phone, f"{SHEET} section.panel")
    x, y = before["x"] + 160, before["y"] + 50
    client_points = [(x, y), (x, y + 10), (x, y + 20)]
    moving_phone.wait_for_timeout(100)
    touch(moving_phone, client_points)
    moving_phone.wait_for_timeout(100)
    assert settled_box(moving_phone, f"{SHEET} section.panel")["y"] == before["y"]


def test_the_slider_of_a_blind_keeps_the_finger_for_itself(moving_phone):
    open_cover(moving_phone)
    box = settled_box(moving_phone, f"{SHEET} [data-slider]")
    x, y = box["x"] + box["width"] / 2, box["y"] + 10
    touch(moving_phone, [(x, y + step * 25) for step in range(10)])
    moving_phone.wait_for_timeout(400)
    assert moving_phone.locator(f"{SHEET} section.panel").count() == 1


def test_the_close_button_lets_the_sheet_slide_away_first(moving_phone):
    open_cover(moving_phone)
    settled_box(moving_phone, f"{SHEET} section.panel")
    moving_phone.locator(f"{SHEET} header button").first.click()
    assert moving_phone.locator(f"{SHEET} section.panel").count() == 1
    moving_phone.wait_for_selector(f"{SHEET} section.panel", state="detached")


# Mini player ----------------------------------------------------------------------------------


@pytest.mark.parametrize("name", ["home", "media"])
def test_the_mini_player_is_on_the_other_pages(phone, name):
    playing_speaker(phone)
    mount(phone, None, name)
    assert phone.locator("[data-mini]").count() == 1


# The map and the energy page need the bottom of the screen for their own panel and lists.
@pytest.mark.parametrize("name", ["energy", "map"])
def test_the_mini_player_keeps_off_the_map_and_energy(phone, name):
    playing_speaker(phone)
    mount(phone, None, name)
    phone.wait_for_timeout(200)
    assert phone.locator("[data-mini]").count() == 0


def test_music_assistant_keeps_its_own_player_on_the_music_page(phone):
    playing_speaker(phone)
    mount(phone, {"music": {"frame": "about:blank"}}, "music")
    assert phone.locator("[data-mini]").count() == 0


# Background -----------------------------------------------------------------------------------


def test_the_background_stands_still_while_the_page_scrolls(phone):
    mount(phone, {"background": "#223344"})
    measure = """() => window.card.shadowRoot.querySelector(".backdrop").getBoundingClientRect().top"""
    assert phone.evaluate(measure) == 0
    for position in (200, 700):
        phone.evaluate("(y) => window.scrollTo(0, y)", position)
        assert phone.evaluate("scrollY") == position
        assert phone.evaluate(measure) == 0


def test_the_background_reaches_the_end_of_the_page_without_moving(phone):
    mount(phone, {"background": "#223344"})
    phone.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    box = phone.evaluate("""() => {
        const { top, bottom } = window.card.shadowRoot.querySelector(".backdrop").getBoundingClientRect();
        return [top, bottom >= innerHeight];
    }""")
    assert box == [0, True]


def test_the_background_adds_nothing_to_the_length_of_the_page(phone):
    mount(phone, {"background": "#223344"})
    end_of_page, length = phone.evaluate("""() => [
        window.card.shadowRoot.querySelector(".page").getBoundingClientRect().bottom + scrollY,
        document.documentElement.scrollHeight,
    ]""")
    assert length <= end_of_page


# Scrolling and the area around the page --------------------------------------------------------


def styles(page, body: str):
    return page.evaluate(f"""async () => {{
        const s = await import("/custom_components/home_dashboard/www/app/styles.js");
        return {body};
    }}""")


def chrome_module(page, body: str):
    return page.evaluate(f"""async () => {{
        const c = await import("/custom_components/home_dashboard/www/app/chrome.js");
        return {body};
    }}""")


def test_the_view_scrolls_instead_of_the_document(phone):
    css = chrome_module(phone, "c.rootStyle()")
    assert "overflow-y: auto" in css
    assert "height: 100dvh" in css


def test_the_scroller_is_the_view_when_there_is_one(phone):
    assert phone.evaluate("""async () => {
        const c = await import("/custom_components/home_dashboard/www/app/chrome.js");
        const root = document.createElement("hui-root");
        root.attachShadow({ mode: "open" }).innerHTML = '<div id="view"><p></p></div>';
        document.body.append(root);
        const found = c.pageScroller(root.shadowRoot.querySelector("p")).id;
        root.remove();
        return [found, c.pageScroller(document.body) === window];
    }""") == ["view", True]


def test_the_page_ends_soon_after_the_bar_when_nothing_plays(phone):
    mount(phone)
    assert phone.evaluate("""() => {
        const page = window.card.shadowRoot.querySelector(".page");
        return parseFloat(getComputedStyle(page).paddingBottom);
    }""") < 100


def test_the_page_leaves_room_for_the_mini_player(phone):
    playing_speaker(phone)
    mount(phone)
    assert phone.evaluate("""() => {
        const page = window.card.shadowRoot.querySelector(".page");
        return parseFloat(getComputedStyle(page).paddingBottom);
    }""") > 150


def test_the_veil_of_the_theme_is_mixed_into_a_background(phone):
    assert styles(phone, 's.veiled("#000000", "#ffffff")') == "#999999"


@pytest.mark.parametrize(
    ("background", "expected"),
    [("linear-gradient(160deg, #000000, #ffffff)", "#000000"), ("#000000", "#000000")],
)
def test_the_area_over_the_page_continues_the_top_of_the_background(phone, background, expected):
    assert styles(phone, f's.backgroundTop("{background}")') == styles(phone, f's.veiled("{expected}")')


def app_messages(page):
    page.evaluate("""() => {
        window.appColours = [];
        window.webkit = { messageHandlers: { updateThemeColors: { postMessage: (m) => window.appColours.push(m) } } };
    }""")


def test_the_ios_app_gets_the_colour_of_the_page(phone):
    app_messages(phone)
    mount(phone, {"background": "#000000"})
    phone.wait_for_function("window.appColours.length > 0")
    phone.wait_for_timeout(200)
    expected = styles(phone, 's.veiled("#000000")')
    assert phone.evaluate("window.appColours.at(-1)['--primary-background-color']") == expected


def test_the_ios_app_gets_black_around_a_camera(phone):
    app_messages(phone)
    mount(phone)
    phone.locator("home-dashboard-page .camera").first.click()
    phone.wait_for_selector(f"{SHEET} .panel")
    phone.wait_for_function("window.appColours.at(-1)['--primary-background-color'] === '#17181a'")


def stub_home_assistant(page):
    page.evaluate("""() => {
        const app = document.createElement("home-assistant");
        app.hass = { selectedTheme: { theme: "tablet" } };
        app.themeChanges = [];
        app._updateHass = (change) => { app.hass = { ...app.hass, ...change }; };
        app._applyTheme = () => app.themeChanges.push(app.hass.selectedTheme);
        document.body.append(app);
    }""")


def test_dialogs_of_home_assistant_are_light_on_a_light_page(phone):
    stub_home_assistant(phone)
    mount(phone)
    assert phone.evaluate("document.querySelector('home-assistant').themeChanges.at(-1)") == {
        "theme": "default",
        "dark": False,
    }


def test_leaving_the_dashboard_brings_the_users_theme_back(phone):
    stub_home_assistant(phone)
    mount(phone)
    assert phone.evaluate("""() => {
        document.querySelector("home-dashboard-chrome").remove();
        return document.querySelector("home-assistant").hass.selectedTheme;
    }""") == {"theme": "tablet"}


# Filters --------------------------------------------------------------------------------------


def test_a_filter_fades_the_old_content_while_the_new_one_rises(moving_phone):
    mount(moving_phone)
    moving_phone.locator("[data-chip='lights']").click()
    moving_phone.wait_for_selector("home-dashboard-page .stage-old", state="attached")
    result = moving_phone.evaluate("""() => {
        const root = window.card.shadowRoot;
        return [
            root.querySelector(".stage-old").getAnimations().length,
            [...root.querySelector(".stage-now").children].some((child) => child.getAnimations().length),
            root.querySelector(".title-old")?.textContent.length > 0,
        ];
    }""")
    assert result == [1, True, True]


def test_lower_content_rises_from_further_away(moving_phone):
    mount(moving_phone)
    moving_phone.locator("[data-chip='lights']").click()
    moving_phone.wait_for_selector("home-dashboard-page .stage-old", state="attached")
    distances = moving_phone.evaluate("""() => [...window.card.shadowRoot.querySelector(".stage-now").children]
        .flatMap((child) => child.getAnimations())
        .map((animation) => new DOMMatrix(animation.effect.getKeyframes()[0].transform).m42)""")
    assert len(distances) > 1
    assert distances == sorted(distances)
    assert distances[0] < distances[-1]


def test_the_old_content_is_gone_after_the_change(moving_phone):
    mount(moving_phone)
    moving_phone.locator("[data-chip='lights']").click()
    moving_phone.wait_for_selector("home-dashboard-page .stage-old", state="attached")
    moving_phone.wait_for_selector("home-dashboard-page .stage-old", state="detached")
    assert moving_phone.locator("home-dashboard-page .title-old").count() == 0


def test_the_old_content_cannot_be_tapped(moving_phone):
    mount(moving_phone)
    moving_phone.locator("[data-chip='lights']").click()
    moving_phone.wait_for_selector("home-dashboard-page .stage-old", state="attached")
    assert moving_phone.locator("home-dashboard-page .stage-old").evaluate(
        "(old) => [old.inert, getComputedStyle(old).pointerEvents]"
    ) == [True, "none"]


def test_two_quick_taps_end_on_the_right_page(moving_phone):
    mount(moving_phone)
    moving_phone.locator("[data-chip='lights']").click()
    moving_phone.locator("[data-chip='lights']").click()
    moving_phone.wait_for_selector("home-dashboard-page .stage-old", state="detached")
    assert moving_phone.locator("home-dashboard-page .camera").count() > 0
    assert "filter" not in moving_phone.url


def test_without_animations_the_filter_changes_at_once(phone):
    mount(phone)
    phone.locator("[data-chip='lights']").click()
    assert phone.locator("home-dashboard-page .stage-old").count() == 0
