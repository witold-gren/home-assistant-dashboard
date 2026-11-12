"""The sheets of lights, switches and alarms, the menu of a screen and the grouped controls."""

from __future__ import annotations

import pytest

from .test_motion import open_cover
from .test_page import mount
from .test_panels import add_entity, room_with
from .test_sheets import calls, service_calls
from .test_shortcuts import SHEET, mount_admin


def room_of(*ids: str) -> dict:
    return room_with(*[{"entity": entity} for entity in ids])


def open_entity(page, entity_id: str, state: str, attributes: dict | None = None) -> None:
    add_entity(page, entity_id, state, attributes or {})
    mount(page, room_of(entity_id))
    page.locator(f"home-dashboard-page [data-entity='{entity_id}'] .text").click()
    page.wait_for_selector(f"{SHEET} .panel")


def last_call(page) -> dict:
    return [call for call in calls(page) if call["type"] == "service"][-1]


DIMMABLE = {"supported_color_modes": ["color_temp", "xy"], "brightness": 128, "friendly_name": "Lampa"}


def test_a_light_opens_the_sheet_of_the_dashboard(phone):
    open_entity(phone, "light.a", "on", DIMMABLE)
    assert phone.locator(f"{SHEET} section.panel").get_attribute("data-kind") == "light"
    assert "50%" in phone.locator(f"{SHEET} .info").text_content()


def test_a_light_changes_when_the_slider_is_dragged(phone):
    open_entity(phone, "light.a", "on", DIMMABLE)
    phone.wait_for_timeout(100)
    box = phone.locator(f"{SHEET} [data-slider]").bounding_box()
    x = box["x"] + box["width"] / 2
    phone.mouse.move(x, box["y"] + box["height"] * 0.75)
    phone.mouse.down()
    phone.mouse.move(x, box["y"] + box["height"] * 0.25, steps=4)
    phone.mouse.up()
    call = last_call(phone)
    assert (call["domain"], call["service"]) == ("light", "turn_on")
    assert call["data"]["brightness_pct"] == pytest.approx(75, abs=2)
    assert "7" in phone.locator(f"{SHEET} .info").text_content()


def test_a_light_goes_off_at_the_bottom_of_the_slider(phone):
    open_entity(phone, "light.a", "on", DIMMABLE)
    phone.wait_for_timeout(100)
    box = phone.locator(f"{SHEET} [data-slider]").bounding_box()
    x = box["x"] + box["width"] / 2
    phone.mouse.move(x, box["y"] + box["height"] / 2)
    phone.mouse.down()
    phone.mouse.move(x, box["y"] + box["height"] + 20, steps=4)
    phone.mouse.up()
    assert service_calls(phone)[-1] == ("light", "turn_off")


def test_a_light_offers_only_what_it_can_do(phone):
    open_entity(phone, "light.a", "off", {"supported_color_modes": ["onoff"]})
    assert phone.locator(f"{SHEET} [data-slider]").count() == 0
    assert phone.locator(f"{SHEET} [data-swatch]").count() == 0
    phone.locator(f"{SHEET} [data-light-power]").click()
    assert service_calls(phone) == [("light", "toggle")]


def test_a_swatch_sets_a_white_or_a_colour(phone):
    open_entity(phone, "light.a", "on", DIMMABLE)
    assert phone.locator(f"{SHEET} [data-swatch]").count() == 8
    phone.locator(f"{SHEET} [data-swatch]").first.click()
    assert last_call(phone)["data"]["color_temp_kelvin"] == 2200
    phone.locator(f"{SHEET} [data-swatch]").last.click()
    assert last_call(phone)["data"]["rgb_color"] == [255, 106, 77]


def test_the_colours_of_a_light_are_round_and_four_in_a_row(phone):
    open_entity(phone, "light.a", "on", DIMMABLE)
    boxes = phone.locator(f"{SHEET} [data-swatch]").evaluate_all(
        "(items) => items.map((item) => { const box = item.getBoundingClientRect(); return [box.width, box.height, box.top]; })"
    )
    assert {tuple(box[:2]) for box in boxes} == {(44, 44)}
    assert len({box[2] for box in boxes[:4]}) == 1


def test_an_effect_can_be_chosen(phone):
    open_entity(phone, "light.a", "on", {**DIMMABLE, "effect_list": ["Fire", "Rain"]})
    phone.locator(f"{SHEET} [data-light-effect]").select_option("Rain")
    assert last_call(phone)["data"]["effect"] == "Rain"


def test_an_unavailable_light_cannot_be_touched(phone):
    open_entity(phone, "light.a", "unavailable", DIMMABLE)
    assert phone.locator(f"{SHEET} [data-light-power]").is_disabled()


@pytest.mark.parametrize("entity", ["switch.a", "input_boolean.a"])
def test_a_switch_opens_the_sheet_of_the_dashboard_and_toggles(phone, entity):
    open_entity(phone, entity, "off", {"friendly_name": "Wtyczka"})
    assert phone.locator(f"{SHEET} section.panel").get_attribute("data-kind") == "switch"
    phone.locator(f"{SHEET} [data-big-switch]").click()
    assert service_calls(phone) == [("homeassistant", "toggle")]


ALARM = {"supported_features": 55, "code_format": None, "friendly_name": "Działka"}


def test_an_alarm_lists_what_it_supports_and_marks_the_current_mode(phone):
    open_entity(phone, "alarm_control_panel.a", "armed_away", ALARM)
    modes = phone.locator(f"{SHEET} [data-alarm]").evaluate_all("(items) => items.map((item) => item.dataset.alarm)")
    assert modes == ["armed_home", "armed_away", "armed_night", "armed_vacation", "armed_custom_bypass", "disarmed"]
    assert "on" in phone.locator(f"{SHEET} [data-alarm='armed_away']").get_attribute("class")


def test_a_small_alarm_has_only_its_own_modes(phone):
    open_entity(phone, "alarm_control_panel.a", "disarmed", {"supported_features": 3})
    modes = phone.locator(f"{SHEET} [data-alarm]").evaluate_all("(items) => items.map((item) => item.dataset.alarm)")
    assert modes == ["armed_home", "armed_away", "disarmed"]


def test_an_alarm_mode_is_set_with_one_tap(phone):
    open_entity(phone, "alarm_control_panel.a", "disarmed", ALARM)
    phone.locator(f"{SHEET} [data-alarm='armed_home']").click()
    assert service_calls(phone) == [("alarm_control_panel", "alarm_arm_home")]


def test_an_alarm_with_a_code_stays_with_home_assistant(phone):
    add_entity(phone, "alarm_control_panel.a", "disarmed", {**ALARM, "code_format": "number"})
    mount(phone, room_of("alarm_control_panel.a"))
    phone.evaluate("""() => {
        window.moreInfo = [];
        window.addEventListener("hass-more-info", (event) => window.moreInfo.push(event.detail.entityId));
    }""")
    phone.locator("home-dashboard-page [data-entity='alarm_control_panel.a'] .text").click()
    assert phone.evaluate("window.moreInfo") == ["alarm_control_panel.a"]


# Menu of a screen -------------------------------------------------------------------------------


def test_the_menu_shows_the_rooms_first_and_editing_last(phone):
    layout = [{"id": "r", "name": "R", "areas": [], "home": [], "sections": []}]
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(phone, {"layout": layout}, "room")
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.wait_for_selector(f"{SHEET} [data-sheet-edit]")
    order = phone.locator(f"{SHEET} .rows").evaluate(
        "(rows) => [...rows.children].map((child) => child.localName + (child.dataset.sheetEdit !== undefined ? '-edit' : ''))"
    )
    assert order[-1] == "button-edit"
    assert order.index("hr") >= 1


def test_the_header_has_no_pencil_any_more(phone):
    mount_admin(phone, {})
    assert phone.locator("home-dashboard-page [data-edit-home], home-dashboard-page [data-edit-room]").count() == 0


def test_someone_who_cannot_edit_sees_only_the_rooms(phone):
    mount(phone)
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.wait_for_selector(f"{SHEET} .panel")
    assert phone.locator(f"{SHEET} [data-sheet-edit]").count() == 0


def test_the_menu_opens_the_background_of_home(phone):
    mount_admin(phone, {})
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.locator(f"{SHEET} [data-sheet-background]").click()
    phone.wait_for_selector(f"{SHEET} section.panel[data-kind='background']")


def test_the_intercom_is_a_sound_wave(phone):
    area = phone.evaluate("Object.keys(window.dashboard.snapshot.areas)[0]")
    mount(phone, {"intercom": {"script": "script.a", "areas": [area]}})
    icons = phone.evaluate("""() => [...window.card.shadowRoot.querySelectorAll(".intercom ha-icon")].map((icon) => icon.getAttribute("icon"))""")
    assert "mdi:waveform" in icons
    assert "mdi:bullhorn-outline" not in icons


# Grouped controls -------------------------------------------------------------------------------

CONTROLS = {
    "kind": "panel",
    "name": "Sync",
    "icon": "mdi:television",
    "groups": [
        {
            "layout": "controls",
            "rows": [
                {"entity": "switch.power", "name": "Zasilanie", "icon": "mdi:power"},
                {"entity": "select.mode", "name": "Tryb", "labels": {"video": "Wideo"}, "icons": {"video": "mdi:movie"}},
                {"entity": "number.level", "name": "Jasność"},
                {"entity": "sensor.wifi", "name": "Wi-Fi"},
            ],
        }
    ],
}


def open_controls(page) -> None:
    add_entity(page, "switch.power", "on", {})
    add_entity(page, "select.mode", "video", {"options": ["video", "music"]})
    add_entity(page, "number.level", "40", {"min": 0, "max": 100})
    add_entity(page, "sensor.wifi", "good", {})
    mount(page, room_with(CONTROLS))
    page.locator("home-dashboard-page [data-tile='Sync']").click()
    page.wait_for_selector(f"{SHEET} .big-toggles")


def test_controls_are_big_buttons_choices_and_facts_not_rows(phone):
    open_controls(phone)
    assert phone.locator(f"{SHEET} .big-toggle").count() == 1
    assert phone.locator(f"{SHEET} .choice").count() == 2
    assert phone.locator(f"{SHEET} .fact").count() == 1
    assert phone.locator(f"{SHEET} .field").count() == 0


def test_the_current_choice_is_marked_and_another_can_be_picked(phone):
    open_controls(phone)
    assert "on" in phone.locator(f"{SHEET} [data-choice='video']").get_attribute("class")
    assert "Wideo" in phone.locator(f"{SHEET} [data-choice='video']").text_content()
    phone.locator(f"{SHEET} [data-choice='music']").click()
    assert last_call(phone)["data"]["option"] == "music"


def test_a_big_button_toggles(phone):
    open_controls(phone)
    phone.locator(f"{SHEET} .big-toggle").click()
    assert service_calls(phone) == [("homeassistant", "toggle")]


# Remote -----------------------------------------------------------------------------------------


def test_a_short_list_of_sources_and_sound_modes_is_shown_as_choices(phone):
    add_entity(
        phone,
        "media_player.bar",
        "on",
        {"source_list": ["Bluetooth", "HDMI", "USB"], "source": "HDMI", "sound_mode_list": ["Cinema", "Game"], "sound_mode": "Game"},
    )
    item = {"kind": "tv", "entity": "media_player.bar", "name": "Bar", "sound_mode": True, "shortcuts": [{"name": "HDMI", "icon": "mdi:hdmi"}]}
    mount(phone, room_with(item))
    phone.locator("home-dashboard-page [data-tile='Bar']").click()
    phone.wait_for_selector(f"{SHEET} .choices")
    assert phone.locator(f"{SHEET} [data-choice='HDMI']").count() == 0
    assert phone.locator(f"{SHEET} [data-choice='Bluetooth']").count() == 1
    assert "on" in phone.locator(f"{SHEET} [data-choice='Game']").get_attribute("class")
    phone.locator(f"{SHEET} [data-choice='Cinema']").click()
    assert last_call(phone)["data"]["sound_mode"] == "Cinema"


def test_filter_animation_adds_nothing_to_the_length_of_the_page(moving_phone):
    mount(moving_phone, {"background": "#223344"})
    moving_phone.locator("[data-chip='security']").click()
    moving_phone.wait_for_selector("home-dashboard-page .stage-old", state="attached")
    end_of_page, length = moving_phone.evaluate("""() => [
        window.card.shadowRoot.querySelector(".page").getBoundingClientRect().bottom + scrollY,
        document.documentElement.scrollHeight,
    ]""")
    assert length <= end_of_page + 1




# Security filter --------------------------------------------------------------------------------

GUESTS = {"name": "Gość", "entities": ["input_boolean.home", "input_boolean.cabin"]}


def guests_dashboard() -> dict:
    home = [{"entity": "input_boolean.home", "name": "Gość Dom", "turn_on_only": True}]
    cabin = [{"entity": "input_boolean.cabin", "name": "Gość działka"}, {"entity": "alarm_control_panel.a", "name": "Altanka"}]
    return {
        "security": {"group": GUESTS},
        "layout": [
            {"id": "one", "name": "Korytarz", "areas": [], "home": home, "sections": []},
            {"id": "two", "name": "Działka", "areas": [], "home": cabin, "sections": []},
        ],
    }


def open_security(page) -> None:
    add_entity(page, "input_boolean.home", "on", {})
    add_entity(page, "input_boolean.cabin", "off", {})
    add_entity(page, "alarm_control_panel.a", "armed_away", ALARM)
    mount(page, guests_dashboard())
    page.locator("[data-chip='security']").click()
    page.wait_for_selector("home-dashboard-page section[data-room='__security_group']")


def test_the_guest_group_is_at_the_top_of_the_security_filter(phone):
    open_security(phone)
    first = phone.locator("home-dashboard-page section[data-room]").first
    assert first.get_attribute("data-room") == "__security_group"
    assert first.locator("h2").text_content().strip() == "Gość"
    assert first.locator("[data-entity]").evaluate_all("(tiles) => tiles.map((tile) => tile.dataset.entity)") == [
        "input_boolean.home",
        "input_boolean.cabin",
    ]


def test_the_group_heading_leads_nowhere(phone):
    open_security(phone)
    assert phone.locator("section[data-room='__security_group'] [data-room-link]").count() == 0


def test_a_guest_mode_needing_a_pin_cannot_be_switched_off_in_the_group(phone):
    open_security(phone)
    phone.locator("section[data-room='__security_group'] [data-entity='input_boolean.home'] .text").click()
    assert service_calls(phone) == []
    assert phone.locator(f"{SHEET} .panel").count() == 0


def test_other_filters_have_no_group(phone):
    add_entity(phone, "input_boolean.home", "on", {})
    mount(phone, {"security": {"group": GUESTS}})
    phone.locator("[data-chip='lights']").click()
    assert phone.locator("section[data-room='__security_group']").count() == 0


def test_an_alarm_of_a_device_that_is_gone_stays_out_of_the_filter(phone):
    entity = "alarm_control_panel.gone"
    add_entity(phone, entity, "unavailable", {"restored": True})
    assert phone.evaluate(
        """(id) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            instance.entities[id] = { entity_id: id, area_id: Object.keys(instance.areas)[0] };
            const config = model.normalizeConfig({});
            const home = model.buildHomeModel(instance, config, model.selectEntities(instance, config));
            return home.filterRooms.flatMap((room) => room.tiles).some((tile) => tile.entityId === id);
        }""",
        entity,
    ) is False


def test_an_alarm_without_a_name_in_the_layout_is_called_after_its_device(phone):
    entity = "alarm_control_panel.garage"
    add_entity(phone, entity, "armed_home", {"friendly_name": "Security mode"})
    assert phone.evaluate(
        """(id) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            const area = Object.keys(instance.areas)[0];
            instance.devices.garage = { id: "garage", name: "Garaż", area_id: area };
            instance.entities[id] = { entity_id: id, device_id: "garage" };
            const config = model.normalizeConfig({});
            const home = model.buildHomeModel(instance, config, model.selectEntities(instance, config));
            return home.filterRooms.flatMap((room) => room.tiles).find((tile) => tile.entityId === id).name;
        }""",
        entity,
    ) == "Garaż"


# Menu and icons ---------------------------------------------------------------------------------


def test_the_list_of_areas_starts_with_home_and_goes_there(phone):
    area = phone.evaluate("Object.keys(window.dashboard.snapshot.areas)[0]")
    phone.evaluate(f"window.history.replaceState(null, '', '?room={area}')")
    mount(phone, {}, "room")
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.wait_for_selector(f"{SHEET} [data-home-link]")
    first = phone.locator(f"{SHEET} .rows > *").first
    assert first.get_attribute("data-home-link") is not None
    assert "Strona główna" in first.text_content()
    first.click()
    phone.wait_for_function("window.location.pathname.endsWith('/home')")


@pytest.mark.parametrize(
    ("icon", "expected"),
    [("mdi:star", "mdi:star"), ("phu:fingerbot", "mdi:toggle-switch"), ("hue:bulb", "hue:bulb")],
)
def test_an_icon_from_a_missing_set_falls_back_to_the_default(phone, icon, expected):
    add_entity(phone, "switch.a", "off", {"icon": icon})
    assert phone.evaluate(
        """() => {
            window.customIcons = { hue: {} };
            const { model, hass } = window.dashboard;
            return model.buildTile(hass(), "switch.a", null, model.normalizeConfig({})).icon;
        }"""
    ) == expected


# Remote of a webOS TV ---------------------------------------------------------------------------

TV_ITEM = {"kind": "tv", "entity": "media_player.tv", "name": "TV", "shortcuts": [{"name": "YouTube", "icon": "mdi:youtube"}]}
MANY_SOURCES = ["YouTube", *[f"App {index}" for index in range(20)]]


def open_webos(page, state: str = "on", platform: str = "webostv") -> None:
    add_entity(page, "media_player.tv", state, {"source_list": MANY_SOURCES, "source": "App 3"})
    page.evaluate(
        """(platform) => {
            const original = window.dashboard.hass;
            window.dashboard.hass = () => {
                const instance = original();
                instance.entities["media_player.tv"] = { entity_id: "media_player.tv", platform };
                return instance;
            };
        }""",
        platform,
    )
    mount(page, room_with(TV_ITEM))
    page.locator("home-dashboard-page [data-tile='TV']").click()
    page.wait_for_selector(f"{SHEET} section.panel[data-kind='tv']")


def test_a_webos_tv_has_arrows_and_keys(phone):
    open_webos(phone)
    phone.locator(f"{SHEET} [data-tv-key='ENTER']").click()
    phone.locator(f"{SHEET} [data-tv-key='BACK']").click()
    assert [(call["domain"], call["service"], call["data"]["button"]) for call in calls(phone)] == [
        ("webostv", "button", "ENTER"),
        ("webostv", "button", "BACK"),
    ]


def test_the_arrows_form_a_cross(phone):
    open_webos(phone)
    box = lambda name: phone.locator(f"{SHEET} [data-tv-key='{name}']").bounding_box()  # noqa: E731
    middle, up, left = box("ENTER"), box("UP"), box("LEFT")
    assert up["x"] == middle["x"]
    assert up["y"] < middle["y"]
    assert left["y"] == middle["y"]
    assert left["x"] < middle["x"]


def test_the_keys_wait_while_the_tv_is_off(phone):
    open_webos(phone, "off")
    assert phone.locator(f"{SHEET} [data-tv-key='UP']").is_disabled()


def test_another_tv_has_no_webos_keys(phone):
    open_webos(phone, platform="androidtv")
    assert phone.locator(f"{SHEET} [data-tv-key]").count() == 0


def test_a_long_list_of_sources_opens_on_request(phone):
    open_webos(phone)
    sources = phone.locator(f"{SHEET} [data-tv-sources]")
    assert sources.locator("summary").text_content().count("20") == 1
    assert sources.locator("[data-choice='App 3']").is_hidden()
    sources.locator("summary").click()
    assert "on" in sources.locator("[data-choice='App 3']").get_attribute("class")
    assert sources.locator("[data-choice='YouTube']").count() == 0


# Summary groups ---------------------------------------------------------------------------------


def open_car(page, door: str = "off") -> None:
    add_entity(page, "binary_sensor.door", door, {"device_class": "door", "friendly_name": "Samochód Drzwi"})
    add_entity(page, "binary_sensor.oil", "off", {"device_class": "problem", "friendly_name": "Olej"})
    add_entity(page, "sensor.trip", "12", {"friendly_name": "Trasa", "unit_of_measurement": "km"})
    item = {
        "kind": "panel",
        "name": "Samochód",
        "groups": [
            {"title": "Stan", "layout": "summary", "rows": [{"entity": "binary_sensor.door"}, {"entity": "binary_sensor.oil"}]},
            {"title": "Trasa", "layout": "controls", "rows": [{"entity": "sensor.trip", "name": "Dziś"}]},
        ],
    }
    mount(page, room_with(item))
    page.locator("home-dashboard-page [data-tile='Samochód']").click()
    page.wait_for_selector(f"{SHEET} [data-summary='Stan']")


def test_a_summary_says_all_is_fine_in_one_closed_line(phone):
    open_car(phone)
    group = phone.locator(f"{SHEET} [data-summary='Stan']")
    assert "Wszystko w porządku" in group.locator("summary").text_content()
    assert group.get_attribute("open") is None
    group.locator("summary").click()
    assert group.locator(".fact").count() == 2


def test_a_summary_opens_by_itself_when_something_is_wrong(phone):
    open_car(phone, door="on")
    group = phone.locator(f"{SHEET} [data-summary='Stan']")
    assert group.get_attribute("open") is not None
    assert "Uwaga: 1" in group.locator("summary").text_content()
    assert "alert" in group.locator("[data-value='binary_sensor.door']").get_attribute("class")


def test_facts_drop_the_name_of_the_block(phone):
    open_car(phone, door="on")
    assert "Samochód" not in phone.locator(f"{SHEET} [data-value='binary_sensor.door'] small").text_content()


# Room title -------------------------------------------------------------------------------------


@pytest.mark.parametrize("name", ["Kuchnia i Jadalnia", "Bardzo bardzo bardzo długa nazwa pokoju"])
def test_a_long_room_name_stays_in_line_with_the_icons(phone, name):
    layout = [{"id": "r", "name": name, "areas": [], "home": [], "sections": []}]
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(phone, {"layout": layout}, "room")
    title = phone.locator("home-dashboard-page .room-name").bounding_box()
    icons = phone.locator("home-dashboard-page .room-title .intercom").bounding_box()
    assert icons["y"] < title["y"] + title["height"]
    assert title["x"] + title["width"] <= icons["x"]


def test_the_name_of_the_kitchen_fits_without_being_cut(phone):
    layout = [{"id": "r", "name": "Kuchnia i Jadalnia", "areas": [], "home": [], "sections": []}]
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(phone, {"layout": layout, "intercom": {"script": "script.a", "areas": ["r"]}}, "room")
    assert phone.locator("home-dashboard-page .room-name").evaluate("(name) => name.scrollWidth <= name.clientWidth")


# A device's own card ----------------------------------------------------------------------------

LAMP = "light.lamp"
LAMP_CARD = {"type": "custom:lamp-card", "entity": LAMP}


def lamp_dashboard(tile: dict | None = None) -> dict:
    return {**room_with(tile or {"entity": LAMP}), "entities": {"overrides": {LAMP: {"card": LAMP_CARD}}}}


def open_lamp(page, part: str, tile: dict | None = None) -> None:
    add_entity(page, LAMP, "on", DIMMABLE)
    mount(page, lamp_dashboard(tile))
    page.locator(f"home-dashboard-page [data-entity='{LAMP}'] {part}").click()
    page.wait_for_selector(f"{SHEET} section.panel[data-kind='panel']")


def test_a_device_with_its_own_card_opens_it_instead_of_the_light_sheet(phone):
    open_lamp(phone, ".text")
    phone.wait_for_selector("[data-card='custom:lamp-card']", state="attached")
    assert phone.locator(f"{SHEET} [data-slider]").count() == 0


def test_the_icon_opens_the_card_and_never_switches_the_lamp(phone):
    open_lamp(phone, ".icon")
    assert service_calls(phone) == []


def test_the_sheet_of_the_card_keeps_the_name_from_the_layout(phone):
    open_lamp(phone, ".text", {"entity": LAMP, "name": "Lampa akwarium"})
    assert phone.locator(f"{SHEET} h2").text_content() == "Lampa akwarium"


def test_the_card_is_also_used_outside_the_layout(phone):
    add_entity(phone, LAMP, "on", DIMMABLE)
    tile = phone.evaluate(
        """(dashboard) => {
            const { model, hass } = window.dashboard;
            return model.buildTile(hass(), "light.lamp", null, model.normalizeConfig(dashboard));
        }""",
        lamp_dashboard(),
    )
    assert tile["tapAction"] == "panel"
    assert tile["item"]["card"] == LAMP_CARD


def test_a_card_can_stay_at_the_very_end_of_a_panel(phone):
    add_entity(phone, "sensor.trip", "12", {"friendly_name": "Trasa"})
    item = {
        "kind": "panel",
        "name": "Auto",
        "card": {"type": "map"},
        "card_open": True,
        "card_last": True,
        "groups": [{"title": "Trasa", "rows": [{"entity": "sensor.trip", "name": "Dziś"}]}],
    }
    mount(phone, room_with(item))
    phone.locator("home-dashboard-page [data-tile='Auto']").click()
    phone.wait_for_selector("[data-card='map']", state="attached")
    assert phone.locator(f"{SHEET} .rows > *").last.get_attribute("data-live") is not None


# Music Assistant player -------------------------------------------------------------------------

OPEN_PLAYER = """() => {
    const doc = window.card.shadowRoot.querySelector("iframe").contentDocument;
    doc.body.innerHTML = '<div class="v-overlay v-overlay--active"><div class="fullscreen-player-card"></div></div>';
}"""
CLOSE_PLAYER = """() => {
    window.card.shadowRoot.querySelector("iframe").contentDocument.querySelector(".v-overlay")
        .classList.remove("v-overlay--active");
}"""
NAV = "document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('nav')"


def open_music(page) -> None:
    mount(page, {"music": {"frame": "about:blank"}}, "music")
    page.wait_for_selector("home-dashboard-page iframe")


def test_the_bottom_bar_goes_away_for_the_player_and_comes_back(phone):
    open_music(phone)
    assert phone.evaluate(f"{NAV}.classList.contains('tucked')") is False
    phone.evaluate(OPEN_PLAYER)
    phone.wait_for_function(f"{NAV}.classList.contains('tucked')")
    phone.evaluate(CLOSE_PLAYER)
    phone.wait_for_function(f"!{NAV}.classList.contains('tucked')")


def test_the_tucked_bar_is_off_the_screen(phone):
    open_music(phone)
    phone.evaluate(OPEN_PLAYER)
    phone.wait_for_function(f"{NAV}.getBoundingClientRect().top >= innerHeight - 1")


def test_the_side_bar_of_a_tablet_stays(tablet):
    open_music(tablet)
    tablet.evaluate(OPEN_PLAYER)
    tablet.wait_for_function(f"{NAV}.classList.contains('tucked')")
    tablet.wait_for_timeout(300)
    assert tablet.evaluate(f"{NAV}.getBoundingClientRect().left") == 0
    assert tablet.evaluate(f"{NAV}.getBoundingClientRect().top") == 0


def test_a_frame_from_another_address_changes_nothing(phone):
    mount(phone, {"music": {"frame": "http://127.0.0.1:9/"}}, "music")
    phone.wait_for_selector("home-dashboard-page iframe")
    phone.wait_for_timeout(400)
    assert phone.evaluate(f"{NAV}.classList.contains('tucked')") is False


def test_leaving_the_music_page_brings_the_bar_back(phone):
    open_music(phone)
    phone.evaluate(OPEN_PLAYER)
    phone.wait_for_function(f"{NAV}.classList.contains('tucked')")
    phone.evaluate("() => window.card.remove()")
    phone.wait_for_function(f"!{NAV}.classList.contains('tucked')")


def test_a_hidden_camera_is_left_out_everywhere(phone):
    visible = phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        return model.buildCameras(hass(), model.normalizeConfig({})).map((camera) => camera.entityId);
    }""")
    assert len(visible) > 1
    left = phone.evaluate(
        """(hide) => {
            const { model, hass } = window.dashboard;
            const config = model.normalizeConfig({ cameras: { hide: [hide] } });
            return model.buildCameras(hass(), config).map((camera) => camera.entityId);
        }""",
        visible[0],
    )
    assert left == visible[1:]


def broken_camera(page) -> str:
    return page.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const id = model.buildCameras(hass(), model.normalizeConfig({}))[0].entityId;
        window.dashboard.snapshot.states[id].state = "unavailable";
        return id;
    }""")


def test_an_unavailable_camera_is_blurred_and_says_so(phone):
    camera = broken_camera(phone)
    mount(phone)
    tile = phone.locator(f"home-dashboard-page [data-camera='{camera}']")
    assert "offline" in tile.get_attribute("class")
    assert "Kamera niedostępna" in tile.text_content()
    assert "blur" in tile.locator("img").evaluate("(image) => getComputedStyle(image).filter")


def test_an_unavailable_camera_opens_its_window_with_its_name(phone):
    camera = broken_camera(phone)
    mount(phone)
    phone.locator(f"home-dashboard-page [data-camera='{camera}']").click()
    phone.wait_for_selector(f"{SHEET} [data-camera-down]")
    # Which camera went away is read in its window: its name in the header, the notice over the picture.
    name = phone.evaluate("(id) => window.dashboard.snapshot.states[id].attributes.friendly_name", camera)
    assert phone.locator(f"{SHEET} header h2").inner_text() == name
    assert phone.locator(f"{SHEET} [data-camera-down]").inner_text() == "Kamera jest niedostępna"


def test_the_camera_screen_leaves_out_an_unavailable_camera(phone):
    camera = broken_camera(phone)
    mount(phone)
    phone.locator("home-dashboard-page .camera:not(.offline)").first.click()
    phone.wait_for_selector("[data-thumbs]")
    assert phone.locator(f"{SHEET} [data-thumb='{camera}']").count() == 0


# PIN --------------------------------------------------------------------------------------------

OFF_PIN = {"service": "script.unlock", "field": "pin"}


def open_pin(page) -> None:
    add_entity(page, "input_boolean.guest", "on", {})
    item = {"entity": "input_boolean.guest", "name": "Gość Dom", "turn_on_only": True, "off_pin": OFF_PIN}
    mount(page, room_with(item))
    page.locator("home-dashboard-page [data-entity='input_boolean.guest'] .text").click()
    page.wait_for_selector(f"{SHEET} section.panel[data-kind='pin']")


def type_pin(page, digits: str) -> None:
    for digit in digits:
        page.locator(f"{SHEET} [data-pin-key='{digit}']").click()


def test_a_guest_mode_that_is_on_opens_the_keypad(phone):
    open_pin(phone)
    assert phone.locator(f"{SHEET} [data-pin-key]").count() == 10
    assert service_calls(phone) == []


def test_the_pin_goes_to_the_script_and_is_not_shown(phone):
    open_pin(phone)
    type_pin(phone, "1234")
    assert phone.locator(f"{SHEET} [data-pin-dots] span").count() == 4
    assert "1234" not in phone.locator(f"{SHEET} section.panel").text_content()
    phone.locator(f"{SHEET} [data-pin-ok]").click()
    call = last_call(phone)
    assert (call["domain"], call["service"], call["data"]) == ("script", "unlock", {"pin": "1234"})


def test_a_wrong_pin_says_so_and_clears_the_keypad(phone):
    open_pin(phone)
    type_pin(phone, "12")
    phone.locator(f"{SHEET} [data-pin-ok]").click()
    phone.wait_for_function(
        """() => document.querySelector("home-dashboard-chrome").shadowRoot.querySelector("home-dashboard-sheet")
            .shadowRoot.querySelector("[data-pin-message]").textContent === "Błędny PIN" """
    )
    assert phone.locator(f"{SHEET} [data-pin-dots] span").count() == 0


def test_the_keypad_closes_when_the_mode_goes_off(phone):
    open_pin(phone)
    phone.evaluate("""() => {
        const chrome = document.querySelector("home-dashboard-chrome");
        const states = { ...chrome.hass.states };
        states["input_boolean.guest"] = { ...states["input_boolean.guest"], state: "off" };
        chrome.hass = { ...chrome.hass, states };
    }""")
    phone.wait_for_selector(f"{SHEET} section.panel", state="detached")


def test_ok_needs_at_least_one_digit(phone):
    open_pin(phone)
    assert phone.locator(f"{SHEET} [data-pin-ok]").is_disabled()


def test_without_a_pin_script_the_tile_stays_shut(phone):
    add_entity(phone, "input_boolean.guest", "on", {})
    mount(phone, room_with({"entity": "input_boolean.guest", "name": "Gość", "turn_on_only": True}))
    phone.locator("home-dashboard-page [data-entity='input_boolean.guest'] .text").click()
    assert phone.locator(f"{SHEET} .panel").count() == 0


# My layout and user access ----------------------------------------------------------------------


def model(page, body: str, argument=None):
    return page.evaluate(
        f"""(argument) => {{
            const {{ model, hass }} = window.dashboard;
            const instance = hass();
            const config = model.normalizeConfig({{}});
            const ids = model.buildCameras(instance, config).map((camera) => camera.entityId);
            {body}
        }}""",
        argument,
    )


def test_a_person_sets_the_order_of_cameras(phone):
    assert model(
        phone,
        """const mine = model.personalize(config, "kid", { cameras: [ids[2], ids[0]] });
           const order = model.buildCameras(instance, mine).map((camera) => camera.entityId);
           return [order[0] === ids[2], order[1] === ids[0], order.length === ids.length];""",
    ) == [True, True, True]


def test_a_person_hides_a_camera_for_themselves(phone):
    assert model(
        phone,
        """const mine = model.personalize(config, "kid", { hidden_cameras: [ids[0]] });
           return model.buildCameras(instance, mine).some((camera) => camera.entityId === ids[0]);""",
    ) is False


def test_rooms_follow_the_personal_order_on_home_and_in_the_list(phone):
    assert model(
        phone,
        """const selection = model.selectEntities(instance, config);
           const rooms = model.buildRoomList(instance, config, selection).map((room) => room.id);
           const wanted = [rooms.at(-1), rooms[0]];
           const mine = model.personalize(config, "kid", { rooms: wanted });
           const list = model.buildRoomList(instance, mine, model.selectEntities(instance, mine)).map((room) => room.id);
           const home = model.buildHomeModel(instance, mine, model.selectEntities(instance, mine));
           return [list.slice(0, 2).join() === wanted.join(), home.rooms[0].id === wanted[0]];""",
    ) == [True, True]


def test_access_hides_a_camera_and_the_person_cannot_bring_it_back(phone):
    assert model(
        phone,
        """const shared = model.normalizeConfig({ access: { kid: { hide: [ids[0]] } } });
           const kid = model.personalize(shared, "kid", { cameras: [ids[0]] });
           const parent = model.personalize(shared, "parent");
           const has = (who) => model.buildCameras(instance, who).some((camera) => camera.entityId === ids[0]);
           return [has(kid), has(parent), model.personalChoices(instance, { access: { kid: { hide: [ids[0]] } } }, "kid")
               .cameras.some((camera) => camera.id === ids[0])];""",
    ) == [False, True, False]


def test_a_denied_room_takes_its_cameras_with_it(phone):
    assert model(
        phone,
        """const area = model.effectiveArea(instance, ids[0], config);
           const shared = model.normalizeConfig({ access: { kid: { rooms: [area] } } });
           const kid = model.personalize(shared, "kid");
           const list = model.buildRoomList(instance, kid, model.selectEntities(instance, kid)).map((room) => room.id);
           return [model.buildCameras(instance, kid).some((camera) => camera.entityId === ids[0]), list.includes(area)];""",
    ) == [False, False]


def test_a_denied_scene_tile_is_gone(phone):
    add_entity(phone, "scene.party", "2026-01-01", {"friendly_name": "Impreza"})
    assert model(
        phone,
        """const shared = model.normalizeConfig({ access: { kid: { hide: ["scene.party"] } } });
           return [model.buildTile(instance, "scene.party", null, model.personalize(shared, "kid")),
                   model.buildTile(instance, "scene.party", null, model.personalize(shared, "parent")) !== null];""",
    ) == [None, True]


def open_personal(page) -> None:
    mount_admin(page, {})
    page.locator("home-dashboard-page [data-rooms]").click()
    page.locator(f"{SHEET} [data-sheet-personal]").click()
    page.wait_for_selector(f"{SHEET} section.panel[data-kind='personal']")


def user_data(page) -> list:
    return [message for message in page.evaluate("window.saved") if message["type"] == "frontend/set_user_data"]


def test_moving_a_camera_saves_it_with_the_account(phone):
    open_personal(phone)
    first = phone.locator(f"{SHEET} [data-order]").first.get_attribute("data-order")
    phone.locator(f"{SHEET} [data-order='{first}'] [data-personal='down']").click()
    assert phone.locator(f"{SHEET} [data-order]").nth(1).get_attribute("data-order") == first
    saved = user_data(phone)[-1]
    assert saved["key"] == "home_dashboard"
    assert saved["value"]["cameras"][1] == first


def test_the_first_row_cannot_go_higher(phone):
    open_personal(phone)
    assert phone.locator(f"{SHEET} [data-personal='up']").first.is_disabled()


def test_hiding_an_area_for_yourself_is_saved_and_can_be_undone(phone):
    open_personal(phone)
    phone.locator(f"{SHEET} [data-tab='rooms']").click()
    row = phone.locator(f"{SHEET} [data-order]").first
    room = row.get_attribute("data-order")
    row.locator("[data-personal='hide']").click()
    assert user_data(phone)[-1]["value"]["hidden_rooms"] == [room]
    phone.locator(f"{SHEET} [data-personal-reset]").click()
    assert user_data(phone)[-1]["value"] == {}


def test_someone_who_is_not_an_administrator_has_my_layout_but_not_access(phone):
    mount_admin(phone, {}, admin=False)
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.wait_for_selector(f"{SHEET} [data-sheet-personal]")
    assert phone.locator(f"{SHEET} [data-sheet-access]").count() == 0


def test_the_viewport_is_locked_and_restored(phone):
    phone.evaluate("""() => {
        const meta = document.createElement("meta");
        meta.name = "viewport";
        meta.content = "width=device-width";
        document.head.append(meta);
    }""")
    mount(phone)
    assert "user-scalable=no" in phone.evaluate("document.querySelector('meta[name=viewport]').content")
    phone.evaluate("document.querySelector('home-dashboard-chrome').remove()")
    assert phone.evaluate("document.querySelector('meta[name=viewport]').content") == "width=device-width"


def columns(page, cameras: list) -> list:
    return page.evaluate(
        """async (cameras) => {
            const { model } = window.dashboard;
            return model.cameraColumns(cameras).map((column) => column.map((camera) => camera.id));
        }""",
        cameras,
    )


def test_a_broken_camera_gives_up_the_large_place(phone):
    cameras = [{"id": "off", "unavailable": True}, {"id": "a"}, {"id": "b"}, {"id": "c"}]
    assert columns(phone, cameras) == [["a"], ["b", "c"], ["off"]]


def test_broken_cameras_share_a_small_column(phone):
    cameras = [{"id": "x", "unavailable": True}, {"id": "a"}, {"id": "y", "unavailable": True}]
    assert columns(phone, cameras) == [["a"], ["x", "y"]]


def test_a_broken_camera_alone_keeps_its_size(phone):
    assert columns(phone, [{"id": "off", "unavailable": True}]) == [["off"]]


# More of user access and the bottom bar --------------------------------------------------------


def test_access_sorts_entities_into_tabs_and_blocks_into_other(phone):
    add_entity(phone, "light.a", "on", {"friendly_name": "Lampa"})
    add_entity(phone, "lock.a", "locked", {"friendly_name": "Zamek"})
    add_entity(phone, "media_player.a", "off", {"friendly_name": "Głośnik"})
    add_entity(phone, "switch.a", "off", {"friendly_name": "Wtyczka"})
    tiles = [{"entity": "light.a"}, {"entity": "lock.a"}, {"entity": "media_player.a"}, {"entity": "switch.a"}]
    frame = {"kind": "panel", "name": "Frigate", "frame": "about:blank"}
    raw = {**room_with(*tiles, frame), "shortcuts": [{"kind": "host", "name": "Host"}]}
    result = phone.evaluate(
        """(raw) => {
            const { model, hass } = window.dashboard;
            const choices = model.accessChoices(hass(), raw);
            const ids = (key) => choices[key].map((item) => item.id);
            return { lights: ids("lights"), security: ids("security"), media: ids("media"), other: ids("other") };
        }""",
        raw,
    )
    assert "light.a" in result["lights"]
    assert "lock.a" in result["security"]
    assert "media_player.a" in result["media"]
    assert {"switch.a", "block:Frigate"} <= set(result["other"])


def test_a_hidden_block_and_shortcut_are_gone_for_that_person(phone):
    frame = {"kind": "panel", "name": "Frigate", "frame": "about:blank"}
    raw = {
        **room_with(frame),
        "shortcuts": [{"kind": "host", "name": "Host"}],
        "access": {"kid": {"hide": ["block:Frigate", "block:Host"]}},
    }
    result = phone.evaluate(
        """(raw) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            const shared = model.normalizeConfig(raw);
            const seen = (id) => {
                const config = model.personalize(shared, id);
                const home = model.buildHomeModel(instance, config, model.selectEntities(instance, config));
                return [home.rooms.flatMap((room) => room.tiles).some((tile) => tile.name === "Frigate"),
                        model.shownShortcuts(instance, config).length];
            };
            return [seen("kid"), seen("parent")];
        }""",
        raw,
    )
    assert result == [[False, 0], [True, 1]]


def test_the_tabs_of_access_fit_in_one_scrolling_row(phone):
    mount_admin(phone, {})
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.locator(f"{SHEET} [data-sheet-access]").click()
    phone.wait_for_selector(f"{SHEET} [data-tab='other']")
    tops = phone.locator(f"{SHEET} [data-tab]").evaluate_all(
        "(tabs) => tabs.map((tab) => Math.round(tab.getBoundingClientRect().top))"
    )
    assert len(tops) == 9
    assert len(set(tops)) == 1


def test_the_inset_of_the_screen_adds_little_to_the_bottom_bar(phone):
    mount(phone)
    height = phone.evaluate("""() => {
        const chrome = document.querySelector("home-dashboard-chrome");
        chrome.style.setProperty("--safe-area-inset-bottom", "34px");
        return chrome.shadowRoot.querySelector("nav").getBoundingClientRect().height;
    }""")
    assert height <= 80


# Who sees a tile -------------------------------------------------------------------------------

def rule_for(page, visibility: dict, user: str) -> bool:
    add_entity(page, "switch.desk", "off", {"friendly_name": "Biurko"})
    return page.evaluate(
        """({ visibility, user }) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            const layout = [{ id: "r", name: "R", areas: [], home: [{ entity: "switch.desk" }], sections: [] }];
            const config = model.personalize(model.normalizeConfig({ layout, visibility }), user);
            const home = model.buildHomeModel(instance, config, model.selectEntities(instance, config));
            return home.rooms.flatMap((room) => room.tiles).some((tile) => tile.entityId === "switch.desk");
        }""",
        {"visibility": visibility, "user": user},
    )


@pytest.mark.parametrize(
    ("rule", "user", "seen"),
    [
        ({"only": ["kid"]}, "kid", True),
        ({"only": ["kid"]}, "parent", False),
        ({"only": ["kid", "mum"]}, "mum", True),
        ({"except": ["kid"]}, "kid", False),
        ({"except": ["kid"]}, "parent", True),
        ({"only": [], "except": []}, "kid", True),
    ],
)
def test_who_sees_a_tile(phone, rule, user, seen):
    assert rule_for(phone, {"switch.desk": rule}, user) is seen


def test_a_rule_covers_a_camera_and_a_block(phone):
    assert model(
        phone,
        """const frame = { kind: "panel", name: "Frigate", frame: "about:blank" };
           const layout = [{ id: "r", name: "R", areas: [], home: [frame], sections: [] }];
           const shared = model.normalizeConfig({ layout, visibility: {
               [ids[0]]: { only: ["kid"] }, "block:Frigate": { except: ["kid"] } } });
           const seen = (who) => {
               const config = model.personalize(shared, who);
               const home = model.buildHomeModel(instance, config, model.selectEntities(instance, config));
               return [model.buildCameras(instance, config).some((camera) => camera.entityId === ids[0]),
                       home.rooms.flatMap((room) => room.tiles).some((tile) => tile.name === "Frigate")];
           };
           return [seen("kid"), seen("parent")];""",
    ) == [[True, False], [False, True]]


def edit_room(page, visibility: dict | None = None, access: dict | None = None, user: str = "me") -> None:
    add_entity(page, "switch.desk", "off", {"friendly_name": "Biurko"})
    layout = [{"id": "r", "name": "R", "areas": [], "home": [{"entity": "switch.desk", "name": "Biurko"}], "sections": []}]
    page.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(page, {"layout": layout, "visibility": visibility or {}, "access": access or {}}, "room")
    page.evaluate(
        """() => {
            const hass = document.querySelector("home-dashboard-chrome").hass;
            const original = hass.callWS;
            hass.callWS = (message) => message.type === "config/auth/list"
                ? Promise.resolve([{ id: "kid", name: "Dziecko", is_active: true }, { id: "mum", name: "Mama", is_active: true }])
                : original(message);
        }"""
    )
    page.locator("home-dashboard-page [data-rooms]").click()
    page.locator(f"{SHEET} [data-sheet-edit]").click()
    page.wait_for_selector("[data-edit-save]")
    page.locator("[data-edit-tab='home']").click()


def tile_of(page):
    return page.locator("home-dashboard-page [data-edit-tile='Biurko']")


def test_the_editor_shows_what_this_account_does_not_see_in_green(phone):
    edit_room(phone, {"switch.desk": {"only": ["kid"]}})
    assert "only" in tile_of(phone).get_attribute("class")


def test_the_editor_marks_a_tile_hidden_from_someone_in_red(phone):
    edit_room(phone, {"switch.desk": {"except": ["kid"]}})
    assert "except" in tile_of(phone).get_attribute("class")


def test_what_was_hidden_in_user_access_is_red_too(phone):
    edit_room(phone, access={"kid": {"hide": ["switch.desk"]}})
    assert "except" in tile_of(phone).get_attribute("class")


def test_choosing_people_turns_the_tile_green_and_saves_with_the_room(phone):
    edit_room(phone)
    assert "only" not in tile_of(phone).get_attribute("class")
    tile_of(phone).click()
    phone.locator(f"{SHEET} [data-rule-mode='only']").click()
    phone.locator(f"{SHEET} [data-rule-user='kid']").click()
    phone.locator(f"{SHEET} [data-tile-save]").click()
    phone.wait_for_selector(f"{SHEET} section.panel", state="detached")
    assert "only" in tile_of(phone).get_attribute("class")
    assert phone.evaluate("window.saved") == []
    phone.locator("[data-edit-save]").click()
    phone.wait_for_function("window.saved.length === 1")
    assert phone.evaluate("window.saved[0].config.strategy.visibility") == {
        "switch.desk": {"only": ["kid"], "except": []}
    }


def test_back_to_everyone_clears_the_rule_and_the_old_hiding(phone):
    edit_room(phone, {"switch.desk": {"except": ["mum"]}}, {"kid": {"hide": ["switch.desk", "scene.x"]}})
    tile_of(phone).click()
    phone.wait_for_selector(f"{SHEET} [data-rule-mode='except'].on")
    phone.locator(f"{SHEET} [data-rule-mode='everyone']").click()
    phone.locator(f"{SHEET} [data-tile-save]").click()
    phone.wait_for_selector(f"{SHEET} section.panel", state="detached")
    phone.locator("[data-edit-save]").click()
    phone.wait_for_function("window.saved.length === 1")
    strategy = phone.evaluate("window.saved[0].config.strategy")
    assert strategy["visibility"] == {}
    assert strategy["access"]["kid"]["hide"] == ["scene.x"]


def test_the_editor_explains_the_colours(phone):
    edit_room(phone)
    assert "Zielone" in phone.locator("[data-edit-legend]").text_content()


# Answer to a touch ------------------------------------------------------------------------------

TILE = "home-dashboard-page .tile"
ANIMATED = "(element) => element.getAnimations().length"


def press_on(page, selector: str) -> tuple:
    box = page.locator(selector).first.bounding_box()
    point = (box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.move(*point)
    page.mouse.down()
    page.wait_for_timeout(100)
    return point


def test_a_tile_sinks_under_the_finger_and_comes_back(moving_phone):
    mount(moving_phone)
    moving_phone.locator(TILE).first.scroll_into_view_if_needed()
    press_on(moving_phone, TILE)
    pressed = moving_phone.locator(TILE).first.evaluate("(tile) => new DOMMatrix(getComputedStyle(tile).transform).a")
    assert pressed < 1
    moving_phone.mouse.up()
    moving_phone.wait_for_timeout(300)
    assert moving_phone.locator(TILE).first.evaluate(ANIMATED) == 0


def test_a_quick_tap_still_answers(moving_phone):
    mount(moving_phone)
    tile = moving_phone.locator(TILE).first
    tile.scroll_into_view_if_needed()
    box = tile.bounding_box()
    moving_phone.mouse.move(box["x"] + 20, box["y"] + 20)
    moving_phone.mouse.down()
    moving_phone.mouse.up()
    assert tile.evaluate(ANIMATED) == 1


def test_a_cancelled_press_leaves_nothing_behind(moving_phone):
    mount(moving_phone)
    press_on(moving_phone, "home-dashboard-page [data-chip]")
    moving_phone.evaluate("window.dispatchEvent(new PointerEvent('pointercancel'))")
    assert moving_phone.locator("home-dashboard-page [data-chip]").first.evaluate(ANIMATED) == 0
    moving_phone.mouse.up()


def test_a_scroll_that_starts_at_once_shows_no_press(moving_phone):
    mount(moving_phone)
    chip = moving_phone.locator("home-dashboard-page [data-chip]").first
    box = chip.bounding_box()
    moving_phone.mouse.move(box["x"] + 10, box["y"] + 10)
    moving_phone.mouse.down()
    moving_phone.evaluate("window.dispatchEvent(new PointerEvent('pointercancel'))")
    moving_phone.wait_for_timeout(120)
    assert chip.evaluate(ANIMATED) == 0
    moving_phone.mouse.up()


def test_buttons_in_a_sheet_answer_too(moving_phone):
    open_cover(moving_phone)
    moving_phone.wait_for_timeout(400)
    press_on(moving_phone, f"{SHEET} .actions button")
    assert moving_phone.locator(f"{SHEET} .actions button").first.evaluate(ANIMATED) >= 1
    moving_phone.mouse.up()


def test_a_slider_keeps_the_finger_without_the_press(moving_phone):
    open_cover(moving_phone)
    moving_phone.wait_for_timeout(400)
    press_on(moving_phone, f"{SHEET} [data-slider]")
    assert moving_phone.locator(f"{SHEET} [data-slider]").evaluate(ANIMATED) == 0
    moving_phone.mouse.up()


def test_without_animations_nothing_moves(phone):
    mount(phone)
    phone.locator(TILE).first.scroll_into_view_if_needed()
    press_on(phone, TILE)
    assert phone.locator(TILE).first.evaluate(ANIMATED) == 0
    phone.mouse.up()


def scene_on_home(page) -> str:
    add_entity(page, "scene.evening", "2026-01-01", {"friendly_name": "Wieczór"})
    mount(page, {"scenes": [{"entity": "scene.evening", "name": "Wieczór"}]})
    return "home-dashboard-page [data-entity='scene.evening']"


def test_a_scene_tile_says_that_it_worked_and_goes_back(phone):
    tile = scene_on_home(phone)
    phone.locator(tile).click()
    assert service_calls(phone) == [("scene", "turn_on")]
    assert "ran" in phone.locator(tile).get_attribute("class")
    assert "Uruchomiono" in phone.locator(tile).text_content()
    phone.wait_for_function(
        """() => !window.card.shadowRoot.querySelector("[data-entity='scene.evening']").classList.contains("ran")""",
        timeout=3000,
    )
    assert "Uruchom" in phone.locator(tile).text_content()
    assert "Uruchomiono" not in phone.locator(tile).text_content()


def test_only_the_tapped_tile_confirms(phone):
    add_entity(phone, "scene.a", "2026-01-01", {})
    add_entity(phone, "scene.b", "2026-01-01", {})
    mount(phone, {"scenes": [{"entity": "scene.a", "name": "A"}, {"entity": "scene.b", "name": "B"}]})
    phone.locator("home-dashboard-page [data-entity='scene.a']").click()
    assert phone.locator("home-dashboard-page .tile.ran").count() == 1


def test_a_pressed_tile_sinks_clearly(moving_phone):
    mount(moving_phone)
    moving_phone.locator(TILE).first.scroll_into_view_if_needed()
    press_on(moving_phone, TILE)
    moving_phone.wait_for_timeout(120)
    scale = moving_phone.locator(TILE).first.evaluate("(tile) => new DOMMatrix(getComputedStyle(tile).transform).a")
    assert scale <= 0.94
    moving_phone.mouse.up()


def test_the_confirmation_stands_out_from_the_tile(phone):
    tile = scene_on_home(phone)
    before = phone.locator(tile).evaluate("(tile) => getComputedStyle(tile).backgroundColor")
    phone.locator(tile).click()
    phone.wait_for_timeout(300)
    after = phone.locator(tile).evaluate("(tile) => getComputedStyle(tile).backgroundColor")
    assert after != before
    assert phone.locator(tile).evaluate("(tile) => getComputedStyle(tile).color") == "rgb(255, 255, 255)"


# Guest mode -------------------------------------------------------------------------------------


def guest_cameras(page, guest: str = "on") -> dict:
    return page.evaluate(
        """(guest) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            const base = model.normalizeConfig({});
            const camera = model.buildCameras(instance, base).find((item) => item.entityId.startsWith("camera."));
            const area = model.effectiveArea(instance, camera.entityId, base);
            instance.states["input_boolean.guest"] = { entity_id: "input_boolean.guest", state: guest, attributes: {} };
            const config = model.normalizeConfig({
                cameras: { guest: { entity: "input_boolean.guest", hide: [camera.entityId] } },
            });
            const selection = model.selectEntities(instance, config);
            const room = model.buildRoomModel(instance, config, selection, area).cameras
                .find((item) => item.entityId === camera.entityId);
            return { home: model.buildCameras(instance, config).some((item) => item.entityId === camera.entityId),
                     guest: room?.guest };
        }""",
        guest,
    )


def test_guest_mode_keeps_the_camera_in_its_room_and_takes_it_off_home(phone):
    assert guest_cameras(phone) == {"home": False, "guest": True}


def test_without_guest_mode_the_camera_is_normal(phone):
    assert guest_cameras(phone, "off") == {"home": True, "guest": False}


def test_a_blocked_camera_says_why_and_opens_nothing(phone):
    camera = phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const config = model.normalizeConfig({});
        const id = model.buildCameras(hass(), config).find((item) => item.entityId.startsWith("camera.")).entityId;
        return { id, area: model.effectiveArea(hass(), id, config) };
    }""")
    add_entity(phone, "input_boolean.guest", "on", {})
    phone.evaluate(f"window.history.replaceState(null, '', '?room={camera['area']}')")
    mount(phone, {"cameras": {"guest": {"entity": "input_boolean.guest", "hide": [camera["id"]]}}}, "room")
    tile = phone.locator(f"home-dashboard-page [data-camera='{camera['id']}']")
    assert "Tryb gościa" in tile.text_content()
    tile.click()
    phone.wait_for_timeout(150)
    assert phone.locator(f"{SHEET} .panel").count() == 0


# Privacy ----------------------------------------------------------------------------------------


def private_camera(page, state: str) -> dict:
    return page.evaluate(
        """(state) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            const base = model.normalizeConfig({});
            const camera = model.buildCameras(instance, base).find((item) => item.entityId.startsWith("camera."));
            const area = model.effectiveArea(instance, camera.entityId, base);
            instance.states["switch.privacy"] = { entity_id: "switch.privacy", state, attributes: {} };
            instance.states[camera.entityId] = { ...instance.states[camera.entityId], state: state === "on" ? "unavailable" : "idle" };
            const config = model.normalizeConfig({
                cameras: { private: [{ entity: "switch.privacy", hide: [camera.entityId] }] },
            });
            const selection = model.selectEntities(instance, config);
            const has = (list) => list.some((item) => item.entityId === camera.entityId);
            return { home: has(model.buildCameras(instance, config)),
                     room: has(model.buildRoomModel(instance, config, selection, area).cameras),
                     watched: model.watchedEntityIds(instance, config, selection).has("switch.privacy") };
        }""",
        state,
    )


def test_a_private_camera_is_gone_everywhere_and_not_shown_as_broken(phone):
    assert private_camera(phone, "on") == {"home": False, "room": False, "watched": True}


def test_the_camera_comes_back_when_privacy_ends(phone):
    assert private_camera(phone, "off") == {"home": True, "room": True, "watched": True}


def test_a_toggle_tile_works_with_one_tap_and_keeps_its_own_state(phone):
    add_entity(phone, "switch.privacy", "off", {"friendly_name": "Prywatność"})
    mount(phone, {"scenes": [{"entity": "switch.privacy", "name": "Prywatność", "tap_toggle": True}]})
    tile = "home-dashboard-page [data-entity='switch.privacy']"
    phone.locator(f"{tile} .text").click()
    assert service_calls(phone) == [("homeassistant", "toggle")]
    assert "ran" not in phone.locator(tile).get_attribute("class")
    assert phone.locator(f"{SHEET} .panel").count() == 0


# Energy and map ---------------------------------------------------------------------------------


def map_card(page, dashboard: dict | None = None, who: str | None = None, hours: int | None = None) -> dict:
    page.evaluate(
        """({ who, hours }) => {
            if (who) localStorage.setItem('home_dashboard_map_who', who);
            if (hours) localStorage.setItem('home_dashboard_map_hours', String(hours));
            const states = window.dashboard.snapshot.states;
            states["zone.home"] = { entity_id: "zone.home", state: "1", attributes: { latitude: 50.0, longitude: 10.0 } };
            states["person.anna"] = { entity_id: "person.anna", state: "home", attributes: { friendly_name: "Anna Nowak", latitude: 50.0, longitude: 10.0 } };
            states["device_tracker.car"] = { entity_id: "device_tracker.car", state: "not_home",
                attributes: { friendly_name: "Auto", latitude: 50.1, longitude: 10.1 } };
        }""",
        {"who": who, "hours": hours},
    )
    mount(page, dashboard, "map")
    page.wait_for_function("window.createdCards.length >= 1")
    return page.evaluate("window.createdCards.at(-1)")


def test_the_map_draws_the_routes_of_everyone_with_the_zones(phone):
    card = map_card(phone)
    entities = [item["entity"] if isinstance(item, dict) else item for item in card["entities"]]
    assert card["hours_to_show"] == 24
    assert card["fit_zones"] is False
    assert any(entity.startswith("person.") for entity in entities)
    assert any(entity.startswith("zone.") for entity in entities)
    assert not any(entity.startswith("device_tracker.") for entity in entities)


def test_a_device_with_a_route_is_chosen_in_the_configuration(phone):
    card = map_card(phone, {"map": {"track": ["device_tracker.car"]}})
    assert {"entity": "device_tracker.car"} in card["entities"]


def test_the_map_remembers_whose_route_and_how_far_back(phone):
    card = map_card(phone, None, who="person.anna", hours=168)
    routes = [item for item in card["entities"] if isinstance(item, dict)]
    assert routes == [{"entity": "person.anna"}]
    assert card["hours_to_show"] == 168


def test_choosing_a_range_draws_the_map_again(phone):
    map_card(phone)
    phone.locator("home-dashboard-page [data-map-hours='72']").click()
    phone.wait_for_function("window.createdCards.at(-1).hours_to_show === 72")
    assert phone.evaluate("localStorage.getItem('home_dashboard_map_hours')") == "72"
    assert phone.locator("home-dashboard-page [data-map-hours='72'].on").count() == 1


def test_the_look_chooses_the_colours_of_the_map(phone):
    card = map_card(phone, {"appearance": {"map": {"theme": "dark", "hours": 6}}})
    assert card["theme_mode"] == "dark"
    assert card["hours_to_show"] == 6


# Calm tiles -------------------------------------------------------------------------------------


def calm_tile(page, entity: str, state: str, extra: dict | None = None):
    add_entity(page, entity, state, {"friendly_name": "Tryb"})
    mount(page, room_with({"entity": entity, "name": "Tryb", "tap_toggle": True, **(extra or {})}))
    return page.locator(f"home-dashboard-page [data-entity='{entity}']")


def test_a_calm_tile_that_is_on_does_not_shine(phone):
    classes = calm_tile(phone, "automation.a", "on", {"calm": True}).get_attribute("class").split()
    assert "appliance" not in classes
    assert "off" in classes
    assert "dormant" not in classes


def test_a_calm_tile_that_is_off_fades(phone):
    tile = calm_tile(phone, "automation.a", "off", {"calm": True})
    assert "dormant" in tile.get_attribute("class")
    assert float(tile.evaluate("(tile) => getComputedStyle(tile).opacity")) < 0.6


def test_other_tiles_keep_their_colour(phone):
    assert "appliance" in calm_tile(phone, "automation.a", "on").get_attribute("class")


# Languages --------------------------------------------------------------------------------------


def test_every_language_has_every_text(phone):
    missing = phone.evaluate("""async () => {
        const { TEXTS } = await import("/custom_components/home_dashboard/www/app/i18n.js");
        const keys = new Set(Object.values(TEXTS).flatMap((texts) => Object.keys(texts)));
        return Object.entries(TEXTS).flatMap(([language, texts]) =>
            [...keys].filter((key) => !(key in texts)).map((key) => `${language}: ${key}`));
    }""")
    assert missing == []


# Row that scrolls -------------------------------------------------------------------------------


def row_room(page, layout: str | None = "row") -> None:
    for number in range(6):
        add_entity(page, f"switch.s{number}", "off", {"friendly_name": f"Tryb {number}"})
    section = {"title": "Automatyzacje", "tiles": [{"entity": f"switch.s{n}", "name": f"T{n}"} for n in range(6)]}
    if layout:
        section["layout"] = layout
    rooms = [{"id": "r", "name": "R", "areas": [], "home": [], "sections": [section]}]
    page.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(page, {"layout": rooms}, "room")


def tile_tops(page) -> set:
    return set(
        page.locator("home-dashboard-page section[data-section] .tile").evaluate_all(
            "(tiles) => tiles.map((tile) => Math.round(tile.getBoundingClientRect().top))"
        )
    )


def test_a_row_section_keeps_its_tiles_in_one_line_and_scrolls(phone):
    row_room(phone)
    assert len(tile_tops(phone)) == 1
    strip = phone.locator("home-dashboard-page section[data-section] .tiles")
    assert strip.evaluate("(row) => row.scrollWidth > row.clientWidth")
    assert phone.evaluate("document.documentElement.scrollWidth <= innerWidth")


def test_a_plain_section_stays_a_grid(phone):
    row_room(phone, None)
    assert len(tile_tops(phone)) > 1


def test_the_editor_switches_a_section_to_a_row(phone):
    row_room(phone, None)
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.locator(f"{SHEET} [data-sheet-edit]").click()
    phone.wait_for_selector("[data-edit-save]")
    phone.locator("[data-section-row]").click()
    assert "on" in phone.locator("[data-section-row]").get_attribute("class")
    phone.locator("[data-edit-save]").click()
    phone.wait_for_function("window.saved.length === 1")
    assert phone.evaluate("window.saved[0].config.strategy.layout[0].sections[0].layout") == "row"


def test_scenes_on_home_can_be_a_row(phone):
    add_entity(phone, "scene.a", "2026-01-01", {})
    mount(phone, {"scenes": [{"entity": "scene.a"}], "scenes_layout": "row"})
    assert "row" in phone.locator("home-dashboard-page [data-scenes] .tiles").get_attribute("class")


@pytest.mark.parametrize("size", ["phone", "tablet"])
def test_scenes_in_a_row_match_the_ordinary_tiles(size, request):
    page = request.getfixturevalue(size)
    names = ["Dobranoc", "Wyciszenie Wszystkie"]
    for index, name in enumerate(names):
        add_entity(page, f"scene.s{index}", "2026-01-01", {"friendly_name": name})
    mount(page, {"scenes": [{"entity": f"scene.s{i}", "name": name} for i, name in enumerate(names)], "scenes_layout": "row"})
    sizes = page.locator("home-dashboard-page .tile").evaluate_all(
        """(tiles) => {
            const size = (tile) => { const box = tile.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; };
            return { scenes: tiles.filter((tile) => tile.closest("[data-scenes]")).map(size),
                     others: tiles.filter((tile) => !tile.closest("[data-scenes]")).map(size) };
        }"""
    )
    assert sizes["others"]
    assert len(sizes["scenes"]) == 2
    assert all(scene == sizes["others"][0] for scene in sizes["scenes"])


def test_the_scenes_editor_saves_the_row(phone):
    add_entity(phone, "scene.a", "2026-01-01", {})
    phone.evaluate("window.history.replaceState(null, '', '?room=__scenes')")
    mount_admin(phone, {"scenes": [{"entity": "scene.a", "name": "A"}]}, "room")
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.locator(f"{SHEET} [data-sheet-edit]").click()
    phone.wait_for_selector("[data-edit-save]")
    phone.locator("[data-section-row]").click()
    phone.locator("[data-edit-save]").click()
    phone.wait_for_function("window.saved.length === 1")
    assert phone.evaluate("window.saved[0].config.strategy.scenes_layout") == "row"
