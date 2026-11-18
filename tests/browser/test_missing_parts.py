"""A home without some parts: no cameras at all, or the Intercom integration removed while the dashboard still names
it. Every page, window and form of the editor still opens without an error (the fixtures fail on any page error),
and what cannot work is not offered."""

# ruff: noqa: F811 (fixtures imported from another test module are its arguments)

from __future__ import annotations

import pytest

from .test_editor_app import APP, desktop, select  # noqa: F401
from .test_sheets import open_menu
from .test_shortcuts import SHEET

PAGE = "home-dashboard-page"
CAMERA_DOMAINS = ("camera.", "image.")
# The intercom as the user's dashboard names it: a service of the Intercom integration and its upload endpoint.
INTERCOM = {
    "script": "intercom.announce",
    "areas_field": "areas",
    "text_field": "message",
    "file_field": "media",
    "played_field": "played",
    "upload": "/api/intercom/message",
}
# Cameras named in the configuration that the home does not have (any more).
GONE_CAMERAS = {
    "hero": "camera.gone",
    "private": ["camera.gone"],
    "order": ["camera.gone"],
    "talk": "intercom",
}
SERVICES_WITHOUT_INTERCOM = {
    "light": {"turn_on": {}, "turn_off": {}, "toggle": {}},
    "script": {"turn_on": {}},
}

MOUNT = """async ({ dashboard, page, room, noCameras, noMedia, services, admin }) => {
    const snapshot = window.dashboard.snapshot;
    const keep = (id) => (!noCameras || !(id.startsWith('camera.') || id.startsWith('image.'))) && (!noMedia || !id.startsWith('media_player.'));
    const states = Object.fromEntries(Object.entries(snapshot.states).filter(([id]) => keep(id)));
    const entities = Object.fromEntries(Object.entries(snapshot.entities).filter(([id]) => keep(id)));
    window.saved = [];
    const hass = window.dashboard.hass({
        states,
        entities,
        ...(services ? { services } : {}),
        user: { name: 'User', is_admin: admin },
        callWS: async (message) => {
            if (message.type === 'lovelace/config') return { strategy: { type: 'custom:home-dashboard', ...dashboard } };
            // Home Assistant without the add-on (or without the Supervisor): every question about it fails.
            if (message.type === 'supervisor/api') throw new Error('Addon is not installed');
            if (['frontend/get_user_data', 'config/entity_registry/get_entries', 'home_dashboard/activity/seen'].includes(message.type)) return null;
            window.saved.push(message);
            return null;
        },
    });
    window.hass = hass;
    if (room) window.history.replaceState(null, '', `?room=${room}`);
    window.card = await window.dashboard.mount(hass, dashboard, page);
    document.querySelector('home-dashboard-chrome')._reload = () => {};
}"""


def mount(
    page, dashboard=None, name="home", room=None, no_cameras=False, services=None, admin=True, no_media=False
):
    page.evaluate(
        MOUNT,
        {
            "dashboard": dashboard or {},
            "page": name,
            "room": room,
            "noCameras": no_cameras,
            "noMedia": no_media,
            "services": services,
            "admin": admin,
        },
    )
    page.wait_for_selector("home-dashboard-chrome", state="attached")
    page.wait_for_timeout(300)


def rooms_of(page) -> list[str]:
    return page.evaluate(
        "() => window.dashboard.model.buildRoomList(window.hass, window.dashboard.model.normalizeConfig({}), "
        "window.dashboard.model.selectEntities(window.hass, window.dashboard.model.normalizeConfig({}))).map((r) => r.id)"
    )


# No cameras ---------------------------------------------------------------------------------------------


@pytest.mark.parametrize("style", ["classic", "sections"])
def test_home_without_any_camera(tablet, style):
    mount(tablet, {"cameras": GONE_CAMERAS, "page_layout": {"style": style}}, no_cameras=True)
    root = tablet.locator(PAGE)
    assert root.locator(".camera").count() == 0
    assert root.locator("[data-section-link='cameras'], [data-camera-pairs]").count() == 0
    assert root.locator("[data-rooms]").count() >= 1


def test_every_room_without_any_camera(phone):
    mount(phone, {"cameras": GONE_CAMERAS}, no_cameras=True)
    for room in rooms_of(phone):
        mount(phone, {"cameras": GONE_CAMERAS}, name="room", room=room, no_cameras=True)
        assert phone.locator(f"{PAGE} .camera").count() == 0


def test_the_windows_of_cameras_open_empty(phone):
    mount(phone, {"cameras": GONE_CAMERAS}, no_cameras=True)
    phone.evaluate(
        "() => document.querySelector('home-dashboard-chrome').open({ type: 'sheet', sheet: { kind: 'cameras' } })"
    )
    phone.wait_for_timeout(300)
    phone.evaluate("() => document.querySelector('home-dashboard-chrome').open({ type: 'drawer' })")
    phone.wait_for_timeout(300)


def test_settings_without_any_camera(phone):
    mount(phone, {"cameras": GONE_CAMERAS}, no_cameras=True)
    open_menu(phone)
    phone.locator("[data-settings]").click()
    phone.wait_for_selector("home-dashboard-settings .panel")


def test_the_status_bar_of_a_tablet_without_any_camera(tablet):
    mount(tablet, {"cameras": GONE_CAMERAS, "appearance": {"status_panel": {"shown": True}}}, no_cameras=True)
    tablet.wait_for_timeout(300)


# No Intercom integration ---------------------------------------------------------------------------------


def test_without_the_intercom_integration_nothing_offers_to_speak(phone):
    mount(phone, {"intercom": INTERCOM}, services=SERVICES_WITHOUT_INTERCOM)
    assert phone.locator(f"{PAGE} [data-intercom-all]").count() == 0
    room = rooms_of(phone)[0]
    mount(phone, {"intercom": INTERCOM}, name="room", room=room, services=SERVICES_WITHOUT_INTERCOM)
    assert phone.locator(f"{PAGE} [data-intercom-here]").count() == 0


def test_with_the_intercom_integration_the_buttons_stay(phone):
    services = {**SERVICES_WITHOUT_INTERCOM, "intercom": {"announce": {}}}
    mount(phone, {"intercom": {**INTERCOM, "areas": []}}, services=services)
    assert phone.locator(f"{PAGE} [data-intercom-all]").count() == 1


def test_a_script_as_the_intercom_needs_the_script(phone):
    without = {"intercom": {**INTERCOM, "script": "script.announce", "upload": None, "areas": []}}
    mount(phone, without, services=SERVICES_WITHOUT_INTERCOM)
    assert phone.locator(f"{PAGE} [data-intercom-all]").count() == 0
    services = {**SERVICES_WITHOUT_INTERCOM, "script": {"turn_on": {}, "announce": {}}}
    mount(phone, without, services=services)
    assert phone.locator(f"{PAGE} [data-intercom-all]").count() == 1


def test_the_home_model_has_no_intercom_rooms_without_the_integration(phone):
    mount(phone, {"intercom": INTERCOM, "cameras": {"talk": "intercom"}}, services=SERVICES_WITHOUT_INTERCOM)
    assert phone.evaluate("() => window.card._model.intercom") == []


# No Music Assistant, no speakers ------------------------------------------------------------------------

# The music as the user's dashboard has it: the Music Assistant add-on, and speakers on the Media page.
MUSIC = {"addon": "d5369777_music_assistant", "fullscreen": True}
MEDIA = {"sections": [{"title": "Głośniki", "tiles": [{"entity": "media_player.gone", "name": "Salon"}]}]}


def test_the_music_page_without_the_add_on_says_so(phone):
    mount(phone, {"music": MUSIC, "media": MEDIA}, name="music", no_media=True)
    message = phone.locator(f"{PAGE} home-dashboard-app [data-app-message]")
    message.wait_for()
    assert message.locator("a[data-app-link]").count() == 1
    assert phone.locator(f"{PAGE} home-dashboard-app [data-app-frame]").count() == 0


@pytest.mark.parametrize("name", ["home", "media", "music", "energy", "map"])
def test_every_page_without_any_speaker(tablet, name):
    mount(tablet, {"music": MUSIC, "media": MEDIA}, name=name, no_media=True)
    assert tablet.locator("home-dashboard-chrome [data-mini]").count() == 0


def test_the_media_window_without_any_speaker(phone):
    mount(
        phone,
        {"music": MUSIC, "media": MEDIA, "shortcuts": [{"kind": "page", "name": "Media", "page": "media"}]},
        no_media=True,
    )
    phone.evaluate(
        "() => document.querySelector('home-dashboard-chrome').open({ type: 'sheet', sheet: { kind: 'page', page: 'media', item: { kind: 'page', page: 'media', name: 'Media' } } })"
    )
    phone.wait_for_timeout(400)


# The editor --------------------------------------------------------------------------------------------


EDITOR_STRATEGY = {
    "type": "custom:home-dashboard",
    "intercom": INTERCOM,
    "cameras": GONE_CAMERAS,
    "music": MUSIC,
    "media": MEDIA,
    "layout": [
        {
            "id": "living",
            "name": "Salon",
            "sections": [{"title": "Kamery", "tiles": [{"entity": "camera.gone"}]}],
        }
    ],
}


def open_bare_editor(page) -> None:
    page.evaluate(
        """async (strategy) => {
            const snapshot = window.editor.snapshot;
            const gone = (id) => id.startsWith('camera.') || id.startsWith('image.') || id.startsWith('media_player.');
            for (const id of Object.keys(snapshot.states)) if (gone(id)) delete snapshot.states[id];
            for (const id of Object.keys(snapshot.entities)) if (gone(id)) delete snapshot.entities[id];
            await window.editor.open(strategy);
            window.editor.app.hass = { ...window.editor.app.hass, services: { light: { turn_on: {} } } };
        }""",
        EDITOR_STRATEGY,
    )
    page.wait_for_selector(f"{APP} [data-tree]")


def test_the_editor_opens_every_setting_without_cameras_intercom_and_music(desktop):
    open_bare_editor(desktop)
    keys = desktop.locator(f"{APP} [data-node]:not([data-unavailable])").evaluate_all(
        "(all) => all.map((n) => n.dataset.node)"
    )
    for key in keys:
        select(desktop, key)
        desktop.wait_for_timeout(30)
    for key in ("home_settings", "variants/home"):
        select(desktop, key)
        desktop.wait_for_selector(f"{APP} [data-props]")
    # The tile of a camera that is gone is marked, not a failure.
    select(desktop, "layout/0/sections/0/tiles/0")
    assert desktop.locator(f"{APP} [data-problem='editor_problem_no_entity']").count() == 1


def test_settings_without_their_part_are_greyed_with_what_to_install(desktop):
    open_bare_editor(desktop)
    greyed = desktop.locator(f"{APP} [data-unavailable]").evaluate_all(
        "(all) => Object.fromEntries(all.map((n) => [n.dataset.node, n.textContent.trim().replace(/\\s+/g, ' ')]))"
    )
    assert set(greyed) == {"cameras", "intercom", "music", "media"}
    assert "Wymaga kamery" in greyed["cameras"]
    assert "Intercom" in greyed["intercom"]
    assert "Music Assistant" in greyed["music"]
    assert "głośnika" in greyed["media"]
    # A greyed row opens nothing, also when an address names it.
    select(desktop, "layout/0")
    desktop.locator(f"{APP} [data-node='cameras']").click()
    assert desktop.evaluate("window.editor.app._selected?.key") == "layout/0"
    desktop.evaluate(
        "window.editor.app._select(window.editor.tree.flatten(window.editor.tree.buildTree(window.editor.app._strategy, window.editor.app.hass, 'pl')).find((n) => n.key === 'cameras'))"
    )
    assert desktop.evaluate("window.editor.app._selected") is None


def test_with_every_part_nothing_is_greyed(desktop):
    from .test_editor_app import open_editor

    open_editor(desktop)
    desktop.evaluate(
        "window.editor.app.hass = { ...window.editor.app.hass, services: { intercom: { announce: {} }, music_assistant: { play_media: {} } } }"
    )
    desktop.wait_for_timeout(100)
    assert desktop.locator(f"{APP} [data-unavailable]").count() == 0


def test_a_script_is_enough_for_the_intercom(desktop):
    open_bare_editor(desktop)
    desktop.evaluate(
        "window.editor.app.hass = { ...window.editor.app.hass, services: { script: { turn_on: {}, komunikat: {} } } }"
    )
    desktop.wait_for_timeout(100)
    assert desktop.locator(f"{APP} [data-node='intercom'][data-unavailable]").count() == 0


def test_the_preview_of_the_editor_without_cameras(desktop):
    open_bare_editor(desktop)
    select(desktop, "layout/0")
    desktop.wait_for_timeout(500)


def test_the_cameras_window_of_a_sheet_says_there_are_none(phone):
    mount(phone, {"cameras": GONE_CAMERAS}, no_cameras=True)
    phone.evaluate(
        "() => document.querySelector('home-dashboard-chrome').open({ type: 'sheet', sheet: { kind: 'cameras' } })"
    )
    phone.wait_for_selector(f"{SHEET}", state="attached")
