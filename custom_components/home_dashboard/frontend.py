"""Serve the frontend files from the integration folder.

The strategy is added to every page with ``add_extra_js_url``, so it does not need an entry in
``lovelace: resources``. Files are served with ``no-cache`` instead of Home Assistant's month-long
static cache: the modules import each other by relative path, so a ``?v=`` on the loader alone
would leave the rest stale on the tablet.
"""

from __future__ import annotations

from http import HTTPStatus
from pathlib import Path

from aiohttp import web
from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .const import DOMAIN, LOADER_FILENAME, STATIC_URL

WWW_DIR = Path(__file__).parent / "www"
SERVED_SUFFIXES = {".js"}
DATA_VIEW_REGISTERED = f"{DOMAIN}_view_registered"
DATA_LOADER_URL = f"{DOMAIN}_loader_url"


def resolve_static_file(root: Path, relative_path: str) -> Path | None:
    """Return the file to serve, or None when the path leaves the root or is not a module."""
    candidate = (root / relative_path).resolve()
    if not candidate.is_relative_to(root.resolve()):
        return None
    if candidate.suffix not in SERVED_SUFFIXES or not candidate.is_file():
        return None
    return candidate


class HomeDashboardStaticView(HomeAssistantView):
    """Frontend modules; public because they load before the user is authenticated."""

    url = f"{STATIC_URL}/{{path:.+}}"
    name = f"api:{DOMAIN}:static"
    requires_auth = False

    async def get(self, request: web.Request, path: str) -> web.StreamResponse:
        """Return one frontend module."""
        hass: HomeAssistant = request.app["hass"]
        file_path = await hass.async_add_executor_job(resolve_static_file, WWW_DIR, path)
        if file_path is None:
            return web.Response(status=HTTPStatus.NOT_FOUND)
        return web.FileResponse(file_path, headers={"Cache-Control": "no-cache"})


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Register the static view (once per run) and add the loader to the pages."""
    if "frontend" not in hass.config.components or hass.http is None:
        return
    if not hass.data.get(DATA_VIEW_REGISTERED):
        hass.http.register_view(HomeDashboardStaticView)
        hass.data[DATA_VIEW_REGISTERED] = True
    integration = await async_get_integration(hass, DOMAIN)
    url = f"{STATIC_URL}/{LOADER_FILENAME}?v={integration.version}"
    add_extra_js_url(hass, url)
    hass.data[DATA_LOADER_URL] = url


def async_unregister_frontend(hass: HomeAssistant) -> None:
    """Remove the loader from the pages; the view stays until the next restart."""
    if url := hass.data.pop(DATA_LOADER_URL, None):
        remove_extra_js_url(hass, url)
