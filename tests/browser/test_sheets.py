"""Sheets, filters, the player, the menu and the settings, as a user reaches them."""

from __future__ import annotations

import pytest

from .test_page import mount

CHROME = "document.querySelector('home-dashboard-chrome')"


def calls(page) -> list:
    return page.evaluate("window.hass.calls")


def service_calls(page) -> list:
    return [(call["domain"], call["service"]) for call in calls(page) if call["type"] == "service"]


def set_state(page, entity_id: str, state: str, attributes: dict | None = None) -> None:
    """Change a state before the page is mounted, as if it had always been so."""
    page.evaluate(
        """({ id, state, attributes }) => {
            const stateObj = window.dashboard.snapshot.states[id];
            stateObj.state = state;
            Object.assign(stateObj.attributes, attributes);
        }""",
        {"id": entity_id, "state": state, "attributes": attributes or {}},
    )


def find_id(page, prefix: str) -> str:
    return page.evaluate(
        """(prefix) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            const selection = model.selectEntities(instance, model.normalizeConfig({}));
            const rooms = model.buildHomeModel(instance, model.normalizeConfig({}), selection).rooms;
            return rooms.flatMap((room) => room.tiles).map((tile) => tile.entityId)
                .find((id) => id.startsWith(prefix));
        }""",
        prefix,
    )


def open_tile(page, entity_id: str) -> None:
    page.locator(f"home-dashboard-page [data-entity='{entity_id}'] .text").click()
    page.wait_for_selector("home-dashboard-sheet .panel")


def drag(page, selector: str, from_ratio: float, to_ratio: float) -> None:
    page.wait_for_timeout(300)  # the sheet rises for 220 ms, so measure it after it stops
    box = page.locator(selector).bounding_box()
    x = box["x"] + box["width"] / 2

    def y(ratio: float) -> float:
        return box["y"] + box["height"] * (1 - ratio)

    page.mouse.move(x, y(from_ratio))
    page.mouse.down()
    page.mouse.move(x, y(to_ratio), steps=5)
    page.mouse.up()


# Thermostat


def test_thermostat_steps_are_sent_once_after_the_last_tap(phone):
    climate = find_id(phone, "climate.")
    set_state(
        phone, climate, "heat", {"temperature": 20, "min_temp": 7, "max_temp": 35, "target_temp_step": 0.5}
    )
    mount(phone)
    open_tile(phone, climate)
    plus = phone.locator("[data-step='1']")
    plus.click()
    plus.click()
    assert "21" in phone.locator("[data-target]").text_content()
    assert calls(phone) == []
    phone.wait_for_timeout(700)
    assert calls(phone) == [
        {
            "type": "service",
            "domain": "climate",
            "service": "set_temperature",
            "data": {"entity_id": climate, "temperature": 21},
        }
    ]


# Cover


def test_cover_slider_sets_the_position_on_release(phone):
    cover = find_id(phone, "cover.")
    set_state(phone, cover, "open", {"current_position": 20, "supported_features": 15})
    mount(phone)
    open_tile(phone, cover)
    drag(phone, "[data-slider]", 0.2, 0.75)
    (call,) = calls(phone)
    assert (call["service"], call["data"]["entity_id"]) == ("set_cover_position", cover)
    assert 70 <= call["data"]["position"] <= 80


def test_cover_without_position_has_only_buttons(phone):
    cover = find_id(phone, "cover.")
    set_state(phone, cover, "open", {"supported_features": 3})
    mount(phone)
    open_tile(phone, cover)
    assert phone.locator("[data-slider]").count() == 0
    phone.get_by_label("Otwórz").click()
    assert service_calls(phone) == [("cover", "open_cover")]


# Lock


def lock_setup(page, state: str, dashboard=None) -> None:
    lock = find_id(page, "lock.")
    set_state(page, lock, state)
    mount(page, dashboard)
    open_tile(page, lock)


def test_short_swipe_does_not_unlock(phone):
    lock_setup(phone, "locked")
    drag(phone, "[data-slider]", 0.05, 0.7)
    assert calls(phone) == []


def test_full_swipe_unlocks_on_the_phone(phone):
    lock_setup(phone, "locked")
    drag(phone, "[data-slider]", 0.05, 0.98)
    assert service_calls(phone) == [("lock", "unlock")]


def test_tablet_cannot_unlock(tablet):
    lock_setup(tablet, "locked")
    drag(tablet, "[data-slider]", 0.05, 0.98)
    assert calls(tablet) == []
    assert "wyłączone" in tablet.locator("home-dashboard-sheet .hint").text_content()


def test_tablet_can_still_lock(tablet):
    lock_setup(tablet, "unlocked")
    drag(tablet, "[data-slider]", 0.95, 0.02)
    assert service_calls(tablet) == [("lock", "lock")]


def test_tablet_unlock_can_be_allowed(tablet):
    lock_setup(tablet, "locked", {"security": {"unlock_on_tablet": True}})
    drag(tablet, "[data-slider]", 0.05, 0.98)
    assert service_calls(tablet) == [("lock", "unlock")]


def test_lock_with_a_code_stays_closed_on_the_tablet(tablet):
    lock = find_id(tablet, "lock.")
    set_state(tablet, lock, "locked", {"code_format": "^\\d{4}$"})
    mount(tablet)
    tablet.locator(f"home-dashboard-page [data-entity='{lock}']").click()
    assert tablet.locator("home-dashboard-sheet .panel").count() == 0


def test_lock_with_a_code_uses_the_regular_dialog_on_the_phone(phone):
    lock = find_id(phone, "lock.")
    set_state(phone, lock, "locked", {"code_format": "^\\d{4}$"})
    mount(phone)
    phone.evaluate("""() => {
        window.moreInfo = [];
        window.addEventListener("hass-more-info", (event) => window.moreInfo.push(event.detail.entityId));
    }""")
    phone.locator(f"home-dashboard-page [data-entity='{lock}']").click()
    assert phone.evaluate("window.moreInfo") == [lock]


# Camera


def open_camera(page, stored: bool = True) -> None:
    mount(page)
    tiles = page.locator("home-dashboard-page .camera:not(.offline)")
    (tiles.last if stored else tiles.first).click()
    page.wait_for_selector("home-dashboard-sheet .panel")


def test_opening_a_stored_picture_shows_it_and_starts_nothing(phone):
    open_camera(phone)
    assert phone.evaluate("window.createdCards") == []
    assert phone.locator("home-dashboard-sheet .picture img").count() == 1
    assert phone.locator("[data-start-live]").count() == 1
    assert "baterię" in phone.locator("home-dashboard-sheet .hint").text_content()


def test_opening_a_mains_camera_starts_nothing_and_warns_about_nothing(phone):
    open_camera(phone, stored=False)
    assert phone.evaluate("window.createdCards") == []
    assert phone.locator("[data-start-live]").count() == 1
    assert phone.locator("home-dashboard-sheet .hint").count() == 0


def test_stream_starts_on_request_and_stops_when_closed(phone):
    open_camera(phone)
    phone.locator("[data-start-live]").click()
    phone.wait_for_selector("[data-card='picture-entity']", state="attached")
    (card,) = phone.evaluate("window.createdCards")
    assert card["camera_view"] == "live"
    assert card["entity"].startswith("camera.")
    phone.get_by_label("Zamknij").click()
    phone.wait_for_function(f"!{CHROME}.shadowRoot.querySelector('home-dashboard-sheet')")
    assert phone.locator("[data-card='picture-entity']").count() == 0


def test_live_camera_comes_from_the_same_device(phone):
    assert phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const instance = hass();
        const config = model.normalizeConfig({});
        return model.buildCameras(instance, config).map((camera) => {
            const live = model.liveCameraFor(instance, camera.entityId, config);
            return live && instance.entities[live].device_id === instance.entities[camera.entityId].device_id;
        }).every(Boolean);
    }""")


def test_camera_tile_goes_live_on_that_same_camera(phone):
    assert phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        return model.liveCameraFor(hass(), "camera.anything", model.normalizeConfig({}));
    }""") == "camera.anything"


def test_live_camera_can_be_set_by_hand(phone):
    assert phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const config = model.normalizeConfig({ cameras: { live: { "image.a": "camera.b" } } });
        return model.liveCameraFor(hass(), "image.a", config);
    }""") == "camera.b"


# History


def test_back_button_closes_the_sheet_and_stays_on_the_page(phone):
    cover = find_id(phone, "cover.")
    mount(phone)
    url = phone.url
    open_tile(phone, cover)
    phone.go_back()
    phone.wait_for_function(f"!{CHROME}.shadowRoot.querySelector('home-dashboard-sheet')")
    assert phone.url == url


def test_details_button_closes_the_sheet_and_opens_the_regular_dialog(phone):
    cover = find_id(phone, "cover.")
    mount(phone)
    phone.evaluate("""() => {
        window.moreInfo = [];
        window.addEventListener("hass-more-info", (event) => window.moreInfo.push(event.detail.entityId));
    }""")
    open_tile(phone, cover)
    phone.locator("[data-details]").click()
    phone.wait_for_function("window.moreInfo.length === 1")
    assert phone.locator("home-dashboard-sheet .panel").count() == 0


# Filters


def test_chip_filters_and_second_tap_clears(phone):
    mount(phone)
    phone.locator("[data-chip='lights']").click()
    phone.wait_for_function("window.card.shadowRoot.querySelector('h1').textContent === 'Światła'")
    domains = phone.evaluate("""() => [...new Set([...window.card.shadowRoot.querySelectorAll("[data-entity]")]
        .map((tile) => tile.dataset.entity.split(".")[0]))]""")
    assert domains == ["light"]
    assert "filter=lights" in phone.url
    assert phone.locator("home-dashboard-page .camera").count() == 0
    phone.locator("[data-chip='lights']").click()
    phone.wait_for_function("window.card.shadowRoot.querySelector('h1').textContent.startsWith('D')")
    assert "filter" not in phone.url


def test_filters_sort_covers_by_purpose(phone):
    result = phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const tile = (domain, deviceClass) => ({ domain, deviceClass });
        const base = { rooms: [{ id: "a", name: "A", tiles: [
            tile("cover", "garage"), tile("cover", "blind"), tile("lock", null), tile("climate", null)] }],
            favorites: [], cameras: [{ entityId: "image.a" }] };
        const pick = (key) => model.applyFilter(base, key, "pl");
        return [pick("security").rooms[0].tiles.map((item) => item.domain),
                pick("climate").rooms[0].tiles.map((item) => item.domain),
                pick("security").cameraList.length, pick("climate").cameraList.length,
                model.applyFilter(base, "nonsense", "pl") === base];
    }""")
    assert result == [["cover", "lock"], ["cover", "climate"], 1, 0, True]


# Player


PLAYING = {
    "media_title": "Utwór",
    "media_artist": "Zespół",
    "media_duration": 200,
    "media_position": 50,
    "volume_level": 0.4,
    "supported_features": 2 | 4 | 16 | 32 | 32768 | 262144,
}


def playing_speaker(page) -> str:
    speaker = page.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const instance = hass();
        return model.selectEntities(instance, model.normalizeConfig({})).mediaGroups[0][0];
    }""")
    set_state(page, speaker, "playing", PLAYING)
    return speaker


def test_mini_player_appears_only_when_something_plays(phone):
    mount(phone)
    assert phone.locator("[data-mini]").count() == 0


def test_mini_player_pauses_and_opens_the_full_player(phone):
    speaker = playing_speaker(phone)
    mount(phone)
    assert "Utwór" in phone.locator("[data-mini]").text_content()
    phone.locator("[data-mini-play]").click()
    assert service_calls(phone) == [("media_player", "media_play_pause")]
    phone.locator(".mini-open").click()
    phone.wait_for_selector("home-dashboard-sheet .panel")
    text = phone.locator("home-dashboard-sheet .player").text_content()
    assert "Utwór" in text
    assert "Zespół" in text
    phone.locator("[data-play]").click()
    assert calls(phone)[-1]["data"]["entity_id"] == speaker


def test_player_model(phone):
    result = phone.evaluate(
        """(attributes) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            const config = model.normalizeConfig({});
            const id = model.selectEntities(instance, config).mediaGroups[0][0];
            const updated = new Date(1000000).toISOString();
            const playing = window.dashboard.withState(instance, id, { state: "playing",
                attributes: { ...attributes, media_position_updated_at: updated } });
            const player = model.buildPlayer(playing, id, config, 1000000 + 30000);
            const paused = window.dashboard.withState(instance, id, { state: "paused",
                attributes: { ...attributes, media_position_updated_at: updated } });
            return [player.position, player.can.next, player.can.seek,
                    model.buildPlayer(paused, id, config, 1000000 + 30000).position,
                    ["off", "all", "one"].map(model.nextRepeat)];
        }""",
        PLAYING,
    )
    assert result == [80, True, True, 50, ["all", "one", "off"]]


def test_position_never_passes_the_end(phone):
    assert phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const instance = hass();
        const config = model.normalizeConfig({});
        const id = model.selectEntities(instance, config).mediaGroups[0][0];
        const playing = window.dashboard.withState(instance, id, { state: "playing", attributes: {
            media_duration: 100, media_position: 90, media_position_updated_at: new Date(0).toISOString() } });
        return model.buildPlayer(playing, id, config, 500000).position;
    }""") == 100


# Pages


def test_media_page_lists_speakers_by_room_and_sources(phone):
    phone.evaluate("""() => {
        const original = window.dashboard.hass;
        window.dashboard.hass = (overrides) => original({
            callWS: async () => ({ children: [{ title: "Radio", thumbnail: null }] }), ...overrides });
    }""")
    mount(phone, None, "media")
    phone.wait_for_selector("[data-source]")
    assert phone.locator("home-dashboard-page .tile").count() == 6
    assert phone.locator("[data-source]").text_content().strip() == "Radio"
    assert phone.locator("[data-browse]").count() == 1


def test_media_sources_leave_out_pictures_and_tokenised_icons(phone):
    sources = phone.evaluate("""() => window.dashboard.model.playableSources([
        { title: "Kamera", media_content_id: "media-source://camera" },
        { title: "Zdjęcia", media_content_id: "media-source://image_upload" },
        { title: "Radio", media_content_id: "media-source://radio_browser", thumbnail: "/api/brands/x.png" },
        { title: "Muzyka", media_content_id: "media-source://media_source", thumbnail: "https://x/y.png" },
    ])""")
    assert sources == [
        {"title": "Radio", "thumbnail": None},
        {"title": "Muzyka", "thumbnail": "https://x/y.png"},
    ]


def test_media_page_survives_without_sources(phone):
    mount(phone, None, "media")
    assert phone.locator("[data-browse]").count() == 1


def test_energy_page_uses_home_assistant_cards_when_set_up(phone):
    phone.evaluate("""() => {
        const original = window.dashboard.hass;
        window.dashboard.hass = (overrides) => original({
            callWS: async () => ({ energy_sources: [{ type: "grid" }] }), ...overrides });
    }""")
    mount(phone, None, "energy")
    phone.wait_for_function("window.createdCards.length === 5")
    assert phone.evaluate("window.createdCards.map((card) => card.type)") == [
        "energy-date-selection",
        "energy-compare",
        "energy-usage-graph",
        "energy-distribution",
        "energy-sources-table",
    ]


PEOPLE = """() => {
    const person = (id, name, state, position) => ({ entity_id: `person.${id}`, state,
        attributes: { friendly_name: name, ...position } });
    const states = { ...window.dashboard.snapshot.states,
        "zone.home": { entity_id: "zone.home", state: "2", attributes: { latitude: 51.1, longitude: 17.0 } },
        "person.a": person("a", "Daleko", "not_home", { latitude: 52.2, longitude: 21.0 }),
        "person.b": person("b", "Blisko", "not_home", { latitude: 51.1005, longitude: 17.0 }),
        "person.d": person("d", "W domu", "home", { latitude: 51.1, longitude: 17.0 }),
        "person.c": person("c", "Nieznana", "unknown", {}) };
    return states;
}"""


def test_people_are_sorted_by_distance(phone):
    people = phone.evaluate(f"""() => {{
        const states = ({PEOPLE})();
        return window.dashboard.model.buildPeople(window.dashboard.hass({{ states }}))
            .map((person) => [person.name, person.distance]);
    }}""")
    assert people[0] == ["W domu", ""]
    assert people[1] == ["Blisko", "56 m od domu"]
    assert people[2][0] == "Daleko"
    assert people[2][1].endswith("km od domu")
    assert people[3] == ["Nieznana", ""]


def test_map_page_shows_the_map_card_and_people(phone):
    phone.evaluate(f"""async () => {{
        const states = ({PEOPLE})();
        window.hass = window.dashboard.hass({{ states }});
        window.card = await window.dashboard.mount(window.hass, {{}}, "map");
    }}""")
    phone.wait_for_function("window.createdCards.length === 1")
    assert phone.evaluate("window.createdCards[0].type") == "map"
    assert phone.evaluate("window.createdCards[0].show_all") is True
    assert phone.locator("[data-person]").count() == 4


# Menu


def open_menu(page) -> None:
    page.locator("home-dashboard-page [data-menu]").click()
    page.wait_for_selector("[data-drawer]")


def test_menu_goes_to_a_page(phone):
    mount(phone)
    open_menu(phone)
    phone.locator("[data-go='energy']").click()
    phone.wait_for_function("location.pathname.endsWith('/energy')")
    assert phone.locator("[data-drawer]").count() == 0


def test_menu_hides_admin_links_from_regular_users(phone):
    phone.evaluate("""async () => {
        window.hass = window.dashboard.hass({ user: { name: "Dziecko", is_admin: false } });
        window.card = await window.dashboard.mount(window.hass);
    }""")
    open_menu(phone)
    assert phone.locator("[data-link='/config/devices/dashboard']").count() == 0
    assert phone.locator("[data-settings]").count() == 0
    assert phone.locator("[data-link='/history']").count() == 1


def room_with_tiles(page) -> dict:
    return page.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const instance = hass();
        const config = model.normalizeConfig({});
        const rooms = model.buildHomeModel(instance, config, model.selectEntities(instance, config)).rooms;
        const room = rooms.find((item) => item.tiles.some((tile) => tile.domain === "climate"));
        return { id: room.id, name: room.name, tiles: room.tiles.map((tile) => tile.entityId) };
    }""")


def mount_room(page, room_id: str) -> None:
    page.evaluate("(id) => history.replaceState(null, '', `/tests/room?room=${id}`)", room_id)
    mount(page, None, "room")


def test_room_in_the_menu_opens_its_own_page_instead_of_scrolling(phone):
    mount(phone)
    open_menu(phone)
    rooms = phone.locator("[data-jump]")
    assert rooms.count() == 10
    room_id = rooms.last.get_attribute("data-jump")
    rooms.last.click()
    phone.wait_for_function("location.pathname.endsWith('/room')")
    assert f"room={room_id}" in phone.url
    assert phone.evaluate("window.scrollY") == 0
    assert phone.locator("[data-drawer]").count() == 0


def test_room_page_shows_only_that_room_in_sections(phone):
    room = room_with_tiles(phone)
    mount_room(phone, room["id"])
    assert phone.locator("home-dashboard-page h1").text_content() == room["name"]
    shown = phone.evaluate("""() => [...window.card.shadowRoot.querySelectorAll("[data-entity]")]
        .map((tile) => tile.dataset.entity)""")
    assert sorted(shown) == sorted(room["tiles"])
    assert phone.locator("[data-section='climate'] h2").text_content() == "Klimat"
    assert phone.locator("home-dashboard-page .chip").count() == 0


def test_room_page_follows_the_address_to_another_room(phone):
    room = room_with_tiles(phone)
    mount_room(phone, room["id"])
    other = phone.evaluate(
        """(current) => Object.values(window.hass.areas).find((area) => area.area_id !== current).area_id""",
        room["id"],
    )
    phone.evaluate(
        """(id) => {
            history.pushState(null, "", `/tests/room?room=${id}`);
            window.dispatchEvent(new CustomEvent("location-changed"));
        }""",
        other,
    )
    expected = phone.evaluate("(id) => window.hass.areas[id].name", other)
    phone.wait_for_function(
        "(name) => window.card.shadowRoot.querySelector('h1').textContent === name", arg=expected
    )
    phone.go_back()
    phone.wait_for_function(
        "(name) => window.card.shadowRoot.querySelector('h1').textContent === name", arg=room["name"]
    )


def test_room_page_arrow_returns_home(phone):
    mount_room(phone, room_with_tiles(phone)["id"])
    phone.locator("[data-back]").click()
    assert phone.evaluate("location.pathname") == "/tests/home"


def test_room_highlights_home_in_the_navigation(phone):
    mount_room(phone, room_with_tiles(phone)["id"])
    assert phone.locator("home-dashboard-chrome .item.active").get_attribute("data-page") == "home"


def test_room_page_of_an_unknown_room_says_it_is_empty(phone):
    mount_room(phone, "no_such_room")
    assert "nie ma jeszcze nic" in phone.locator("home-dashboard-page .soon").text_content()


def test_room_page_starts_no_stream(phone):
    platforms = phone.evaluate("""() => {
        const { entities } = window.dashboard.hass();
        return Object.fromEntries(Object.entries(entities).map(([id, entry]) => [id, entry.platform]));
    }""")
    result = phone.evaluate("""async () => {
        const { model, hass } = window.dashboard;
        const instance = hass();
        const config = model.normalizeConfig({});
        const areas = Object.keys(instance.areas);
        const selection = model.selectEntities(instance, config);
        return areas.flatMap((id) => model.buildRoomModel(instance, config, selection, id).cameras)
            .map((camera) => camera.entityId);
    }""")
    assert result
    assert all(item.startswith("image.") or platforms[item] == "frigate" for item in result)


def test_menu_lists_rooms_on_every_page(phone):
    mount(phone, None, "energy")
    open_menu(phone)
    assert phone.locator("[data-jump]").count() == 10


# Settings


SETTINGS_HASS = """(dashboard) => {
    window.saved = [];
    const hass = window.dashboard.hass({
        user: { name: "Admin", is_admin: true },
        callWS: async (message) => {
            if (message.type === "lovelace/config") {
                return { strategy: { type: "custom:home-dashboard", ...dashboard }, title: "x" };
            }
            if (!["frontend/get_user_data", "config/auth/list"].includes(message.type)) window.saved.push(message);
            return null;
        },
    });
    window.hass = hass;
    return window.dashboard.mount(hass, dashboard).then((card) => { window.card = card; });
}"""


def open_settings(page, dashboard: dict) -> None:
    page.evaluate(SETTINGS_HASS, dashboard)
    open_menu(page)
    page.locator("[data-settings]").click()
    page.wait_for_selector("home-dashboard-settings .panel")


def test_settings_save_favorites_and_rooms(phone):
    dashboard = {"rooms": {"hidden": []}}
    open_settings(phone, dashboard)
    light = find_id(phone, "light.")
    name = phone.evaluate("(id) => window.hass.states[id].attributes.friendly_name", light)
    phone.locator("home-dashboard-settings input[type='search']").fill(name)
    phone.locator(f"home-dashboard-settings li[data-entity='{light}'] [data-favorite]").click()
    room = phone.locator("home-dashboard-settings li[data-room]").nth(1)
    room_id = room.get_attribute("data-room")
    room.locator("[data-up]").click()
    phone.locator(f"home-dashboard-settings li[data-room='{room_id}'] [data-hide]").click()
    phone.evaluate(f"{CHROME}._reload = () => {{}}")
    phone.locator("[data-save]").click()
    phone.wait_for_function("window.saved.length === 1")
    strategy = phone.evaluate("window.saved[0].config.strategy")
    assert strategy["type"] == "custom:home-dashboard"
    assert strategy["favorites"] == [light]
    assert strategy["rooms"]["order"][0] == room_id
    assert strategy["rooms"]["hidden"] == [room_id]
    assert phone.evaluate("window.saved[0].url_path") == "tests"


def test_settings_add_a_switch_to_its_room(phone):
    result = phone.evaluate("""async () => {
        const { applyInclude } = await import("/custom_components/home_dashboard/www/app/settings.js");
        const { model, hass } = window.dashboard;
        const instance = hass();
        const id = Object.keys(instance.entities).find((key) => key.startsWith("switch.")
            && model.isPrimary(instance.entities[key])
            && model.effectiveArea(instance, key, model.normalizeConfig({})));
        const added = applyInclude({}, instance, id);
        const area = Object.keys(added.entities.include)[0];
        return [added.entities.include[area].includes(id), applyInclude(added, instance, id).entities.include[area]];
    }""")
    assert result == [True, None]


def test_list_helpers(phone):
    assert phone.evaluate("""() => {
        const { toggleInList, moveInList } = window.dashboard.model;
        return [toggleInList(["a"], "b"), toggleInList(["a", "b"], "a"),
                moveInList(["a", "b", "c"], "c", -1), moveInList(["a"], "a", -1), moveInList(["a"], "x", 1)];
    }""") == [["a", "b"], ["b"], ["a", "c", "b"], ["a"], ["a"]]


# Configuration editor

EDITED = {"favorites": ["light.a"], "rooms": {"hidden": ["garage"]}}


def open_editor(page, dashboard: dict | None = None) -> None:
    open_settings(page, dashboard or EDITED)
    page.locator("[data-editor]").click()
    page.wait_for_selector("[data-yaml]")
    page.evaluate(f"{CHROME}._reload = () => {{}}")


def editor_text(page) -> str:
    return page.locator("[data-yaml]").input_value()


def test_editor_shows_the_configuration_without_its_type(phone):
    open_editor(phone)
    text = editor_text(phone)
    assert "light.a" in text
    assert "hidden:" in text
    assert "custom:home-dashboard" not in text


def test_editor_saves_a_change_and_keeps_the_strategy_type(phone):
    open_editor(phone)
    phone.locator("[data-yaml]").fill("favorites:\n  - light.b\nidle:\n  return_after: 60\n")
    phone.locator("[data-yaml-save]").click()
    phone.wait_for_function("window.saved.length === 1")
    assert phone.evaluate("window.saved[0].config.strategy") == {
        "type": "custom:home-dashboard",
        "favorites": ["light.b"],
        "idle": {"return_after": 60},
    }


def test_editor_shows_the_line_of_a_syntax_error_and_saves_nothing(phone):
    open_editor(phone)
    phone.locator("[data-yaml]").fill("favorites:\n  - a\n bad: [\n")
    phone.locator("[data-yaml-save]").click()
    assert "Wiersz" in phone.locator("[data-yaml-problem]").inner_text()
    assert phone.evaluate("window.saved") == []
    assert "bad" in editor_text(phone)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("- a\n- b\n", "zestawem opcji"),
        ("layout: nope\n", "layout: musi być listą"),
        ("rooms: nope\n", "rooms: musi być zestawem"),
        ("layout:\n  - id: a\n", "layout[0]: pokój wymaga"),
        ("layout:\n  - {id: a, name: A, sections: [{title: X}]}\n", "sections[0].tiles: musi być listą"),
        ("layout:\n  - {id: a, name: A, home: [{name: X}]}\n", "home[0]: kafelek wymaga"),
        ("layout:\n  - {id: a, name: A, status: [{name: X}]}\n", "status[0].entities: musi być listą"),
    ],
)
def test_editor_refuses_what_would_break_the_dashboard(phone, text, expected):
    open_editor(phone)
    phone.locator("[data-yaml]").fill(text)
    phone.locator("[data-yaml-save]").click()
    assert expected in phone.locator("[data-yaml-problem]").inner_text()
    assert phone.evaluate("window.saved") == []


def test_a_block_without_an_entity_is_a_valid_tile(phone):
    open_editor(phone)
    text = "layout:\n  - {id: a, name: A, home: [{kind: panel, name: NVR, frame: 'http://x'}]}\n"
    phone.locator("[data-yaml]").fill(text)
    phone.locator("[data-yaml-save]").click()
    phone.wait_for_function("window.saved.length === 1")


def test_an_empty_editor_does_not_wipe_the_configuration(phone):
    open_editor(phone)
    phone.locator("[data-yaml]").fill("")
    phone.locator("[data-yaml-save]").click()
    assert "zestawem opcji" in phone.locator("[data-yaml-problem]").inner_text()
    assert phone.evaluate("window.saved") == []


def test_the_version_before_the_last_save_can_be_loaded_back(phone):
    open_editor(phone)
    assert phone.locator("[data-yaml-restore]").count() == 0
    before = editor_text(phone)
    phone.locator("[data-yaml]").fill("favorites: []\n")
    phone.locator("[data-yaml-save]").click()
    phone.wait_for_function("window.saved.length === 1")
    phone.wait_for_selector("home-dashboard-settings .panel", state="detached")
    phone.evaluate(f"{CHROME}.open({{ type: 'settings' }})")
    phone.locator("[data-editor]").click()
    phone.locator("[data-yaml-restore]").click()
    assert editor_text(phone) == before


def test_typing_survives_a_state_update(phone):
    open_editor(phone)
    phone.locator("[data-yaml]").fill("favorites: []\n# written by hand\n")
    phone.evaluate(f"{CHROME}.hass = {{ ...window.hass }}")
    phone.wait_for_timeout(50)
    assert "written by hand" in editor_text(phone)


def test_leaving_the_editor_saves_nothing(phone):
    open_editor(phone)
    phone.locator("[data-yaml]").fill("favorites: []\n")
    phone.locator("[data-editor-close]").click()
    assert phone.locator("[data-yaml]").count() == 0
    assert phone.evaluate("window.saved") == []


def test_a_real_layout_survives_the_round_trip(phone):
    layout = [
        {
            "id": "kitchen",
            "name": "Kuchnia",
            "areas": ["kitchen"],
            "home": [{"kind": "panel", "name": "Ekspres", "entity": "sensor.a", "labels": {"on": "Gotowy: tak"}}],
            "sections": [{"title": "Światła", "tiles": [{"entity": "light.a", "name": "Główne # lampa"}]}],
        }
    ]
    open_editor(phone, {"layout": layout})
    phone.locator("[data-yaml-save]").click()
    phone.wait_for_function("window.saved.length === 1")
    assert phone.evaluate("window.saved[0].config.strategy.layout") == layout
