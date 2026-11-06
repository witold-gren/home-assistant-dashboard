"""The rendered page: behaviour, safety and layout on both screen sizes."""

from __future__ import annotations

from pathlib import Path

import pytest

from .conftest import OUTPUT

MOUNT = """async ({ dashboard, page }) => {
    window.hass = window.dashboard.hass();
    window.card = await window.dashboard.mount(window.hass, dashboard ?? {}, page ?? "home");
}"""


def mount(page, dashboard=None, name="home"):
    page.evaluate(MOUNT, {"dashboard": dashboard, "page": name})
    page.wait_for_function("document.querySelector('home-dashboard-chrome') !== null")


def shot(page, name: str) -> None:
    OUTPUT.mkdir(exist_ok=True)
    page.screenshot(path=Path(OUTPUT, f"{name}.png"))


def first_entity(page, prefix: str) -> str:
    return page.evaluate(
        """(prefix) => [...window.card.shadowRoot.querySelectorAll("[data-entity]")]
            .map((tile) => tile.dataset.entity).find((id) => id.startsWith(prefix))""",
        prefix,
    )


def test_opening_the_page_starts_no_stream_and_calls_nothing(phone):
    mount(phone)
    assert phone.evaluate("window.hass.calls") == []
    media = phone.evaluate("""() => {
        const root = window.card.shadowRoot;
        return { streams: root.querySelectorAll("video, ha-camera-stream, hui-image").length,
                 pictures: [...root.querySelectorAll(".camera img")].map((img) => img.getAttribute("src")) };
    }""")
    assert media["streams"] == 0
    assert media["pictures"]
    assert phone.evaluate("""() => {
        const { hass } = window;
        const shown = [...window.card.shadowRoot.querySelectorAll(".camera")].map((tile) => tile.ariaLabel);
        const battery = Object.keys(hass.entities).filter(
            (id) => id.startsWith("camera.") && hass.entities[id].platform !== "frigate");
        return battery.filter((id) => shown.includes(hass.states[id].attributes.friendly_name ?? id));
    }""") == []


def test_icon_toggles_a_light_and_the_tile_opens_its_sheet(phone):
    mount(phone)
    light = first_entity(phone, "light.")
    phone.evaluate("""() => {
        window.moreInfo = [];
        window.addEventListener("hass-more-info", (event) => window.moreInfo.push(event.detail.entityId));
    }""")
    tile = f"home-dashboard-page [data-entity='{light}']"
    phone.locator(f"{tile} .icon").click()
    assert phone.evaluate("window.hass.calls") == [
        {"type": "service", "domain": "homeassistant", "service": "toggle", "data": {"entity_id": light}}
    ]
    assert phone.evaluate("window.moreInfo") == []
    phone.locator(f"{tile} .text").click()
    phone.wait_for_selector("home-dashboard-sheet section.panel[data-kind='light']")
    assert phone.evaluate("window.moreInfo") == []
    assert len(phone.evaluate("window.hass.calls")) == 1


def test_cover_icon_does_not_move_the_cover(phone):
    mount(phone)
    cover = first_entity(phone, "cover.")
    phone.locator(f"home-dashboard-page [data-entity='{cover}'] .icon").click()
    assert phone.evaluate("window.hass.calls") == []


RENDER_COUNTER = """() => {
    const card = window.card;
    window.renders = 0;
    const original = card.render.bind(card);
    card.render = () => { window.renders += 1; return original(); };
}"""


def test_unrelated_state_change_does_not_render(phone):
    mount(phone)
    phone.evaluate(RENDER_COUNTER)
    renders = phone.evaluate("""async () => {
        const unrelated = Object.keys(window.hass.states).find((id) => id.startsWith("switch."));
        window.card.hass = window.dashboard.withState(window.hass, unrelated, { state: "on" });
        await window.card.updateComplete;
        return window.renders;
    }""")
    assert renders == 0


def test_watched_state_change_updates_the_tile(phone):
    mount(phone)
    light = first_entity(phone, "light.")
    text = phone.evaluate(
        """async (id) => {
            const stateObj = window.hass.states[id];
            window.card.hass = window.dashboard.withState(window.hass, id, {
                state: "on", attributes: { ...stateObj.attributes, brightness: 128 } });
            await window.card.updateComplete;
            return window.card.shadowRoot.querySelector(`[data-entity="${id}"] .text`).textContent;
        }""",
        light,
    )
    assert "50%" in text


def test_registry_change_rebuilds_the_selection(phone):
    mount(phone)
    light = first_entity(phone, "light.")
    gone = phone.evaluate(
        """async (id) => {
            const entities = { ...window.hass.entities, [id]: { ...window.hass.entities[id], hidden: true } };
            window.card.hass = { ...window.hass, entities };
            await window.card.updateComplete;
            return !window.card.shadowRoot.querySelector(`[data-entity="${id}"]`);
        }""",
        light,
    )
    assert gone


def test_phone_layout(phone):
    mount(phone, {"favorites": []})
    result = phone.evaluate("""() => {
        const root = window.card.shadowRoot;
        const nav = document.querySelector("home-dashboard-chrome").shadowRoot.querySelector("nav");
        const tiles = getComputedStyle(root.querySelector(".tiles")).gridTemplateColumns.split(" ").length;
        const box = nav.getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth - window.innerWidth, tiles,
                 navBottom: box.bottom, navWidth: box.width, height: window.innerHeight };
    }""")
    shot(phone, "phone-home")
    assert result["overflow"] <= 0
    assert result["tiles"] == 2
    assert result["navBottom"] == result["height"]
    assert result["navWidth"] == 402


def test_tablet_layout(tablet):
    tablet.evaluate("document.body.style.paddingLeft = '88px'")
    mount(tablet)
    result = tablet.evaluate("""() => {
        const root = window.card.shadowRoot;
        const nav = document.querySelector("home-dashboard-chrome").shadowRoot.querySelector("nav").getBoundingClientRect();
        const strip = root.querySelector(".cameras").getBoundingClientRect();
        const firstRoom = root.querySelector("section[data-room]").getBoundingClientRect();
        const chips = root.querySelector(".chips").getBoundingClientRect();
        const page = root.querySelector(".page").getBoundingClientRect();
        const tiles = getComputedStyle(root.querySelector(".tiles")).gridTemplateColumns.split(" ").length;
        return { navWidth: nav.width, navHeight: nav.height,
                 stripBetween: strip.top >= chips.bottom && strip.bottom <= firstRoom.top,
                 stripFills: strip.width >= page.width - 48, roomWidth: firstRoom.width, tiles,
                 topBar: getComputedStyle(root.querySelector(".top-bar")).display,
                 overflow: document.documentElement.scrollWidth - window.innerWidth };
    }""")
    shot(tablet, "tablet-home")
    assert result["navWidth"] == 88
    assert result["navHeight"] == 820
    assert result["stripBetween"] is True
    assert result["stripFills"] is True
    assert result["roomWidth"] >= 1000
    assert result["tiles"] >= 5
    assert result["topBar"] == "none"
    assert result["overflow"] <= 0


def test_navigation_goes_to_the_view_path(phone):
    mount(phone)
    result = phone.evaluate("""() => {
        window.locations = 0;
        window.addEventListener("location-changed", () => { window.locations += 1; });
        document.querySelector("home-dashboard-chrome").shadowRoot.querySelector('[data-page="energy"]').click();
        return [window.location.pathname, window.locations];
    }""")
    assert result == ["/tests/energy", 1]


def test_chrome_replaces_the_header_inside_hui_root(phone):
    result = phone.evaluate("""async () => {
        const root = document.createElement("hui-root");
        const shadow = root.attachShadow({ mode: "open" });
        shadow.innerHTML = '<div class="header">x</div><div id="view" style="padding-top: 56px"></div>';
        document.body.appendChild(root);
        const hass = window.dashboard.hass();
        await window.dashboard.mount(hass, {}, "home", shadow.querySelector("#view"));
        await window.dashboard.mount(hass, {}, "media", shadow.querySelector("#view"));
        return { chromes: shadow.querySelectorAll("home-dashboard-chrome").length,
                 page: shadow.querySelector("home-dashboard-chrome").page,
                 header: getComputedStyle(shadow.querySelector(".header")).display,
                 padding: getComputedStyle(shadow.querySelector("#view")).paddingTop,
                 inBody: document.body.querySelectorAll(":scope > home-dashboard-chrome").length };
    }""")
    assert result == {"chromes": 1, "page": "media", "header": "none", "padding": "0px", "inBody": 0}


def test_debug_report_measures_the_bottom_of_the_screen(phone):
    mount(phone)
    report = phone.evaluate("""() => {
        const nav = document.querySelector("home-dashboard-chrome").shadowRoot.querySelector("nav");
        return window.dashboard.chrome.layoutReport(nav, null);
    }""")
    assert report["inner"] == "402x874"
    assert report["nav_bottom"] == 874
    assert report["env_bottom"] == 0


def test_energy_page_says_when_it_is_not_set_up(phone):
    mount(phone, None, "energy")
    phone.wait_for_function("window.card.shadowRoot.textContent.includes('nie jest skonfigurowany')")
    assert "Energia" in phone.evaluate("window.card.shadowRoot.textContent")


# Camera strip ---------------------------------------------------------------------------------


def strip_state(page):
    return page.evaluate("""() => {
        const strip = window.card.shadowRoot.querySelector(".cameras");
        return { left: strip.scrollLeft, room: strip.scrollWidth - strip.clientWidth,
                 tiles: strip.querySelectorAll(".camera").length,
                 overflow: document.documentElement.scrollWidth - window.innerWidth };
    }""")


@pytest.mark.parametrize("size", ["phone", "tablet"])
def test_camera_strip_scrolls_sideways_without_moving_the_page(size, request):
    page = request.getfixturevalue(size)
    mount(page)
    before = strip_state(page)
    assert before["tiles"] > 3
    assert before["room"] > 0
    box = page.evaluate("""() => {
        const strip = window.card.shadowRoot.querySelector(".cameras").getBoundingClientRect();
        return [strip.left + strip.width / 2, strip.top + strip.height / 2];
    }""")
    page.mouse.move(*box)
    page.mouse.wheel(600, 0)
    page.wait_for_timeout(200)
    after = strip_state(page)
    assert after["left"] > 0
    assert after["overflow"] <= 0


def test_last_camera_can_be_reached_and_opened(phone):
    mount(phone)
    phone.evaluate("""() => {
        const strip = window.card.shadowRoot.querySelector(".cameras");
        strip.scrollLeft = strip.scrollWidth;
    }""")
    phone.locator("home-dashboard-page .camera:not(.offline)").last.click()
    phone.wait_for_timeout(100)
    assert phone.evaluate("""() => document.querySelector("home-dashboard-chrome").shadowRoot
        .querySelector("home-dashboard-sheet").sheet.kind""") == "camera"


def test_every_camera_shows_how_old_its_picture_is(phone):
    mount(phone)
    labels = phone.evaluate("""() =>
        [...window.card.shadowRoot.querySelectorAll(".camera .age")].map((label) => label.textContent)""")
    assert labels
    assert "teraz" in labels
    assert all(labels)


def test_refresh_reloads_current_pictures_and_leaves_stored_ones(phone):
    mount(phone)
    result = phone.evaluate("""async () => {
        const sources = () => [...window.card.shadowRoot.querySelectorAll(".camera img")].map((img) => img.src);
        const before = sources();
        window.card._refreshPictures();
        await window.card.updateComplete;
        const after = sources();
        return { changed: after.filter((src, index) => src !== before[index]),
                 kept: after.filter((src, index) => src === before[index]) };
    }""")
    assert result["changed"]
    assert all("camera." in src and "tick=" in src for src in result["changed"])
    assert result["kept"]
    assert all("image." in src for src in result["kept"])
