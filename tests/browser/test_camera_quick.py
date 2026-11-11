"""Quick buttons of a camera: siren (asks first), light and night vision, under the picture upright and in the
bottom left corner on a phone on its side, from the bottom."""

from __future__ import annotations

from .test_camera_controls import ADD_DEVICE
from .test_shortcuts import mount_admin

SHEET = "home-dashboard-sheet"

ADD_QUICK = """(things) => {
    const snapshot = window.dashboard.snapshot;
    const add = (id, state, attributes = {}) => {
        snapshot.entities[id] = { entity_id: id, device_id: "ptz_device", hidden: false };
        snapshot.states[id] = { entity_id: id, state, attributes: { friendly_name: id, ...attributes } };
    };
    if (things.includes("siren")) add("siren.slup_siren", "off");
    if (things.includes("light")) add("switch.slup_light", "off");
    if (things.includes("night")) add("select.slup_night_vision", "Infrared", { options: ["Off", "Infrared", "Full Color"] });
    add("switch.slup_spotlight_enabled", "on");
}"""


def open_camera(page, things=("siren", "light", "night"), viewport=None) -> None:
    if viewport:
        page.set_viewport_size(viewport)
    page.evaluate(ADD_DEVICE)
    page.evaluate(ADD_QUICK, list(things))
    mount_admin(page, {"cameras": {"tiles": ["image.slup_last_screen"]}})
    page.evaluate("""() => document.querySelector('home-dashboard-chrome')
        .open({ type: 'sheet', sheet: { kind: 'camera', entityId: 'image.slup_last_screen' } })""")
    page.wait_for_selector(f"{SHEET} home-dashboard-timeline", state="attached")


def quick_keys(page) -> list:
    return page.locator(f"{SHEET} [data-quick-bar] [data-quick]").evaluate_all("(buttons) => buttons.map((b) => b.dataset.quick)")


def services(page) -> list:
    return page.evaluate("window.hass.calls.filter((c) => c.type === 'service').map((c) => [c.domain, c.service, c.data])")


def test_the_buttons_are_found_on_the_device_and_a_setting_switch_is_not_a_light(phone):
    open_camera(phone)
    assert quick_keys(phone) == ["siren", "light", "night"]
    found = phone.evaluate("""() => { const { model, hass } = window.dashboard;
        return model.cameraQuickControls(hass(), 'camera.slup', model.normalizeConfig({})); }""")
    assert found["light"] == "switch.slup_light"
    assert found["night"]["entity"] == "select.slup_night_vision"


def test_a_camera_without_them_has_no_row(phone):
    open_camera(phone, things=())
    assert phone.locator(f"{SHEET} [data-quick-bar]").count() == 0


def test_the_siren_asks_first_then_glows_red_and_a_tap_stops_it(phone):
    open_camera(phone, things=("siren",))
    phone.locator(f"{SHEET} [data-quick='siren']").click()
    phone.wait_for_selector(f"{SHEET} [data-siren-ask]")
    phone.locator(f"{SHEET} [data-siren-cancel]").click()
    assert services(phone) == []
    phone.locator(f"{SHEET} [data-quick='siren']").click()
    phone.locator(f"{SHEET} [data-siren-confirm]").click()
    assert phone.locator(f"{SHEET} [data-siren-ask]").count() == 0
    assert services(phone) == [["siren", "turn_on", {"entity_id": "siren.slup_siren"}]]
    phone.evaluate("""async () => { const chrome = document.querySelector('home-dashboard-chrome');
        const states = { ...chrome.hass.states, 'siren.slup_siren': { ...chrome.hass.states['siren.slup_siren'], state: 'on' } };
        const sheet = chrome.shadowRoot.querySelector('home-dashboard-sheet');
        sheet.hass = { ...chrome.hass, states }; await sheet.updateComplete; }""")
    siren = phone.locator(f"{SHEET} [data-quick='siren']")
    assert "alarm" in siren.get_attribute("class")
    assert siren.evaluate("(b) => getComputedStyle(b).backgroundColor") == "rgb(215, 0, 21)"
    siren.click()
    assert services(phone)[-1] == ["siren", "turn_off", {"entity_id": "siren.slup_siren"}]


def test_the_light_switches_and_night_vision_is_chosen_from_a_list(phone):
    open_camera(phone, things=("light", "night"))
    phone.locator(f"{SHEET} [data-quick='light']").click()
    phone.locator(f"{SHEET} [data-quick='night']").click()
    options = phone.locator(f"{SHEET} [data-quick-menu='night'] [data-quick-option]")
    assert options.all_inner_texts() == ["Wyłączona (dzień)", "Podczerwień", "Pełny kolor (doświetlanie)"]
    assert "chosen" in phone.locator(f"{SHEET} [data-quick-option='Infrared']").get_attribute("class")
    phone.locator(f"{SHEET} [data-quick-option='Full Color']").click()
    assert services(phone) == [
        ["homeassistant", "turn_on", {"entity_id": "switch.slup_light"}],
        ["select", "select_option", {"entity_id": "select.slup_night_vision", "option": "Full Color"}],
    ]


def test_upright_they_stand_over_the_line_of_time_from_the_right(phone):
    open_camera(phone)
    line = phone.locator(f"{SHEET} home-dashboard-timeline").bounding_box()
    boxes = {key: phone.locator(f"{SHEET} [data-quick='{key}']").bounding_box() for key in ("siren", "light", "night")}
    assert all(box["y"] + box["height"] <= line["y"] for box in boxes.values())
    # The siren is the rightmost, the others go left from it.
    assert boxes["siren"]["x"] > boxes["light"]["x"] > boxes["night"]["x"]
    assert abs(boxes["siren"]["x"] + boxes["siren"]["width"] - (line["x"] + line["width"])) < 24


def test_on_its_side_they_stand_in_the_bottom_left_corner_from_the_bottom(phone):
    open_camera(phone, viewport={"width": 874, "height": 402})
    boxes = {key: phone.locator(f"{SHEET} [data-quick='{key}']").bounding_box() for key in ("siren", "light", "night")}
    assert all(box["x"] < 70 for box in boxes.values())
    # The siren at the bottom, the light over it, night vision over the light.
    assert boxes["siren"]["y"] > boxes["light"]["y"] > boxes["night"]["y"]
    assert boxes["siren"]["y"] + boxes["siren"]["height"] > 402 - 70


def test_with_only_a_light_it_takes_the_place_of_the_siren(phone):
    open_camera(phone, things=("light",), viewport={"width": 874, "height": 402})
    light = phone.locator(f"{SHEET} [data-quick='light']").bounding_box()
    assert light["y"] + light["height"] > 402 - 70


def test_on_its_side_the_left_column_stands_on_a_picture_with_bands(phone):
    from .test_zoom import WIDE

    phone.route("**/api/*_proxy/**", lambda route: route.fulfill(body=WIDE, content_type="image/svg+xml"))
    open_camera(phone, viewport={"width": 874, "height": 402})
    phone.wait_for_function("""() => document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('home-dashboard-sheet').shadowRoot.querySelector('.picture img')?.naturalWidth === 1600""")
    phone.wait_for_timeout(100)
    picture = phone.locator(f"{SHEET} .picture img").bounding_box()
    siren = phone.locator(f"{SHEET} [data-quick='siren']").bounding_box()
    # The 16:9 picture leaves a band on the left; the column stands on the picture, 12 px in from its edge.
    assert picture["x"] > 40
    assert abs(siren["x"] - (picture["x"] + 12)) < 2


GARDEN = """() => {
    const snapshot = window.dashboard.snapshot;
    const add = (id, state, attributes = {}) => {
        snapshot.entities[id] = { entity_id: id, device_id: "garden", hidden: false };
        snapshot.states[id] = { entity_id: id, state, attributes: { friendly_name: id, ...attributes } };
    };
    add("switch.garden_alarm", "off");
    add("light.garden_flood", "off");
    add("input_select.garden_mode", "Day", { options: ["Day", "Night"] });
}"""


def chosen(page, quick: dict) -> dict:
    return page.evaluate("""(quick) => { const { model, hass } = window.dashboard;
        const config = model.normalizeConfig({ cameras: { quick: { 'camera.slup': quick } } });
        const found = model.cameraQuickControls(hass(), 'camera.slup', config);
        return { siren: found.siren, light: found.light, night: found.night?.entity ?? null }; }""", quick)


def test_buttons_are_chosen_by_hand_from_any_entity_or_left_out(phone):
    phone.evaluate(ADD_DEVICE)
    phone.evaluate(ADD_QUICK, ["siren", "light", "night"])
    phone.evaluate(GARDEN)
    assert chosen(phone, {}) == {"siren": "siren.slup_siren", "light": "switch.slup_light", "night": "select.slup_night_vision"}
    assert chosen(phone, {"siren": "switch.garden_alarm", "light": "light.garden_flood", "night": "input_select.garden_mode"}) == {
        "siren": "switch.garden_alarm", "light": "light.garden_flood", "night": "input_select.garden_mode"}
    assert chosen(phone, {"siren": "none", "light": "none", "night": "none"}) == {"siren": None, "light": None, "night": None}
    # An entity of the wrong kind, or one that is gone, leaves the button to be found as usual.
    assert chosen(phone, {"night": "light.garden_flood", "siren": "switch.gone"})["night"] == "select.slup_night_vision"


def test_a_switch_chosen_as_siren_is_turned_on_after_asking(phone):
    phone.evaluate(GARDEN)
    open_camera(phone, things=())
    phone.evaluate("""async () => { const chrome = document.querySelector('home-dashboard-chrome');
        const sheet = chrome.shadowRoot.querySelector('home-dashboard-sheet');
        sheet.config = { ...sheet.config, cameras: { ...sheet.config.cameras,
            quick: { 'image.slup_last_screen': { siren: 'switch.garden_alarm', night: 'input_select.garden_mode' } } } };
        await sheet.updateComplete; }""")
    phone.locator(f"{SHEET} [data-quick='siren']").click()
    phone.locator(f"{SHEET} [data-siren-confirm]").click()
    phone.locator(f"{SHEET} [data-quick='night']").click()
    phone.locator(f"{SHEET} [data-quick-option='Night']").click()
    assert services(phone) == [
        ["homeassistant", "turn_on", {"entity_id": "switch.garden_alarm"}],
        ["input_select", "select_option", {"entity_id": "input_select.garden_mode", "option": "Night"}],
    ]


def test_the_settings_offer_the_buttons_of_each_camera(phone):
    phone.evaluate(ADD_DEVICE)
    phone.evaluate(ADD_QUICK, ["siren"])
    phone.evaluate(GARDEN)
    mount_admin(phone, {"cameras": {"tiles": ["image.slup_last_screen"]}})
    phone.evaluate("() => document.querySelector('home-dashboard-chrome').open({ type: 'settings' })")
    row = "home-dashboard-settings [data-camera-control='image.slup_last_screen']"
    phone.locator(f"{row} .camera-row").click()
    siren = phone.locator(f"{row} [data-quick-choice='siren']")
    assert "siren.slup_siren" in siren.locator("option").first.inner_text()
    siren.select_option("switch.garden_alarm")
    phone.locator(f"{row} [data-quick-choice='night']").select_option("none")
    phone.locator("home-dashboard-settings [data-save]").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'lovelace/config/save')")
    saved = phone.evaluate("window.saved.filter((m) => m.type === 'lovelace/config/save').at(-1).config.strategy.cameras.quick")
    assert saved == {"image.slup_last_screen": {"siren": "switch.garden_alarm", "night": "none"}}
