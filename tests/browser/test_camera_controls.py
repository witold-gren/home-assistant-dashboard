"""A camera that turns and a window of its settings, made from the entities of its device."""

from __future__ import annotations

import os

from .test_shortcuts import mount_admin

SHEET = "home-dashboard-sheet"

ADD_DEVICE = """() => {
    const snapshot = window.dashboard.snapshot;
    const device = "ptz_device";
    snapshot.devices[device] = { id: device, name: "Słup", area_id: Object.keys(snapshot.areas)[0] };
    const add = (id, state, attributes = {}, category = null) => {
        snapshot.entities[id] = { entity_id: id, device_id: device, entity_category: category, hidden: false };
        snapshot.states[id] = { entity_id: id, state, attributes: { friendly_name: `Słup ${attributes.name ?? id}`, ...attributes } };
    };
    add("camera.slup", "idle", { name: "", entity_picture: "/api/camera_proxy/camera.slup" });
    add("image.slup_last_screen", "2026-11-09T06:26:53", { name: "Last screen", entity_picture: "/api/image_proxy/image.slup_last_screen" });
    add("button.slup_pan_left", "unknown", { name: "Pan left" });
    add("button.slup_pan_right", "unknown", { name: "Pan right" });
    add("button.slup_tilt_up", "unknown", { name: "Tilt up" });
    add("button.slup_tilt_down", "unknown", { name: "Tilt down" });
    add("button.slup_go_to_preset", "unknown", { name: "Go to preset" });
    add("button.slup_take_screenshot", "unknown", { name: "Take screenshot" });
    add("select.slup_preset", "0 · HOME", { name: "Preset", options: ["0 · HOME", "1 · GATE", "2 · empty"] }, "config");
    add("switch.slup_microphone", "on", { name: "Microphone" }, "config");
    add("number.slup_brightness", "100", { name: "Brightness", min: 0, max: 100, step: 1 }, "config");
    add("sensor.slup_battery", "100", { name: "Battery", unit_of_measurement: "%" }, "diagnostic");
    add("switch.slup_gone", "unavailable", { name: "Gone" }, "config");
}"""


def run(page, body: str):
    return page.evaluate(f"""() => {{
        const {{ model, hass }} = window.dashboard;
        const instance = hass();
        const config = model.normalizeConfig(window.cameraConfig ?? {{}});
        {body}
    }}""")


def press(entity: str) -> dict:
    return {"domain": "button", "service": "press", "data": {"entity_id": entity}, "entity": entity}


def test_the_buttons_of_a_device_turn_its_camera(phone):
    phone.evaluate(ADD_DEVICE)
    result = run(phone, "return model.cameraMoves(instance, 'camera.slup', config);")
    assert {direction: move["entity"] for direction, move in result["moves"].items()} == {
        "left": "button.slup_pan_left", "right": "button.slup_pan_right", "up": "button.slup_tilt_up", "down": "button.slup_tilt_down"}
    assert result["moves"]["left"] == press("button.slup_pan_left")
    assert result["mode"] == "names"
    assert result["presets"] == {"select": "select.slup_preset", "button": "button.slup_go_to_preset",
                                 "options": ["0 · HOME", "1 · GATE"], "current": "0 · HOME"}


def test_a_camera_without_such_buttons_has_no_arrows(phone):
    result = run(phone, """const id = Object.keys(instance.states).find((key) => key.startsWith('camera.'));
        return model.cameraMoves(instance, id, config);""")
    assert result == {"mode": "auto", "moves": {}, "presets": None}


def test_the_settings_are_grouped_and_named_without_the_device(phone):
    phone.evaluate(ADD_DEVICE)
    panel = run(phone, "return model.cameraSettingsPanel(instance, 'camera.slup', config, 'Słup');")
    groups = {group["title"]: [row["name"] for row in group["rows"]] for group in panel["groups"]}
    assert groups == {
        # The positions and turning have their own place over the picture.
        "Ustawienia": ["Brightness", "Microphone"],
        "Stan": ["Battery"],
        "Akcje": ["Take screenshot"],
    }
    assert panel["kind"] == "panel"


def test_the_configuration_can_choose_the_settings(phone):
    phone.evaluate(ADD_DEVICE)
    phone.evaluate("window.cameraConfig = { cameras: { settings: { 'camera.slup': ['switch.slup_microphone', 'sensor.slup_battery'] } } }")
    panel = run(phone, "return model.cameraSettingsPanel(instance, 'camera.slup', config, 'Słup');")
    assert [row["entity"] for row in panel["groups"][0]["rows"]] == ["switch.slup_microphone", "sensor.slup_battery"]


def open_slup(page) -> None:
    page.evaluate(ADD_DEVICE)
    mount_admin(page, {"cameras": {"tiles": ["image.slup_last_screen"]}})
    page.evaluate("""() => document.querySelector('home-dashboard-chrome')
        .open({ type: 'sheet', sheet: { kind: 'camera', entityId: 'image.slup_last_screen' } })""")
    page.wait_for_selector(f"{SHEET} [data-ptz-toggle]")


def go_live(page, wide_picture: bool = False) -> None:
    """The live view as it starts: the last picture stands in, which is all that turning needs."""
    page.evaluate("""async () => { const sheet = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet'); sheet._live = true; await sheet.updateComplete; }""")
    if wide_picture:
        page.evaluate("""() => document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet').shadowRoot.querySelector('.poster').src = 'data:image/svg+xml,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900"/></svg>')""")
        page.wait_for_function("() => document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet').shadowRoot.querySelector('.poster').naturalWidth === 1600")


def test_without_a_live_view_turning_and_sound_are_greyed(phone):
    open_slup(phone)
    assert phone.locator(f"{SHEET} [data-ptz-toggle]").is_disabled()
    assert phone.locator(f"{SHEET} [data-sound]").is_disabled()
    go_live(phone)
    assert phone.locator(f"{SHEET} [data-ptz-toggle]").is_enabled()
    # Live, but nothing to hear yet: the sound waits for a stream with a sound track.
    assert phone.locator(f"{SHEET} [data-sound]").is_disabled()
    phone.evaluate("""async () => {
        const sheet = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet');
        const video = document.createElement('video');
        Object.defineProperty(video, 'srcObject', { value: { getAudioTracks: () => [{ id: 'a', readyState: 'live' }] } });
        sheet.shadowRoot.querySelector('[data-live]').appendChild(video);
        sheet._applySound();
        await sheet.updateComplete;
    }""")
    assert phone.locator(f"{SHEET} [data-sound]").is_enabled()


def test_a_live_view_without_a_sound_track_keeps_the_sound_greyed(phone):
    open_slup(phone)
    go_live(phone)
    phone.evaluate("""async () => {
        const sheet = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet');
        const video = document.createElement('video');
        Object.defineProperty(video, 'srcObject', { value: { getAudioTracks: () => [] } });
        sheet.shadowRoot.querySelector('[data-live]').appendChild(video);
        sheet._applySound();
        await sheet.updateComplete;
    }""")
    assert phone.locator(f"{SHEET} [data-sound]").is_disabled()


# The eufy set finds its entities by translation keys, so a home in Polish, with Polish entity ids, works too.
POLISH_EUFY = """() => {
    const snapshot = window.dashboard.snapshot;
    snapshot.devices.eufy_pl = { id: "eufy_pl", name: "Ogród", area_id: null };
    const add = (id, state, attributes = {}) => {
        snapshot.entities[id] = { entity_id: id, device_id: "eufy_pl", platform: "eufy_sdk", hidden: false };
        snapshot.states[id] = { entity_id: id, state, attributes };
    };
    add("camera.ogrod", "idle");
    add("button.ogrod_obrot_w_lewo", "unknown");
    add("button.ogrod_obrot_w_prawo", "unknown");
    add("button.ogrod_pochyl_w_gore", "unknown");
    add("button.ogrod_pochyl_w_dol", "unknown");
    add("button.ogrod_idz_do_pozycji", "unknown");
    add("select.ogrod_pozycja", "Brama", { options: ["Brama", "Taras"] });
    window.registryKeys = {
        "button.ogrod_obrot_w_lewo": "pan_left", "button.ogrod_obrot_w_prawo": "pan_right",
        "button.ogrod_pochyl_w_gore": "tilt_up", "button.ogrod_pochyl_w_dol": "tilt_down",
        "button.ogrod_idz_do_pozycji": "preset_goto", "select.ogrod_pozycja": "preset",
    };
}"""

LOAD_KEYS = """const asked = [];
    const registry = { callWS: async (message) => { asked.push(message);
        return Object.fromEntries(message.entity_ids.map((id) => [id, { translation_key: window.registryKeys[id] ?? null }])); } };
    await model.loadTranslationKeys(registry, model.controlEntityIds(instance, 'camera.ogrod', config));"""


def run_async(page, body: str):
    return page.evaluate(f"""async () => {{
        const {{ model, hass }} = window.dashboard;
        const instance = hass();
        const config = model.normalizeConfig(window.cameraConfig ?? {{}});
        {body}
    }}""")


def test_the_eufy_set_finds_the_buttons_by_their_keys_in_any_language(phone):
    phone.evaluate(POLISH_EUFY)
    before = run_async(phone, "return model.cameraMoves(instance, 'camera.ogrod', config).mode;")
    result = run_async(phone, LOAD_KEYS + " return [model.cameraMoves(instance, 'camera.ogrod', config), asked.length];")
    controls, asked = result
    # Without the keys the Polish names say nothing; with them the eufy set is found.
    assert before == "auto"
    assert asked == 1
    assert controls["mode"] == "eufy"
    assert controls["moves"]["left"] == press("button.ogrod_obrot_w_lewo")
    assert controls["moves"]["down"] == press("button.ogrod_pochyl_w_dol")
    assert controls["presets"]["select"] == "select.ogrod_pozycja"
    assert controls["presets"]["button"] == "button.ogrod_idz_do_pozycji"


def test_the_keys_are_read_from_the_registry_only_once(phone):
    phone.evaluate(POLISH_EUFY)
    asked = run_async(phone, LOAD_KEYS + " await model.loadTranslationKeys(registry, model.controlEntityIds(instance, 'camera.ogrod', config)); return asked.length;")
    assert asked == 1


def test_entities_chosen_by_hand_turn_a_camera_whose_buttons_have_other_names(phone):
    phone.evaluate(ADD_DEVICE)
    phone.evaluate("""() => { window.cameraConfig = { cameras: { ptz: { 'camera.slup': {
        mode: 'manual', left: 'script.turn_left', right: 'button.slup_pan_right', select: 'select.slup_preset', button: 'button.slup_go_to_preset' } } } }; }""")
    controls = run(phone, "return model.cameraMoves(instance, 'camera.slup', config);")
    assert controls["mode"] == "manual"
    assert controls["moves"] == {
        "left": {"domain": "script", "service": "turn_on", "data": {"entity_id": "script.turn_left"}, "entity": "script.turn_left"},
        "right": press("button.slup_pan_right"),
    }
    assert controls["presets"]["options"] == ["0 · HOME", "1 · GATE"]


def test_an_onvif_camera_turns_with_the_service_and_goes_to_its_positions(phone):
    phone.evaluate("""() => {
        const snapshot = window.dashboard.snapshot;
        snapshot.devices.onvif = { id: "onvif", name: "Brama", area_id: null };
        snapshot.entities["camera.brama"] = { entity_id: "camera.brama", device_id: "onvif", platform: "onvif", hidden: false };
        snapshot.states["camera.brama"] = { entity_id: "camera.brama", state: "idle", attributes: {} };
        window.cameraConfig = { cameras: { ptz: { "camera.brama": { presets: ["1", "2"] } } } };
    }""")
    controls = run(phone, "return model.cameraMoves(instance, 'camera.brama', config);")
    assert controls["mode"] == "onvif"
    assert controls["moves"]["left"] == {"domain": "onvif", "service": "ptz", "data": {
        "entity_id": "camera.brama", "pan": "LEFT", "move_mode": "ContinuousMove", "continuous_duration": 0.5, "speed": 0.5}}
    assert controls["moves"]["up"]["data"]["tilt"] == "UP"
    calls = run(phone, "return model.presetCalls(model.cameraMoves(instance, 'camera.brama', config).presets, '2');")
    assert calls == [{"domain": "onvif", "service": "ptz", "data": {"entity_id": "camera.brama", "move_mode": "GotoPreset", "preset": "2"}}]


def test_turning_can_be_switched_off_for_a_camera(phone):
    phone.evaluate(ADD_DEVICE)
    phone.evaluate("window.cameraConfig = { cameras: { ptz: { 'camera.slup': { mode: 'none' } } } }")
    assert run(phone, "return model.cameraMoves(instance, 'camera.slup', config);") == {"mode": "none", "moves": {}, "presets": None}


def test_a_chosen_set_that_finds_nothing_turns_nothing(phone):
    phone.evaluate(ADD_DEVICE)
    phone.evaluate("window.cameraConfig = { cameras: { ptz: { 'camera.slup': { mode: 'onvif' } } } }")
    assert run(phone, "return model.cameraMoves(instance, 'camera.slup', config);")["moves"] == {}


def test_the_arrows_are_hidden_until_the_button_is_pressed(phone):
    open_slup(phone)
    go_live(phone)
    assert phone.locator(f"{SHEET} [data-ptz-overlay]").count() == 0
    toggle = phone.locator(f"{SHEET} [data-ptz-toggle]")
    toggle.click()
    phone.wait_for_selector(f"{SHEET} .stage [data-ptz-overlay] [data-ptz-pad]")
    assert toggle.get_attribute("aria-pressed") == "true"
    toggle.click()
    phone.wait_for_selector(f"{SHEET} [data-ptz-overlay]", state="detached")
    assert toggle.get_attribute("aria-pressed") == "false"


def test_the_arrows_lie_over_the_picture_on_the_right(phone):
    open_slup(phone)
    # A picture of a real camera, 16:9.
    go_live(phone, wide_picture=True)
    before = phone.locator(f"{SHEET} home-dashboard-timeline").bounding_box()
    phone.locator(f"{SHEET} [data-ptz-toggle]").click()
    pad = phone.locator(f"{SHEET} [data-ptz-overlay]").bounding_box()
    picture = phone.locator(f"{SHEET} .live-wrap").bounding_box()
    # The window does not move: what is under the picture stays where it was.
    assert phone.locator(f"{SHEET} home-dashboard-timeline").bounding_box() == before
    assert pad["x"] + pad["width"] <= picture["x"] + picture["width"]
    assert pad["x"] > picture["x"] + picture["width"] / 2
    assert phone.locator(f"{SHEET} header [data-ptz-toggle] + [data-sound]").count() == 1
    assert picture["y"] <= pad["y"] and pad["y"] + pad["height"] <= picture["y"] + picture["height"]
    phone.screenshot(path=os.environ["SHOT"]) if os.environ.get("SHOT") else None


def test_a_camera_that_does_not_turn_has_no_button(phone):
    mount_admin(phone, {})
    phone.locator("home-dashboard-page .camera:not(.offline)").first.click()
    phone.wait_for_selector(f"{SHEET} .stage", state="attached")
    assert phone.locator(f"{SHEET} [data-ptz-toggle]").count() == 0


def test_the_arrows_and_presets_press_the_buttons(phone):
    open_slup(phone)
    go_live(phone)
    phone.locator(f"{SHEET} [data-ptz-toggle]").click()
    phone.locator(f"{SHEET} [data-ptz='left']").click()
    phone.locator(f"{SHEET} [data-quick='positions']").click()
    assert phone.locator(f"{SHEET} [data-quick-menu='positions'] [data-quick-option]").all_inner_texts() == ["0 · HOME", "1 · GATE"]
    phone.locator(f"{SHEET} [data-quick-option='1 · GATE']").click()
    assert phone.locator(f"{SHEET} [data-quick-menu]").count() == 0
    phone.wait_for_function("window.hass.calls.filter((c) => c.type === 'service').length >= 3")
    calls = phone.evaluate("window.hass.calls.filter((c) => c.type === 'service').map((c) => [c.domain, c.service, c.data])")
    assert calls == [
        ["button", "press", {"entity_id": "button.slup_pan_left"}],
        ["select", "select_option", {"entity_id": "select.slup_preset", "option": "1 · GATE"}],
        ["button", "press", {"entity_id": "button.slup_go_to_preset"}],
    ]


def test_the_gear_opens_the_settings_of_the_camera(phone):
    open_slup(phone)
    phone.locator(f"{SHEET} [data-details]").click()
    phone.wait_for_function("document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet').sheet.kind === 'panel'")
    title = phone.evaluate("document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet').sheet.item.name")
    assert title == "Słup: ustawienia"
    assert phone.evaluate("window.moreInfo ?? []") == []


def test_a_camera_whose_device_has_a_battery_is_a_battery_camera(phone):
    phone.evaluate(ADD_DEVICE)
    phone.evaluate("""() => {
        const snapshot = window.dashboard.snapshot;
        snapshot.states['sensor.slup_battery'].attributes.device_class = 'battery';
        snapshot.entities['camera.slup'].platform = 'neolink';
        snapshot.entities['camera.other'] = { entity_id: 'camera.other', device_id: 'other', platform: 'neolink' };
        snapshot.states['camera.other'] = { entity_id: 'camera.other', state: 'idle', attributes: {} };
    }""")
    result = run(phone, "return [model.isBatteryCamera(instance, 'camera.slup', config), model.isBatteryCamera(instance, 'camera.other', config)];")
    assert result == [True, False]


def test_another_camera_can_lend_its_buttons_for_turning(phone):
    phone.evaluate(ADD_DEVICE)
    phone.evaluate("""() => {
        const snapshot = window.dashboard.snapshot;
        snapshot.devices.nvr = { id: "nvr", name: "NVR", area_id: null };
        snapshot.entities["camera.nvr_slup"] = { entity_id: "camera.nvr_slup", device_id: "nvr", platform: "frigate", hidden: false };
        snapshot.states["camera.nvr_slup"] = { entity_id: "camera.nvr_slup", state: "idle", attributes: {} };
        window.cameraConfig = { cameras: { controls: { "camera.nvr_slup": "camera.slup" } } };
    }""")
    result = run(phone, "return model.cameraMoves(instance, 'camera.nvr_slup', config);")
    assert result["moves"]["left"]["entity"] == "button.slup_pan_left"
    assert result["presets"]["select"] == "select.slup_preset"
    phone.evaluate("window.cameraConfig = {}")
    assert run(phone, "return model.cameraMoves(instance, 'camera.nvr_slup', config);") == {"mode": "auto", "moves": {}, "presets": None}


def test_the_age_is_top_left_and_the_positions_bottom_left(phone):
    open_slup(phone)
    phone.evaluate("""() => document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet').shadowRoot.querySelector('.picture img').src = 'data:image/svg+xml,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900"/></svg>')""")
    phone.wait_for_function("() => document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet').shadowRoot.querySelector('.picture img').naturalWidth === 1600")
    picture = phone.locator(f"{SHEET} .stage").bounding_box()
    age = phone.locator(f"{SHEET} .age").bounding_box()
    assert age["y"] - picture["y"] < 20 and age["x"] - picture["x"] < 20
    go_live(phone, wide_picture=True)
    phone.locator(f"{SHEET} [data-ptz-toggle]").click()
    picture = phone.locator(f"{SHEET} .stage").bounding_box()
    positions = phone.locator(f"{SHEET} [data-quick='positions']").bounding_box()
    line = phone.locator(f"{SHEET} home-dashboard-timeline").bounding_box()
    ring = phone.locator(f"{SHEET} [data-ptz-overlay]").bounding_box()
    # Upright the positions are a round button in the row over the line of time.
    assert positions["y"] + positions["height"] <= line["y"]
    assert positions["y"] > picture["y"] + picture["height"]
    assert ring["x"] > picture["x"] + picture["width"] / 2


MANY_POSITIONS = [str(number) for number in range(1, 21)]


def open_many_positions(page, viewport: dict) -> dict:
    """Open the positions of a camera with 20 of them; return the box of the list."""
    page.set_viewport_size(viewport)
    page.evaluate(ADD_DEVICE)
    page.evaluate(
        "(options) => { const state = window.dashboard.snapshot.states['select.slup_preset']; state.state = options[0]; state.attributes.options = options; }",
        MANY_POSITIONS,
    )
    mount_admin(page, {"cameras": {"tiles": ["image.slup_last_screen"]}})
    page.evaluate("""() => document.querySelector('home-dashboard-chrome')
        .open({ type: 'sheet', sheet: { kind: 'camera', entityId: 'image.slup_last_screen' } })""")
    page.wait_for_selector(f"{SHEET} [data-ptz-toggle]")
    go_live(page, wide_picture=True)
    page.locator(f"{SHEET} [data-ptz-toggle]").click()
    page.locator(f"{SHEET} [data-quick='positions']").click()
    return page.locator(f"{SHEET} [data-quick-menu='positions']").bounding_box()


def test_a_long_list_of_positions_on_its_side_stays_under_the_header_and_scrolls(phone):
    menu = open_many_positions(phone, {"width": 874, "height": 402})
    header = phone.locator(f"{SHEET} header").bounding_box()
    assert menu["y"] >= header["y"] + header["height"] - 1, "the list covers the header"
    assert menu["y"] + menu["height"] <= 402, "the list leaves the screen"
    last = phone.locator(f"{SHEET} [data-quick-option='20']")
    last.scroll_into_view_if_needed()
    last.click()
    phone.wait_for_function("window.hass.calls.filter((c) => c.type === 'service').length >= 2")
    assert ["select", "select_option", {"entity_id": "select.slup_preset", "option": "20"}] in phone.evaluate(
        "window.hass.calls.filter((c) => c.type === 'service').map((c) => [c.domain, c.service, c.data])"
    )


def test_a_long_list_of_positions_upright_stays_on_the_screen(phone):
    menu = open_many_positions(phone, {"width": 402, "height": 874})
    assert menu["y"] >= 0 and menu["y"] + menu["height"] <= 874
    assert phone.locator(f"{SHEET} [data-quick-menu='positions']").evaluate("(e) => e.scrollHeight > e.clientHeight")


def test_on_its_side_the_right_column_mirrors_the_left_and_the_ring_stays_on_the_picture(phone):
    phone.set_viewport_size({"width": 874, "height": 402})
    open_slup(phone)
    go_live(phone, wide_picture=True)
    phone.locator(f"{SHEET} [data-ptz-toggle]").click()
    phone.wait_for_timeout(100)
    line = phone.locator(f"{SHEET} [data-open-line]").bounding_box()
    ring = phone.locator(f"{SHEET} [data-ptz-overlay]").bounding_box()
    poster = phone.locator(f"{SHEET} .poster").bounding_box()
    # The button of the line of time at the bottom right, wholly on the picture, 12 px in from its right edge.
    shown = min(poster["width"], poster["height"] * 16 / 9)
    right = poster["x"] + (poster["width"] + shown) / 2
    assert abs((line["x"] + line["width"]) - (right - 12)) < 2
    assert round(line["width"]) == 48
    # The ring over the column (room for the talk button between), wholly on the picture, not on the band beside it.
    assert ring["y"] + ring["height"] <= line["y"] - 60
    # The 16:9 picture is shown whole in its box ("contain"): its own right edge, not the box's.
    assert right < 874 - 16, "the picture leaves a band on the right"
    assert ring["x"] + ring["width"] <= right + 1
    positions = phone.locator(f"{SHEET} [data-quick='positions']").bounding_box()
    # The left column too stands on the picture, 12 px in from its left edge.
    left = poster["x"] + (poster["width"] - shown) / 2
    assert abs(positions["x"] - (left + 12)) < 2 and positions["y"] > 250
    phone.locator(f"{SHEET} [data-open-line]").click()
    assert phone.locator(f"{SHEET} [data-quick-bar]").evaluate("(e) => getComputedStyle(e).visibility") == "hidden"
