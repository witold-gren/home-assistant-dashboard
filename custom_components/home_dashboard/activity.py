"""How the household uses Home Assistant: the pages and windows each person opens in the dashboard, and the
devices they switch, for one person to look through (the owner of Home Assistant by default).

Home Assistant itself keeps no record of what anybody looks at, so the dashboard tells it here: every page and
window opened is one line in a file of that day (`.storage/home_dashboard_activity/<day>.jsonl`), kept for
`RETENTION_DAYS`. What people switched comes from the history of Home Assistant (a change of a state made from
an app carries its user), which the recorder keeps for its own number of days.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
import json
from pathlib import Path
from typing import Any

from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.frontend import async_remove_panel
from homeassistant.const import EVENT_STATE_CHANGED
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.event import async_track_time_change
from homeassistant.loader import async_get_integration
from homeassistant.util import dt as dt_util
import voluptuous as vol

from .const import (
    CONF_ACTIVITY_IN_SIDEBAR,
    CONF_ACTIVITY_RECORD,
    CONF_ACTIVITY_VIEWERS,
    DEFAULT_ACTIVITY_IN_SIDEBAR,
    DEFAULT_ACTIVITY_RECORD,
    DOMAIN,
    STATIC_URL,
)

RETENTION_DAYS = 30
FOLDER = "home_dashboard_activity"
DATA_ACTIVITY = f"{DOMAIN}_activity"
PANEL_URL = "home-dashboard-activity"
PANEL_ELEMENT = "home-dashboard-activity"
PANEL_TITLES = {"pl": "Aktywność domowników"}
PANEL_TITLE = "Household activity"
PANEL_ICON = "mdi:account-clock-outline"
CONF_VIEWERS = CONF_ACTIVITY_VIEWERS
KINDS = ["page", "window"]
TEXT = vol.All(str, vol.Length(max=160))
# The pages and windows are kept 30 days: a range can cover them all.
MAX_RANGE = timedelta(days=31)
ERROR_NOT_ALLOWED = "not_allowed"
SIGNAL_SEEN = f"{DOMAIN}_activity_seen"


def folder(hass: HomeAssistant) -> Path:
    return Path(hass.config.path(".storage", FOLDER))


def day_file(hass: HomeAssistant, day: date) -> Path:
    return folder(hass) / f"{day.isoformat()}.jsonl"


def _option(hass: HomeAssistant, key: str, default: bool) -> bool:
    entries = hass.config_entries.async_entries(DOMAIN)
    return entries[0].options.get(key, default) if entries else default


def recording(hass: HomeAssistant) -> bool:
    """Whether the pages and windows opened are written down (an option of the integration)."""
    return _option(hass, CONF_ACTIVITY_RECORD, DEFAULT_ACTIVITY_RECORD)


async def async_viewers(hass: HomeAssistant) -> set[str]:
    """Who may look: the people chosen in the options, or the owner of Home Assistant."""
    entries = hass.config_entries.async_entries(DOMAIN)
    chosen = entries[0].options.get(CONF_VIEWERS) if entries else None
    if chosen:
        return set(chosen)
    return {user.id for user in await hass.auth.async_get_users() if user.is_owner}


def _append(path: Path, line: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as file:
        file.write(line + "\n")


def _read(paths: list[Path]) -> list[dict[str, Any]]:
    entries = []
    for path in paths:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            try:
                entries.append(json.loads(line))
            except ValueError:
                continue
    return entries


def _purge(path: Path, oldest: date) -> list[str]:
    removed = []
    if not path.exists():
        return removed
    for file in path.glob("*.jsonl"):
        try:
            day = date.fromisoformat(file.stem)
        except ValueError:
            continue
        if day < oldest:
            file.unlink(missing_ok=True)
            removed.append(file.name)
    return removed


async def async_purge(hass: HomeAssistant, today: date | None = None) -> list[str]:
    """Remove the days older than RETENTION_DAYS."""
    oldest = (today or dt_util.now().date()) - timedelta(days=RETENTION_DAYS)
    return await hass.async_add_executor_job(_purge, folder(hass), oldest)


def _changes(hass: HomeAssistant, start: datetime, end: datetime) -> list[dict[str, Any]]:
    """The changes of states made by a person (their user in the context), from the history of Home
    Assistant."""
    from homeassistant.components.recorder.util import session_scope
    from sqlalchemy import text

    query = text(
        "SELECT sm.entity_id, s.state, s.last_updated_ts, s.context_user_id_bin "
        "FROM states s JOIN states_meta sm ON s.metadata_id = sm.metadata_id "
        "WHERE s.last_updated_ts >= :start AND s.last_updated_ts < :end "
        "AND s.context_user_id_bin IS NOT NULL "
        "ORDER BY s.last_updated_ts"
    )
    with session_scope(hass=hass, read_only=True) as session:
        rows = session.execute(query, {"start": start.timestamp(), "end": end.timestamp()}).all()
    return [
        {
            "at": datetime.fromtimestamp(row[2], UTC).isoformat(),
            "user_id": bytes(row[3]).hex(),
            "kind": "change",
            "entity_id": row[0],
            "state": row[1],
        }
        for row in rows
        if row[3]
    ]


async def async_changes(hass: HomeAssistant, start: datetime, end: datetime) -> list[dict[str, Any]]:
    if "recorder" not in hass.config.components:
        return []
    from homeassistant.components.recorder import get_instance

    try:
        return await get_instance(hass).async_add_executor_job(_changes, hass, start, end)
    except Exception:  # another database or schema: the page shows the rest
        return []


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/activity/seen",
        vol.Required("kind"): vol.In(KINDS),
        vol.Required("name"): TEXT,
        vol.Optional("page"): vol.Any(None, TEXT),
        vol.Optional("entity_id"): vol.Any(None, TEXT),
        vol.Optional("device"): vol.Any(None, TEXT),
    }
)
@websocket_api.async_response
async def websocket_seen(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """A page or a window of the dashboard was opened by the person of this connection."""
    if not recording(hass):
        # Writing down is off: an open page that has not heard it yet is answered, nothing is kept.
        connection.send_result(msg["id"], {"recorded": False})
        return
    now = dt_util.now()
    entry = {
        "at": now.astimezone(UTC).isoformat(),
        "user_id": connection.user.id if connection.user else None,
        "kind": msg["kind"],
        "name": msg["name"],
        "page": msg.get("page"),
        "entity_id": msg.get("entity_id"),
        "device": msg.get("device"),
    }
    line = json.dumps(entry, ensure_ascii=False)
    await hass.async_add_executor_job(_append, day_file(hass, now.date()), line)
    async_dispatcher_send(hass, SIGNAL_SEEN, entry)
    connection.send_result(msg["id"], {"recorded": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/activity/get",
        vol.Required("start"): str,
        vol.Required("end"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """What the household did between two moments (at most 31 days): the pages and windows they opened, the
    devices they switched, and the people with the devices they use."""
    if connection.user is None or connection.user.id not in await async_viewers(hass):
        connection.send_error(msg["id"], ERROR_NOT_ALLOWED, "Only the owner of Home Assistant sees this")
        return
    start = dt_util.parse_datetime(msg["start"])
    end = dt_util.parse_datetime(msg["end"])
    if start is None or end is None or end <= start or end - start > MAX_RANGE:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, "A range of at most 31 days")
        return
    start, end = dt_util.as_utc(start), dt_util.as_utc(end)
    days, day = [], dt_util.as_local(start).date() - timedelta(days=1)
    while day <= dt_util.as_local(end).date() + timedelta(days=1):
        days.append(day_file(hass, day))
        day += timedelta(days=1)
    seen = [
        entry
        for entry in await hass.async_add_executor_job(_read, days)
        if start <= (dt_util.parse_datetime(entry.get("at", "")) or start - timedelta(seconds=1)) < end
    ]
    changes = await async_changes(hass, start, end)
    people = []
    for user in await hass.auth.async_get_users():
        if user.system_generated:
            continue
        devices = [
            {
                "name": token.client_name or token.client_id,
                "last_used_at": token.last_used_at.isoformat() if token.last_used_at else None,
                "last_used_ip": token.last_used_ip,
            }
            for token in user.refresh_tokens.values()
            if token.token_type == "normal"
        ]
        people.append({"id": user.id, "name": user.name, "is_admin": user.is_admin, "devices": devices})
    connection.send_result(
        msg["id"],
        {
            "entries": sorted(seen + changes, key=lambda entry: entry["at"]),
            "people": people,
            "retention_days": RETENTION_DAYS,
        },
    )


def change_entry(event: Event) -> dict[str, Any] | None:
    """A change of a state made by a person, as the history gives it; None for any other change."""
    new = event.data.get("new_state")
    user_id = event.context.user_id
    if new is None or not user_id:
        return None
    return {
        "at": new.last_updated.astimezone(UTC).isoformat(),
        "user_id": user_id,
        "kind": "change",
        "entity_id": new.entity_id,
        "state": new.state,
    }


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/activity/subscribe"})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_subscribe(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Live: each page or window written down and each change made by a person, as it happens."""
    if connection.user is None or connection.user.id not in await async_viewers(hass):
        connection.send_error(msg["id"], ERROR_NOT_ALLOWED, "Only the owner of Home Assistant sees this")
        return

    @callback
    def send(entry: dict[str, Any]) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], entry))

    @callback
    def changed(event: Event) -> None:
        entry = change_entry(event)
        if entry:
            send(entry)

    stop_seen = async_dispatcher_connect(hass, SIGNAL_SEEN, send)
    stop_changes = hass.bus.async_listen(EVENT_STATE_CHANGED, changed)

    @callback
    def unsubscribe() -> None:
        stop_seen()
        stop_changes()

    connection.subscriptions[msg["id"]] = unsubscribe
    connection.send_result(msg["id"])


COMMANDS = (websocket_seen, websocket_get, websocket_subscribe)


async def async_setup_activity(hass: HomeAssistant) -> None:
    """Register the commands once, add the panel for administrators (in the sidebar or, without a title, only
    at its address) and purge the old days every night."""
    in_sidebar = _option(hass, CONF_ACTIVITY_IN_SIDEBAR, DEFAULT_ACTIVITY_IN_SIDEBAR)
    if DATA_ACTIVITY not in hass.data:
        for command in COMMANDS:
            websocket_api.async_register_command(hass, command)
        hass.data[DATA_ACTIVITY] = {}
    state = hass.data[DATA_ACTIVITY]
    await async_purge(hass)
    if state.get("unsub"):
        state["unsub"]()

    async def nightly(_now: datetime) -> None:
        await async_purge(hass)

    state["unsub"] = async_track_time_change(hass, nightly, hour=3, minute=17, second=0)
    integration = await async_get_integration(hass, DOMAIN)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=PANEL_TITLES.get(hass.config.language, PANEL_TITLE) if in_sidebar else None,
        sidebar_icon=PANEL_ICON if in_sidebar else None,
        module_url=f"{STATIC_URL}/activity/activity.js?v={integration.version}",
        require_admin=True,
    )


@callback
def async_unload_activity(hass: HomeAssistant) -> None:
    async_remove_panel(hass, PANEL_URL, warn_if_unknown=False)
    unsub = hass.data.get(DATA_ACTIVITY, {}).pop("unsub", None)
    if unsub:
        unsub()
