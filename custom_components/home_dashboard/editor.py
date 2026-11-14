"""The editor of a dashboard on a computer: a draft kept on the server, a version for one person to check,
and publishing for everyone with a history to go back to.

A draft changes nothing on the phones and tablets of the home. Publishing it for one person (the reviewer)
makes their dashboard load that version instead; publishing it for everyone saves it as the dashboard's
configuration, as the YAML editor does, after the version it replaces goes to the history. Restoring a
version from the history makes it a new draft, never the live configuration at once. Everything but reading
one's own review is for administrators.
"""

from __future__ import annotations

from datetime import UTC, datetime
import hashlib
import json
from pathlib import Path
from typing import Any
import uuid

from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.frontend import async_remove_panel
from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.storage import Store
from homeassistant.loader import async_get_integration
import voluptuous as vol

from .const import DOMAIN, STATIC_URL

STORAGE_KEY = f"{DOMAIN}.editor"
STORAGE_VERSION = 1
HISTORY_LIMIT = 30
PANEL_URL = "home-dashboard-editor"
PANEL_ELEMENT = "home-dashboard-editor"
PANEL_TITLES = {"pl": "Edytor dashboardu"}
PANEL_TITLE = "Dashboard editor"
PANEL_ICON = "mdi:pencil-ruler"
DATA_EDITOR = f"{DOMAIN}_editor"
STRATEGY_TYPE = "custom:home-dashboard"
PICTURE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"}
PICTURE_LIMIT = 500

ERROR_NOT_FOUND = "not_found"
ERROR_NO_DRAFT = "no_draft"
ERROR_CONFLICT = "conflict"


def config_hash(config: dict[str, Any] | None) -> str:
    """A short fingerprint of a configuration, the same for the same content in any order of keys."""
    text = json.dumps(config, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


class EditorStore:
    """The drafts, reviews and histories of every dashboard, saved in .storage."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.data: dict[str, Any] = {"dashboards": {}}

    async def async_load(self) -> None:
        self.data = await self._store.async_load() or {"dashboards": {}}

    def dashboard(self, url_path: str) -> dict[str, Any]:
        return self.data["dashboards"].setdefault(url_path, {"draft": None, "review": None, "history": []})

    async def async_save(self) -> None:
        await self._store.async_save(self.data)


def storage_dashboard(hass: HomeAssistant, url_path: str):
    """The stored dashboard behind a path, or an error a page can show."""
    lovelace = hass.data.get(LOVELACE_DATA)
    dashboard = lovelace.dashboards.get(url_path) if lovelace else None
    if dashboard is None or dashboard.mode != "storage":
        raise HomeAssistantError(f"No stored dashboard at {url_path}")
    return dashboard


async def live_config(hass: HomeAssistant, url_path: str) -> dict[str, Any]:
    return await storage_dashboard(hass, url_path).async_load(False)


def history_entry(config: dict[str, Any], user_id: str | None, note: str) -> dict[str, Any]:
    return {"id": uuid.uuid4().hex[:12], "config": config, "at": now_iso(), "by": user_id, "note": note}


def history_summary(history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{key: entry.get(key) for key in ("id", "at", "by", "note")} for entry in history]


async def async_setup_editor(hass: HomeAssistant, in_sidebar: bool = True) -> None:
    """Open the store, register the commands once and add the panel for administrators, in the
    sidebar or (without a title) only at its address."""
    if DATA_EDITOR not in hass.data:
        store = EditorStore(hass)
        await store.async_load()
        hass.data[DATA_EDITOR] = store
        for command in COMMANDS:
            websocket_api.async_register_command(hass, command)
    integration = await async_get_integration(hass, DOMAIN)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=PANEL_TITLES.get(hass.config.language, PANEL_TITLE) if in_sidebar else None,
        sidebar_icon=PANEL_ICON if in_sidebar else None,
        module_url=f"{STATIC_URL}/editor/editor.js?v={integration.version}",
        require_admin=True,
        config={"strategy": STRATEGY_TYPE},
    )


@callback
def async_unload_editor(hass: HomeAssistant) -> None:
    """Take the panel away; the commands stay until the next start and refuse nothing harmful."""
    async_remove_panel(hass, PANEL_URL, warn_if_unknown=False)


def _store(hass: HomeAssistant) -> EditorStore:
    return hass.data[DATA_EDITOR]


async def _live_or_error(hass, connection, msg) -> dict[str, Any] | None:
    try:
        return await live_config(hass, msg["url_path"])
    except HomeAssistantError:
        connection.send_error(msg["id"], ERROR_NOT_FOUND, "No stored dashboard at this path")
        return None


def _user(connection: websocket_api.ActiveConnection) -> str | None:
    return connection.user.id if connection.user else None


URL = vol.Required("url_path")


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/editor/dashboards"})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_dashboards(hass, connection, msg) -> None:
    """The stored dashboards that use this strategy, for the editor to choose from."""
    lovelace = hass.data.get(LOVELACE_DATA)
    found = []
    for url_path, dashboard in (lovelace.dashboards if lovelace else {}).items():
        if url_path is None or dashboard.mode != "storage":
            continue
        try:
            config = await dashboard.async_load(False)
        except HomeAssistantError:
            continue
        if (config.get("strategy") or {}).get("type") == STRATEGY_TYPE:
            title = (dashboard.config or {}).get("title") or url_path
            found.append({"url_path": url_path, "title": title})
    connection.send_result(msg["id"], {"dashboards": found})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/editor/load", URL: str})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_load(hass, connection, msg) -> None:
    """Everything the editor needs: the live configuration, the draft, who checks a review, the history."""
    live = await _live_or_error(hass, connection, msg)
    if live is None:
        return
    entry = _store(hass).dashboard(msg["url_path"])
    review = entry["review"]
    connection.send_result(
        msg["id"],
        {
            "live": live,
            "live_hash": config_hash(live),
            "draft": entry["draft"],
            "review": {key: review[key] for key in ("user_id", "published_at", "by", "hash")}
            if review
            else None,
            "history": history_summary(entry["history"]),
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/editor/save_draft",
        URL: str,
        vol.Required("config"): dict,
        vol.Required("base"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_save_draft(hass, connection, msg) -> None:
    """Keep the draft; `base` is the fingerprint of the live configuration it was started from."""
    if await _live_or_error(hass, connection, msg) is None:
        return
    store = _store(hass)
    entry = store.dashboard(msg["url_path"])
    previous = entry["draft"] or {}
    entry["draft"] = {
        "config": msg["config"],
        "base": previous.get("base") or msg["base"],
        "updated_at": now_iso(),
        "by": _user(connection),
    }
    await store.async_save()
    connection.send_result(
        msg["id"], {"updated_at": entry["draft"]["updated_at"], "base": entry["draft"]["base"]}
    )


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/editor/discard", URL: str})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_discard(hass, connection, msg) -> None:
    """Throw the draft away; the live configuration and a review stay as they are."""
    store = _store(hass)
    store.dashboard(msg["url_path"])["draft"] = None
    await store.async_save()
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/editor/publish_review", URL: str, vol.Required("user_id"): str}
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_publish_review(hass, connection, msg) -> None:
    """Give the draft to one person to check on their own devices; nobody else sees it."""
    store = _store(hass)
    entry = store.dashboard(msg["url_path"])
    if not entry["draft"]:
        connection.send_error(msg["id"], ERROR_NO_DRAFT, "There is no draft to check")
        return
    if await hass.auth.async_get_user(msg["user_id"]) is None:
        connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such user")
        return
    config = entry["draft"]["config"]
    entry["review"] = {
        "config": config,
        "hash": config_hash(config),
        "user_id": msg["user_id"],
        "published_at": now_iso(),
        "by": _user(connection),
    }
    await store.async_save()
    _review_changed(hass, msg["url_path"])
    connection.send_result(msg["id"], {"published_at": entry["review"]["published_at"]})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/editor/end_review", URL: str})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_end_review(hass, connection, msg) -> None:
    """The reviewer goes back to the live version."""
    store = _store(hass)
    store.dashboard(msg["url_path"])["review"] = None
    await store.async_save()
    _review_changed(hass, msg["url_path"])
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/editor/publish",
        URL: str,
        vol.Required("base"): str,
        vol.Optional("force", default=False): bool,
        vol.Optional("note", default=""): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_publish(hass, connection, msg) -> None:
    """Make the draft the dashboard of everyone. A change made elsewhere meanwhile stops it unless forced."""
    store = _store(hass)
    entry = store.dashboard(msg["url_path"])
    if not entry["draft"]:
        connection.send_error(msg["id"], ERROR_NO_DRAFT, "There is no draft to publish")
        return
    live = await _live_or_error(hass, connection, msg)
    if live is None:
        return
    if config_hash(live) != msg["base"] and not msg["force"]:
        connection.send_error(
            msg["id"], ERROR_CONFLICT, "The dashboard was changed elsewhere since the draft began"
        )
        return
    entry["history"] = [history_entry(live, _user(connection), msg["note"]), *entry["history"]][
        :HISTORY_LIMIT
    ]
    config = entry["draft"]["config"]
    await storage_dashboard(hass, msg["url_path"]).async_save(config)
    had_review = entry["review"] is not None
    entry["draft"] = None
    entry["review"] = None
    await store.async_save()
    if had_review:
        _review_changed(hass, msg["url_path"])
    connection.send_result(msg["id"], {"live_hash": config_hash(config)})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/editor/history_get", URL: str, vol.Required("version"): str}
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_history_get(hass, connection, msg) -> None:
    """One version from the history, to look at or to compare."""
    found = next(
        (item for item in _store(hass).dashboard(msg["url_path"])["history"] if item["id"] == msg["version"]),
        None,
    )
    if found is None:
        connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such version")
        return
    connection.send_result(msg["id"], {"config": found["config"], "at": found["at"], "by": found["by"]})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/editor/restore", URL: str, vol.Required("version"): str}
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_restore(hass, connection, msg) -> None:
    """Make a version from the history the draft, to look at and publish like any other."""
    live = await _live_or_error(hass, connection, msg)
    if live is None:
        return
    store = _store(hass)
    entry = store.dashboard(msg["url_path"])
    found = next((item for item in entry["history"] if item["id"] == msg["version"]), None)
    if found is None:
        connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such version")
        return
    entry["draft"] = {
        "config": found["config"],
        "base": config_hash(live),
        "updated_at": now_iso(),
        "by": _user(connection),
    }
    await store.async_save()
    connection.send_result(msg["id"], {"draft": entry["draft"]})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/review/get", URL: str})
@websocket_api.async_response
async def websocket_review_get(hass, connection, msg) -> None:
    """The version this person was asked to check, or nothing: anyone may ask, only the reviewer gets it."""
    review = _store(hass).dashboard(msg["url_path"])["review"]
    mine = review is not None and connection.user is not None and review["user_id"] == connection.user.id
    connection.send_result(
        msg["id"], {"config": review["config"], "published_at": review["published_at"]} if mine else None
    )


def _review_changed(hass: HomeAssistant, url_path: str) -> None:
    """Pages of the reviewer load again, as after a saved configuration."""
    hass.bus.async_fire("lovelace_updated", {"url_path": url_path})


def list_pictures(www: Path, limit: int = PICTURE_LIMIT) -> list[dict[str, Any]]:
    """The pictures under `www` as their `/local/` addresses, newest first.

    Hidden folders and links leading out of `www` stay out.
    """
    if not www.is_dir():
        return []
    root = www.resolve()
    found = []
    for path in www.rglob("*"):
        relative = path.relative_to(www)
        hidden = any(part.startswith(".") for part in relative.parts)
        if hidden or path.suffix.lower() not in PICTURE_SUFFIXES:
            continue
        try:
            if not path.is_file() or not path.resolve().is_relative_to(root):
                continue
            stat = path.stat()
        except OSError:
            continue
        url = f"/local/{relative.as_posix()}"
        found.append({"url": url, "size": stat.st_size, "modified": stat.st_mtime})
    found.sort(key=lambda item: (-item["modified"], item["url"]))
    return found[:limit]


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/editor/pictures"})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_pictures(hass, connection, msg) -> None:
    """The pictures in the `www` folder of the configuration, to choose one as a background."""
    pictures = await hass.async_add_executor_job(list_pictures, Path(hass.config.path("www")))
    connection.send_result(msg["id"], {"pictures": pictures})


COMMANDS = [
    websocket_pictures,
    websocket_dashboards,
    websocket_load,
    websocket_save_draft,
    websocket_discard,
    websocket_publish_review,
    websocket_end_review,
    websocket_publish,
    websocket_history_get,
    websocket_restore,
    websocket_review_get,
]
