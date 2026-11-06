"""Rooms from a layout, the status row, the intercom, the camera screen and guest mode."""

from __future__ import annotations

from itertools import pairwise

import pytest

from .test_page import mount

SHEET = "home-dashboard-sheet"


def ids_of(page, prefix: str, count: int = 1) -> list[str]:
    return page.evaluate(
        """({ prefix, count }) => Object.keys(window.dashboard.snapshot.states)
            .filter((id) => id.startsWith(prefix)).slice(0, count)""",
        {"prefix": prefix, "count": count},
    )


def set_state(page, entity_id: str, state: str) -> None:
    page.evaluate(
        """({ id, state }) => {
            window.dashboard.snapshot.states[id] ??= { entity_id: id, attributes: {} };
            window.dashboard.snapshot.states[id].state = state;
        }""",
        {"id": entity_id, "state": state},
    )


def calls(page) -> list:
    return page.evaluate("window.hass.calls")


def layout_dashboard(page) -> dict:
    light, second = ids_of(page, "light.", 2)
    (switch,) = ids_of(page, "switch.")
    return {
        "layout": [
            {
                "id": "kitchen",
                "name": "Kuchnia i Jadalnia",
                "areas": ["area_a", "area_b"],
                "home": [{"entity": switch, "name": "Lodówka"}, {"entity": light, "name": "Główne"}],
                "sections": [
                    {"title": "Oświetlenie", "tiles": [{"entity": light, "name": "Główne"}, {"entity": second}]},
                    {"title": "Pusta", "tiles": [{"entity": "light.missing"}]},
                ],
            }
        ]
    }


INTERCOM = {
    "script": "script.announce",
    "areas_field": "rooms",
    "text_field": "message",
    "file_field": "recording",
    "played_field": "played",
}


def first_area(page) -> str:
    return page.evaluate("Object.keys(window.dashboard.snapshot.areas)[0]")


# 1. Area names ----------------------------------------------------------------------------------


def test_area_name_on_home_opens_the_room(phone):
    mount(phone)
    link = phone.locator("[data-room-link]").first
    room = link.get_attribute("data-room-link")
    link.click()
    assert phone.evaluate("window.location.pathname").endswith("/room")
    assert f"room={room}" in phone.evaluate("window.location.search")


# 2. Security filter -----------------------------------------------------------------------------


def test_security_filter_replaces_the_strip_with_every_camera_stacked(phone):
    mount(phone)
    total = phone.locator("home-dashboard-page .cameras .camera").count()
    phone.locator("[data-chip='security']").click()
    phone.wait_for_timeout(100)
    assert phone.locator("home-dashboard-page .cameras").count() == 0
    tops = phone.evaluate("""() => [...window.card.shadowRoot.querySelectorAll(".camera-list .camera")]
        .map((tile) => tile.getBoundingClientRect())
        .map((box) => [box.top, box.bottom, box.left])""")
    assert len(tops) == total
    assert all(after[0] >= before[1] for before, after in pairwise(tops))
    assert len({left for _, _, left in tops}) == 1


def test_stacked_cameras_are_named_and_start_no_stream(phone):
    mount(phone)
    phone.locator("[data-chip='security']").click()
    phone.wait_for_timeout(100)
    assert phone.locator("home-dashboard-page .camera-list .camera-name").count() > 0
    assert phone.locator("home-dashboard-page video, home-dashboard-page ha-camera-stream").count() == 0
    assert calls(phone) == []


def test_other_filters_show_no_cameras(phone):
    mount(phone)
    phone.locator("[data-chip='lights']").click()
    phone.wait_for_timeout(100)
    assert phone.locator("home-dashboard-page .camera").count() == 0


# 3. Camera screen -------------------------------------------------------------------------------


def open_first_camera(page, dashboard=None) -> None:
    mount(page, dashboard)
    page.locator("home-dashboard-page .camera").first.click()
    page.wait_for_selector(f"{SHEET} .panel")


def test_camera_screen_browses_the_other_cameras(phone):
    open_first_camera(phone)
    thumbs = phone.locator("[data-thumb]")
    assert thumbs.count() > 3
    assert phone.locator(".camera-thumb.current").count() == 1
    boxes = [thumbs.nth(index).bounding_box() for index in range(2)]
    assert boxes[1]["x"] >= boxes[0]["x"] + boxes[0]["width"]
    target = thumbs.nth(2).get_attribute("data-thumb")
    thumbs.nth(2).click()
    phone.wait_for_timeout(100)
    assert phone.locator(".camera-thumb.current").get_attribute("data-thumb") == target
    assert phone.evaluate("window.createdCards") == []


def push_state_update(page) -> None:
    page.evaluate("""async () => {
        const chrome = document.querySelector("home-dashboard-chrome");
        chrome.hass = { ...window.hass };
        await chrome.updateComplete;
    }""")
    page.wait_for_timeout(50)


@pytest.mark.parametrize("size", ["phone", "tablet"])
def test_thumbnails_keep_their_height_with_the_message_open(size, request):
    page = request.getfixturevalue(size)
    area = page.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const instance = hass();
        const config = model.normalizeConfig({});
        return model.effectiveArea(instance, model.buildCameras(instance, config)[0].entityId, config);
    }""")
    open_first_camera(page, {"intercom": {**INTERCOM, "areas": [area]}})
    page.locator("[data-voice]").click()
    page.wait_for_selector(f"{SHEET} home-dashboard-intercom input")
    assert page.locator("[data-thumbs]").bounding_box()["height"] >= 64


def test_chosen_camera_survives_a_state_update(phone):
    open_first_camera(phone)
    target = phone.locator("[data-thumb]").nth(2).get_attribute("data-thumb")
    phone.locator("[data-thumb]").nth(2).click()
    phone.wait_for_timeout(50)
    push_state_update(phone)
    assert phone.locator(".camera-thumb.current").get_attribute("data-thumb") == target


def test_back_closes_the_camera_after_browsing_in_one_step(phone):
    open_first_camera(phone)
    phone.locator("[data-thumb]").nth(1).click()
    phone.locator("[data-thumb]").nth(2).click()
    phone.wait_for_timeout(50)
    phone.go_back()
    phone.wait_for_timeout(100)
    assert phone.locator(f"{SHEET} .panel").count() == 0


def test_switching_camera_stops_the_stream(phone):
    open_first_camera(phone)
    phone.locator("[data-start-live]").click()
    phone.wait_for_selector("[data-card='picture-entity']", state="attached")
    phone.locator("[data-thumb]").nth(2).click()
    phone.wait_for_timeout(100)
    assert phone.locator("[data-card='picture-entity']").count() == 0


def test_voice_button_speaks_in_the_camera_room(phone):
    area = phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const instance = hass();
        const config = model.normalizeConfig({});
        const camera = model.buildCameras(instance, config)[0].entityId;
        return model.effectiveArea(instance, camera, config);
    }""")
    open_first_camera(phone, {"intercom": {**INTERCOM, "areas": [area]}})
    phone.locator("[data-voice]").click()
    phone.locator(f"{SHEET} home-dashboard-intercom input").fill("Kolacja")
    assert calls(phone) == []
    phone.locator("[data-intercom-send]").click()
    phone.wait_for_selector("[data-intercom-state='sent']")
    (sent,) = calls(phone)
    assert sent["message"]["service"] == "announce"
    assert sent["message"]["service_data"] == {"rooms": [area], "message": "Kolacja"}


def test_no_voice_button_where_there_is_no_speaker(phone):
    open_first_camera(phone, {"intercom": {**INTERCOM, "areas": ["somewhere_else"]}})
    assert phone.locator("[data-voice]").count() == 0


def test_no_voice_button_without_a_script(phone):
    open_first_camera(phone)
    assert phone.locator("[data-voice]").count() == 0


# 4. Tiles from the layout -----------------------------------------------------------------------


def home_rooms(page, dashboard) -> list:
    return page.evaluate(
        """(dashboard) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            const config = model.normalizeConfig(dashboard);
            const selection = model.selectEntities(instance, config);
            return model.buildHomeModel(instance, config, selection).rooms
                .map((room) => [room.id, room.name, room.tiles.map((tile) => tile.name)]);
        }""",
        dashboard,
    )


def test_layout_decides_the_room_order_names_and_tiles(phone):
    rooms = home_rooms(phone, layout_dashboard(phone))
    assert rooms[0] == ["kitchen", "Kuchnia i Jadalnia", ["Lodówka", "Główne"]]


def test_areas_outside_the_layout_follow_it(phone):
    dashboard = layout_dashboard(phone)
    plain = home_rooms(phone, {})
    assert len(home_rooms(phone, dashboard)) == len(plain) + 1


def test_merged_area_opens_the_room_it_belongs_to(phone):
    dashboard = layout_dashboard(phone)
    room = phone.evaluate(
        """(dashboard) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            const config = model.normalizeConfig(dashboard);
            const room = model.buildRoomModel(instance, config, model.selectEntities(instance, config), "area_b");
            return { id: room.id, areas: room.areas, sections: room.sections.map((item) => item.title) };
        }""",
        dashboard,
    )
    assert room == {"id": "kitchen", "areas": ["area_a", "area_b"], "sections": ["Oświetlenie"]}


def room_dashboard(tile: dict) -> dict:
    return {"layout": [{"id": "r", "name": "R", "areas": [], "home": [tile], "sections": []}]}


def test_tile_with_an_action_runs_it_instead_of_toggling(phone):
    (switch,) = ids_of(phone, "switch.")
    mount(phone, room_dashboard({"entity": switch, "action": "script.nas_toggle"}))
    phone.locator(f"[data-entity='{switch}'] .icon").click()
    assert [(call["domain"], call["service"]) for call in calls(phone)] == [("script", "nas_toggle")]


def test_guest_tile_turns_on(phone):
    set_state(phone, "input_boolean.guest", "off")
    mount(phone, room_dashboard({"entity": "input_boolean.guest", "turn_on_only": True}))
    phone.locator("[data-entity='input_boolean.guest'] .text").click()
    assert [(call["domain"], call["service"]) for call in calls(phone)] == [("homeassistant", "turn_on")]


def test_guest_tile_cannot_be_turned_off(phone):
    set_state(phone, "input_boolean.guest", "on")
    mount(phone, room_dashboard({"entity": "input_boolean.guest", "turn_on_only": True}))
    phone.evaluate("""() => {
        window.opened = [];
        window.addEventListener("hass-more-info", (event) => window.opened.push(event.detail));
    }""")
    phone.locator("[data-entity='input_boolean.guest'] .icon").click()
    phone.locator("[data-entity='input_boolean.guest'] .text").click()
    assert calls(phone) == []
    assert phone.evaluate("window.opened") == []


@pytest.mark.parametrize(("state", "shown"), [("playing", True), ("off", False), ("idle", False)])
def test_active_only_tile_follows_the_player(phone, state, shown):
    (player,) = ids_of(phone, "media_player.")
    set_state(phone, player, state)
    rooms = home_rooms(phone, room_dashboard({"entity": player, "name": "TV", "active_only": True}))
    assert (rooms[0][0] == "r") is shown


@pytest.mark.parametrize(
    ("entity", "state", "tone", "action"),
    [
        ("scene.a", "2026-01-01", "off", "call"),
        ("script.a", "off", "off", "call"),
        ("button.a", "unknown", "off", "call"),
        ("sensor.a", "21", "off", "more-info"),
        ("alarm_control_panel.a", "disarmed", "off", "sheet"),
        ("alarm_control_panel.a", "armed_away", "security", "sheet"),
    ],
)
def test_new_tile_kinds(phone, entity, state, tone, action):
    set_state(phone, entity, state)
    tile = phone.evaluate(
        """(id) => {
            const { model, hass } = window.dashboard;
            return model.buildTile(hass(), id, null, model.normalizeConfig({}));
        }""",
        entity,
    )
    assert tile["tone"] == tone
    assert tile["tapAction"] == action


def test_leak_sensor_turns_red_and_a_window_amber(phone):
    tones = phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const tone = (deviceClass) => {
            const instance = hass();
            instance.states = { ...instance.states, "binary_sensor.a": { state: "on", attributes: { device_class: deviceClass } } };
            return model.buildTile(instance, "binary_sensor.a", null, model.normalizeConfig({})).tone;
        };
        return [tone("moisture"), tone("window"), tone("motion")];
    }""")
    assert tones == ["security", "climate", "appliance"]


def test_filters_still_cover_the_whole_house_with_a_layout(phone):
    dashboard = layout_dashboard(phone)
    locks = phone.evaluate(
        """(dashboard) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            const config = model.normalizeConfig(dashboard);
            const base = model.buildHomeModel(instance, config, model.selectEntities(instance, config));
            return model.applyFilter(base, "security", "pl").rooms.flatMap((room) => room.tiles).length;
        }""",
        dashboard,
    )
    assert locks > 0


# 5 and 6. Intercom ------------------------------------------------------------------------------


def test_intercom_buttons_need_a_script(phone):
    mount(phone)
    assert phone.locator("[data-intercom-all]").count() == 0


def test_intercom_reaches_every_room_with_a_speaker(phone):
    mount(phone, {"intercom": {**INTERCOM, "areas": ["area_a", "area_b"]}})
    phone.locator("[data-intercom-all]").click()
    phone.wait_for_selector(f"{SHEET} home-dashboard-intercom input")
    assert calls(phone) == []
    phone.locator(f"{SHEET} home-dashboard-intercom input").fill("Obiad")
    phone.locator("[data-intercom-send]").click()
    phone.wait_for_selector("[data-intercom-state='sent']")
    assert sorted(calls(phone)[0]["message"]["service_data"]["rooms"]) == ["area_a", "area_b"]


def test_second_icon_opens_the_card_of_the_chosen_room(phone):
    dashboard = layout_dashboard(phone)
    mount(phone, dashboard)
    phone.locator("[data-rooms]").click()
    phone.locator("[data-area-link='kitchen']").click()
    phone.wait_for_function("window.location.search.includes('room=kitchen')")
    assert calls(phone) == []
    assert phone.locator(f"{SHEET} section.panel").count() == 0


def test_rooms_can_be_chosen_without_an_intercom(phone):
    mount(phone)
    assert phone.locator("[data-rooms]").count() == 1


@pytest.mark.parametrize("name", ["media", "energy", "map"])
def test_rooms_can_be_chosen_on_every_page(tablet, name):
    mount(tablet, {}, name)
    tablet.locator("[data-rooms]").click()
    assert tablet.locator("[data-area-link]").count() > 0


def test_rooms_can_be_chosen_from_a_room_and_lead_to_another_one(tablet):
    deck = layout_dashboard(tablet)
    open_room(tablet, deck, first_area(tablet))
    tablet.locator("[data-rooms]").click()
    tablet.locator("[data-area-link='kitchen']").click()
    tablet.wait_for_function("window.location.search.includes('room=kitchen')")
    assert tablet.locator("h1").inner_text() == "Kuchnia i Jadalnia"


def test_rooms_can_be_chosen_while_a_filter_is_on(phone):
    phone.evaluate("window.history.replaceState(null, '', '?filter=lights')")
    mount(phone, {"intercom": INTERCOM})
    assert phone.locator("[data-rooms]").count() == 1
    assert phone.locator("[data-intercom-all]").count() == 0


def open_room(page, dashboard, room) -> None:
    page.evaluate(f"window.history.replaceState(null, '', '?room={room}')")
    mount(page, dashboard, "room")


def test_room_intercom_speaks_only_in_that_room(phone):
    area = first_area(phone)
    open_room(phone, {"intercom": {**INTERCOM, "areas": [area, "other"]}}, area)
    phone.locator("[data-intercom-here]").click()
    phone.wait_for_selector(f"{SHEET} home-dashboard-intercom input")
    push_state_update(phone)
    phone.locator(f"{SHEET} home-dashboard-intercom input").fill("Chodź")
    phone.locator("[data-intercom-send]").click()
    phone.wait_for_selector("[data-intercom-state='sent']")
    assert calls(phone)[0]["message"]["service_data"] == {"rooms": [area], "message": "Chodź"}


def test_merged_room_speaks_in_its_areas_that_have_speakers(phone):
    first, second = phone.evaluate("Object.keys(window.dashboard.snapshot.areas).slice(0, 2)")
    dashboard = {
        "intercom": {**INTERCOM, "areas": [first, second, "other"]},
        "layout": [{"id": "both", "name": "Both", "areas": [first, second], "home": [], "sections": []}],
    }
    open_room(phone, dashboard, "both")
    phone.locator("[data-intercom-here]").click()
    phone.locator(f"{SHEET} home-dashboard-intercom input").fill("Obiad")
    phone.locator("[data-intercom-send]").click()
    phone.wait_for_selector("[data-intercom-state='sent']")
    assert set(calls(phone)[0]["message"]["service_data"]["rooms"]) == {first, second}


def test_room_without_a_speaker_has_no_intercom_icon(phone):
    area = first_area(phone)
    open_room(phone, {"intercom": {**INTERCOM, "areas": ["other"]}}, area)
    assert phone.locator("[data-intercom-here]").count() == 0


def test_intercom_says_when_nothing_played(phone):
    mount(phone, {"intercom": {**INTERCOM, "areas": ["area_a"]}})
    phone.evaluate("""() => {
        window.hass.connection.sendMessagePromise = async () => ({ response: { played: [] } });
    }""")
    phone.locator("[data-intercom-all]").click()
    phone.locator(f"{SHEET} home-dashboard-intercom input").fill("Hej")
    phone.locator("[data-intercom-send]").click()
    phone.wait_for_selector("[data-intercom-state='failed']")
    assert "głośnika" in phone.locator("[data-intercom-state='failed']").text_content()


def test_empty_message_sends_nothing(phone):
    mount(phone, {"intercom": {**INTERCOM, "areas": ["area_a"]}})
    phone.locator("[data-intercom-all]").click()
    phone.locator("[data-intercom-send]").click()
    assert calls(phone) == []


def test_rooms_with_speakers_are_found_on_their_own(phone):
    areas = phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        return model.intercomAreas(hass(), model.normalizeConfig({})).map((area) => area.id);
    }""")
    assert areas


def test_recording_is_a_valid_wav(phone):
    header = phone.evaluate("""async () => {
        const { encodeWav } = await import("/custom_components/home_dashboard/www/app/intercom.js");
        const blob = encodeWav([new Float32Array(4800).fill(0.1)], 48000);
        const view = new DataView(await blob.arrayBuffer());
        const text = (start, end) => String.fromCharCode(
            ...Array.from({ length: end - start }, (_, index) => view.getUint8(start + index)));
        return { riff: text(0, 4), wave: text(8, 12), rate: view.getUint32(24, true), size: blob.size,
                 peak: view.getInt16(44 + 200, true) };
    }""")
    assert header["riff"] == "RIFF"
    assert header["wave"] == "WAVE"
    assert header["rate"] == 24000
    assert header["size"] == 44 + 2400 * 2
    assert header["peak"] > 10000  # 0.1 is raised towards full scale, up to the gain limit


def test_plain_http_page_cannot_record(phone):
    assert phone.evaluate("""async () => {
        const { canRecord } = await import("/custom_components/home_dashboard/www/app/intercom.js");
        const { model } = window.dashboard;
        return canRecord({ user: { is_admin: false } }, model.normalizeConfig({ intercom: { media_folder: "x" } }));
    }""") is False


# 7. Status row ----------------------------------------------------------------------------------


def status_room(page) -> str:
    return page.evaluate("""async () => {
        const { buildRoomStatus } = await import("/custom_components/home_dashboard/www/app/status.js");
        const { model, hass } = window.dashboard;
        const instance = hass();
        const config = model.normalizeConfig({});
        return Object.keys(instance.areas)
            .map((id) => [id, buildRoomStatus(instance, config, [id]).length])
            .sort((a, b) => b[1] - a[1])[0][0];
    }""")


@pytest.mark.parametrize("size", ["phone", "tablet"])
def test_status_row_stays_on_one_line_above_the_cameras(size, request):
    page = request.getfixturevalue(size)
    room = status_room(page)
    page.evaluate(f"window.history.replaceState(null, '', '?room={room}')")
    mount(page, None, "room")
    boxes = page.evaluate("""() => {
        const root = window.card.shadowRoot;
        const pills = [...root.querySelectorAll(".pill")].map((pill) => pill.getBoundingClientRect().top);
        const row = root.querySelector(".status").getBoundingClientRect();
        const next = root.querySelector(".status + section")?.getBoundingClientRect();
        return { tops: [...new Set(pills)], rowBottom: row.bottom, nextTop: next?.top };
    }""")
    assert len(boxes["tops"]) == 1
    assert boxes["nextTop"] is None or boxes["nextTop"] >= boxes["rowBottom"]


def test_status_icon_lists_its_devices(phone):
    room = status_room(phone)
    phone.evaluate(f"window.history.replaceState(null, '', '?room={room}')")
    mount(phone, None, "room")
    phone.locator("home-dashboard-page .pill").first.click()
    phone.wait_for_selector(f"{SHEET} [data-row]")
    assert calls(phone) == []


def status_of(page, states: dict, dashboard=None) -> dict:
    return page.evaluate(
        """async ({ states, dashboard }) => {
            const { buildRoomStatus } = await import("/custom_components/home_dashboard/www/app/status.js");
            const { model } = window.dashboard;
            const hass = { language: "pl", areas: {}, devices: {}, entities: {}, states: {},
                           formatEntityState: (stateObj) => stateObj.state };
            for (const [id, [state, attributes, platform]] of Object.entries(states)) {
                hass.entities[id] = { area_id: "a", platform };
                hass.states[id] = { state, attributes: attributes ?? {} };
            }
            return Object.fromEntries(buildRoomStatus(hass, model.normalizeConfig({}), ["a"], dashboard ?? [])
                .map((pill) => [pill.key, [pill.title, pill.value, pill.tone]]));
        }""",
        {"states": states, "dashboard": dashboard},
    )


def test_status_shows_a_range_and_ignores_machines(phone):
    status = status_of(
        phone,
        {
            "sensor.a": ["20.5", {"device_class": "temperature"}],
            "sensor.b": ["22", {"device_class": "temperature"}],
            "sensor.server": ["45", {"device_class": "temperature"}, "glances"],
        },
    )
    assert status["temperature"][1] == "20,5\u201322,0°"


def test_status_grades_the_air(phone):
    assert status_of(phone, {"sensor.a": ["570", {"device_class": "carbon_dioxide"}]})["air"][1] == "Doskonała · 570 ppm"
    assert status_of(phone, {"sensor.a": ["1500", {"device_class": "carbon_dioxide"}]})["air"][2] == "climate"


def test_status_counts_in_polish(phone):
    status = status_of(
        phone,
        {f"cover.{index}": ["open", {}] for index in range(2)} | {f"light.{index}": ["on", {}] for index in range(5)},
    )
    assert status["covers"][0] == "2 rolety"
    assert status["lights"][0] == "5 świateł"


def test_status_agrees_for_a_single_device(phone):
    status = status_of(phone, {"switch.a": ["on", {}], "cover.a": ["open", {}], "light.a": ["on", {}]})
    assert status["switches"][:2] == ["Włącznik", "Włączony"]
    assert status["covers"][:2] == ["Roleta", "Otwarta"]
    assert status["lights"][:2] == ["Światło", "Włączone"]


def test_status_hides_what_is_at_rest(phone):
    status = status_of(phone, {"light.a": ["off", {}], "cover.a": ["closed", {}], "switch.a": ["off", {}]})
    assert status == {}


def test_status_warns_about_a_leak_first(phone):
    status = status_of(phone, {"binary_sensor.a": ["on", {"device_class": "moisture"}]})
    assert status["alarm"] == ["Zalanie", "Wykryto", "security"]
    assert "leak" not in status


def test_quiet_leak_sensors_still_show_they_watch(phone):
    assert status_of(phone, {"binary_sensor.a": ["off", {"device_class": "moisture"}]})["leak"][1] == "Brak"


def test_fixed_group_stays_visible_at_rest(phone):
    status = status_of(
        phone,
        {"binary_sensor.door": ["off", {"device_class": "door"}]},
        [{"name": "Drzwi auta", "type": "contact", "entities": ["binary_sensor.door"]}],
    )
    assert status["fixed-0"] == ["Drzwi auta", "Zamknięte", "off"]


# Guest mode -------------------------------------------------------------------------------------


def guest_dashboard(page) -> dict:
    hidden = page.evaluate("""() => {
        const { model, hass } = window.dashboard;
        return model.buildCameras(hass(), model.normalizeConfig({}))
            .filter((camera) => camera.entityId.startsWith("camera.")).map((camera) => camera.entityId);
    }""")
    return {"cameras": {"guest": {"entity": "input_boolean.guest", "hide": hidden}}}


def shown_cameras(page) -> list:
    return page.evaluate("""() => [...window.card.shadowRoot.querySelectorAll("[data-camera]")]
        .map((tile) => tile.dataset.camera)""")


def test_guest_mode_hides_the_inside_of_the_house(phone):
    dashboard = guest_dashboard(phone)
    hidden = dashboard["cameras"]["guest"]["hide"]
    set_state(phone, "input_boolean.guest", "on")
    mount(phone, dashboard)
    shown = shown_cameras(phone)
    assert shown
    assert not set(shown) & set(hidden)


def test_guest_mode_also_empties_the_thumbnails(phone):
    dashboard = guest_dashboard(phone)
    set_state(phone, "input_boolean.guest", "on")
    mount(phone, dashboard)
    phone.locator("home-dashboard-page .camera").first.click()
    phone.wait_for_selector(f"{SHEET} .panel")
    thumbs = phone.evaluate("""() => [...document.querySelector("home-dashboard-chrome").shadowRoot
        .querySelector("home-dashboard-sheet").shadowRoot.querySelectorAll("[data-thumb]")]
        .map((thumb) => thumb.dataset.thumb)""")
    assert not set(thumbs) & set(dashboard["cameras"]["guest"]["hide"])


def test_cameras_come_back_when_guests_leave(phone):
    dashboard = guest_dashboard(phone)
    set_state(phone, "input_boolean.guest", "off")
    mount(phone, dashboard)
    assert set(dashboard["cameras"]["guest"]["hide"]) <= set(shown_cameras(phone))


def test_turning_guest_mode_on_closes_an_open_camera(phone):
    dashboard = guest_dashboard(phone)
    set_state(phone, "input_boolean.guest", "off")
    mount(phone, dashboard)
    phone.locator("home-dashboard-page .camera").first.click()
    phone.wait_for_selector(f"{SHEET} .picture", state="attached")
    phone.evaluate("""() => {
        const chrome = document.querySelector("home-dashboard-chrome");
        const hass = window.dashboard.withState(window.hass, "input_boolean.guest", { state: "on" });
        chrome.hass = hass;
    }""")
    phone.wait_for_timeout(100)
    assert phone.locator(f"{SHEET} .picture").count() == 0
