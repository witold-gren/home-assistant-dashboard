"""Variants of a page: other versions of Home or of a room to try out without touching the published one.

A variant holds only the part of the configuration that belongs to its page (its slice): for Home the
favourites, scenes, the strip of cameras, the order of the rooms and what each room shows on Home, the layout
of the page and its background; for a room its card (sections, status, layout) and its background. Everything
else always comes from the published configuration, so a variant never falls behind the rest of the dashboard.

Who sees a variant: a device (one login to Home Assistant, as a phone or the tablet on the wall), then a
person, then everyone else the published page. Making a variant the published one saves its slice into the
dashboard's configuration with the replaced version in the editor's history; the slice it replaced stays as
a variant, so going back is one step. Everything but asking for one's own variants is for administrators.

The same slices are worked out in the browser (www/app/variants.js); tests/fixtures/variant_slices.json
holds the cases both sides must agree on.
"""

from __future__ import annotations

import copy
from datetime import timedelta
from typing import Any
import uuid

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
import voluptuous as vol

from .const import DOMAIN

HOME = "home"
ROOM_PREFIX = "room:"
PAGE_LAYOUTS = ("classic", "sections")
DEFAULT_PAGE_LAYOUT = "classic"
# What of the cameras belongs to Home: the strip at its top. Settings of each camera stay with the dashboard.
HOME_CAMERA_KEYS = ("hero", "tiles", "columns", "layout", "order")
HOME_KEYS = ("favorites", "scenes", "scenes_layout", "weather")
NAME_LIMIT = 80
LABEL_LIMIT = 80
# A device that asks again is written down again only this rarely, unless what it says of itself changed.
SEEN_EVERY = timedelta(hours=6)

ERROR_NOT_FOUND = "not_found"
ERROR_INVALID_PAGE = "invalid_page"


# Slices ------------------------------------------------------------------------------------------------


def valid_page(page: str) -> bool:
    return page == HOME or (page.startswith(ROOM_PREFIX) and len(page) > len(ROOM_PREFIX))


def room_id(page: str) -> str | None:
    return page[len(ROOM_PREFIX) :] if page.startswith(ROOM_PREFIX) else None


def _layout_choice(value: Any) -> str | None:
    return value if value in PAGE_LAYOUTS else None


def _put(target: dict[str, Any], key: str, value: Any) -> None:
    """Set a key, or take it away when the slice has nothing for it."""
    if value is None:
        target.pop(key, None)
    else:
        target[key] = copy.deepcopy(value)


def slice_of(strategy: dict[str, Any], page: str) -> dict[str, Any] | None:
    """The part of a configuration that belongs to a page; None for a room the configuration lacks."""
    page_layout = strategy.get("page_layout") or {}
    style = _layout_choice(page_layout.get("style")) or DEFAULT_PAGE_LAYOUT
    backgrounds = strategy.get("backgrounds") or {}
    if page == HOME:
        cameras = strategy.get("cameras") or {}
        rooms = strategy.get("rooms") or {}
        return copy.deepcopy(
            {
                **{key: strategy.get(key) for key in HOME_KEYS},
                "cameras": {key: cameras.get(key) for key in HOME_CAMERA_KEYS},
                "rooms": {"order": rooms.get("order"), "hidden": rooms.get("hidden")},
                "page_layout": {
                    "home": _layout_choice(page_layout.get("home")) or style,
                    "rows": page_layout.get("rows"),
                },
                "room_home": {room["id"]: room.get("home") for room in strategy.get("layout") or []},
                "background": backgrounds.get(HOME),
            }
        )
    room = room_id(page)
    entry = next((item for item in strategy.get("layout") or [] if item.get("id") == room), None)
    if entry is None:
        return None
    card = {key: value for key, value in entry.items() if key != "home"}
    card["page_layout"] = _layout_choice(entry.get("page_layout")) or style
    return copy.deepcopy({"room": card, "background": backgrounds.get(room)})


def with_slice(strategy: dict[str, Any], page: str, part: dict[str, Any] | None) -> dict[str, Any]:
    """A copy of the configuration with the page's part taken from a slice; a room that is gone stays gone."""
    result = copy.deepcopy(strategy)
    if not part:
        return result
    backgrounds = result.setdefault("backgrounds", {})
    if page == HOME:
        for key in HOME_KEYS:
            _put(result, key, part.get(key))
        cameras = result.setdefault("cameras", {})
        for key in HOME_CAMERA_KEYS:
            _put(cameras, key, (part.get("cameras") or {}).get(key))
        rooms = result.setdefault("rooms", {})
        for key in ("order", "hidden"):
            _put(rooms, key, (part.get("rooms") or {}).get(key))
        if not rooms:
            result.pop("rooms")
        page_layout = result.setdefault("page_layout", {})
        layout_part = part.get("page_layout") or {}
        _put(page_layout, "home", layout_part.get("home"))
        _put(page_layout, "rows", layout_part.get("rows"))
        room_home = part.get("room_home") or {}
        for room in result.get("layout") or []:
            if room.get("id") in room_home:
                _put(room, "home", room_home[room["id"]])
        _put(backgrounds, HOME, part.get("background"))
    else:
        room = room_id(page)
        layout = result.get("layout") or []
        index = next((n for n, item in enumerate(layout) if item.get("id") == room), None)
        if index is None:
            return copy.deepcopy(strategy)
        card = {key: value for key, value in (part.get("room") or {}).items() if key != "home"}
        card["id"] = room
        if "home" in layout[index]:
            card["home"] = layout[index]["home"]
        layout[index] = copy.deepcopy(card)
        _put(backgrounds, room, part.get("background"))
    if not backgrounds:
        result.pop("backgrounds")
    return result


# Storage -----------------------------------------------------------------------------------------------


def page_entry(dashboard: dict[str, Any], page: str) -> dict[str, Any]:
    """The variants of one page of a dashboard kept by the editor's store."""
    pages = dashboard.setdefault("variants", {})
    return pages.setdefault(page, {"live_name": None, "items": [], "devices": {}, "people": {}})


def find_item(entry: dict[str, Any], variant: str) -> dict[str, Any] | None:
    return next((item for item in entry["items"] if item["id"] == variant), None)


def shown_variant(entry: dict[str, Any], device: str | None, user: str | None) -> dict[str, Any] | None:
    """The variant a device sees: its own, else its person's, else none (the published page)."""
    for chosen in (
        entry["devices"].get(device) if device else None,
        entry["people"].get(user) if user else None,
    ):
        if chosen:
            found = find_item(entry, chosen)
            if found:
                return found
    return None


def assigned(entry: dict[str, Any], variant: str) -> dict[str, list[str]]:
    return {
        "devices": sorted(device for device, chosen in entry["devices"].items() if chosen == variant),
        "people": sorted(user for user, chosen in entry["people"].items() if chosen == variant),
    }


def is_seen(entry: dict[str, Any], variant: str) -> bool:
    return variant in entry["devices"].values() or variant in entry["people"].values()


def item_summary(entry: dict[str, Any], item: dict[str, Any]) -> dict[str, Any]:
    seen = assigned(entry, item["id"])
    return {
        **{key: item.get(key) for key in ("id", "name", "slice", "created_at", "updated_at", "by")},
        "shared": bool(item.get("shared")),
        **seen,
        # The people among them who chose it themselves (a shared variant), not given it by an administrator.
        "chosen": sorted(set(seen["people"]) & set(entry.get("self") or [])),
    }


def shared_choices(entry: dict[str, Any], user: str | None) -> dict[str, Any] | None:
    """What a person who is not an administrator may choose: the published page and the shared ones."""
    items = [item for item in entry["items"] if item.get("shared")]
    if not items:
        return None
    return {
        "live_name": entry["live_name"],
        "items": [
            {key: item.get(key) for key in ("id", "name", "slice")} | {"shared": True} for item in items
        ],
        "own": entry["people"].get(user) if user else None,
    }


def new_item(name: str, part: dict[str, Any] | None, user: str | None) -> dict[str, Any]:
    at = dt_util.utcnow().isoformat()
    return {
        "id": uuid.uuid4().hex[:12],
        "name": name,
        "slice": part,
        "created_at": at,
        "updated_at": at,
        "by": user,
    }


# A device that keeps an id of its own (the dashboard's, in its browser) is known by it, so signing in again
# keeps it the same device; one without (no storage in its browser) is known by its sign-in to Home Assistant.
DEVICE_PREFIX = "id:"


def device_key(device_id: str | None, token: str | None) -> str | None:
    return f"{DEVICE_PREFIX}{device_id}" if device_id else token


def adopt_device(store_data: dict[str, Any], key: str, token: str | None) -> bool:
    """A device known by its sign-in that now has an id of its own keeps its name and variants under it."""
    devices = store_data.setdefault("devices", {})
    if not token or key == token or key in devices or token not in devices:
        return False
    devices[key] = devices.pop(token)
    for dashboard in store_data.get("dashboards", {}).values():
        for entry in (dashboard.get("variants") or {}).values():
            if token in entry["devices"]:
                entry["devices"][key] = entry["devices"].pop(token)
    return True


def note_device(
    store_data: dict[str, Any],
    key: str,
    user: str | None,
    label: str | None,
    token: str | None = None,
    browser_mod: str | None = None,
) -> bool:
    """Write down a device that asked; True when something new is to be saved."""
    devices = store_data.setdefault("devices", {})
    known = devices.get(key)
    now = dt_util.utcnow()
    label = (label or "")[:LABEL_LIMIT] or None
    browser_mod = (browser_mod or "")[:LABEL_LIMIT] or None
    same = known and all(
        known.get(field) == value
        for field, value in (
            ("label", label),
            ("user_id", user),
            ("token", token),
            ("browser_mod", browser_mod),
        )
    )
    if same:
        seen = dt_util.parse_datetime(known.get("seen") or "")
        if seen and now - seen < SEEN_EVERY:
            return False
    devices[key] = {
        **(known or {"name": None}),
        "label": label,
        "user_id": user,
        "token": token,
        "browser_mod": browser_mod,
        "seen": now.isoformat(),
    }
    return True


# Commands ----------------------------------------------------------------------------------------------

URL = vol.Required("url_path")
PAGE = vol.Required("page")
NAME = vol.All(str, vol.Length(min=1, max=NAME_LIMIT))


def _bad_page(connection, msg) -> bool:
    if valid_page(msg["page"]):
        return False
    connection.send_error(msg["id"], ERROR_INVALID_PAGE, "A page is home or room:<id>")
    return True


def _token(connection) -> str | None:
    return getattr(connection, "refresh_token_id", None)


def _changed(hass: HomeAssistant, url_path: str) -> None:
    """Pages load their configuration again, as after a saved one."""
    hass.bus.async_fire("lovelace_updated", {"url_path": url_path})


def _editor():
    # The editor's module imports this one; its store is found when a command runs.
    from . import editor

    return editor


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/variants/mine",
        URL: str,
        vol.Optional("device_label"): vol.Any(None, str),
        vol.Optional("device_id"): vol.Any(None, vol.All(str, vol.Length(min=8, max=64))),
        vol.Optional("browser_mod"): vol.Any(None, vol.All(str, vol.Length(max=LABEL_LIMIT))),
    }
)
@websocket_api.async_response
async def websocket_mine(hass, connection, msg) -> None:
    """The variants this device sees, page by page; for an administrator also all there are to choose from."""
    editor = _editor()
    store = editor.store_of(hass)
    dashboard = store.dashboard(msg["url_path"])
    token = _token(connection)
    key = device_key(msg.get("device_id"), token)
    user = connection.user.id if connection.user else None
    adopted = bool(key) and adopt_device(store.data, key, token)
    noted = bool(key) and note_device(
        store.data, key, user, msg.get("device_label"), token, msg.get("browser_mod")
    )
    if adopted or noted:
        await store.async_save()
    pages = {}
    choices = {}
    for page, entry in (dashboard.get("variants") or {}).items():
        shown = shown_variant(entry, key, user)
        if shown:
            pages[page] = {key: shown[key] for key in ("id", "name", "slice")}
        admin = bool(connection.user and connection.user.is_admin)
        if admin and entry["items"]:
            choices[page] = {
                "live_name": entry["live_name"],
                "items": [item_summary(entry, item) for item in entry["items"]],
                "own": entry["people"].get(user) if user else None,
            }
        elif not admin:
            shared = shared_choices(entry, user)
            if shared:
                choices[page] = shared
    device = (store.data.get("devices") or {}).get(key) if key else None
    connection.send_result(
        msg["id"],
        {
            "device": key,
            "device_name": (device or {}).get("name") or (device or {}).get("browser_mod"),
            "device_battery": (device or {}).get("battery"),
            "admin": bool(connection.user and connection.user.is_admin),
            "pages": pages,
            "choices": choices or None,
        },
    )


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/variants/list", URL: str})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_list(hass, connection, msg) -> None:
    """Every variant of every page of a dashboard, who sees each, and the devices that can be given one."""
    editor = _editor()
    store = editor.store_of(hass)
    dashboard = store.dashboard(msg["url_path"])
    users = {user.id: user for user in await hass.auth.async_get_users() if not user.system_generated}
    devices = []
    for key, device in (store.data.get("devices") or {}).items():
        user = users.get(device.get("user_id"))
        # One known only by its sign-in is gone with it; one with an id of its own outlives a sign-out.
        signed_out = not key.startswith(DEVICE_PREFIX) and hass.auth.async_get_refresh_token(key) is None
        if user is None or signed_out:
            continue
        devices.append(
            {
                "id": key,
                "name": device.get("name"),
                "browser_mod": device.get("browser_mod"),
                "label": device.get("label"),
                "user_id": user.id,
                "user_name": user.name,
                "seen": device.get("seen"),
                "battery": device.get("battery"),
            }
        )
    devices.sort(key=lambda item: item.get("seen") or "", reverse=True)
    connection.send_result(
        msg["id"],
        {
            "pages": {
                page: {
                    "live_name": entry["live_name"],
                    "items": [item_summary(entry, item) for item in entry["items"]],
                }
                for page, entry in (dashboard.get("variants") or {}).items()
            },
            "devices": devices,
            "people": [{"id": user.id, "name": user.name} for user in users.values() if user.is_active],
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/variants/create",
        URL: str,
        PAGE: str,
        vol.Required("name"): NAME,
        vol.Optional("from"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_create(hass, connection, msg) -> None:
    """A new variant: a copy of another one (`from`) or of the published page."""
    if _bad_page(connection, msg):
        return
    editor = _editor()
    live = await editor.live_or_error(hass, connection, msg)
    if live is None:
        return
    store = editor.store_of(hass)
    entry = page_entry(store.dashboard(msg["url_path"]), msg["page"])
    if msg.get("from"):
        source = find_item(entry, msg["from"])
        if source is None:
            connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such variant")
            return
        part = copy.deepcopy(source["slice"])
    else:
        part = slice_of(live.get("strategy") or {}, msg["page"])
        if part is None:
            connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such room")
            return
    item = new_item(msg["name"], part, connection.user.id if connection.user else None)
    entry["items"].append(item)
    await store.async_save()
    connection.send_result(msg["id"], {"variant": item_summary(entry, item)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/variants/update",
        URL: str,
        PAGE: str,
        vol.Required("variant"): str,
        vol.Optional("name"): NAME,
        vol.Optional("slice"): dict,
        vol.Optional("shared"): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_update(hass, connection, msg) -> None:
    """Rename a variant or keep its new content; devices that see it show the change."""
    if _bad_page(connection, msg):
        return
    editor = _editor()
    store = editor.store_of(hass)
    entry = page_entry(store.dashboard(msg["url_path"]), msg["page"])
    item = find_item(entry, msg["variant"])
    if item is None:
        connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such variant")
        return
    if "name" in msg:
        item["name"] = msg["name"]
    if "slice" in msg:
        item["slice"] = msg["slice"]
    if "shared" in msg:
        item["shared"] = msg["shared"]
        # Taken back: whoever chose it themselves gets the published page again.
        if not msg["shared"]:
            for user in list(entry.get("self") or []):
                if entry["people"].get(user) == item["id"]:
                    entry["people"].pop(user)
                    entry["self"].remove(user)
    item["updated_at"] = dt_util.utcnow().isoformat()
    item["by"] = connection.user.id if connection.user else None
    await store.async_save()
    if ("slice" in msg and is_seen(entry, item["id"])) or "shared" in msg:
        _changed(hass, msg["url_path"])
    connection.send_result(msg["id"], {"updated_at": item["updated_at"]})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/variants/delete",
        URL: str,
        PAGE: str,
        vol.Required("variant"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_delete(hass, connection, msg) -> None:
    """Throw a variant away; whoever saw it gets the published page again."""
    if _bad_page(connection, msg):
        return
    editor = _editor()
    store = editor.store_of(hass)
    entry = page_entry(store.dashboard(msg["url_path"]), msg["page"])
    if find_item(entry, msg["variant"]) is None:
        connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such variant")
        return
    seen = is_seen(entry, msg["variant"])
    entry["items"] = [item for item in entry["items"] if item["id"] != msg["variant"]]
    _forget(entry, msg["variant"])
    await store.async_save()
    if seen:
        _changed(hass, msg["url_path"])
    connection.send_result(msg["id"])


def _forget(entry: dict[str, Any], variant: str) -> None:
    for mapping in (entry["devices"], entry["people"]):
        for key in [key for key, chosen in mapping.items() if chosen == variant]:
            del mapping[key]
    entry["self"] = [user for user in entry.get("self") or [] if user in entry["people"]]


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/variants/assign",
        URL: str,
        PAGE: str,
        vol.Optional("devices", default={}): {str: vol.Any(None, str)},
        vol.Optional("people", default={}): {str: vol.Any(None, str)},
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_assign(hass, connection, msg) -> None:
    """Who sees which variant of a page: a variant id for a device or a person, None for the published one."""
    if _bad_page(connection, msg):
        return
    editor = _editor()
    store = editor.store_of(hass)
    entry = page_entry(store.dashboard(msg["url_path"]), msg["page"])
    for chosen in [*msg["devices"].values(), *msg["people"].values()]:
        if chosen and find_item(entry, chosen) is None:
            connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such variant")
            return
    for key, mapping in (("devices", entry["devices"]), ("people", entry["people"])):
        for target, chosen in msg[key].items():
            if key == "people" and mapping.get(target) == chosen:
                continue
            if chosen:
                mapping[target] = chosen
            else:
                mapping.pop(target, None)
            if key == "people" and target in (entry.get("self") or []):
                entry["self"].remove(target)
    await store.async_save()
    _changed(hass, msg["url_path"])
    connection.send_result(msg["id"], assigned_all(entry))


def assigned_all(entry: dict[str, Any]) -> dict[str, Any]:
    return {"devices": dict(entry["devices"]), "people": dict(entry["people"])}


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/variants/deploy",
        URL: str,
        PAGE: str,
        vol.Required("variant"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_deploy(hass, connection, msg) -> None:
    """Make a variant the published page for everyone. The replaced version goes to the history and its page
    stays as a variant; a draft of the editor takes the new page too."""
    if _bad_page(connection, msg):
        return
    editor = _editor()
    live = await editor.live_or_error(hass, connection, msg)
    if live is None:
        return
    store = editor.store_of(hass)
    dashboard = store.dashboard(msg["url_path"])
    entry = page_entry(dashboard, msg["page"])
    item = find_item(entry, msg["variant"])
    if item is None:
        connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such variant")
        return
    user = connection.user.id if connection.user else None
    strategy = live.get("strategy") or {}
    previous = slice_of(strategy, msg["page"])
    if previous is None:
        connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such room")
        return
    config = {**live, "strategy": with_slice(strategy, msg["page"], item["slice"])}
    old_hash = editor.config_hash(live)
    dashboard["history"] = [
        editor.history_entry(live, user, item["name"]),
        *dashboard["history"],
    ][: editor.HISTORY_LIMIT]
    await editor.storage_dashboard(hass, msg["url_path"]).async_save(config)
    new_hash = editor.config_hash(config)
    draft = dashboard.get("draft")
    if draft:
        draft["config"] = {
            **draft["config"],
            "strategy": with_slice(draft["config"].get("strategy") or {}, msg["page"], item["slice"]),
        }
        if draft.get("base") == old_hash:
            draft["base"] = new_hash
    replaced = new_item(entry["live_name"] or "", previous, user)
    entry["items"] = [replaced if other["id"] == item["id"] else other for other in entry["items"]]
    entry["live_name"] = item["name"]
    _forget(entry, item["id"])
    await store.async_save()
    _changed(hass, msg["url_path"])
    connection.send_result(msg["id"], {"live_hash": new_hash, "replaced": item_summary(entry, replaced)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/variants/name_live",
        URL: str,
        PAGE: str,
        vol.Required("name"): vol.Any(None, vol.All(str, vol.Length(max=NAME_LIMIT))),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_name_live(hass, connection, msg) -> None:
    """Name the published page among its variants ("Classic")."""
    if _bad_page(connection, msg):
        return
    editor = _editor()
    store = editor.store_of(hass)
    page_entry(store.dashboard(msg["url_path"]), msg["page"])["live_name"] = msg["name"] or None
    await store.async_save()
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/variants/name_device",
        vol.Required("device"): str,
        vol.Required("name"): vol.Any(None, vol.All(str, vol.Length(max=NAME_LIMIT))),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_name_device(hass, connection, msg) -> None:
    """Give a device a name everyone recognises ("iPad in the hall")."""
    editor = _editor()
    store = editor.store_of(hass)
    device = (store.data.get("devices") or {}).get(msg["device"])
    if device is None:
        connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such device")
        return
    device["name"] = msg["name"] or None
    await store.async_save()
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/variants/battery_device",
        vol.Required("device"): str,
        vol.Required("battery"): vol.Any(None, vol.All(str, vol.Match(r"^sensor\.[a-z0-9_]+$"))),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_battery_device(hass, connection, msg) -> None:
    """The battery sensor of a tablet (from the Home Assistant app), shown at the foot of its status bar."""
    editor = _editor()
    store = editor.store_of(hass)
    device = (store.data.get("devices") or {}).get(msg["device"])
    if device is None:
        connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such device")
        return
    device["battery"] = msg["battery"]
    await store.async_save()
    # The tablet learns it when its pages load again
    for url_path in store.data.get("dashboards") or {}:
        _changed(hass, url_path)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/variants/forget_device", vol.Required("device"): str}
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_forget_device(hass, connection, msg) -> None:
    """Take a device off the list and off its variants; it comes back when it opens a dashboard again."""
    editor = _editor()
    store = editor.store_of(hass)
    if (store.data.get("devices") or {}).pop(msg["device"], None) is None:
        connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such device")
        return
    changed = []
    for url_path, dashboard in store.data["dashboards"].items():
        for entry in (dashboard.get("variants") or {}).values():
            if entry["devices"].pop(msg["device"], None):
                changed.append(url_path)
    await store.async_save()
    for url_path in set(changed):
        _changed(hass, url_path)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/variants/choose",
        URL: str,
        PAGE: str,
        vol.Required("variant"): vol.Any(None, str),
    }
)
@websocket_api.async_response
async def websocket_choose(hass, connection, msg) -> None:
    """A person chooses for themselves (all their devices): a shared variant, or None for the published."""
    if _bad_page(connection, msg):
        return
    user = connection.user.id if connection.user else None
    if user is None:
        connection.send_error(msg["id"], ERROR_NOT_FOUND, "No person")
        return
    editor = _editor()
    store = editor.store_of(hass)
    entry = page_entry(store.dashboard(msg["url_path"]), msg["page"])
    chosen = find_item(entry, msg["variant"]) if msg["variant"] else None
    if msg["variant"] and (chosen is None or not chosen.get("shared")):
        connection.send_error(msg["id"], ERROR_NOT_FOUND, "No such shared variant")
        return
    own = entry.setdefault("self", [])
    if chosen:
        entry["people"][user] = chosen["id"]
        if user not in own:
            own.append(user)
    else:
        entry["people"].pop(user, None)
        if user in own:
            own.remove(user)
    await store.async_save()
    _changed(hass, msg["url_path"])
    connection.send_result(msg["id"])


COMMANDS = [
    websocket_mine,
    websocket_list,
    websocket_create,
    websocket_update,
    websocket_delete,
    websocket_assign,
    websocket_deploy,
    websocket_name_live,
    websocket_name_device,
    websocket_battery_device,
    websocket_forget_device,
    websocket_choose,
]
