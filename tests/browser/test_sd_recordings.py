"""Recordings on a camera's own card (`sd_recordings`): listed by day in their own window, brought down to the disk on
a tap, and one already on the disk shown on the line of time."""

from __future__ import annotations

from .test_recorded_live import SETUP, YESTERDAY
from .test_shortcuts import mount_admin

SHEET = "home-dashboard-sheet"
OLDER = "2026-05-02"

CARD = """(arg) => {
    const snapshot = window.dashboard.snapshot;
    snapshot.states["camera.slup"].attributes.sd_recordings = { list: "neolink/sd_recordings", download: "neolink/sd_download" };
    const clip = (day, from, to, extra = {}) => ({ file: `${day}/${from.replaceAll(":", "")}-${to.replaceAll(":", "")}.mp4`,
        start: `${day}T${from}`, end: `${day}T${to}`, kinds: "pir, people", size: 1000, local: false, downloading: false,
        thumbnail: null, ...extra });
    window.cardClips = [
        clip(arg.older, "10:00:00", "10:00:30", { thumbnail: "/api/neolink/sd_thumbnail/a?authSig=x" }),
        clip(arg.yesterday, "08:00:00", "08:01:30", { local: true, thumbnail: "/api/neolink/sd_thumbnail/b?authSig=x" }),
        clip(arg.yesterday, "12:25:59", "12:26:09"),
    ];
    const asked = window.asked;
    const hass = window.dashboard.hass;
    window.dashboard.hass = (overrides) => {
        const base = hass(overrides);
        const callWS = base.callWS;
        return { ...base, callWS: async (message) => {
            if (message.type === "neolink/sd_recordings") {
                asked.push(message);
                return { updated: "2026-11-11T10:00:00", refreshing: !message.refresh && false, error: null, recordings: window.cardClips };
            }
            if (message.type === "neolink/sd_download") {
                asked.push(message);
                return { started: true };
            }
            return callWS(message);
        } };
    };
}"""


def open_card(page, with_card: bool = True) -> None:
    page.evaluate(SETUP, {"recording": True, "folder": "media-source://media_source/media/eufy/T86P2ABC", "path": None,
                          "yesterday": YESTERDAY, "longAgo": OLDER})
    if with_card:
        page.evaluate(CARD, {"yesterday": YESTERDAY, "older": OLDER})
    mount_admin(page, {"cameras": {"tiles": ["image.slup_last_screen"]}})
    page.evaluate("""() => document.querySelector('home-dashboard-chrome')
        .open({ type: 'sheet', sheet: { kind: 'camera', entityId: 'image.slup_last_screen' } })""")
    page.wait_for_selector(f"{SHEET} home-dashboard-timeline", state="attached")


def asked(page, kind: str) -> list:
    return page.evaluate(f"window.asked.filter((m) => m.type === '{kind}')")


def open_sd(page) -> None:
    open_card(page)
    page.locator(f"{SHEET} [data-sd-open]").click()
    page.wait_for_selector(f"{SHEET} [data-sd-clip]")


def test_only_a_camera_that_keeps_recordings_on_its_card_has_the_button(phone):
    open_card(phone, with_card=False)
    assert phone.locator(f"{SHEET} [data-sd-open]").count() == 0


def test_the_recordings_stand_by_day_newest_first_and_the_card_is_asked_once(phone):
    open_sd(phone)
    days = phone.locator(f"{SHEET} [data-sd-day]").evaluate_all("(days) => days.map((day) => day.dataset.sdDay)")
    assert days == [YESTERDAY, OLDER]
    clips = phone.locator(f"{SHEET} [data-sd-day='{YESTERDAY}'] [data-sd-clip]").evaluate_all(
        "(clips) => clips.map((clip) => clip.dataset.sdClip)")
    assert clips == [f"{YESTERDAY}/122559-122609.mp4", f"{YESTERDAY}/080000-080130.mp4"]
    lists = asked(phone, "neolink/sd_recordings")
    assert [message["refresh"] for message in lists[:2]] == [False, True]
    assert all(message["entity_id"] == "camera.slup" for message in lists)
    assert "Lista z" in phone.locator(f"{SHEET} [data-sd-status]").inner_text()


def test_a_tap_brings_a_recording_down_and_it_shows_as_coming(phone):
    open_sd(phone)
    file = f"{YESTERDAY}/122559-122609.mp4"
    phone.locator(f"{SHEET} [data-sd-download='{file}']").click()
    phone.wait_for_selector(f"{SHEET} [data-sd-busy='{file}']")
    assert asked(phone, "neolink/sd_download") == [{"type": "neolink/sd_download", "entity_id": "camera.slup", "files": [file]}]
    # The list says what happened next: on the disk, with the green mark.
    phone.evaluate(f"window.cardClips.find((clip) => clip.file === '{file}').local = true")
    phone.wait_for_selector(f"{SHEET} [data-sd-local='{file}']", timeout=8000)


def test_a_recording_on_the_disk_opens_the_line_of_time_at_it(phone):
    open_sd(phone)
    phone.locator(f"{SHEET} [data-sd-local='{YESTERDAY}/080000-080130.mp4']").click()
    phone.wait_for_selector(f"{SHEET} .panel[data-kind='camera']")
    phone.wait_for_function("window.asked.some((m) => m.type === 'media_source/resolve_media')", timeout=10000)
    resolved = phone.evaluate(
        "window.asked.filter((m) => m.type === 'media_source/resolve_media').map((m) => m.media_content_id.split('/').pop())")
    assert resolved[-1] == "080000-080130.mp4"


def test_pictures_are_asked_for_the_recordings_in_sight(phone):
    open_sd(phone)
    phone.wait_for_function(
        "window.asked.some((m) => m.type === 'neolink/sd_recordings' && (m.thumbnails ?? []).length)", timeout=8000)
    wanted = [message.get("thumbnails") for message in asked(phone, "neolink/sd_recordings") if message.get("thumbnails")]
    assert wanted[0] == [f"{YESTERDAY}/122559-122609.mp4"]


def test_the_window_goes_back_to_the_camera(phone):
    open_sd(phone)
    phone.locator(f"{SHEET} [data-back]").click()
    phone.wait_for_selector(f"{SHEET} .panel[data-kind='camera']")


def test_a_day_comes_down_whole_with_one_tap_oldest_first(phone):
    open_sd(phone)
    day = f"{SHEET} [data-sd-day='{YESTERDAY}']"
    # One of the two is on the disk already: only the other is asked for.
    assert phone.locator(f"{day} [data-sd-day-download]").text_content().strip() == "1"
    phone.locator(f"{day} [data-sd-day-download]").click()
    assert asked(phone, "neolink/sd_download")[-1]["files"] == [f"{YESTERDAY}/122559-122609.mp4"]
    phone.wait_for_selector(f"{day} [data-sd-day-busy]")
    # Once all of it is on the disk, the day says so.
    phone.evaluate(f"window.cardClips.find((clip) => clip.file === '{YESTERDAY}/122559-122609.mp4').local = true")
    phone.wait_for_selector(f"{day} [data-sd-day-done]", timeout=8000)


def test_the_copy_on_the_disk_is_deleted_and_the_card_kept(phone):
    open_sd(phone)
    local = f"{SHEET} [data-sd-clip='{YESTERDAY}/080000-080130.mp4']"
    phone.locator(f"{local} [data-remove]").click()
    phone.locator(f"{SHEET} [data-remove-yes]").click()
    phone.wait_for_function("window.asked.some((m) => m.type === 'media_source/local_source/remove')")
    removed = [m["media_content_id"] for m in phone.evaluate("window.asked") if m.get("type") == "media_source/local_source/remove"]
    assert removed == [f"media-source://media_source/media/eufy/T86P2ABC/{YESTERDAY}/080000-080130.mp4"]
    # Nothing asked of the card itself.
    assert asked(phone, "neolink/sd_download") == []


def test_a_copy_the_camera_turned_down_stops_turning_and_says_why(phone):
    # The camera refuses (busy with a live view): the recording never shows as coming, nor on the disk.
    phone.clock.install()
    open_sd(phone)
    file = f"{YESTERDAY}/122559-122609.mp4"
    phone.locator(f"{SHEET} [data-sd-download='{file}']").click()
    phone.wait_for_selector(f"{SHEET} [data-sd-busy='{file}']")
    phone.clock.run_for(25_000)
    phone.wait_for_selector(f"{SHEET} [data-sd-download='{file}']")
    assert "zajęta podglądem" in phone.locator(f"{SHEET} .panel").inner_text()


def test_a_copy_waiting_behind_another_one_is_not_given_up(phone):
    phone.clock.install()
    open_sd(phone)
    file = f"{YESTERDAY}/122559-122609.mp4"
    phone.locator(f"{SHEET} [data-sd-download='{file}']").click()
    phone.evaluate(f"window.cardClips.find((clip) => clip.file.startsWith('{OLDER}')).downloading = true")
    phone.clock.run_for(25_000)
    assert phone.locator(f"{SHEET} [data-sd-busy='{file}']").count() == 1
