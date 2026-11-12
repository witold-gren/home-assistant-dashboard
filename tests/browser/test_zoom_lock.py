"""The dashboard keeps a pinch from enlarging it, and gives zoom back to the rest of Home Assistant when it goes."""

from __future__ import annotations

FREE = "width=device-width, initial-scale=1"
LOCKED = f"{FREE}, maximum-scale=1, user-scalable=no"
MODULE = "/custom_components/home_dashboard/www/app/chrome.js"

SCENARIO = """async ({ module, free, steps }) => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.append(meta); }
    meta.setAttribute('content', free);
    const chrome = await import(module);
    const seen = [];
    for (const step of steps) { chrome[step](); seen.push(meta.getAttribute('content')); }
    return seen;
}"""


def run(page, *steps):
    return page.evaluate(SCENARIO, {"module": MODULE, "free": FREE, "steps": list(steps)})


def test_one_dashboard_locks_and_gives_zoom_back(phone):
    assert run(phone, "lockZoom", "unlockZoom") == [LOCKED, FREE]


def test_a_new_view_built_before_the_old_one_goes_does_not_keep_the_lock(phone):
    # The old view is still there when the new one locks; the old one goes first, then the new one.
    assert run(phone, "lockZoom", "lockZoom", "unlockZoom", "unlockZoom") == [LOCKED, LOCKED, LOCKED, FREE]


def test_more_unlocks_than_locks_change_nothing(phone):
    assert run(phone, "unlockZoom", "lockZoom", "unlockZoom", "unlockZoom") == [FREE, LOCKED, FREE, FREE]


def test_a_lock_left_by_an_older_version_is_not_taken_as_free(phone):
    phone.evaluate("""(locked) => { let meta = document.querySelector('meta[name="viewport"]');
        if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.append(meta); } }""", LOCKED)
    seen = phone.evaluate("""async ({ module, locked }) => {
        const meta = document.querySelector('meta[name="viewport"]');
        meta.setAttribute('content', locked);
        const chrome = await import(module);
        chrome.lockZoom(); chrome.unlockZoom();
        return meta.getAttribute('content'); }""", {"module": MODULE, "locked": LOCKED})
    assert seen == FREE
