"""The window of a camera, opened on the dashboards from an automation (motion seen, a doorbell).

`home_dashboard.show_camera` sends the camera to every open dashboard that is asked for: on some devices
(the browser id of Browser Mod), for some people, or everywhere. The dashboard opens its own window of that
camera with the picture of the event, closes it by itself after a while unless somebody turns on the live
view, and says when it is gone with the event `home_dashboard_camera_closed`, so an automation can wait
for it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import count
from typing import Any

from homeassistant.components import websocket_api
from homeassistant.core import (
    HomeAssistant,
    ServiceCall,
    ServiceResponse,
    SupportsResponse,
    callback,
)
from homeassistant.helpers import config_validation as cv
import voluptuous as vol

from .const import DOMAIN

SERVICE_SHOW_CAMERA = "show_camera"
EVENT_CAMERA_CLOSED = f"{DOMAIN}_camera_closed"
DATA_WINDOWS = f"{DOMAIN}_camera_windows"
CLOSE_REASONS = ["timeout", "closed", "busy", "hidden", "unknown_camera", "replaced"]
DEFAULT_CLOSE_AFTER = 15
DEFAULT_LIVE_LIMIT = 600

SHOW_CAMERA_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
        vol.Optional("picture"): vol.Any(None, "", cv.entity_id),
        vol.Optional("title"): vol.Any(None, cv.string),
        vol.Optional("close_after", default=DEFAULT_CLOSE_AFTER): vol.All(
            vol.Coerce(int), vol.Range(min=0, max=3600)
        ),
        vol.Optional("live_limit", default=DEFAULT_LIVE_LIMIT): vol.All(
            vol.Coerce(int), vol.Range(min=10, max=3600)
        ),
        vol.Optional("live", default=False): cv.boolean,
        vol.Optional("interrupt", default=False): cv.boolean,
        vol.Optional("browser_id", default=list): vol.All(cv.ensure_list, [cv.string]),
        vol.Optional("user_id", default=list): vol.All(cv.ensure_list, [cv.string]),
    }
)


@dataclass
class _Window:
    """An open dashboard listening for cameras."""

    send: Any
    browser_id: str | None
    user_id: str | None


@dataclass
class CameraWindows:
    """The open dashboards, and the number of each request."""

    listeners: dict[int, _Window] = field(default_factory=dict)
    numbers: count = field(default_factory=lambda: count(1))
    next_listener: count = field(default_factory=lambda: count(1))

    def matching(self, browser_ids: list[str], user_ids: list[str]) -> list[_Window]:
        """The dashboards asked for: on one of the devices and of one of the people; nothing asked = all."""
        return [
            window
            for window in self.listeners.values()
            if (not browser_ids or window.browser_id in browser_ids)
            and (not user_ids or window.user_id in user_ids)
        ]


def _windows(hass: HomeAssistant) -> CameraWindows:
    return hass.data.setdefault(DATA_WINDOWS, CameraWindows())


async def _async_show_camera(call: ServiceCall) -> ServiceResponse:
    hass = call.hass
    data = call.data
    windows = _windows(hass)
    request = next(windows.numbers)
    message = {
        "request": request,
        "entity_id": data["entity_id"],
        "picture": data.get("picture") or None,
        "title": data.get("title") or None,
        "close_after": data["close_after"],
        "live_limit": data["live_limit"],
        "live": data["live"],
        "interrupt": data["interrupt"],
    }
    shown = windows.matching(data["browser_id"], data["user_id"])
    for window in shown:
        window.send(message)
    return {"request": request, "sent_to": len(shown)}


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/camera/subscribe",
        vol.Optional("browser_id"): vol.Any(None, str),
    }
)
@callback
def websocket_subscribe_camera(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """An open dashboard waits for cameras to show."""
    windows = _windows(hass)
    key = next(windows.next_listener)

    @callback
    def send(message: dict[str, Any]) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], message))

    user_id = connection.user.id if connection.user else None
    windows.listeners[key] = _Window(send, msg.get("browser_id") or None, user_id)

    @callback
    def unsubscribe() -> None:
        windows.listeners.pop(key, None)

    connection.subscriptions[msg["id"]] = unsubscribe
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/camera/closed",
        vol.Required("request"): int,
        vol.Required("entity_id"): str,
        vol.Required("reason"): vol.In(CLOSE_REASONS),
        vol.Optional("browser_id"): vol.Any(None, str),
        vol.Optional("live", default=False): bool,
    }
)
@callback
def websocket_camera_closed(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """The window of a camera is gone (or was not opened): automations waiting for it go on."""
    hass.bus.async_fire(
        EVENT_CAMERA_CLOSED,
        {
            "request": msg["request"],
            "entity_id": msg["entity_id"],
            "reason": msg["reason"],
            "browser_id": msg.get("browser_id"),
            "user_id": connection.user.id if connection.user else None,
            "live": msg["live"],
        },
    )
    connection.send_result(msg["id"])


@callback
def async_setup_camera_window(hass: HomeAssistant) -> None:
    """Register the service and the commands of the window of a camera."""
    _windows(hass)
    websocket_api.async_register_command(hass, websocket_subscribe_camera)
    websocket_api.async_register_command(hass, websocket_camera_closed)
    hass.services.async_register(
        DOMAIN,
        SERVICE_SHOW_CAMERA,
        _async_show_camera,
        schema=SHOW_CAMERA_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )


@callback
def async_unload_camera_window(hass: HomeAssistant) -> None:
    """Remove the service; open dashboards stop getting cameras."""
    hass.services.async_remove(DOMAIN, SERVICE_SHOW_CAMERA)
    hass.data.pop(DATA_WINDOWS, None)
