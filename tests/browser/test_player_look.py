"""The small player: only for something that plays, paused for a while, closed by hand, and its look."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from .test_panels import add_entity
from .test_shortcuts import mount_admin

CHROME = "document.querySelector('home-dashboard-chrome')"
NOW = datetime(2026, 11, 8, 17, 0, tzinfo=UTC)


def state(entity_id: str, value: str, title: str | None, minutes_ago: int = 1) -> dict:
    changed = (NOW - timedelta(minutes=minutes_ago)).isoformat()
    return {"entity_id": entity_id, "state": value, "last_changed": changed,
            "attributes": {"media_title": title, "friendly_name": entity_id}}


def pick(page, states: list, **options) -> str | None:
    return page.evaluate(
        """({ states, options }) => {
            const hass = { states: Object.fromEntries(states.map((item) => [item.entity_id, item])) };
            const selection = { mediaGroups: [states.map((item) => item.entity_id)] };
            return window.dashboard.model.nowPlaying(hass, selection, { now: Date.parse(arg_now), ...options });
        }""".replace("arg_now", f"'{NOW.isoformat()}'"),
        {"states": states, "options": options},
    )


def test_a_speaker_that_plays_nothing_is_not_shown(phone):
    assert pick(phone, [state("media_player.ghost", "playing", None)]) is None


def test_something_playing_wins_over_something_paused(phone):
    states = [state("media_player.a", "paused", "A"), state("media_player.b", "playing", "B")]
    assert pick(phone, states) == "media_player.b"


def test_something_paused_stays_only_for_a_while(phone):
    assert pick(phone, [state("media_player.a", "paused", "A", minutes_ago=5)]) == "media_player.a"
    assert pick(phone, [state("media_player.a", "paused", "A", minutes_ago=15)]) is None
    assert pick(phone, [state("media_player.a", "paused", "A", minutes_ago=1)], pausedMinutes=0) is None


def test_a_closed_player_comes_back_for_something_new(phone):
    paused = state("media_player.a", "paused", "A")
    assert pick(phone, [paused], dismissed="media_player.a|paused|A") is None
    assert pick(phone, [state("media_player.a", "playing", "A")], dismissed="media_player.a|paused|A") == "media_player.a"


def mini(page) -> dict | None:
    return page.evaluate(f"""() => {{
        const box = {CHROME}.shadowRoot.querySelector('[data-mini]');
        return box && {{ style: box.getAttribute('style'), close: Boolean(box.querySelector('[data-mini-close]')) }};
    }}""")


def add_paused_player(page) -> None:
    page.evaluate("""() => {
        const groups = window.dashboard.snapshot;
        const id = Object.keys(groups.states).find((key) => key.startsWith('media_player.') && key.includes('homepod'));
        window.playerId = id;
        groups.states[id] = { ...groups.states[id], state: 'paused', last_changed: new Date().toISOString(),
            attributes: { ...groups.states[id].attributes, media_title: 'Song' } };
    }""")


def test_a_paused_player_can_be_closed(phone):
    add_paused_player(phone)
    look = {"player": {"background": "#2a2f6a", "text": "#ffffff", "opacity": 60, "blur": 20, "radius": 22}}
    mount_admin(phone, {"appearance": look})
    phone.wait_for_function(f"{CHROME}.shadowRoot.querySelector('[data-mini]')")
    shown = mini(phone)
    assert shown["close"] is True
    for expected in ("--hd-player-bg: #2a2f6a", "--hd-player-opacity: 60%", "--hd-player-blur: 20px", "--hd-player-radius: 22px"):
        assert expected in shown["style"]
    phone.locator("home-dashboard-chrome [data-mini-close]").click()
    phone.wait_for_function(f"!{CHROME}.shadowRoot.querySelector('[data-mini]')")
    assert phone.evaluate("localStorage.getItem('home_dashboard_dismissed_player')").endswith("|paused|Song")


def test_a_look_can_hide_anything_paused(phone):
    add_paused_player(phone)
    mount_admin(phone, {"appearance": {"player": {"paused_minutes": 0}}})
    phone.wait_for_timeout(300)
    assert mini(phone) is None


def test_the_player_settings_are_in_the_bar_tab(phone):
    add_entity(phone, "light.x", "on")
    mount_admin(phone, {})
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.locator("home-dashboard-sheet [data-sheet-look]").click()
    phone.locator("home-dashboard-sheet [data-tab='nav']").click()
    phone.locator("home-dashboard-sheet [data-look='player-paused'] input").fill("0")
    phone.locator("home-dashboard-sheet [data-look='player-radius'] input").fill("22")
    phone.locator("home-dashboard-sheet [data-look-save]").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'lovelace/config/save')")
    saved = phone.evaluate("window.saved.find((m) => m.type === 'lovelace/config/save').config.strategy.appearance")
    assert saved == {"player": {"radius": 22, "paused_minutes": 0}}
