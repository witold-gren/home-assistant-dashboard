"""The changes of states each person made, read from the history of Home Assistant (the recorder starts
before Home Assistant here, as the recorder's tests need)."""

from __future__ import annotations

from homeassistant.core import Context, HomeAssistant
import pytest
from pytest_homeassistant_custom_component.components.recorder.common import async_wait_recording_done

from custom_components.home_dashboard.const import DOMAIN

from .test_activity import day_range, send, set_up


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(recorder_mock, enable_custom_integrations: None) -> None:
    """The recorder first, then custom_components."""


async def test_changes_made_by_a_person_come_from_the_history(
    hass: HomeAssistant, hass_ws_client, hass_admin_user
) -> None:
    await set_up(hass, [hass_admin_user.id])
    hass.states.async_set("light.salon", "on", context=Context(user_id=hass_admin_user.id))
    hass.states.async_set("sensor.power", "120")
    await async_wait_recording_done(hass)
    client = await hass_ws_client(hass)
    result = (await send(client, {"type": f"{DOMAIN}/activity/get", **day_range()}))["result"]
    changes = [entry for entry in result["entries"] if entry["kind"] == "change"]
    assert [(entry["entity_id"], entry["state"], entry["user_id"]) for entry in changes] == [
        ("light.salon", "on", hass_admin_user.id)
    ]
