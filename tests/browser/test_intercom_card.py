"""The intercom window as a card of its own: whom it goes to, the voice as a live wave, one big button to send."""

from __future__ import annotations

from .test_layout import INTERCOM
from .test_page import mount

SHEET = "home-dashboard-sheet"
CARD = f"{SHEET} home-dashboard-intercom [data-intercom-card]"

# A recorder that hears a voice getting louder, and notes what it was asked.
OPEN = """() => {
    window.recorderLog = [];
    let level = 0;
    const recorder = {
        start: async () => window.recorderLog.push('start'),
        level: () => (level = Math.min(1, level + 0.05)),
        get seconds() { return 3; },
        stop: () => (window.recorderLog.push('stop'), null),
        cancel: () => window.recorderLog.push('cancel'),
    };
    document.querySelector('home-dashboard-chrome').open({ type: 'sheet', sheet: {
        kind: 'intercom', areas: ['area_a'], label: 'Mieszkanie', recorder } });
}"""


def open_card(page) -> None:
    mount(page, {"intercom": {**INTERCOM, "areas": ["area_a"]}})
    page.evaluate(OPEN)
    page.wait_for_selector(f"{CARD}[data-intercom-state='recording']")


def test_the_card_says_whom_it_goes_to_and_draws_the_voice(phone):
    open_card(phone)
    assert phone.locator(f"{CARD} h2").inner_text() == "Do: Mieszkanie"
    assert phone.locator(f"{CARD} .kind").inner_text() == "Interkom"
    assert phone.locator(f"{CARD} .label").inner_text() == "Gotowe"
    # The voice grows louder: the wave turns from dots into lines.
    phone.wait_for_function(f"""() => document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('{SHEET}').shadowRoot.querySelector('home-dashboard-intercom').shadowRoot
        .querySelectorAll('[data-intercom-wave] line:not(.dot)').length > 5""")
    # No header of the window: the card has its own close button.
    assert phone.locator(f"{SHEET} header").count() == 0


def test_done_sends_and_close_cancels(phone):
    open_card(phone)
    phone.locator(f"{CARD} [data-intercom-done]").click()
    assert "stop" in phone.evaluate("window.recorderLog")
    phone.wait_for_selector(f"{CARD}[data-intercom-state='failed']")
    phone.locator(f"{CARD} [data-intercom-cancel]").click()
    phone.wait_for_selector(f"{SHEET} home-dashboard-intercom", state="detached")


# The endpoint of the Intercom integration -------------------------------------------------------------
MODULE = "/custom_components/home_dashboard/www/app/intercom.js"

UPLOAD = """async (arg) => {
    const i = await import('MODULE');
    const sent = [];
    const hass = { language: 'pl', user: { is_admin: arg.admin },
        fetchWithAuth: async (url, init) => { sent.push({ url, type: init.headers['Content-Type'], size: init.body.size, method: init.method });
            return { ok: true, json: async () => arg.answer }; } };
    const config = { intercom: { upload: '/api/intercom/message', media_folder: null } };
    let error = null;
    try { await i.sendRecording(hass, config, ['salon', 'pokój dzieci'], new Blob([new Uint8Array(44)], { type: 'audio/wav' })); }
    catch (e) { error = e.message; }
    return { sent, error };
}""".replace("MODULE", MODULE)


def test_a_recording_goes_to_the_endpoint_which_plays_it(phone):
    result = phone.evaluate(UPLOAD, {"admin": False, "answer": {"played": [{"area": "salon"}], "missing": []}})
    assert result["error"] is None
    assert result["sent"] == [{"url": "/api/intercom/message?areas=salon,pok%C3%B3j%20dzieci", "type": "audio/wav", "size": 44, "method": "POST"}]


def test_nowhere_played_is_an_error(phone):
    result = phone.evaluate(UPLOAD, {"admin": False, "answer": {"played": [], "missing": ["salon"]}})
    assert "głośnik" in result["error"].lower() or result["error"]


def test_with_the_endpoint_anyone_may_record(phone):
    allowed = phone.evaluate(f"""async () => {{ const i = await import('{MODULE}');
        Object.defineProperty(window, 'isSecureContext', {{ value: true, configurable: true }});
        navigator.mediaDevices ??= {{}}; navigator.mediaDevices.getUserMedia ??= async () => null;
        const user = {{ user: {{ is_admin: false }} }};
        return [i.canRecord(user, {{ intercom: {{ upload: '/api/intercom/message', media_folder: null }} }}),
                i.canRecord(user, {{ intercom: {{ upload: null, media_folder: 'media-source://x' }} }}),
                i.canRecord({{ user: {{ is_admin: true }} }}, {{ intercom: {{ upload: null, media_folder: 'media-source://x' }} }})]; }}""")
    assert allowed == [True, False, True]


def test_done_with_the_endpoint_sends_no_service_call(phone):
    mount(phone, {"intercom": {**INTERCOM, "areas": ["area_a"], "upload": "/api/intercom/message"}})
    phone.evaluate("""() => { window.uploads = [];
        const card = document.querySelector('home-dashboard-chrome');
        card.hass = { ...card.hass, fetchWithAuth: async (url, init) => (window.uploads.push(url),
            { ok: true, json: async () => ({ played: [{ area: 'area_a' }], missing: [] }) }) }; }""")
    phone.evaluate(OPEN.replace("stop: () => (window.recorderLog.push('stop'), null)",
                                "stop: () => (window.recorderLog.push('stop'), new Blob([new Uint8Array(44)]))"))
    phone.wait_for_selector(f"{CARD}[data-intercom-state='recording']")
    phone.locator(f"{CARD} [data-intercom-done]").click()
    phone.wait_for_selector(f"{CARD}[data-intercom-state='sent']")
    assert phone.evaluate("window.uploads") == ["/api/intercom/message?areas=area_a"]
    assert [call for call in phone.evaluate("window.hass.calls") if call["type"] == "message"] == []


# The end of a recording -----------------------------------------------------------------------------
RECORD = """async (speak) => {
    const i = await import('/custom_components/home_dashboard/www/app/intercom.js');
    // A made-up microphone: a tone from another audio context.
    const source = new AudioContext();
    const tone = source.createOscillator();
    const out = source.createMediaStreamDestination();
    tone.connect(out); tone.start();
    navigator.mediaDevices.getUserMedia = async () => out.stream;
    const recorder = i.createRecorder(window.dashboard.hass(), { intercom: { upload: '/api/intercom/message' } });
    await recorder.start();
    await new Promise((resolve) => setTimeout(resolve, speak));
    const wav = await recorder.stop();
    if (!wav) return null;
    const view = new DataView(await wav.arrayBuffer());
    return (view.byteLength - 44) / view.getUint32(28, true);
}"""


def test_a_recording_keeps_its_end_after_done(phone):
    # About 1.2 s of voice, then Done: what was said up to the tap is all in the file.
    seconds = phone.evaluate(RECORD, 1200)
    assert seconds is not None
    assert seconds >= 1.6


def test_a_recording_closed_during_its_tail_sends_nothing(phone):
    result = phone.evaluate("""async () => {
        const i = await import('/custom_components/home_dashboard/www/app/intercom.js');
        const source = new AudioContext(); const tone = source.createOscillator();
        const out = source.createMediaStreamDestination(); tone.connect(out); tone.start();
        navigator.mediaDevices.getUserMedia = async () => out.stream;
        const recorder = i.createRecorder(window.dashboard.hass(), { intercom: { upload: '/x' } });
        await recorder.start();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const stopped = recorder.stop();
        recorder.cancel();
        return await stopped; }""")
    assert result is None


def test_closing_the_window_drops_the_recording_at_once(phone):
    open_card(phone)
    phone.evaluate("document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')._close()")
    assert "cancel" in phone.evaluate("window.recorderLog")
