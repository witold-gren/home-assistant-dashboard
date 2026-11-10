"""What the dashboard selects from a real installation's registries."""

from __future__ import annotations

import pytest


def run(page, body: str):
    return page.evaluate(f"""() => {{
        const {{ model, hass: createHass, snapshot }} = window.dashboard;
        const hass = createHass();
        const config = model.normalizeConfig({{}});
        const selection = model.selectEntities(hass, config);
        {body}
    }}""")


def test_only_primary_switches_are_candidates_and_none_is_shown_by_default(phone):
    primary, selected = run(
        phone,
        """
        const switches = Object.entries(hass.entities).filter(([id]) => id.startsWith("switch."));
        return [switches.filter(([, entry]) => model.isPrimary(entry)).length,
                selection.entityIds.filter((id) => id.startsWith("switch.")).length];
        """,
    )
    assert primary == 98
    assert selected == 0


def test_light_group_replaces_its_members(phone):
    leaked, groups, without_preference = run(
        phone,
        """
        const groups = selection.entityIds.filter(
          (id) => id.startsWith("light.") && Array.isArray(hass.states[id].attributes.entity_id));
        const members = groups.flatMap((id) => hass.states[id].attributes.entity_id);
        const plain = model.normalizeConfig({ lights: { prefer_groups: false } });
        return [members.filter((id) => selection.entityIds.includes(id)).length, groups.length,
                model.selectEntities(hass, plain).entityIds.length - selection.entityIds.length];
        """,
    )
    assert leaked == 0
    assert groups == 18
    assert without_preference > 0


def test_speakers_are_merged_and_other_players_stay_out(phone):
    groups, tiles, members = run(
        phone,
        """
        const model_ = model.buildHomeModel(hass, config, selection);
        const players = model_.rooms.flatMap((room) => room.tiles).filter((tile) => tile.domain === "media_player");
        return [selection.mediaGroups.length, players.length, selection.mediaGroups.flat().length];
        """,
    )
    assert groups == 6
    assert members == 12
    assert tiles <= groups


def test_merged_speaker_prefers_the_one_playing(phone):
    result = run(
        phone,
        """
        const [controlled, other] = selection.mediaGroups[0];
        const playing = window.dashboard.withState(hass, other, { state: "playing" });
        const tiles = model.buildHomeModel(playing, config, selection).rooms.flatMap((room) => room.tiles);
        return [tiles.some((tile) => tile.entityId === other), tiles.some((tile) => tile.entityId === controlled)];
        """,
    )
    assert result == [True, False]


def test_area_comes_from_the_device_when_the_entity_has_none(phone):
    assert run(
        phone,
        """
        const id = Object.keys(hass.entities).find(
          (key) => !hass.entities[key].area_id && hass.devices[hass.entities[key].device_id]?.area_id);
        return model.effectiveArea(hass, id, config) === hass.devices[hass.entities[id].device_id].area_id;
        """,
    )


def test_entities_without_a_room_wait_in_a_hidden_group(phone):
    unassigned, shown = run(
        phone,
        """
        const unassigned = model.unassignedEntities(hass, config, selection);
        const rooms = model.buildHomeModel(hass, config, selection).rooms;
        return [unassigned.filter((id) => id.startsWith("cover.")).length,
                rooms.flatMap((room) => room.tiles).filter((tile) => unassigned.includes(tile.entityId)).length];
        """,
    )
    assert unassigned == 5
    assert shown == 0


def test_user_can_include_exclude_and_override(phone):
    result = run(
        phone,
        """
        const switchId = Object.keys(hass.entities).find(
          (id) => id.startsWith("switch.") && model.isPrimary(hass.entities[id]));
        const room = Object.keys(hass.areas)[0];
        const coverId = selection.entityIds.find((id) => id.startsWith("cover."));
        const custom = model.normalizeConfig({
          entities: {
            include: { [room]: [switchId] },
            exclude: [coverId],
            overrides: { [switchId]: { name: "Wentylator", icon: "mdi:fan" } },
          },
        });
        const chosen = model.selectEntities(hass, custom);
        const rooms = model.buildHomeModel(hass, custom, chosen).rooms;
        const tile = rooms.find((item) => item.id === room).tiles.find((item) => item.entityId === switchId);
        return [tile.name, tile.icon, chosen.entityIds.includes(coverId)];
        """,
    )
    assert result == ["Wentylator", "mdi:fan", False]


def test_rooms_respect_order_and_hidden(phone):
    first, hidden_present = run(
        phone,
        """
        const rooms = model.buildHomeModel(hass, config, selection).rooms.map((room) => room.id);
        const custom = model.normalizeConfig({ rooms: { order: [rooms[2]], hidden: [rooms[0]] } });
        const ordered = model.buildHomeModel(hass, custom, selection).rooms.map((room) => room.id);
        return [ordered[0] === rooms[2], ordered.includes(rooms[0])];
        """,
    )
    assert first is True
    assert hidden_present is False


def test_cameras_outside_the_safe_platforms_can_never_reach_the_grid(phone):
    ids = run(
        phone,
        """
        const unsafe = Object.keys(hass.states).filter(
            (id) => id.startsWith("camera.") && hass.entities[id]?.platform !== "frigate");
        unsafe.forEach((id) => { hass.states[id].attributes.entity_picture = "/api/camera_proxy/x"; });
        const custom = model.normalizeConfig({ cameras: { hero: unsafe[0], tiles: unsafe } });
        return model.buildCameras(hass, custom).map((item) => item.entityId);
        """,
    )
    assert ids == []


def test_a_battery_platform_stays_out_even_when_listed_as_safe(phone):
    ids = run(
        phone,
        """
        const custom = model.normalizeConfig({ cameras: { snapshot_platforms: ["eufy_sdk", "frigate"], battery_platforms: ["eufy_sdk"] } });
        return model.buildCameras(hass, custom)
            .filter((item) => item.entityId.startsWith("camera."))
            .map((item) => hass.entities[item.entityId].platform);
        """,
    )
    assert ids
    assert set(ids) == {"frigate"}


def test_a_camera_whose_device_reports_a_battery_stays_out_even_when_listed_as_safe(phone):
    ids = run(
        phone,
        """
        for (const entity of Object.values(hass.entities)) {
            if (!entity.entity_id.startsWith("camera.") || entity.platform !== "eufy_sdk") continue;
            const id = `sensor.${entity.entity_id.slice(7)}_battery_level`;
            hass.entities[id] = { entity_id: id, device_id: entity.device_id };
            hass.states[id] = { entity_id: id, state: "80", attributes: { device_class: "battery" } };
        }
        const custom = model.normalizeConfig({ cameras: { snapshot_platforms: ["eufy_sdk", "frigate"] } });
        return model.buildCameras(hass, custom)
            .filter((item) => item.entityId.startsWith("camera."))
            .map((item) => hass.entities[item.entityId].platform);
        """,
    )
    assert set(ids) == {"frigate"}


def test_automatic_grid_shows_every_camera_with_current_pictures_first(phone):
    ids = run(phone, "return model.buildCameras(hass, config).map((item) => item.entityId);")
    cameras = [item for item in ids if item.startswith("camera.")]
    pictures = [item for item in ids if item.startswith("image.")]
    assert len(ids) > 3
    assert cameras
    assert ids == cameras + pictures
    assert all(item.endswith(("_last_screen", "_last_snapshot")) for item in pictures)


def test_unavailable_camera_stays_and_a_camera_of_a_device_that_is_gone_does_not(phone):
    result = phone.evaluate("""() => {
        const { model, hass: make } = window.dashboard;
        const hass = make();
        const config = model.normalizeConfig({});
        const camera = model.buildCameras(hass, config)[0].entityId;
        const find = (instance) => model.buildCameras(instance, config).find((item) => item.entityId === camera);
        const broken = window.dashboard.withState(hass, camera, { state: "unavailable" });
        const gone = window.dashboard.withState(hass, camera, { state: "unavailable", attributes: { restored: true } });
        return [find(hass).unavailable, find(broken)?.unavailable, find(gone) === undefined];
    }""")
    assert result == [False, True, True]


def test_stored_picture_knows_its_age_and_a_camera_is_current(phone):
    result = run(
        phone,
        """
        const items = model.buildCameras(hass, config);
        return { camera: items.find((item) => item.entityId.startsWith("camera.")).updatedAt,
                 picture: items.find((item) => item.entityId.startsWith("image.")).updatedAt };
        """,
    )
    assert result["camera"] is None
    assert result["picture"] > 0


@pytest.mark.parametrize(
    ("count", "sizes"),
    [(0, []), (1, [1]), (2, [1, 1]), (3, [1, 2]), (4, [1, 2, 1]), (5, [1, 2, 1, 1]), (6, [1, 2, 1, 2])],
)
def test_camera_strip_alternates_large_and_stacked(phone, count, sizes):
    columns = run(phone, f"return model.cameraColumns(Array.from({{ length: {count} }}, (_, i) => i));")
    assert [len(column) for column in columns] == sizes
    assert [item for column in columns for item in column] == list(range(count))


@pytest.mark.parametrize(
    ("language", "seconds", "label"),
    [
        ("pl", 6, "6 s"),
        ("pl", 59, "59 s"),
        ("pl", 60, "1 min"),
        ("pl", 3599, "59 min"),
        ("pl", 7 * 3600, "7 godz."),
        ("pl", 13 * 86400, "13 d"),
        ("en", 7 * 3600, "7 h"),
    ],
)
def test_picture_age_label(phone, language, seconds, label):
    assert run(phone, f'return model.pictureAge("{language}", 1000, 1000 + {seconds} * 1000);') == label


def test_picture_without_a_date_reads_as_current(phone):
    assert run(phone, 'return model.pictureAge("pl", null, 5000);') == "teraz"


def test_chips_summarise_the_house(phone):
    chips = run(
        phone,
        """
        const lockId = selection.entityIds.find((id) => id.startsWith("lock."));
        const open = window.dashboard.withState(hass, lockId, { state: "unlocked" });
        return model.buildChips(open, selection).map((chip) => chip.value);
        """,
    )
    assert len(chips) == 4
    assert chips[2] == "otwarte: 1"


def test_tile_text_for_each_domain(phone):
    light, cover, climate, red = run(
        phone,
        """
        const tile = (id, change) =>
          model.buildTile(window.dashboard.withState(hass, id, change), id, null, config);
        const pick = (domain) => selection.entityIds.find((id) => id.startsWith(domain));
        return [
          tile(pick("light."), { state: "on", attributes: { brightness: 204 } }).stateText,
          tile(pick("cover."), { state: "open", attributes: { current_position: 30 } }).stateText,
          tile(pick("climate."), {
            state: "heat", attributes: { temperature: 21, hvac_action: "grzanie", current_temperature: 20.4 },
          }),
          tile(pick("light."), { state: "on", attributes: { rgb_color: [255, 40, 40] } }).tint,
        ];
        """,
    )
    assert light == "80%"
    assert cover == "otwarcie 30%"
    assert climate["stateText"] == "grzanie do 21°"
    assert climate["badge"] == "20°"
    assert climate["tone"] == "climate"
    assert red == [255, 40, 40]


def test_unavailable_tile_cannot_be_toggled(phone):
    available, action, tone = run(
        phone,
        """
        const id = selection.entityIds.find((key) => key.startsWith("light."));
        const tile = model.buildTile(window.dashboard.withState(hass, id, { state: "unavailable" }), id, null, config);
        return [tile.available, tile.iconAction, tile.tone];
        """,
    )
    assert (available, action, tone) == (False, None, "off")


def test_greeting_follows_the_time_of_day(phone):
    assert phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        return [8, 15, 21].map((hour) => model.greeting(hass(), new Date(2026, 10, 4, hour)));
    }""") == ["Dzień dobry Test", "Dzień dobry Test", "Dobry wieczór Test"]


def test_strategy_generates_the_panel_views(phone):
    views = phone.evaluate("""() => window.dashboard.generateDashboard({ favorites: [] }, window.dashboard.hass()).views
        .map((view) => [view.path, view.type, view.cards[0].type, view.cards[0].page])""")
    assert [view[0] for view in views] == ["home", "room", "media", "music", "energy", "map"]
    assert all(view[1] == "panel" and view[2] == "custom:home-dashboard-page" for view in views)


def test_warm_white_light_is_not_a_colour(phone):
    white, colour = run(
        phone,
        """
        const id = selection.entityIds.find((key) => key.startsWith("light."));
        const tile = (attributes) =>
          model.buildTile(window.dashboard.withState(hass, id, { state: "on", attributes }), id, null, config);
        return [tile({ color_mode: "color_temp", rgb_color: [255, 167, 87] }).tint,
                tile({ color_mode: "xy", rgb_color: [255, 167, 87] }).tint];
        """,
    )
    assert white is None
    assert colour == [255, 167, 87]


def test_thermostat_that_is_not_heating_shows_the_target(phone):
    texts = run(
        phone,
        """
        const id = selection.entityIds.find((key) => key.startsWith("climate."));
        const text = (attributes) =>
          model.buildTile(window.dashboard.withState(hass, id, { state: "heat", attributes }), id, null, config).stateText;
        return [text({ temperature: 20, hvac_action: "idle" }), text({ temperature: 20 })];
        """,
    )
    assert texts == ["Ustawione 20°", "Ustawione 20°"]
