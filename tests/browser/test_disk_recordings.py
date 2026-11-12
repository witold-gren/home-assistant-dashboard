"""Recordings on the disk as a list by day, newest first, read a few days at a time; a tap goes back to the camera at
that recording."""

from __future__ import annotations

from pathlib import Path

from .test_recorded_live import LONG_AGO, SETUP, YESTERDAY
from .test_shortcuts import mount_admin

SHEET = "home-dashboard-sheet"


def open_camera(page, viewport=None, admin: bool = True) -> None:
    if viewport:
        page.set_viewport_size(viewport)
    page.evaluate(SETUP, {"recording": True, "folder": "media-source://media_source/media/eufy/T86P2ABC", "path": None,
                          "yesterday": YESTERDAY, "longAgo": LONG_AGO})
    mount_admin(page, {"cameras": {"tiles": ["image.slup_last_screen"]}}, admin=admin)
    page.evaluate("""() => document.querySelector('home-dashboard-chrome')
        .open({ type: 'sheet', sheet: { kind: 'camera', entityId: 'image.slup_last_screen' } })""")
    page.wait_for_selector(f"{SHEET} home-dashboard-timeline", state="attached")


def open_disk(page) -> None:
    open_camera(page)
    page.locator(f"{SHEET} [data-disk-open='upright']").click()
    page.wait_for_selector(f"{SHEET} [data-disk-clip]")


def test_upright_the_button_stands_at_the_left_over_the_line_of_time(phone):
    open_camera(phone)
    button = phone.locator(f"{SHEET} [data-disk-open='upright']").bounding_box()
    line = phone.locator(f"{SHEET} home-dashboard-timeline").bounding_box()
    assert button["x"] < 60
    assert button["y"] + button["height"] <= line["y"]
    assert not phone.locator(f"{SHEET} [data-disk-open='side']").is_visible()


def test_upright_the_quick_buttons_stay_at_the_right(phone):
    open_camera(phone)
    # A siren on the same device as the camera.
    phone.evaluate("""async () => { const snapshot = window.dashboard.snapshot;
        snapshot.entities['siren.slup_siren'] = { entity_id: 'siren.slup_siren', device_id: 'slup', platform: 'eufy_sdk', hidden: false };
        snapshot.states['siren.slup_siren'] = { entity_id: 'siren.slup_siren', state: 'off', attributes: {} };
        const chrome = document.querySelector('home-dashboard-chrome'); const sheet = chrome.shadowRoot.querySelector('home-dashboard-sheet');
        sheet.hass = window.dashboard.hass(); await sheet.updateComplete; }""")
    siren = phone.locator(f"{SHEET} [data-quick='siren']").bounding_box()
    disk = phone.locator(f"{SHEET} [data-disk-open='upright']").bounding_box()
    assert disk["x"] < 60
    assert siren["x"] + siren["width"] > 402 - 60


def test_on_its_side_the_button_stands_beside_the_button_of_the_line_of_time(phone):
    open_camera(phone, {"width": 874, "height": 402})
    side = phone.locator(f"{SHEET} [data-disk-open='side']").bounding_box()
    line = phone.locator(f"{SHEET} [data-open-line]").bounding_box()
    assert abs(side["y"] - line["y"]) < 1
    assert side["x"] + side["width"] < line["x"]
    assert not phone.locator(f"{SHEET} [data-disk-open='upright']").is_visible()


def test_the_recordings_stand_by_day_newest_first(phone):
    open_disk(phone)
    days = phone.locator(f"{SHEET} [data-disk-day]").evaluate_all("(days) => days.map((day) => day.dataset.diskDay)")
    assert days == [YESTERDAY]
    times = phone.locator(f"{SHEET} [data-disk-day='{YESTERDAY}'] strong").all_text_contents()
    assert times == ["09:30", "08:00"]
    assert "1 min 30 s" in phone.locator(f"{SHEET} [data-disk-clip]").last.text_content()


def test_a_tap_goes_back_to_the_camera_at_that_recording(phone):
    open_disk(phone)
    phone.locator(f"{SHEET} [data-disk-clip]").last.click()
    phone.wait_for_selector(f"{SHEET} .panel[data-kind='camera']")
    phone.wait_for_function("window.asked.some((m) => m.type === 'media_source/resolve_media')", timeout=10000)
    resolved = phone.evaluate(
        "window.asked.filter((m) => m.type === 'media_source/resolve_media').map((m) => m.media_content_id.split('/').pop())")
    assert resolved[-1] == "080000-080130.mp4"


def test_the_days_are_read_a_few_at_a_time(phone):
    open_camera(phone)
    # Fourteen days with one recording each: the first read stops after a week, the rest as the list is scrolled.
    phone.evaluate("""() => {
        const sheet = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet');
        const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (i + 1) * 864e5).toISOString().slice(0, 10));
        window.readDays = [];
        sheet._startDisk = async function () {
            const source = { days: async () => days, day: async (day) => (window.readDays.push(day),
                { ranges: [{ start: Date.parse(day) / 1000 + 3600, end: Date.parse(day) / 1000 + 3630 }], events: [] }) };
            this._disk = { source, days: [...days].sort().reverse(), next: 0, days_loaded: [], loading: false, error: null };
            await this._loadDisk();
        };
    }""")
    phone.locator(f"{SHEET} [data-disk-open='upright']").click()
    phone.wait_for_selector(f"{SHEET} [data-disk-clip]")
    phone.wait_for_function("window.readDays.length >= 7")
    first = phone.evaluate("window.readDays.length")
    assert first < 14
    phone.locator(f"{SHEET} [data-disk-more]").scroll_into_view_if_needed()
    phone.wait_for_function("window.readDays.length === 14", timeout=8000)
    assert phone.locator(f"{SHEET} [data-disk-day]").count() == 14


def test_a_recording_is_deleted_after_asking(phone):
    open_disk(phone)
    clip = phone.locator(f"{SHEET} [data-disk-clip]").last
    clip.locator("[data-remove]").click()
    # Asked first; cancelling keeps it.
    phone.locator(f"{SHEET} [data-remove-no]").click()
    assert phone.locator(f"{SHEET} [data-disk-clip]").count() == 2
    clip.locator("[data-remove]").click()
    assert "Nie da się tego cofnąć" in phone.locator(f"{SHEET} [data-remove-ask]").text_content()
    phone.locator(f"{SHEET} [data-remove-yes]").click()
    phone.wait_for_function("window.asked.some((m) => m.type === 'media_source/local_source/remove')")
    removed = phone.evaluate("window.asked.filter((m) => m.type === 'media_source/local_source/remove').map((m) => m.media_content_id)")
    assert removed == [f"media-source://media_source/media/eufy/T86P2ABC/{YESTERDAY}/080000-080130.mp4"]
    assert phone.locator(f"{SHEET} [data-disk-clip]").count() == 1
    # The window stayed: the tap on the bin was not a tap on the recording.
    assert phone.locator(f"{SHEET} .panel[data-kind='disk']").count() == 1


def test_only_an_administrator_has_the_bin(phone):
    open_camera(phone, admin=False)
    phone.locator(f"{SHEET} [data-disk-open='upright']").click()
    phone.wait_for_selector(f"{SHEET} [data-disk-clip]")
    assert phone.locator(f"{SHEET} [data-remove]").count() == 0


# Pictures of the files -------------------------------------------------------------------------------
CLIP = Path(__file__).parent.parent / "fixtures" / "clip.mp4"
THUMBS = "/custom_components/home_dashboard/www/app/clip-thumbs.js"


def test_a_file_without_a_picture_gets_a_frame_of_its_start(phone):
    phone.route("**/media/*.mp4*", lambda route: route.fulfill(path=str(CLIP), content_type="video/mp4"))
    phone.evaluate("caches.delete('home-dashboard-clip-thumbs')")
    open_disk(phone)
    phone.wait_for_function(f"""() => document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('{SHEET}')
        .shadowRoot.querySelectorAll('[data-disk-thumb]').length === 2""", timeout=20000)
    sources = phone.locator(f"{SHEET} [data-disk-thumb]").evaluate_all("(images) => images.map((image) => image.src)")
    assert all(source.startswith("data:image/jpeg") for source in sources)


def test_a_picture_is_taken_once_and_one_that_failed_is_tried_again(phone):
    asked = phone.evaluate(f"""async () => {{ const t = await import('{THUMBS}'); const taken = [];
        const take = async (url) => {{ taken.push(url); return url === 'bad' ? null : 'data:image/jpeg;base64,x'; }};
        const first = await t.clipThumbnail('a', async () => 'good', take);
        const again = await t.clipThumbnail('a', async () => 'good', take);
        const failed = await t.clipThumbnail('b', async () => 'bad', take);
        await new Promise((resolve) => setTimeout(resolve, 0));
        await t.clipThumbnail('b', async () => 'bad', take);
        return {{ first, again, failed, taken }}; }}""")
    assert asked["first"] == asked["again"] == "data:image/jpeg;base64,x"
    assert asked["failed"] is None
    assert asked["taken"] == ["good", "bad", "bad"]
