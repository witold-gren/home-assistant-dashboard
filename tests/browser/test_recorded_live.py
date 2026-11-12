"""Recorded live views of a battery camera: files the eufy bridge keeps in the media folder, on the line of time."""

from __future__ import annotations

import datetime

from .test_shortcuts import mount_admin

SHEET = "home-dashboard-sheet"
TIMELINE = f"{SHEET} home-dashboard-timeline"
DAYS = f"{SHEET} home-dashboard-recording-days"
TODAY = datetime.date.today()
YESTERDAY = (TODAY - datetime.timedelta(days=1)).isoformat()
LONG_AGO = (TODAY - datetime.timedelta(days=20)).isoformat()
FOLDER = "media-source://media_source/media/eufy/T86P2ABC"

SETUP = """(arg) => {
    const snapshot = window.dashboard.snapshot;
    const area = Object.keys(snapshot.areas)[0];
    snapshot.devices.slup = { id: "slup", name: "Słup", area_id: area, serial_number: "T86P2ABC" };
    const add = (id, state, attributes = {}) => {
        snapshot.entities[id] = { entity_id: id, device_id: "slup", platform: "eufy_sdk", hidden: false };
        snapshot.states[id] = { entity_id: id, state, attributes: { friendly_name: `Słup ${id}`, ...attributes } };
    };
    add("camera.slup", "idle", { entity_picture: "/api/camera_proxy/camera.slup" });
    add("image.slup_last_screen", "2026-11-09T06:26:53", { entity_picture: "/api/image_proxy/image.slup_last_screen" });
    add("switch.slup_record_live", arg.recording ? "on" : "off", arg.path ? { recordings_path: arg.path } : {});
    window.asked = [];
    const file = (day, name) => ({ title: name, media_content_id: `${arg.folder}/${day}/${name}` });
    const original = window.dashboard.hass;
    window.dashboard.hass = (overrides) => original({ ...overrides, callWS: async (message) => {
        window.asked.push(message);
        if (message.type === "media_source/browse_media") {
            const id = message.media_content_id;
            if (id.includes("/local/")) throw { code: "browse_media_failed" };
            if (id === arg.folder) return { children: [{ title: arg.yesterday }, { title: arg.longAgo }, { title: "notes" }] };
            if (id === `${arg.folder}/${arg.yesterday}`)
                return { children: [file(arg.yesterday, "080000-080130.mp4"), file(arg.yesterday, "093000-093045.mp4"),
                                    { title: "readme.txt" }] };
            return { children: [] };
        }
        if (message.type === "media_source/resolve_media") return { url: `/media/${message.media_content_id.split("/").pop()}?authSig=x` };
        return null;
    } });
}"""


def setup(page, recording=True, folder=FOLDER, path=None) -> None:
    page.evaluate(SETUP, {"recording": recording, "folder": folder, "path": path, "yesterday": YESTERDAY,
                          "longAgo": LONG_AGO})


def run(page, body: str):
    return page.evaluate(f"async () => {{ const r = await import('/custom_components/home_dashboard/www/app/recordings.js'); {body} }}")


def open_slup(page, recording=True, **where) -> None:
    setup(page, recording, **where)
    mount_admin(page, {"cameras": {"tiles": ["image.slup_last_screen"]}})
    page.evaluate("""() => document.querySelector('home-dashboard-chrome')
        .open({ type: 'sheet', sheet: { kind: 'camera', entityId: 'image.slup_last_screen' } })""")
    page.wait_for_selector(f"{TIMELINE} .range")


def test_a_file_name_gives_the_span_of_the_recording(phone):
    spans = run(phone, """const at = (h, m, s) => new Date(2026, 10, 9, h, m, s).getTime() / 1000;
        const a = r.fileRange('2026-11-09', { title: '080000-080130.mp4', media_content_id: 'x' });
        const b = r.fileRange('2026-11-09', { title: '235950-000010.mp4', media_content_id: 'y' });
        return [a.start === at(8, 0, 0), a.end === at(8, 1, 30), b.end - b.start, r.fileRange('2026-11-09', { title: 'notes' })];""")
    assert spans == [True, True, 20, None]


def test_a_moment_plays_its_file_from_that_moment_or_the_next_file(phone):
    clips = run(phone, """const ranges = [{ start: 100, end: 190, id: 'a' }, { start: 500, end: 545, id: 'b' }];
        return [r.fileClipAt(ranges, 140.7), r.fileClipAt(ranges, 300), r.fileClipAt(ranges, 600)];""")
    assert clips == [{"start": 100, "end": 190, "id": "a", "offset": 40}, {"start": 500, "end": 545, "id": "b", "offset": 0}, None]


def test_a_camera_with_the_record_switch_has_recorded_live_views(phone):
    setup(phone)
    found = run(phone, "return r.recordedLiveCamera(window.dashboard.hass(), 'camera.slup');")
    assert found == {"sn": "T86P2ABC", "toggle": "switch.slup_record_live"}


def test_a_switch_that_names_its_folder_is_read_from_there(phone):
    # Neolink's switch says where its recordings are; the serial number of the device does not matter then.
    folder = "media-source://media_source/media/neolink/G330"
    open_slup(phone, folder=folder, path="neolink/G330")
    found = run(phone, "return r.recordedLiveCamera(window.dashboard.hass(), 'camera.slup').sn;")
    assert found == "neolink/G330"
    assert phone.locator(f"{TIMELINE} .range").count() == 2
    asked = phone.evaluate("window.asked.filter((m) => m.type === 'media_source/browse_media').map((m) => m.media_content_id)")
    assert f"{folder}/{YESTERDAY}" in asked
    assert not any("/eufy" in id for id in asked)


def test_the_window_shows_the_recorded_files_of_every_day(phone):
    open_slup(phone)
    assert phone.locator(f"{DAYS} [data-recording-day='{YESTERDAY}'].on.has").count() == 1
    days = phone.locator(DAYS).evaluate("(element) => [...element._days]")
    assert sorted(days) == sorted([YESTERDAY, LONG_AGO])
    assert phone.locator(f"{TIMELINE} .range").count() == 2
    asked = phone.evaluate("window.asked.filter((m) => m.type === 'media_source/browse_media').map((m) => m.media_content_id)")
    assert f"{FOLDER}/{YESTERDAY}" in asked


def test_a_moment_inside_a_file_plays_it_from_there(phone):
    open_slup(phone)
    phone.evaluate("""() => document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')
        .shadowRoot.querySelector('home-dashboard-timeline').shadowRoot.querySelector('[data-timeline-track]')
        .scrollLeft = (28840 / 3600) * 360""")
    phone.wait_for_function("window.asked.some((m) => m.type === 'media_source/resolve_media')")
    resolved = phone.evaluate("window.asked.find((m) => m.type === 'media_source/resolve_media').media_content_id")
    assert resolved == f"{FOLDER}/{YESTERDAY}/080000-080130.mp4"
    phone.wait_for_selector(f"{SHEET} video[data-clip]", state="attached")
    assert phone.locator(f"{SHEET} video[data-clip]").get_attribute("src").endswith("080000-080130.mp4?authSig=x")
    clip = phone.evaluate("document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')._clip")
    assert clip["offset"] == 40


def test_live_says_it_records_only_with_the_pill_on_the_picture(phone):
    open_slup(phone)
    assert phone.locator(f"{TIMELINE} [data-timeline-live] [data-rec]").count() == 0
    phone.locator(f"{TIMELINE} [data-timeline-live]").click()
    phone.wait_for_selector(f"{SHEET} .live-pill.recording [data-rec]")
    assert phone.locator(f"{SHEET} [data-corner-live] [data-rec]").count() == 0


def test_with_the_switch_off_there_is_no_red_dot(phone):
    open_slup(phone, recording=False)
    assert phone.locator(f"{TIMELINE} [data-timeline-live] [data-rec]").count() == 0


def resolved_files(page) -> list:
    return page.evaluate(
        "window.asked.filter((m) => m.type === 'media_source/resolve_media').map((m) => m.media_content_id.split('/').pop())"
    )


def test_on_a_phone_on_its_side_the_line_jumps_to_the_previous_and_next_recording(phone):
    phone.set_viewport_size({"width": 874, "height": 402})
    open_slup(phone)
    # On its side the line of time lies put away under the picture until its button brings it out.
    phone.locator(f"{SHEET} [data-open-line]").click()
    skip = f"{TIMELINE} [data-timeline-skip]"
    assert phone.locator(skip).evaluate_all("(buttons) => buttons.map((b) => b.dataset.timelineSkip)") == ["previous", "next"]
    # Another day opens at its last recording: nothing after it, the one before it is there.
    assert phone.locator(f"{skip}[data-timeline-skip='next']").is_disabled()
    phone.locator(f"{skip}[data-timeline-skip='previous']").click()
    phone.wait_for_function("window.asked.some((m) => m.type === 'media_source/resolve_media')")
    assert resolved_files(phone)[-1] == "080000-080130.mp4"
    assert phone.locator(f"{skip}[data-timeline-skip='previous']").is_disabled()
    phone.locator(f"{skip}[data-timeline-skip='next']").click()
    phone.wait_for_function("window.asked.filter((m) => m.type === 'media_source/resolve_media').length > 1")
    assert resolved_files(phone)[-1] == "093000-093045.mp4"


def test_upright_the_line_has_no_jumping_buttons(phone):
    open_slup(phone)
    assert phone.locator(f"{TIMELINE} [data-timeline-skip]").evaluate_all(
        "(buttons) => buttons.map((b) => getComputedStyle(b).display)"
    ) == ["none", "none"]


def test_the_neighbour_of_a_moment_in_a_gap_is_the_recording_on_either_side(phone):
    open_slup(phone)
    neighbours = phone.locator(TIMELINE).evaluate("""(line) => {
        const at = (h, m) => line._ranges[0].start + (h - 8) * 3600 + m * 60;
        const start = (range) => range && Math.round((range.start - line._ranges[0].start) / 60);
        return [start(line.neighbour(at(9, 0), -1)), start(line.neighbour(at(9, 0), 1)),
                start(line.neighbour(at(8, 1), -1)), start(line.neighbour(at(9, 40), 1))];
    }""")
    assert neighbours == [0, 90, None, None]


def test_when_a_file_ends_the_next_one_plays_so_a_cut_viewing_plays_whole(phone):
    phone.set_viewport_size({"width": 874, "height": 402})
    open_slup(phone)
    phone.locator(f"{SHEET} [data-open-line]").click()
    phone.locator(f"{TIMELINE} [data-timeline-skip='previous']").click()
    phone.wait_for_selector(f"{SHEET} video[data-clip]", state="attached")
    assert resolved_files(phone)[-1] == "080000-080130.mp4"
    phone.locator(f"{SHEET} video[data-clip]").dispatch_event("ended")
    phone.wait_for_function("window.asked.filter((m) => m.type === 'media_source/resolve_media').length > 1")
    assert resolved_files(phone)[-1] == "093000-093045.mp4"


def test_every_day_on_the_disk_is_offered_also_weeks_old(phone):
    # Recordings brought down from a camera's card keep the day they were made, often weeks ago.
    setup(phone)
    mount_admin(phone, {"cameras": {"tiles": ["image.slup_last_screen"]}})
    days = run(phone, """const source = r.recordingSource(window.dashboard.hass(), 'image.slup_last_screen', 'camera.slup', { cameras: {} });
        return (await source.days()).sort();""")
    assert days == sorted([YESTERDAY, LONG_AGO])
