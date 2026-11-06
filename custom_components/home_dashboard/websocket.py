"""Settings for the frontend, pushed so that a tablet on the wall follows them without a reload."""

from __future__ import annotations

from typing import Any

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
import voluptuous as vol

from .const import COLOR_MODE_AUTO, CONF_COLOR_MODE, DOMAIN, SIGNAL_SETTINGS_UPDATED


def current_settings(hass: HomeAssistant) -> dict[str, str]:
    """Return what the frontend needs from the options."""
    entries = hass.config_entries.async_entries(DOMAIN)
    options = entries[0].options if entries else {}
    return {CONF_COLOR_MODE: options.get(CONF_COLOR_MODE, COLOR_MODE_AUTO)}


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/settings/subscribe"})
@callback
def websocket_subscribe_settings(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Send the settings now and after every change."""

    @callback
    def forward() -> None:
        connection.send_message(websocket_api.event_message(msg["id"], current_settings(hass)))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL_SETTINGS_UPDATED, forward)
    connection.send_result(msg["id"])
    forward()
