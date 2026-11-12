"""Blocks of several entities, the remote, the camera corners and the return to Home."""

from __future__ import annotations

import pytest

from .test_page import mount

ON_TV = {
    "state": "on",
    "attributes": {
        "friendly_name": "TV",
        "source": "Netflix",
        "source_list": ["Live TV", "Netflix", "HDMI4"],
        "volume_level": 0.2,
        "is_volume_muted": False,
    },
}


def add_entity(page, entity_id: str, state: str, attributes: dict | None = None) -> None:
    page.evaluate(
        """({ id, state, attributes }) => {
            window.dashboard.snapshot.states[id] = { entity_id: id, state, attributes };
        }""",
        {"id": entity_id, "state": state, "attributes": attributes or {}},
    )


def calls(page) -> list:
    return page.evaluate("window.hass.calls")


def room_with(*tiles: dict) -> dict:
    return {"layout": [{"id": "test", "name": "Test", "areas": [], "home": list(tiles), "sections": []}]}


def block(**extra) -> dict:
    return {"kind": "panel", "name": "Machine", "entity": "sensor.machine", **extra}


def open_block(page, dashboard: dict, name: str = "Machine") -> None:
    mount(page, dashboard)
    page.locator(f"home-dashboard-page [data-tile='{name}']").click()
    page.wait_for_selector("home-dashboard-sheet section.panel")


# Tiles -------------------------------------------------------------------------------------------


def test_a_block_shows_its_translated_state_and_numbers_across_the_row(phone):
    add_entity(phone, "sensor.machine", "ready")
    add_entity(phone, "sensor.cups", "3.4")
    add_entity(phone, "sensor.water", "1.25")
    dashboard = room_with(
        block(
            labels={"ready": "Gotowy"},
            stats=[
                {"name": "Kawy", "entity": "sensor.cups", "digits": 0},
                {"name": "Woda", "entity": "sensor.water", "digits": 1, "unit": "l"},
                {"name": "Brak", "entity": "sensor.missing"},
            ],
        )
    )
    mount(phone, dashboard)
    tile = phone.locator("home-dashboard-page [data-tile='Machine']")
    assert "Gotowy" in tile.inner_text()
    assert tile.locator(".stats b").all_inner_texts() == ["3", "1,3 l", "\u2013"]
    width = phone.evaluate("""() => {
        const tile = window.card.shadowRoot.querySelector("[data-tile='Machine']");
        return tile.getBoundingClientRect().width / tile.parentElement.getBoundingClientRect().width;
    }""")
    assert width == pytest.approx(1)


def test_on_a_tablet_a_block_with_numbers_is_two_tiles_wide(tablet):
    add_entity(tablet, "sensor.machine", "ready")
    add_entity(tablet, "sensor.cups", "3")
    add_entity(tablet, "light.one", "off", {"friendly_name": "One"})
    dashboard = room_with(block(stats=[{"name": "Kawy", "entity": "sensor.cups"}]), {"entity": "light.one"})
    mount(tablet, dashboard)
    widths = tablet.evaluate("""() => {
        const root = window.card.shadowRoot;
        const tile = root.querySelector("[data-tile='Machine']");
        const other = root.querySelector(".tile[data-entity='light.one']");
        const gap = parseFloat(getComputedStyle(tile.parentElement).columnGap) || 0;
        return [tile.getBoundingClientRect().width, other.getBoundingClientRect().width * 2 + gap,
            tile.parentElement.getBoundingClientRect().width];
    }""")
    assert widths[0] == pytest.approx(widths[1], abs=1)
    assert widths[0] < widths[2]
    # Below the ordinary tiles, so its height does not stretch them.
    tops = tablet.evaluate("""() => { const root = window.card.shadowRoot;
        return [root.querySelector("[data-tile='Machine']").getBoundingClientRect().top,
            root.querySelector(".tile[data-entity='light.one']").getBoundingClientRect().bottom]; }""")
    assert tops[0] >= tops[1]


def test_on_a_tablet_two_blocks_stand_side_by_side_below_the_tiles(tablet):
    add_entity(tablet, "sensor.machine", "ready")
    add_entity(tablet, "sensor.cups", "3")
    add_entity(tablet, "light.one", "off", {"friendly_name": "One"})
    stats = [{"name": "Kawy", "entity": "sensor.cups"}]
    dashboard = room_with(block(stats=stats), block(name="Second", stats=stats), {"entity": "light.one"})
    mount(tablet, dashboard)
    boxes = tablet.evaluate("""() => { const root = window.card.shadowRoot;
        const box = (selector) => root.querySelector(selector).getBoundingClientRect().toJSON();
        return [box("[data-tile='Machine']"), box("[data-tile='Second']"), box(".tile[data-entity='light.one']")]; }""")
    first, second, light = boxes
    assert first["top"] >= light["bottom"]
    assert second["top"] == first["top"]
    assert second["left"] > first["left"]


def test_a_compact_block_is_an_ordinary_tile(phone):
    add_entity(phone, "sensor.machine", "ready")
    add_entity(phone, "sensor.cups", "3")
    mount(phone, room_with(block(compact=True, stats=[{"name": "Kawy", "entity": "sensor.cups"}])))
    assert phone.locator("home-dashboard-page [data-tile='Machine'] .stats").count() == 0


def test_a_block_lights_up_on_the_chosen_state(phone):
    add_entity(phone, "sensor.machine", "running")
    mount(phone, room_with(block(active="sensor.machine", active_state="running")))
    assert "appliance" in phone.locator("home-dashboard-page [data-tile='Machine']").get_attribute("class")


def test_a_block_without_its_entity_is_left_out(phone):
    mount(phone, room_with(block(entity="sensor.nothing_like_this")))
    assert phone.locator("home-dashboard-page [data-tile='Machine']").count() == 0


def test_a_block_can_hide_in_guest_mode(phone):
    add_entity(phone, "input_boolean.guest", "on")
    mount(phone, room_with({"kind": "panel", "name": "NVR", "frame": "about:blank", "hidden_when": "input_boolean.guest"}))
    assert phone.locator("home-dashboard-page [data-tile='NVR']").count() == 0


def test_opening_a_block_calls_nothing(phone):
    add_entity(phone, "sensor.machine", "ready")
    open_block(phone, room_with(block()))
    assert calls(phone) == []


def test_watched_entities_include_everything_a_block_reads(phone):
    ids = phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const config = model.normalizeConfig({ layout: [{ id: "x", name: "X", home: [{
            kind: "panel", name: "M", entity: "sensor.a", status: "sensor.b", active: "sensor.c",
            stats: [{ name: "s", entity: "sensor.d" }], groups: [{ rows: [{ entity: "sensor.e" }] }],
        }], sections: [] }] });
        const instance = hass();
        return [...model.watchedEntityIds(instance, config, model.selectEntities(instance, config))];
    }""")
    assert {"sensor.a", "sensor.b", "sensor.c", "sensor.d", "sensor.e"} <= set(ids)


# Sheet -------------------------------------------------------------------------------------------


def test_rows_send_the_service_of_their_kind(phone):
    add_entity(phone, "sensor.machine", "ready")
    add_entity(phone, "switch.sync", "off", {"friendly_name": "Sync"})
    add_entity(phone, "select.mode", "video", {"options": ["video", "game"]})
    add_entity(phone, "number.level", "40", {"min": 0, "max": 100, "step": 1})
    add_entity(phone, "button.start", "unknown", {"friendly_name": "Start"})
    rows = [
        {"entity": "switch.sync"},
        {"entity": "select.mode", "labels": {"video": "Wideo", "game": "Gra"}},
        {"entity": "number.level"},
        {"entity": "button.start"},
    ]
    open_block(phone, room_with(block(groups=[{"title": "Sterowanie", "rows": rows}])))
    phone.locator("[data-toggle='switch.sync']").click()
    assert phone.locator("[data-select='select.mode'] option").all_inner_texts() == ["Wideo", "Gra"]
    phone.locator("[data-select='select.mode']").select_option("game")
    phone.locator("[data-range='number.level']").fill("70")
    phone.locator("[data-press='button.start']").click()
    sent = [(call["domain"], call["service"], call["data"]) for call in calls(phone)]
    assert sent == [
        ("homeassistant", "toggle", {"entity_id": "switch.sync"}),
        ("select", "select_option", {"entity_id": "select.mode", "option": "game"}),
        ("number", "set_value", {"entity_id": "number.level", "value": 70}),
        ("button", "press", {"entity_id": "button.start"}),
    ]


def test_a_lock_row_can_only_be_looked_at(phone):
    add_entity(phone, "sensor.machine", "ready")
    add_entity(phone, "lock.car", "locked", {"friendly_name": "Car"})
    open_block(phone, room_with(block(groups=[{"rows": [{"entity": "lock.car"}]}])))
    details = phone.evaluate("""() => new Promise((resolve) => {
        const sheet = document.querySelector("home-dashboard-chrome").shadowRoot.querySelector("home-dashboard-sheet");
        sheet.addEventListener("sheet-details", (event) => resolve(event.detail.entityId));
        sheet.shadowRoot.querySelector("[data-field='lock.car']").click();
    })""")
    assert details == "lock.car"
    assert calls(phone) == []


def test_an_action_with_a_question_waits_for_the_answer(phone):
    add_entity(phone, "sensor.machine", "ready")
    add_entity(phone, "button.climate", "unknown")
    action = {"name": "Klimatyzacja", "entity": "button.climate", "confirm": "Włączyć?"}
    open_block(phone, room_with(block(actions=[action])))
    phone.locator("[data-action='button.climate']").click()
    assert calls(phone) == []
    assert "Włączyć?" in phone.locator("[data-confirm]").inner_text()
    phone.locator("[data-confirm-no]").click()
    assert phone.locator("[data-confirm]").count() == 0
    assert calls(phone) == []
    phone.locator("[data-action='button.climate']").click()
    phone.locator("[data-confirm-yes]").click()
    (sent,) = calls(phone)
    assert (sent["domain"], sent["service"]) == ("button", "press")
    assert phone.locator("[data-confirm]").count() == 0


def test_an_action_without_a_question_runs_at_once(phone):
    add_entity(phone, "sensor.machine", "ready")
    add_entity(phone, "button.dance", "unknown")
    open_block(phone, room_with(block(actions=[{"name": "Tańcz", "entity": "button.dance"}])))
    phone.locator("[data-action='button.dance']").click()
    assert calls(phone)[0]["data"] == {"entity_id": "button.dance"}


def test_a_control_card_starts_only_on_the_button(phone):
    add_entity(phone, "sensor.machine", "ready")
    open_block(phone, room_with(block(card={"type": "custom:robot-card", "camera": "camera.robot"})))
    assert phone.evaluate("window.createdCards") == []
    phone.locator("[data-panel-card]").click()
    phone.wait_for_selector("[data-card='custom:robot-card']", state="attached")
    assert phone.evaluate("window.createdCards") == [{"type": "custom:robot-card", "camera": "camera.robot"}]


def test_a_control_card_takes_the_colours_of_the_window(phone):
    add_entity(phone, "sensor.machine", "ready")
    open_block(phone, room_with(block(card={"type": "custom:robot-card"})))
    phone.locator("[data-panel-card]").click()
    phone.wait_for_selector("[data-card='custom:robot-card']", state="attached")
    colours = phone.locator("[data-card='custom:robot-card']").evaluate("""(card) => {
        const style = getComputedStyle(card);
        const probe = (value) => { const box = document.createElement('i'); box.style.color = value;
            card.parentElement.append(box); const colour = getComputedStyle(box).color; box.remove(); return colour; };
        return { button: probe('var(--secondary-background-color)'), off: probe('var(--hd-off)'),
            text: probe('var(--primary-text-color)'), ink: probe('var(--hd-text)'),
            card: style.getPropertyValue('--card-background-color').trim() }; }""")
    assert colours["button"] == colours["off"]
    assert colours["text"] == colours["ink"]
    assert colours["card"] == "transparent"


def test_closing_the_sheet_removes_the_control_card(phone):
    add_entity(phone, "sensor.machine", "ready")
    open_block(phone, room_with(block(card={"type": "custom:robot-card"})))
    phone.locator("[data-panel-card]").click()
    phone.wait_for_selector("[data-card='custom:robot-card']", state="attached")
    phone.locator("home-dashboard-sheet header button").first.click()
    phone.wait_for_selector("home-dashboard-sheet section.panel", state="detached")
    assert phone.locator("[data-card='custom:robot-card']").count() == 0


def test_a_tall_control_card_pushes_the_buttons_down(phone):
    add_entity(phone, "sensor.machine", "ready")
    add_entity(phone, "button.dance", "unknown")
    item = block(card={"type": "custom:robot-card"}, actions=[{"name": "Tańcz", "entity": "button.dance"}])
    open_block(phone, room_with(item))
    phone.locator("[data-panel-card]").click()
    phone.wait_for_selector("[data-card='custom:robot-card']", state="attached")
    card = phone.locator("[data-card='custom:robot-card']")
    card.evaluate("(card) => { card.style.display = 'block'; card.style.height = '1100px'; }")
    bottom = card.evaluate("(card) => card.getBoundingClientRect().bottom")
    top = phone.locator("[data-action='button.dance']").evaluate("(button) => button.getBoundingClientRect().top")
    assert top >= bottom


def test_a_control_card_is_not_cut_off_after_two_minutes(phone):
    add_entity(phone, "sensor.machine", "ready")
    open_block(phone, room_with(block(card={"type": "custom:robot-card"})))
    phone.locator("[data-panel-card]").click()
    phone.wait_for_selector("[data-card='custom:robot-card']", state="attached")
    timer = phone.evaluate("""() => document.querySelector("home-dashboard-chrome").shadowRoot
        .querySelector("home-dashboard-sheet")._liveTimer ?? null""")
    assert timer is None


@pytest.mark.parametrize("device", ["phone", "tablet"])
def test_a_full_screen_sheet_also_covers_the_area_under_the_system_bars(device, request):
    page = request.getfixturevalue(device)
    mount(page)
    page.locator("home-dashboard-page .camera").first.click()
    page.wait_for_selector("home-dashboard-sheet section.panel")
    box = page.locator("home-dashboard-sheet .cover").evaluate(
        "(cover) => { const box = cover.getBoundingClientRect(); return [box.top, box.bottom - innerHeight]; }"
    )
    assert box[0] < -100
    assert box[1] > 100


def test_a_centred_sheet_on_a_tablet_keeps_the_page_visible_around_it(tablet):
    add_entity(tablet, "sensor.machine", "ready")
    open_block(tablet, room_with(block()))
    assert tablet.locator("home-dashboard-sheet .cover").is_hidden()


def test_a_web_page_opens_on_the_whole_screen_of_a_tablet(tablet):
    item = {"kind": "panel", "name": "NVR", "frame": "about:blank", "state_text": "Podgląd"}
    open_block(tablet, room_with(item), "NVR")
    box = tablet.locator("home-dashboard-sheet section.panel").bounding_box()
    assert box["width"] == 1180
    assert tablet.locator("home-dashboard-sheet iframe").get_attribute("src") == "about:blank"


def test_action_labels_stay_inside_their_buttons(phone):
    add_entity(phone, "sensor.machine", "ready")
    add_entity(phone, "button.climate", "unknown")
    open_block(phone, room_with(block(actions=[{"name": "Klimatyzacja", "entity": "button.climate"}])))
    button = phone.locator("[data-action='button.climate']").bounding_box()
    label = phone.locator("[data-action='button.climate'] span").bounding_box()
    assert label["y"] + label["height"] <= button["y"] + button["height"]
    assert label["width"] <= button["width"]


def test_a_row_does_not_repeat_the_name_of_its_block(phone):
    add_entity(phone, "sensor.machine", "ready")
    add_entity(phone, "binary_sensor.door", "off", {"friendly_name": "Machine Front door"})
    open_block(phone, room_with(block(groups=[{"rows": [{"entity": "binary_sensor.door"}]}])))
    assert phone.locator("[data-field='binary_sensor.door'] span").inner_text() == "Front door"


# Remote ------------------------------------------------------------------------------------------


def tv_item(**extra) -> dict:
    return {
        "kind": "tv",
        "entity": "media_player.tv",
        "name": "Telewizor",
        "icon": "mdi:television",
        "on": {"service": "remote.turn_on", "target": "remote.tv"},
        "off": {"service": "script.tv_off"},
        "shortcuts": [{"name": "Netflix", "icon": "mdi:netflix"}, {"name": "HDMI", "icon": "mdi:hdmi"}],
        **extra,
    }


def open_tv(page, state: dict, **extra) -> None:
    add_entity(page, "media_player.tv", state["state"], state["attributes"])
    dashboard = {"entities": {"include": {}}, **room_with(tv_item(**extra))}
    open_block(page, dashboard, "Telewizor")


def test_the_remote_turns_a_running_tv_off_and_a_sleeping_one_on(phone):
    open_tv(phone, ON_TV)
    phone.locator("[data-remote='tv_power']").click()
    assert (calls(phone)[0]["domain"], calls(phone)[0]["service"]) == ("script", "tv_off")


def test_the_remote_starts_a_tv_that_is_off(phone):
    open_tv(phone, {"state": "off", "attributes": {}})
    phone.locator("[data-remote='tv_power']").click()
    (sent,) = calls(phone)
    assert (sent["domain"], sent["service"], sent["data"]) == ("remote", "turn_on", {"entity_id": "remote.tv"})


def test_the_remote_shows_the_volume_while_it_moves(phone):
    open_tv(phone, ON_TV)
    phone.locator("[data-tv-volume]").fill("35")
    assert "35%" in phone.locator(".range-field h3").text_content()


def test_the_remote_controls_the_volume(phone):
    open_tv(phone, ON_TV)
    phone.locator("[data-remote='tv_mute']").click()
    phone.locator("[data-remote='tv_volume_up']").click()
    phone.locator("[data-tv-volume]").fill("35")
    sent = [(call["service"], call["data"]) for call in calls(phone)]
    assert sent == [
        ("volume_mute", {"entity_id": "media_player.tv", "is_volume_muted": True}),
        ("volume_up", {"entity_id": "media_player.tv"}),
        ("volume_set", {"entity_id": "media_player.tv", "volume_level": 0.35}),
    ]


def test_a_shortcut_matches_the_name_on_the_tv_and_marks_the_current_one(phone):
    open_tv(phone, ON_TV)
    assert "on" in phone.locator("[data-shortcut='Netflix']").get_attribute("class").split()
    phone.locator("[data-shortcut='HDMI']").click()
    assert calls(phone)[0]["data"] == {"entity_id": "media_player.tv", "source": "HDMI4"}


def test_a_source_for_a_tv_that_is_off_goes_through_its_script(phone):
    phone.evaluate("localStorage.clear()")
    open_tv(
        phone,
        {"state": "off", "attributes": {}},
        source_script={"service": "script.tv_app", "field": "source_name"},
    )
    phone.locator("[data-shortcut='Netflix']").click()
    (sent,) = calls(phone)
    assert (sent["domain"], sent["service"], sent["data"]) == ("script", "tv_app", {"source_name": "Netflix"})


def test_the_list_of_sources_survives_turning_the_tv_off(phone):
    phone.evaluate("localStorage.clear()")
    sources = phone.evaluate("""async () => {
        const { rememberedSources } = await import("/custom_components/home_dashboard/www/app/panel.js");
        rememberedSources("media_player.x", ["A", "B"]);
        return rememberedSources("media_player.x", undefined);
    }""")
    assert sources == ["A", "B"]


def test_a_source_is_chosen_once_the_tv_has_started(phone):
    sent = phone.evaluate("""async () => {
        const { selectSourceAfterStart } = await import("/custom_components/home_dashboard/www/app/panel.js");
        const calls = [];
        const hass = { states: { "media_player.x": { state: "off" } },
                       callService: (...args) => calls.push(args) };
        selectSourceAfterStart(() => hass, "media_player.x", "Netflix", { poll: 5, settle: 5, limit: 1000 });
        await new Promise((resolve) => setTimeout(resolve, 30));
        const before = calls.length;
        hass.states["media_player.x"] = { state: "on" };
        await new Promise((resolve) => setTimeout(resolve, 40));
        return { before, calls };
    }""")
    assert sent["before"] == 0
    assert sent["calls"] == [["media_player", "select_source", {"entity_id": "media_player.x", "source": "Netflix"}]]


def test_a_tv_that_never_starts_gets_no_source(phone):
    sent = phone.evaluate("""async () => {
        const { selectSourceAfterStart } = await import("/custom_components/home_dashboard/www/app/panel.js");
        const calls = [];
        const hass = { states: { "media_player.x": { state: "off" } },
                       callService: (...args) => calls.push(args) };
        selectSourceAfterStart(() => hass, "media_player.x", "Netflix", { poll: 5, settle: 5, limit: 15 });
        await new Promise((resolve) => setTimeout(resolve, 40));
        hass.states["media_player.x"] = { state: "on" };
        await new Promise((resolve) => setTimeout(resolve, 30));
        return calls;
    }""")
    assert sent == []


def test_sound_modes_show_only_when_asked_for_and_hide_unknown_ones(phone):
    state = {
        "state": "on",
        "attributes": {**ON_TV["attributes"], "sound_mode": "Cinema", "sound_mode_list": ["Cinema", "Unknown 7"]},
    }
    open_tv(phone, state, sound_mode=True)
    assert phone.locator("[data-choice='Cinema']").count() == 1
    assert phone.locator("[data-choice='Unknown 7']").count() == 0


# Cameras -----------------------------------------------------------------------------------------


def corners(page) -> list[dict]:
    return page.evaluate("""() => [...window.card.shadowRoot.querySelectorAll(".camera-column")].map((column) => {
        const parts = [...column.querySelectorAll(".camera")].map((camera) => getComputedStyle(camera));
        const [top, bottom] = [parts[0], parts[parts.length - 1]];
        return { tl: top.borderTopLeftRadius, tr: top.borderTopRightRadius,
                 bl: bottom.borderBottomLeftRadius, br: bottom.borderBottomRightRadius };
    })""")


def test_the_outer_corners_of_the_strip_are_round_on_both_ends(tablet):
    mount(tablet)
    columns = corners(tablet)
    assert len(columns) > 1
    assert (columns[0]["tl"], columns[0]["bl"]) == ("24px", "24px")
    assert (columns[-1]["tr"], columns[-1]["br"]) == ("24px", "24px")
    assert (columns[0]["tr"], columns[-1]["tl"]) == ("0px", "0px")


def test_a_single_camera_is_round_on_every_corner(tablet):
    mount(tablet)
    tablet.evaluate("""() => {
        const strip = window.card.shadowRoot.querySelector(".cameras");
        [...strip.children].slice(1).forEach((column) => column.remove());
        [...strip.children[0].children].slice(1).forEach((camera) => camera.remove());
    }""")
    (column,) = corners(tablet)
    assert set(column.values()) == {"24px"}


@pytest.mark.parametrize("device", ["phone", "tablet"])
def test_a_camera_is_a_wide_rectangle(device, request):
    page = request.getfixturevalue(device)
    mount(page)
    ratio = page.evaluate("""() => {
        const box = window.card.shadowRoot.querySelector(".camera-column").getBoundingClientRect();
        return box.width / box.height;
    }""")
    assert ratio >= 1.6


@pytest.mark.parametrize("device", ["phone", "tablet"])
def test_two_cameras_in_a_column_are_each_half_of_a_single_one(device, request):
    page = request.getfixturevalue(device)
    mount(page)
    single, stacked = page.evaluate("""() => {
        const columns = [...window.card.shadowRoot.querySelectorAll(".camera-column")];
        const size = (column) => {
            const box = column.querySelector(".camera").getBoundingClientRect();
            return [box.width, box.height];
        };
        return [size(columns.find((column) => column.children.length === 1)),
                size(columns.find((column) => column.children.length === 2))];
    }""")
    assert stacked[0] == pytest.approx(single[0] / 2, abs=2)
    assert stacked[1] == pytest.approx(single[1] / 2, abs=2)


def test_the_camera_screen_keeps_picture_and_thumbnails_together_in_the_middle(phone):
    mount(phone)
    phone.locator("home-dashboard-page .camera").first.click()
    phone.wait_for_selector("[data-thumbs]")
    phone.wait_for_selector("home-dashboard-timeline [data-timeline-track]")
    boxes = phone.evaluate("""() => {
        const root = document.querySelector("home-dashboard-chrome").shadowRoot
            .querySelector("home-dashboard-sheet").shadowRoot;
        const box = (selector) => root.querySelector(selector).getBoundingClientRect();
        return { days: box("home-dashboard-recording-days"), thumbs: box("[data-thumbs]"),
                 picture: box(".stage"), line: box("home-dashboard-timeline") };
    }""")
    # Days at the top, the line of time at the bottom, and the picture with the thumbnails halfway between them.
    above = boxes["picture"]["top"] - boxes["days"]["bottom"]
    below = boxes["line"]["top"] - boxes["thumbs"]["bottom"]
    assert above > 0 and below > 0
    assert abs(above - below) <= 2


def test_the_current_thumbnail_has_a_frame_above_the_picture(phone):
    mount(phone)
    phone.locator("home-dashboard-page .camera").first.click()
    outline = phone.locator("home-dashboard-sheet .camera-thumb.current").evaluate(
        "(thumb) => getComputedStyle(thumb).outlineStyle"
    )
    assert outline == "solid"


def test_the_current_thumbnail_is_scrolled_into_view(phone):
    mount(phone)
    phone.locator("home-dashboard-page .camera:not(.offline)").last.click()
    phone.wait_for_selector("[data-thumbs]")
    box = phone.locator("home-dashboard-sheet .camera-thumb.current").bounding_box()
    assert box["x"] >= 0
    assert box["x"] + box["width"] <= 402


def test_room_buttons_keep_a_gap_from_the_status_row(phone):
    area = phone.evaluate("Object.keys(window.dashboard.snapshot.areas)[0]")
    phone.evaluate(f"window.history.replaceState(null, '', '?room={area}')")
    add_entity(phone, "input_boolean.placeholder", "off")
    mount(phone, {"intercom": {"script": "script.announce", "areas": [area]}}, "room")
    gap = phone.evaluate("""() => {
        const root = window.card.shadowRoot;
        const status = root.querySelector(".status");
        return status ? status.getBoundingClientRect().top
            - root.querySelector("[data-rooms]").getBoundingClientRect().bottom : null;
    }""")
    assert gap is None or gap >= 8


def test_the_document_behind_the_page_takes_its_colour_and_gives_it_back(phone):
    phone.evaluate("""() => {
        const meta = document.createElement("meta");
        meta.name = "theme-color";
        meta.content = "#03a9f4";
        document.head.append(meta);
    }""")
    mount(phone)
    assert phone.evaluate("document.documentElement.style.backgroundColor") == "rgb(251, 250, 255)"
    assert phone.evaluate("""document.querySelector('meta[name="theme-color"]').content""") == "#fbfaff"
    phone.evaluate("""() => document.querySelector("home-dashboard-chrome")._applySettings({ color_mode: "dark" })""")
    assert phone.evaluate("document.body.style.backgroundColor") == "rgb(18, 19, 22)"
    phone.evaluate("""() => document.querySelector("home-dashboard-chrome").remove()""")
    assert phone.evaluate("document.body.style.backgroundColor") == ""
    assert phone.evaluate("""document.querySelector('meta[name="theme-color"]').content""") == "#03a9f4"


def camera_rows(page) -> list:
    return page.evaluate("""() => [...window.card.shadowRoot.querySelectorAll(".camera-list .camera")]
        .map((camera) => Math.round(camera.getBoundingClientRect().top))""")


def test_security_lists_four_cameras_in_a_row_on_a_tablet_on_its_side(tablet):
    tablet.evaluate("window.history.replaceState(null, '', '?filter=security')")
    mount(tablet)
    tops = camera_rows(tablet)
    assert len(tops) >= 5
    assert tops[:4] == [tops[0]] * 4
    assert tops[4] > tops[0]


def test_security_lists_two_cameras_in_a_row_on_an_upright_tablet(tablet):
    tablet.set_viewport_size({"width": 900, "height": 1180})
    tablet.evaluate("window.history.replaceState(null, '', '?filter=security')")
    mount(tablet)
    tops = camera_rows(tablet)
    assert tops[0] == tops[1] and tops[2] > tops[0]


# Return to Home ----------------------------------------------------------------------------------




def test_a_tablet_left_alone_goes_back_to_home(tablet):
    mount(tablet, {"idle": {"return_after": 0.05}}, "media")
    tablet.wait_for_function(
        "window.location.pathname.endsWith('/home')",
        timeout=2000,
    )


def test_a_phone_stays_where_it_is(phone):
    path = phone.evaluate("window.location.pathname")
    mount(phone, {"idle": {"return_after": 0.05}}, "media")
    phone.wait_for_timeout(200)
    assert phone.evaluate("window.location.pathname") == path


def test_zero_turns_the_return_off(tablet):
    path = tablet.evaluate("window.location.pathname")
    mount(tablet, {"idle": {"return_after": 0}}, "media")
    tablet.wait_for_timeout(200)
    assert tablet.evaluate("window.location.pathname") == path


def test_touching_the_screen_starts_the_wait_again(tablet):
    path = tablet.evaluate("window.location.pathname")
    # Touches 0.2 s apart, for longer than the wait of 0.6 s: under load each still comes well within it.
    mount(tablet, {"idle": {"return_after": 0.6}}, "media")
    for _ in range(5):
        tablet.wait_for_timeout(200)
        tablet.mouse.click(600, 10)
    assert tablet.evaluate("window.location.pathname") == path


def test_the_return_closes_a_sheet_and_clears_the_filter(tablet):
    add_entity(tablet, "sensor.machine", "ready")
    open_block(tablet, {**room_with(block()), "idle": {"return_after": 0}})
    tablet.evaluate("""async () => {
        window.card._toggleFilter("lights");
        await document.querySelector("home-dashboard-chrome")._returnHome();
    }""")
    tablet.wait_for_selector("home-dashboard-sheet section.panel", state="detached")
    assert "filter" not in tablet.evaluate("window.location.search")


@pytest.mark.parametrize(
    ("overlay", "held"),
    [
        ({"type": "settings"}, True),
        ({"type": "sheet", "sheet": {"kind": "intercom"}}, True),
        ({"type": "sheet", "sheet": {"kind": "panel", "item": {"frame": "x"}}}, True),
        ({"type": "sheet", "sheet": {"kind": "panel", "item": {"card": {}}}}, True),
        ({"type": "sheet", "sheet": {"kind": "panel", "item": {}}}, False),
        ({"type": "sheet", "sheet": {"kind": "climate"}}, False),
        (None, False),
    ],
)
def test_what_someone_may_still_be_using_is_not_closed(phone, overlay, held):
    assert phone.evaluate("(overlay) => window.dashboard.chrome.holdsScreen(overlay)", overlay) is held


def test_the_wait_can_be_changed_in_the_settings(phone):
    mount(phone)
    phone.evaluate("""async () => {
        const chrome = document.querySelector("home-dashboard-chrome");
        chrome.open({ type: "settings" });
        await chrome.updateComplete;
    }""")
    phone.locator("[data-idle]").select_option("5")
    draft = phone.evaluate("""() => document.querySelector("home-dashboard-chrome").shadowRoot
        .querySelector("home-dashboard-settings")._draft.idle""")
    assert draft == {"return_after": 300}


# A tile that names a shortcut ----------------------------------------------------------------------


def shortcut_room(*tiles: dict) -> dict:
    vacuum = block(
        name="Odkurzacz",
        stats=[{"name": "Filtr", "entity": "sensor.filter", "unit": "%"}],
        actions=[{"name": "Start", "entity": "vacuum.robot", "service": "vacuum.start"}],
    )
    vacuum.pop("entity")
    return {"shortcuts": [vacuum], **room_with(*tiles)}


def test_a_tile_naming_a_shortcut_shows_its_block_and_opens_its_window(phone):
    add_entity(phone, "vacuum.robot", "docked", {"friendly_name": "Robot"})
    add_entity(phone, "sensor.filter", "71")
    mount(phone, shortcut_room({"shortcut": "Odkurzacz", "entity": "vacuum.robot"}))
    tile = phone.locator("home-dashboard-page [data-tile='Odkurzacz']")
    assert tile.locator(".stats b").all_inner_texts() == ["71 %"]
    tile.click()
    phone.wait_for_selector("home-dashboard-sheet section.panel")
    assert phone.locator("home-dashboard-sheet [data-action='vacuum.robot']").count() == 1


def test_a_tile_naming_an_unknown_shortcut_is_left_out(phone):
    add_entity(phone, "vacuum.robot", "docked")
    mount(phone, shortcut_room({"shortcut": "Nie ma", "entity": "vacuum.robot"}))
    assert phone.locator("home-dashboard-page [data-tile='Nie ma']").count() == 0


# A block of several groups ------------------------------------------------------------------------


def laundry_block() -> dict:
    return block(
        stats=[{"name": "Program", "entity": "sensor.machine"}],
        actions=[{"name": "Start", "entity": "button.start"}],
        groups=[
            {"title": "Program", "layout": "controls", "rows": [
                {"entity": "select.spin", "name": "Spin", "order": ["400 Rpm", "800 Rpm", "1400 Rpm"]}]},
            {"title": "State", "rows": [{"entity": "sensor.door", "name": "Door"}]},
        ],
    )


def add_laundry(page) -> None:
    add_entity(page, "sensor.machine", "Running")
    add_entity(page, "button.start", "unknown")
    add_entity(page, "sensor.door", "closed")
    add_entity(page, "select.spin", "1400 Rpm", {"options": ["1400 Rpm", "400 Rpm", "800 Rpm"]})


def test_choices_follow_the_order_the_row_gives(phone):
    add_laundry(phone)
    open_block(phone, room_with(laundry_block()))
    texts = phone.locator("home-dashboard-sheet [data-choice]").all_inner_texts()
    assert [text.strip() for text in texts] == ["400 Rpm", "800 Rpm", "1400 Rpm"]


def test_on_a_tablet_a_block_of_groups_is_wider_with_its_groups_in_columns(tablet):
    add_laundry(tablet)
    open_block(tablet, room_with(laundry_block()))
    panel = tablet.locator("home-dashboard-sheet section.panel")
    assert "roomy" in panel.get_attribute("class")
    assert panel.bounding_box()["width"] > 900
    groups = tablet.locator("home-dashboard-sheet .panel-group")
    first, second = groups.nth(0).bounding_box(), groups.nth(1).bounding_box()
    assert second["x"] > first["x"] + first["width"] - 1


def test_on_a_phone_a_block_of_groups_stays_one_column(phone):
    add_laundry(phone)
    open_block(phone, room_with(laundry_block()))
    groups = phone.locator("home-dashboard-sheet .panel-group")
    first, second = groups.nth(0).bounding_box(), groups.nth(1).bounding_box()
    assert second["y"] >= first["y"] + first["height"]


def test_the_yaml_editor_takes_a_tile_naming_a_shortcut_or_a_scale(phone):
    problems = phone.evaluate("""async () => { const s = await import('/custom_components/home_dashboard/www/app/settings.js');
        const room = (tiles) => ({ layout: [{ id: 'r', name: 'R', sections: [{ title: 'S', tiles }] }] });
        return [s.configProblem(room([{ shortcut: 'Vacuum' }])), s.configProblem(room([{ kind: 'scale', name: 'Scale' }])),
                s.configProblem(room([{ name: 'nothing' }]))?.key]; }""")
    assert problems == [None, None, "yaml_tile_incomplete"]


def test_a_shortcut_taken_from_someone_stays_away_in_a_room(phone):
    add_entity(phone, "vacuum.robot", "docked")
    add_entity(phone, "sensor.filter", "71")
    tile = phone.evaluate("""async () => { const m = await import('/custom_components/home_dashboard/www/app/model.js');
        const config = m.normalizeConfig({ shortcuts: [{ kind: 'panel', name: 'Vacuum', stats: [] }] });
        config.denied = ['block:Vacuum'];
        return m.layoutTile(window.dashboard.hass(), { shortcut: 'Vacuum', entity: 'vacuum.robot' }, 'R', config, 'phone'); }""")
    assert tile is None


def test_bare_shortcut_tiles_have_keys_of_their_own(phone):
    keys = phone.evaluate("""async () => { const m = await import('/custom_components/home_dashboard/www/app/model.js');
        return [m.tileKey({ shortcut: 'A' }), m.tileKey({ shortcut: 'B' })]; }""")
    assert keys == ["shortcut:A", "shortcut:B"]
