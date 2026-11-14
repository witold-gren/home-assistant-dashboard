"""The editor on a computer, stage 2: the preview of the phone and the tablet in frames that show the draft at once,
choose in the tree what a touch chose, never call a service, and the tools around them (screens, colour, person,
folding the tree, the widths of the columns, the menu of Home Assistant)."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, STRATEGY, desktop, open_editor, select, type_yaml  # noqa: F401

# Rooms show on Home with their own tiles there.
PREVIEW = {
    **STRATEGY,
    "layout": [
        {**STRATEGY["layout"][0], "home": [{"entity": "light.entity_0096", "name": "Sofa"}]},
        {**STRATEGY["layout"][1], "home": [{"entity": "switch.entity_0235"}]},
    ],
}
USERS = [
    {"id": "admin", "name": "Admin", "is_active": True},
    {"id": "kid", "name": "Kuba", "is_active": True},
    {"id": "system", "name": "Supervisor", "is_active": True, "system_generated": True},
]


def frame(page, device: str):
    """The page inside a frame of the preview, once its dashboard is drawn."""
    handle = page.locator(f"{APP} iframe[data-frame='{device}']").element_handle()
    content = handle.content_frame()
    content.wait_for_function("window.previewReady === true")
    return content


def frame_src(page, device: str) -> str:
    return page.locator(f"{APP} iframe[data-frame='{device}']").get_attribute("src")


def open_preview(page, strategy=PREVIEW, **options) -> None:
    open_editor(page, strategy, users=USERS, **options)
    page.wait_for_selector(f"{APP} iframe[data-frame]")


@pytest.fixture(autouse=True)
def clean_storage(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")


# Frames -------------------------------------------------------------------------------------------------


def test_both_screens_by_default_in_their_proportions(desktop):  # noqa: F811
    open_preview(desktop)
    phone = desktop.locator(f"{APP} iframe[data-frame='phone']").bounding_box()
    tablet = desktop.locator(f"{APP} iframe[data-frame='tablet']").bounding_box()
    assert abs(phone["width"] / phone["height"] - 402 / 874) < 0.02
    assert abs(tablet["width"] / tablet["height"] - 1180 / 820) < 0.02
    stage = desktop.locator(f"{APP} [data-stage]").bounding_box()
    assert tablet["x"] + tablet["width"] <= stage["x"] + stage["width"]


def test_one_screen_alone_is_bigger_and_remembered(desktop):  # noqa: F811
    open_preview(desktop)
    both = desktop.locator(f"{APP} [data-device-frame='phone'] .bezel").bounding_box()["height"]
    desktop.locator(f"{APP} [data-device='phone']").click()
    assert desktop.locator(f"{APP} iframe[data-frame]").count() == 1
    alone = desktop.locator(f"{APP} [data-device-frame='phone'] .bezel").bounding_box()["height"]
    assert alone > both
    open_preview(desktop)
    assert desktop.locator(f"{APP} iframe[data-frame]").count() == 1


def test_a_frame_opens_the_dashboard_as_the_preview(desktop):  # noqa: F811
    open_preview(desktop)
    assert "hd_preview=1" in frame_src(desktop, "phone")
    content = frame(desktop, "phone")
    assert content.evaluate("async () => (await import('/custom_components/home_dashboard/www/app/preview.js')).previewMode()") is True


def test_the_frame_shows_the_draft_before_it_is_saved(desktop):  # noqa: F811
    open_preview(desktop)
    content = frame(desktop, "tablet")
    content.wait_for_selector("home-dashboard-page [data-room='living']")
    select(desktop, "layout/0")
    type_yaml(desktop, "id: living\nname: Salon główny\nhome:\n  - entity: light.entity_0096\nsections: []\n")
    content.wait_for_function(
        "document.querySelector('home-dashboard-page').shadowRoot.querySelector('[data-room=\"living\"]').textContent.includes('Salon główny')"
    )
    # Not saved yet: the draft waits a moment after the last letter.
    assert desktop.evaluate("window.editor.server.state.draft") is None


def test_a_touch_in_the_preview_chooses_the_tile_and_does_nothing(desktop):  # noqa: F811
    open_preview(desktop)
    desktop.locator(f"{APP} [data-fold-all]").click()
    content = frame(desktop, "tablet")
    tile = content.locator("home-dashboard-page [data-room='kitchen'] [data-entity='switch.entity_0235']").first
    tile.click()
    desktop.wait_for_selector(f"{APP} [data-node='layout/1/home/0'].sel")
    assert content.evaluate("window.preview.hass.calls.filter((call) => call.type === 'service')") == []


def test_choosing_a_room_takes_the_preview_there_without_loading_again(desktop):  # noqa: F811
    open_preview(desktop)
    frame(desktop, "phone")
    desktop.evaluate("() => { window.loads = 0; }")
    select(desktop, "layout/1")
    content = frame(desktop, "phone")
    content.wait_for_function("location.search.includes('room=kitchen')")
    assert content.evaluate("window.previewReady") is True


def test_colour_and_person_load_the_frames_again_with_them(desktop):  # noqa: F811
    open_preview(desktop)
    desktop.locator(f"{APP} [data-color='dark']").click()
    assert "hd_color=dark" in frame_src(desktop, "phone")
    desktop.locator(f"{APP} [data-as]").select_option("kid")
    assert "hd_as=kid" in frame_src(desktop, "tablet")
    names = desktop.locator(f"{APP} [data-as] option").all_inner_texts()
    assert names == ["Jako ja", "Admin", "Kuba"]


# The guard of the preview -------------------------------------------------------------------------------


def test_the_connection_of_a_frame_refuses_what_would_change_the_home(desktop):  # noqa: F811
    open_preview(desktop)
    content = frame(desktop, "phone")
    sent = content.evaluate("""async () => {
        const connection = window.preview.hass.connection;
        for (const type of ['call_service', 'execute_script', 'lovelace/config/save', 'frontend/set_user_data',
            'config/entity_registry/update', 'history/history_during_period', 'frontend/get_user_data']) {
            await connection.sendMessagePromise({ type });
        }
        return window.preview.sent.map((message) => message.type);
    }""")
    assert sent == ["history/history_during_period", "frontend/get_user_data"]


@pytest.mark.parametrize(
    ("kind", "blocked"),
    [("call_service", True), ("execute_script", True), ("lovelace/config/save", True), ("config/area_registry/delete", True),
     ("recorder/statistics_during_period", False), ("camera/stream", False)],
)
def test_what_a_preview_refuses(desktop, kind, blocked):  # noqa: F811
    result = desktop.evaluate(
        "async (kind) => (await import('/custom_components/home_dashboard/www/app/preview.js')).blockedInPreview(kind)", kind
    )
    assert result is blocked


def test_outside_a_frame_nothing_is_a_preview(desktop):  # noqa: F811
    result = desktop.evaluate("""async () => { const p = await import('/custom_components/home_dashboard/www/app/preview.js');
        return [p.previewMode(), p.previewStrategy('given'), p.previewUserId({ user: { id: 'me' } })]; }""")
    assert result == [False, "given", "me"]


# Finding what a touch chose ------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("target", "path"),
    [
        ({"kind": "tile", "room": "living", "section": "section-0", "entity": "light.entity_0097"}, ["layout", 0, "sections", 0, "tiles", 1]),
        ({"kind": "tile", "room": "living", "section": "section-0", "name": "Sofa"}, ["layout", 0, "sections", 0, "tiles", 0]),
        ({"kind": "tile", "room": None, "entity": "switch.entity_0235"}, ["layout", 1, "sections", 0, "tiles", 0]),
        ({"kind": "tile", "room": None, "entity": "light.nowhere"}, None),
        ({"kind": "room", "room": "kitchen"}, ["layout", 1]),
        ({"kind": "block", "name": "Ekspres"}, ["shortcuts", 0]),
        ({"kind": "section", "room": "living", "section": "section-1"}, ["layout", 0, "sections", 1]),
        ({"kind": "status", "room": "kitchen", "key": "lights"}, ["layout", 1]),
    ],
)
def test_the_node_of_a_touch(desktop, target, path):  # noqa: F811
    found = desktop.evaluate(
        """async ([strategy, target]) => (await import('/custom_components/home_dashboard/www/editor/editor-app.js'))
            .nodeForTarget(strategy, target)""",
        [STRATEGY, target],
    )
    assert found == path


def test_the_page_of_a_choice(desktop):  # noqa: F811
    pages = desktop.evaluate("""async (strategy) => { const e = await import('/custom_components/home_dashboard/www/editor/editor-app.js');
        return [e.previewPage(strategy, ['layout', 1, 'sections', 0]), e.previewPage(strategy, ['favorites', 0]), e.previewPage(strategy, null)]; }""",
        STRATEGY)
    assert pages == [{"page": "room", "room": "kitchen"}, {"page": "home", "room": None}, {"page": "home", "room": None}]


def test_the_scale_fits_the_stage(desktop):  # noqa: F811
    scales = desktop.evaluate("""async () => { const e = await import('/custom_components/home_dashboard/www/editor/editor-app.js');
        return [e.stageScale(['phone'], 600, 600), e.stageScale(['phone', 'tablet'], 1000, 900), e.stageScale(['tablet'], 5000, 5000)]; }""")
    assert 0.55 < scales[0] < 0.65
    assert scales[1] < scales[0]
    assert scales[2] == 1


# The tree and the columns ------------------------------------------------------------------------------


def test_the_whole_tree_folds_and_unfolds_and_stays_so(desktop):  # noqa: F811
    open_preview(desktop)
    desktop.locator(f"{APP} [data-fold-all]").click()
    assert desktop.locator(f"{APP} [data-node='layout/0/sections/0']").count() == 0
    assert desktop.locator(f"{APP} [data-node='layout/0']").count() == 1
    open_preview(desktop)
    assert desktop.locator(f"{APP} [data-node='layout/0/sections/0']").count() == 0
    desktop.locator(f"{APP} [data-unfold-all]").click()
    assert desktop.locator(f"{APP} [data-node='layout/0/sections/0/tiles/0']").count() == 1


def test_a_touch_in_the_preview_unfolds_the_way_to_its_tile(desktop):  # noqa: F811
    open_preview(desktop)
    desktop.locator(f"{APP} [data-fold-all]").click()
    desktop.evaluate("""() => window.homeDashboardPreview.select({ kind: 'tile', room: 'living', section: 'section-0', name: 'Sofa' })""")
    desktop.wait_for_selector(f"{APP} [data-node='layout/0/sections/0/tiles/0'].sel")


def drag(page, side: str, to_x: float) -> None:
    bar = page.locator(f"{APP} [data-splitter='{side}']").bounding_box()
    page.mouse.move(bar["x"] + 3, bar["y"] + 200)
    page.mouse.down()
    page.mouse.move(to_x, bar["y"] + 200, steps=5)
    page.mouse.up()


def width(page, part: str) -> float:
    return page.locator(f"{APP} [data-{part}]").bounding_box()["width"]


def test_the_side_columns_take_the_width_they_are_dragged_to_and_keep_it(desktop):  # noqa: F811
    open_preview(desktop)
    drag(desktop, "left", 400)
    assert abs(width(desktop, "tree") - 400) <= 2
    drag(desktop, "right", 1600 - 500)
    assert abs(width(desktop, "props") - 500) <= 2
    open_preview(desktop)
    assert abs(width(desktop, "tree") - 400) <= 2
    assert abs(width(desktop, "props") - 500) <= 2


def test_a_column_stays_within_its_limits_and_a_double_click_gives_the_first_width_back(desktop):  # noqa: F811
    open_preview(desktop)
    drag(desktop, "left", 50)
    assert abs(width(desktop, "tree") - 220) <= 2
    drag(desktop, "left", 1200)
    assert abs(width(desktop, "tree") - 520) <= 2
    desktop.locator(f"{APP} [data-splitter='left']").dblclick()
    assert abs(width(desktop, "tree") - 290) <= 2


def test_the_menu_button_opens_the_sidebar_of_home_assistant(desktop):  # noqa: F811
    open_preview(desktop)
    desktop.evaluate("() => { window.menus = 0; window.addEventListener('hass-toggle-menu', () => window.menus++); }")
    desktop.locator(f"{APP} [data-ha-menu]").click()
    assert desktop.evaluate("window.menus") == 1


def test_the_zoom_of_the_app_makes_the_page_of_the_tablet_bigger_and_is_remembered(desktop):  # noqa: F811
    open_preview(desktop)
    desktop.locator(f"{APP} [data-zoom='tablet']").select_option("85")
    style = desktop.locator(f"{APP} iframe[data-frame='tablet']").get_attribute("style")
    assert "width: 1388px" in style and "height: 965px" in style
    assert "85 %" in desktop.locator(f"{APP} [data-device-frame='tablet'] figcaption").inner_text()
    assert "width: 402px" in desktop.locator(f"{APP} iframe[data-frame='phone']").get_attribute("style")
    open_preview(desktop)
    assert "width: 1388px" in desktop.locator(f"{APP} iframe[data-frame='tablet']").get_attribute("style")


def test_a_bigger_tablet_gets_a_smaller_scale(desktop):  # noqa: F811
    scales = desktop.evaluate("""async () => { const e = await import('/custom_components/home_dashboard/www/editor/editor-app.js');
        return [e.stageScale(['tablet'], 1000, 900, 'air'), e.stageScale(['tablet'], 1000, 900, 'air', { tablet: 85 }),
            e.stageScale(['tablet'], 1000, 900, 'pro13')]; }""")
    assert scales[1] < scales[0] and scales[2] < scales[0]


@pytest.mark.parametrize(("zoom", "size"), [(100, [1180, 820]), (85, [1388, 965]), (125, [944, 656]), (33, [1180, 820])])
def test_the_page_of_a_zoomed_tablet(desktop, zoom, size):  # noqa: F811
    found = desktop.evaluate("""async (zoom) => { const e = await import('/custom_components/home_dashboard/www/editor/editor-app.js');
        const page = e.deviceSize('tablet', 'air', zoom); return [page.width, page.height]; }""", zoom)
    assert found == size


def test_every_phone_and_tablet_has_a_size_of_its_own(desktop):  # noqa: F811
    sizes = desktop.evaluate("""async () => { const e = await import('/custom_components/home_dashboard/www/editor/editor-app.js');
        return { phones: Object.values(e.PHONES).map((d) => [d.width, d.height, d.label]),
                 tablets: Object.values(e.TABLETS).map((d) => [d.width, d.height, d.label]) }; }""")
    for kind in ("phones", "tablets"):
        dimensions = [(width, height) for width, height, _ in sizes[kind]]
        assert len(dimensions) == len(set(dimensions)), kind  # a size is there once, with every model of it
        for width, height, label in sizes[kind]:
            assert label.endswith(f"{width} \u00d7 {height}")
    assert all(width < height for width, height, _ in sizes["phones"])  # phones upright
    assert all(width > height for width, height, _ in sizes["tablets"])  # tablets on their side
    assert any("iPhone SE" in label for *_, label in sizes["phones"])
    assert any("iPad mini" in label for *_, label in sizes["tablets"])


def test_a_phone_is_chosen_and_the_frame_takes_its_size(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.removeItem('home-dashboard-editor-preview')")
    open_preview(desktop)
    assert "width: 402px" in desktop.locator(f"{APP} iframe[data-frame='phone']").get_attribute("style")
    desktop.locator(f"{APP} [data-phone-size]").select_option("8")
    style = desktop.locator(f"{APP} iframe[data-frame='phone']").get_attribute("style")
    assert "width: 375px" in style and "height: 667px" in style
    assert "375 \u00d7 667" in desktop.locator(f"{APP} [data-device-frame='phone'] figcaption").inner_text()
    open_preview(desktop)  # remembered
    assert "width: 375px" in desktop.locator(f"{APP} iframe[data-frame='phone']").get_attribute("style")
    desktop.locator(f"{APP} [data-tablet-size]").select_option("mini")
    assert "width: 1133px" in desktop.locator(f"{APP} iframe[data-frame='tablet']").get_attribute("style")


def test_a_phone_of_its_own_scales_the_stage(desktop):  # noqa: F811
    scales = desktop.evaluate("""async () => { const e = await import('/custom_components/home_dashboard/www/editor/editor-app.js');
        return [e.stageScale(['phone'], 600, 600), e.stageScale(['phone'], 600, 600, 'air', {}, '16promax'),
                e.stageScale(['phone'], 600, 600, 'air', {}, 'se1')]; }""")
    assert scales[1] < scales[0] < scales[2]
