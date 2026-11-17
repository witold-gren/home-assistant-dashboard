"""home_dashboard.show_camera: an automation opens the dashboard's camera window on the devices asked for."""

from __future__ import annotations

import json
from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_capture_events
import yaml

from custom_components.home_dashboard.camera_window import EVENT_CAMERA_CLOSED, SERVICE_SHOW_CAMERA
from custom_components.home_dashboard.const import DOMAIN

PACKAGE = Path(__file__).parent.parent / "custom_components" / DOMAIN


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Enable custom_components in tests."""


@pytest.fixture
async def entry(hass: HomeAssistant) -> MockConfigEntry:
    assert await async_setup_component(hass, "http", {})
    assert await async_setup_component(hass, "frontend", {})
    config_entry = MockConfigEntry(domain=DOMAIN)
    config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    return config_entry


async def listen(hass: HomeAssistant, hass_ws_client, browser_id: str | None = None):
    client = await hass_ws_client(hass)
    message = {"id": 1, "type": f"{DOMAIN}/camera/subscribe"}
    if browser_id:
        message["browser_id"] = browser_id
    await client.send_json(message)
    assert (await client.receive_json())["success"]
    return client


async def show(hass: HomeAssistant, **data) -> dict:
    data = {"entity_id": "camera.iwiny_slup", **data}
    return await hass.services.async_call(
        DOMAIN, SERVICE_SHOW_CAMERA, data, blocking=True, return_response=True
    )


async def test_an_open_dashboard_gets_the_camera_with_the_picture_and_the_times(
    hass: HomeAssistant, entry: MockConfigEntry, hass_ws_client
) -> None:
    client = await listen(hass, hass_ws_client, "hall_ipad")
    response = await show(hass, picture="image.iwiny_slup_last_event", title="Iwiny Słup")
    assert response == {"request": 1, "sent_to": 1}
    assert (await client.receive_json())["event"] == {
        "request": 1,
        "entity_id": "camera.iwiny_slup",
        "picture": "image.iwiny_slup_last_event",
        "title": "Iwiny Słup",
        "close_after": 15,
        "live_limit": 600,
        "live": False,
        "interrupt": False,
    }


async def test_only_the_devices_asked_for_get_it(
    hass: HomeAssistant, entry: MockConfigEntry, hass_ws_client
) -> None:
    ipad = await listen(hass, hass_ws_client, "hall_ipad")
    phone = await listen(hass, hass_ws_client, "telefon")
    response = await show(hass, browser_id=["hall_ipad"], close_after=0)
    assert response["sent_to"] == 1
    assert (await ipad.receive_json())["event"]["close_after"] == 0
    await show(hass, browser_id="telefon")
    assert (await phone.receive_json())["event"]["request"] == 2


async def test_people_asked_for_are_matched_by_their_user(
    hass: HomeAssistant, entry: MockConfigEntry, hass_ws_client, hass_admin_user
) -> None:
    await listen(hass, hass_ws_client)
    assert (await show(hass, user_id=["somebody-else"]))["sent_to"] == 0
    assert (await show(hass, user_id=[hass_admin_user.id]))["sent_to"] == 1


async def test_nobody_listening_is_said_in_the_answer(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    assert (await show(hass))["sent_to"] == 0


async def test_a_closed_dashboard_gets_nothing_more(
    hass: HomeAssistant, entry: MockConfigEntry, hass_ws_client
) -> None:
    client = await listen(hass, hass_ws_client, "hall_ipad")
    await client.send_json({"id": 2, "type": "unsubscribe_events", "subscription": 1})
    assert (await client.receive_json())["success"]
    assert (await show(hass))["sent_to"] == 0


async def test_the_window_closing_is_an_event_for_automations(
    hass: HomeAssistant, entry: MockConfigEntry, hass_ws_client, hass_admin_user
) -> None:
    events = async_capture_events(hass, EVENT_CAMERA_CLOSED)
    client = await listen(hass, hass_ws_client, "hall_ipad")
    await client.send_json(
        {
            "id": 5,
            "type": f"{DOMAIN}/camera/closed",
            "request": 3,
            "entity_id": "camera.iwiny_slup",
            "reason": "timeout",
            "browser_id": "hall_ipad",
            "live": True,
        }
    )
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert [event.data for event in events] == [
        {
            "request": 3,
            "entity_id": "camera.iwiny_slup",
            "reason": "timeout",
            "browser_id": "hall_ipad",
            "user_id": hass_admin_user.id,
            "live": True,
        }
    ]


async def test_an_unknown_reason_is_refused(
    hass: HomeAssistant, entry: MockConfigEntry, hass_ws_client
) -> None:
    client = await listen(hass, hass_ws_client)
    message = {"id": 5, "type": f"{DOMAIN}/camera/closed", "request": 1}
    message |= {"entity_id": "camera.x", "reason": "exploded"}
    await client.send_json(message)
    assert not (await client.receive_json())["success"]


async def test_wrong_times_are_refused(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    with pytest.raises(Exception, match="close_after"):
        await show(hass, close_after=-1)


async def test_unload_removes_the_service(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    assert hass.services.has_service(DOMAIN, SERVICE_SHOW_CAMERA)
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert not hass.services.has_service(DOMAIN, SERVICE_SHOW_CAMERA)


@pytest.mark.parametrize("language", ["en", "pl"])
def test_every_field_of_the_service_has_a_name_and_a_description(language: str) -> None:
    fields = yaml.safe_load((PACKAGE / "services.yaml").read_text("utf-8"))[SERVICE_SHOW_CAMERA]["fields"]
    translation = json.loads((PACKAGE / "translations" / f"{language}.json").read_text("utf-8"))
    texts = translation["services"][SERVICE_SHOW_CAMERA]
    assert texts["name"] and texts["description"]
    assert set(texts["fields"]) == set(fields)
    assert all(text["name"] and text["description"] for text in texts["fields"].values())


def test_strings_and_english_translation_are_the_same() -> None:
    strings = json.loads((PACKAGE / "strings.json").read_text("utf-8"))
    english = json.loads((PACKAGE / "translations" / "en.json").read_text("utf-8"))
    assert strings["services"] == english["services"]
