"""Variants of a page: slices, who sees which, making one the published page, and what others may not do."""

# ruff: noqa: F811 (fixtures imported from another test module are its arguments)

from __future__ import annotations

from datetime import timedelta
import json
from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
import pytest
from pytest_homeassistant_custom_component.common import MockUser

from custom_components.home_dashboard.const import DOMAIN
from custom_components.home_dashboard.editor import HISTORY_LIMIT, STORAGE_KEY, config_hash
from custom_components.home_dashboard.variants import (
    note_device,
    shown_variant,
    slice_of,
    valid_page,
    with_slice,
)

from .test_editor import URL, admin, call, dashboard, live, ok  # noqa: F401

CASES = json.loads((Path(__file__).parent / "fixtures" / "variant_slices.json").read_text())


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Enable custom_components in tests."""


# Slices (the browser checks the same cases in tests/browser/test_page_variants.py) ----------------------


def test_the_slice_of_home_is_what_home_shows() -> None:
    assert slice_of(CASES["live"], "home") == CASES["slice_home"]
    assert "menu" not in CASES["slice_home"]
    assert CASES["slice_home"]["background"] == {"light": "/local/home.jpg"}
    # The page's own layout, even when it only follows the style of every page.
    assert CASES["slice_home"]["page_layout"]["home"] == "classic"


def test_the_slice_of_a_room_is_its_card_and_background_without_what_it_shows_on_home() -> None:
    assert slice_of(CASES["live"], "room:living") == CASES["slice_living"]
    assert "home" not in CASES["slice_living"]["room"]
    assert slice_of(CASES["live"], "room:bedroom") == CASES["slice_bedroom"]
    assert slice_of(CASES["live"], "room:gone") is None


def test_a_home_variant_changes_only_home() -> None:
    result = with_slice(CASES["live"], "home", CASES["variant_home"])
    assert result == CASES["with_home"]
    assert result["menu"] == CASES["live"]["menu"]
    assert result["cameras"]["private"] == ["camera.kids"]
    assert result["backgrounds"]["home"] == {"light": "/local/other.jpg"}
    assert result["backgrounds"]["living"] == CASES["live"]["backgrounds"]["living"]
    assert "home" not in result["layout"][0]


def test_a_room_variant_changes_only_that_room() -> None:
    result = with_slice(CASES["live"], "room:living", CASES["variant_living"])
    assert result == CASES["with_living"]
    assert result["layout"][0]["home"] == [{"entity": "light.sofa"}]
    assert "living" not in result["backgrounds"]
    assert result["layout"][1] == CASES["live"]["layout"][1]


def test_a_variant_of_a_room_that_is_gone_changes_nothing() -> None:
    assert with_slice(CASES["live"], "room:gone", CASES["variant_living"]) == CASES["live"]
    assert CASES["with_gone"] == CASES["live"]


def test_a_slice_put_back_keeps_the_configuration() -> None:
    assert with_slice(CASES["live"], "home", slice_of(CASES["live"], "home")) == CASES["round_trip_home"]
    room = with_slice(CASES["live"], "room:bedroom", slice_of(CASES["live"], "room:bedroom"))
    assert room == CASES["live"]


def test_pages_are_home_or_a_room() -> None:
    assert valid_page("home")
    assert valid_page("room:living")
    assert not valid_page("room:")
    assert not valid_page("energy")


def test_a_device_wins_over_its_person() -> None:
    entry = {
        "items": [{"id": "a"}, {"id": "b"}],
        "devices": {"tablet": "a"},
        "people": {"sam": "b", "kim": "gone"},
    }
    assert shown_variant(entry, "tablet", "sam")["id"] == "a"
    assert shown_variant(entry, "phone", "sam")["id"] == "b"
    assert shown_variant(entry, "phone", "kim") is None
    assert shown_variant(entry, None, None) is None


def test_a_device_is_written_down_again_only_when_something_changed() -> None:
    data: dict = {}
    assert note_device(data, "token", "sam", "iPad (app)")
    assert not note_device(data, "token", "sam", "iPad (app)")
    assert note_device(data, "token", "sam", "iPhone (app)")
    data["devices"]["token"]["seen"] = (dt_util.utcnow() - timedelta(days=1)).isoformat()
    data["devices"]["token"]["name"] = "Hall"
    assert note_device(data, "token", "sam", "iPhone (app)")
    assert data["devices"]["token"]["name"] == "Hall"


# Commands -----------------------------------------------------------------------------------------------


async def create(client, page="home", name="Sections", **extra):
    return (await ok(client, type=f"{DOMAIN}/variants/create", url_path=URL, page=page, name=name, **extra))[
        "variant"
    ]


async def second_device(hass, hass_ws_client, user):
    """Another login of the same person: another device."""
    refresh = await hass.auth.async_create_refresh_token(user, "https://example.com/second")
    return await hass_ws_client(hass, hass.auth.async_create_access_token(refresh))


async def mine(client, label="iPad (app)"):
    return await ok(client, type=f"{DOMAIN}/variants/mine", url_path=URL, device_label=label)


async def test_a_new_variant_copies_the_published_page(admin) -> None:
    variant = await create(admin, page="room:living", name="Salon B")
    assert variant["slice"]["room"]["name"] == "Living room"
    assert variant["devices"] == [] and variant["people"] == []
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    assert [item["name"] for item in listed["pages"]["room:living"]["items"]] == ["Salon B"]
    assert listed["pages"]["room:living"]["live_name"] is None


async def test_a_copy_of_a_variant_and_bad_requests(admin) -> None:
    first = await create(admin)
    copied = await create(admin, name="Copy", **{"from": first["id"]})
    assert copied["slice"] == first["slice"] and copied["id"] != first["id"]
    answer = await call(admin, type=f"{DOMAIN}/variants/create", url_path=URL, page="room:gone", name="x")
    assert answer["error"]["code"] == "not_found"
    answer = await call(admin, type=f"{DOMAIN}/variants/create", url_path=URL, page="energy", name="x")
    assert answer["error"]["code"] == "invalid_page"
    answer = await call(
        admin, type=f"{DOMAIN}/variants/create", url_path=URL, page="home", name="x", **{"from": "no"}
    )
    assert answer["error"]["code"] == "not_found"


async def test_a_variant_nobody_sees_changes_nothing(hass: HomeAssistant, admin) -> None:
    before = await live(admin)
    variant = await create(admin)
    events = []
    hass.bus.async_listen("lovelace_updated", events.append)
    part = {**variant["slice"], "favorites": ["light.lamp"]}
    await ok(
        admin, type=f"{DOMAIN}/variants/update", url_path=URL, page="home", variant=variant["id"], slice=part
    )
    await hass.async_block_till_done()
    assert await live(admin) == before
    assert events == []
    assert (await mine(admin))["pages"] == {}


async def test_a_device_sees_its_variant_and_others_do_not(
    hass, admin, hass_ws_client, hass_admin_user
) -> None:
    variant = await create(admin)
    me = await mine(admin)
    assert me["device"]
    await ok(
        admin,
        type=f"{DOMAIN}/variants/assign",
        url_path=URL,
        page="home",
        devices={me["device"]: variant["id"]},
    )
    shown = (await mine(admin))["pages"]["home"]
    assert shown["id"] == variant["id"] and shown["name"] == "Sections"
    other = await second_device(hass, hass_ws_client, hass_admin_user)
    assert (await mine(other))["pages"] == {}


async def test_a_person_sees_the_variant_on_every_device(
    hass, admin, hass_ws_client, hass_admin_user
) -> None:
    variant = await create(admin)
    await ok(
        admin,
        type=f"{DOMAIN}/variants/assign",
        url_path=URL,
        page="home",
        people={hass_admin_user.id: variant["id"]},
    )
    other = await second_device(hass, hass_ws_client, hass_admin_user)
    assert (await mine(other))["pages"]["home"]["id"] == variant["id"]
    await ok(
        admin, type=f"{DOMAIN}/variants/assign", url_path=URL, page="home", people={hass_admin_user.id: None}
    )
    assert (await mine(other))["pages"] == {}


async def test_assigning_reloads_the_pages(hass, admin) -> None:
    variant = await create(admin)
    events = []
    hass.bus.async_listen("lovelace_updated", events.append)
    me = await mine(admin)
    await ok(
        admin,
        type=f"{DOMAIN}/variants/assign",
        url_path=URL,
        page="home",
        devices={me["device"]: variant["id"]},
    )
    await ok(
        admin,
        type=f"{DOMAIN}/variants/update",
        url_path=URL,
        page="home",
        variant=variant["id"],
        slice=variant["slice"],
    )
    await hass.async_block_till_done()
    assert len(events) == 2


async def test_an_unknown_variant_cannot_be_assigned(admin) -> None:
    answer = await call(
        admin, type=f"{DOMAIN}/variants/assign", url_path=URL, page="home", devices={"x": "nope"}
    )
    assert answer["error"]["code"] == "not_found"


async def test_deleting_a_variant_gives_the_published_page_back(admin) -> None:
    variant = await create(admin)
    me = await mine(admin)
    await ok(
        admin,
        type=f"{DOMAIN}/variants/assign",
        url_path=URL,
        page="home",
        devices={me["device"]: variant["id"]},
    )
    await ok(admin, type=f"{DOMAIN}/variants/delete", url_path=URL, page="home", variant=variant["id"])
    assert (await mine(admin))["pages"] == {}
    answer = await call(
        admin, type=f"{DOMAIN}/variants/delete", url_path=URL, page="home", variant=variant["id"]
    )
    assert answer["error"]["code"] == "not_found"


async def test_deploying_publishes_the_page_and_keeps_the_old_one(hass, admin) -> None:
    before = await live(admin)
    variant = await create(admin, page="room:living", name="Salon B")
    part = {
        **variant["slice"],
        "room": {**variant["slice"]["room"], "name": "Salon"},
        "background": {"light": "/local/b.jpg"},
    }
    await ok(
        admin,
        type=f"{DOMAIN}/variants/update",
        url_path=URL,
        page="room:living",
        variant=variant["id"],
        slice=part,
    )
    me = await mine(admin)
    await ok(
        admin,
        type=f"{DOMAIN}/variants/assign",
        url_path=URL,
        page="room:living",
        devices={me["device"]: variant["id"]},
    )
    result = await ok(
        admin, type=f"{DOMAIN}/variants/deploy", url_path=URL, page="room:living", variant=variant["id"]
    )
    after = await live(admin)
    assert after["strategy"]["layout"][0]["name"] == "Salon"
    assert after["strategy"]["backgrounds"]["living"] == {"light": "/local/b.jpg"}
    assert result["live_hash"] == config_hash(after)
    # The replaced page is a variant now, and the old configuration is in the history.
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    page = listed["pages"]["room:living"]
    assert page["live_name"] == "Salon B"
    assert [item["slice"]["room"]["name"] for item in page["items"]] == ["Living room"]
    assert result["replaced"]["name"] == ""
    loaded = await ok(admin, type=f"{DOMAIN}/editor/load", url_path=URL)
    assert loaded["history"][0]["note"] == "Salon B"
    got = await ok(
        admin, type=f"{DOMAIN}/editor/history_get", url_path=URL, version=loaded["history"][0]["id"]
    )
    assert got["config"] == before
    # Nobody is left on a variant that is now the published page.
    assert (await mine(admin))["pages"] == {}


async def test_deploying_back_restores_the_old_page(admin) -> None:
    before = await live(admin)
    variant = await create(admin, page="room:living")
    part = {**variant["slice"], "room": {**variant["slice"]["room"], "name": "Salon"}}
    await ok(
        admin,
        type=f"{DOMAIN}/variants/update",
        url_path=URL,
        page="room:living",
        variant=variant["id"],
        slice=part,
    )
    result = await ok(
        admin, type=f"{DOMAIN}/variants/deploy", url_path=URL, page="room:living", variant=variant["id"]
    )
    await ok(
        admin,
        type=f"{DOMAIN}/variants/deploy",
        url_path=URL,
        page="room:living",
        variant=result["replaced"]["id"],
    )
    restored = (await live(admin))["strategy"]["layout"][0]
    assert restored["name"] == before["strategy"]["layout"][0]["name"]


async def test_deploying_carries_the_page_into_the_draft(admin) -> None:
    loaded = await ok(admin, type=f"{DOMAIN}/editor/load", url_path=URL)
    draft_config = {"strategy": {**loaded["live"]["strategy"], "favorites": ["light.draft"]}}
    await ok(
        admin, type=f"{DOMAIN}/editor/save_draft", url_path=URL, config=draft_config, base=loaded["live_hash"]
    )
    variant = await create(admin, page="room:living")
    part = {**variant["slice"], "room": {**variant["slice"]["room"], "name": "Salon"}}
    await ok(
        admin,
        type=f"{DOMAIN}/variants/update",
        url_path=URL,
        page="room:living",
        variant=variant["id"],
        slice=part,
    )
    result = await ok(
        admin, type=f"{DOMAIN}/variants/deploy", url_path=URL, page="room:living", variant=variant["id"]
    )
    loaded = await ok(admin, type=f"{DOMAIN}/editor/load", url_path=URL)
    assert loaded["draft"]["config"]["strategy"]["layout"][0]["name"] == "Salon"
    assert loaded["draft"]["config"]["strategy"]["favorites"] == ["light.draft"]
    # The draft still publishes without a conflict.
    assert loaded["draft"]["base"] == result["live_hash"]
    await ok(admin, type=f"{DOMAIN}/editor/publish", url_path=URL, base=loaded["draft"]["base"])
    assert len(loaded["history"]) <= HISTORY_LIMIT


async def test_devices_are_listed_with_their_person_and_can_be_named(admin, hass_admin_user) -> None:
    me = await mine(admin, label="iPad (app)")
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    device = next(item for item in listed["devices"] if item["id"] == me["device"])
    assert device["label"] == "iPad (app)"
    assert device["user_name"] == hass_admin_user.name
    assert device["name"] is None
    await ok(admin, type=f"{DOMAIN}/variants/name_device", device=me["device"], name="iPad in the hall")
    assert (await mine(admin))["device_name"] == "iPad in the hall"
    answer = await call(admin, type=f"{DOMAIN}/variants/name_device", device="nope", name="x")
    assert answer["error"]["code"] == "not_found"
    # The battery of a tablet: given in the editor, told to the device, kept, and taken away
    assert (await mine(admin))["device_battery"] is None
    await ok(
        admin,
        type=f"{DOMAIN}/variants/battery_device",
        device=me["device"],
        battery="sensor.ipad_battery_level",
    )
    assert (await mine(admin))["device_battery"] == "sensor.ipad_battery_level"
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    assert listed["devices"][0]["battery"] == "sensor.ipad_battery_level"
    await ok(admin, type=f"{DOMAIN}/variants/battery_device", device=me["device"], battery=None)
    assert (await mine(admin))["device_battery"] is None
    answer = await call(
        admin, type=f"{DOMAIN}/variants/battery_device", device=me["device"], battery="light.x"
    )
    assert answer["error"]["code"] == "invalid_format"
    answer = await call(admin, type=f"{DOMAIN}/variants/battery_device", device="nope", battery=None)
    assert answer["error"]["code"] == "not_found"


async def test_only_administrators_get_the_choices(
    hass, admin, hass_ws_client, hass_read_only_access_token
) -> None:
    await create(admin)
    assert (await mine(admin))["choices"]["home"]["items"][0]["name"] == "Sections"
    reader = await hass_ws_client(hass, hass_read_only_access_token)
    answer = await mine(reader)
    assert answer["choices"] is None
    assert answer["pages"] == {}


async def test_people_who_are_not_administrators_cannot_change_variants(
    hass,
    admin,
    hass_ws_client,
    hass_read_only_access_token,
) -> None:
    variant = await create(admin)
    reader = await hass_ws_client(hass, hass_read_only_access_token)
    for message in (
        {"type": f"{DOMAIN}/variants/list"},
        {"type": f"{DOMAIN}/variants/create", "page": "home", "name": "x"},
        {"type": f"{DOMAIN}/variants/update", "page": "home", "variant": variant["id"], "name": "x"},
        {"type": f"{DOMAIN}/variants/delete", "page": "home", "variant": variant["id"]},
        {"type": f"{DOMAIN}/variants/assign", "page": "home", "people": {}},
        {"type": f"{DOMAIN}/variants/deploy", "page": "home", "variant": variant["id"]},
    ):
        answer = await call(reader, url_path=URL, **message)
        assert answer["error"]["code"] == "unauthorized", message
    answer = await call(reader, type=f"{DOMAIN}/variants/name_device", device="x", name="y")
    assert answer["error"]["code"] == "unauthorized"
    answer = await call(reader, type=f"{DOMAIN}/variants/battery_device", device="x", battery=None)
    assert answer["error"]["code"] == "unauthorized"
    answer = await call(reader, type=f"{DOMAIN}/variants/forget_device", device="x")
    assert answer["error"]["code"] == "unauthorized"


async def test_variants_survive_a_restart(hass, admin, hass_storage) -> None:
    variant = await create(admin)
    await hass.async_block_till_done()
    saved = hass_storage[STORAGE_KEY]["data"]["dashboards"][URL]["variants"]["home"]["items"]
    assert saved[0]["id"] == variant["id"]


async def test_a_reviewer_of_another_person_is_not_shown_variants(hass, admin) -> None:
    # A person who is not on any list sees the published page.
    MockUser(name="Kim").add_to_hass(hass)
    variant = await create(admin)
    await ok(
        admin,
        type=f"{DOMAIN}/variants/assign",
        url_path=URL,
        page="home",
        people={"someone-else": variant["id"]},
    )
    assert (await mine(admin))["pages"] == {}


async def test_the_published_page_can_be_named(admin) -> None:
    await create(admin)
    await ok(admin, type=f"{DOMAIN}/variants/name_live", url_path=URL, page="home", name="Classic")
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    assert listed["pages"]["home"]["live_name"] == "Classic"
    await ok(admin, type=f"{DOMAIN}/variants/name_live", url_path=URL, page="home", name="")
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    assert listed["pages"]["home"]["live_name"] is None


async def test_a_device_can_be_forgotten(admin) -> None:
    variant = await create(admin)
    me = await mine(admin)
    await ok(
        admin,
        type=f"{DOMAIN}/variants/assign",
        url_path=URL,
        page="home",
        devices={me["device"]: variant["id"]},
    )
    await ok(admin, type=f"{DOMAIN}/variants/forget_device", device=me["device"])
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    assert listed["devices"] == []
    assert listed["pages"]["home"]["items"][0]["devices"] == []
    answer = await call(admin, type=f"{DOMAIN}/variants/forget_device", device=me["device"])
    assert answer["error"]["code"] == "not_found"
    # Opening a dashboard again brings it back.
    await mine(admin)
    assert len((await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL))["devices"]) == 1


# Shared with the household --------------------------------------------------------------------------------


async def test_a_person_chooses_a_shared_variant_for_themselves(
    hass, admin, hass_ws_client, hass_read_only_access_token
) -> None:
    variant = await create(admin, name="Sekcje")
    hidden = await create(admin, name="Szkic")
    reader = await hass_ws_client(hass, hass_read_only_access_token)
    # Nothing shared: nothing to choose, and a variant that is not shared cannot be chosen.
    assert (await mine(reader))["choices"] is None
    answer = await call(
        reader, type=f"{DOMAIN}/variants/choose", url_path=URL, page="home", variant=variant["id"]
    )
    assert answer["error"]["code"] == "not_found"
    await ok(
        admin, type=f"{DOMAIN}/variants/update", url_path=URL, page="home", variant=variant["id"], shared=True
    )
    choices = (await mine(reader))["choices"]["home"]
    assert [item["name"] for item in choices["items"]] == ["Sekcje"]
    assert "devices" not in choices["items"][0]
    answer = await call(
        reader, type=f"{DOMAIN}/variants/choose", url_path=URL, page="home", variant=hidden["id"]
    )
    assert answer["error"]["code"] == "not_found"
    await ok(reader, type=f"{DOMAIN}/variants/choose", url_path=URL, page="home", variant=variant["id"])
    seen = await mine(reader)
    assert seen["pages"]["home"]["id"] == variant["id"]
    assert seen["choices"]["home"]["own"] == variant["id"]
    # The administrator sees who chose it themselves.
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    item = next(one for one in listed["pages"]["home"]["items"] if one["id"] == variant["id"])
    assert item["shared"] is True
    assert item["chosen"] == item["people"] and len(item["chosen"]) == 1
    # Back to the published page.
    await ok(reader, type=f"{DOMAIN}/variants/choose", url_path=URL, page="home", variant=None)
    assert (await mine(reader))["pages"] == {}


async def test_taking_a_variant_back_from_the_household_ends_their_choices(
    hass, admin, hass_ws_client, hass_read_only_access_token
) -> None:
    variant = await create(admin, name="Sekcje")
    await ok(
        admin, type=f"{DOMAIN}/variants/update", url_path=URL, page="home", variant=variant["id"], shared=True
    )
    reader = await hass_ws_client(hass, hass_read_only_access_token)
    await ok(reader, type=f"{DOMAIN}/variants/choose", url_path=URL, page="home", variant=variant["id"])
    await ok(
        admin,
        type=f"{DOMAIN}/variants/update",
        url_path=URL,
        page="home",
        variant=variant["id"],
        shared=False,
    )
    assert (await mine(reader))["pages"] == {}
    assert (await mine(reader))["choices"] is None


async def test_an_administrators_choice_for_a_person_is_not_their_own(admin, hass_admin_user) -> None:
    variant = await create(admin)
    await ok(
        admin, type=f"{DOMAIN}/variants/update", url_path=URL, page="home", variant=variant["id"], shared=True
    )
    await ok(admin, type=f"{DOMAIN}/variants/choose", url_path=URL, page="home", variant=variant["id"])
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    assert listed["pages"]["home"]["items"][0]["chosen"] == [hass_admin_user.id]
    await ok(
        admin,
        type=f"{DOMAIN}/variants/assign",
        url_path=URL,
        page="home",
        people={hass_admin_user.id: variant["id"]},
    )
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    assert listed["pages"]["home"]["items"][0]["chosen"] == [hass_admin_user.id]
    await ok(
        admin, type=f"{DOMAIN}/variants/assign", url_path=URL, page="home", people={hass_admin_user.id: None}
    )
    await ok(
        admin,
        type=f"{DOMAIN}/variants/assign",
        url_path=URL,
        page="home",
        people={hass_admin_user.id: variant["id"]},
    )
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    assert listed["pages"]["home"]["items"][0]["chosen"] == []


# Devices with an id of their own ---------------------------------------------------------------------------

DEVICE_ID = "3f2b8c0e-0d4a-4c1e-9a77-1d2e3f405162"


async def mine_as(client, device_id=DEVICE_ID, **extra):
    return await ok(
        client,
        type=f"{DOMAIN}/variants/mine",
        url_path=URL,
        device_label="iPad (app)",
        device_id=device_id,
        **extra,
    )


async def test_signing_in_again_keeps_the_device_and_its_variant(
    hass, admin, hass_ws_client, hass_admin_user
) -> None:
    variant = await create(admin)
    me = await mine_as(admin)
    assert me["device"] == f"id:{DEVICE_ID}"
    await ok(
        admin,
        type=f"{DOMAIN}/variants/assign",
        url_path=URL,
        page="home",
        devices={me["device"]: variant["id"]},
    )
    await ok(admin, type=f"{DOMAIN}/variants/name_device", device=me["device"], name="iPad w holu")
    # A new sign-in on the same device: the same entry, its name and its variant.
    again = await second_device(hass, hass_ws_client, hass_admin_user)
    seen = await mine_as(again)
    assert seen["device"] == me["device"]
    assert seen["device_name"] == "iPad w holu"
    assert seen["pages"]["home"]["id"] == variant["id"]
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    assert [device["id"] for device in listed["devices"]] == [me["device"]]


async def test_two_devices_of_one_person_stay_apart(hass, admin, hass_ws_client, hass_admin_user) -> None:
    variant = await create(admin)
    tablet = await mine_as(admin)
    await ok(
        admin,
        type=f"{DOMAIN}/variants/assign",
        url_path=URL,
        page="home",
        devices={tablet["device"]: variant["id"]},
    )
    phone = await mine_as(admin, device_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    assert phone["device"] != tablet["device"]
    assert phone["pages"] == {}


async def test_a_device_known_by_its_sign_in_moves_to_its_id(admin) -> None:
    variant = await create(admin)
    before = await mine(admin)
    await ok(
        admin,
        type=f"{DOMAIN}/variants/assign",
        url_path=URL,
        page="home",
        devices={before["device"]: variant["id"]},
    )
    await ok(admin, type=f"{DOMAIN}/variants/name_device", device=before["device"], name="Hall")
    after = await mine_as(admin)
    assert after["device"] == f"id:{DEVICE_ID}"
    assert after["device_name"] == "Hall"
    assert after["pages"]["home"]["id"] == variant["id"]
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    assert [device["id"] for device in listed["devices"]] == [after["device"]]
    assert listed["pages"]["home"]["items"][0]["devices"] == [after["device"]]


async def test_the_browser_mod_name_is_the_name_until_one_is_given(admin) -> None:
    me = await mine_as(admin, browser_mod="hall_tablet")
    assert me["device_name"] == "hall_tablet"
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    assert listed["devices"][0]["browser_mod"] == "hall_tablet"
    await ok(admin, type=f"{DOMAIN}/variants/name_device", device=me["device"], name="iPad w holu")
    assert (await mine_as(admin, browser_mod="hall_tablet"))["device_name"] == "iPad w holu"


async def test_a_device_with_its_own_id_outlives_its_sign_in(hass, admin, hass_admin_user) -> None:
    await mine(admin)
    store = hass.data["home_dashboard_editor"]
    store.data["devices"][f"id:{DEVICE_ID}"] = {
        "name": None,
        "label": "iPad (app)",
        "user_id": hass_admin_user.id,
        "token": "gone",
    }
    store.data["devices"]["gone"] = {"name": None, "label": "iPhone (app)", "user_id": hass_admin_user.id}
    listed = await ok(admin, type=f"{DOMAIN}/variants/list", url_path=URL)
    ids = [device["id"] for device in listed["devices"]]
    assert f"id:{DEVICE_ID}" in ids
    assert "gone" not in ids


async def test_a_short_id_is_refused(admin) -> None:
    answer = await call(admin, type=f"{DOMAIN}/variants/mine", url_path=URL, device_id="abc")
    assert not answer["success"]
