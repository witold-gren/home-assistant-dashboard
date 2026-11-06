"""Home Dashboard: a touch-first dashboard strategy for phones and wall tablets."""

from __future__ import annotations

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import SIGNAL_SETTINGS_UPDATED
from .frontend import async_register_frontend, async_unregister_frontend
from .websocket import websocket_subscribe_settings


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Serve the dashboard strategy to every Home Assistant page."""
    await async_register_frontend(hass)
    websocket_api.async_register_command(hass, websocket_subscribe_settings)
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Stop adding the strategy to Home Assistant pages."""
    async_unregister_frontend(hass)
    return True


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Tell the open pages about the new options."""
    async_dispatcher_send(hass, SIGNAL_SETTINGS_UPDATED)
