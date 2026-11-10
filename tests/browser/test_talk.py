"""Talking in a camera window: the room's intercom, or the camera's own speaker through the eufy-sdk integration."""

from __future__ import annotations

from .test_shortcuts import mount_admin

SHEET = "home-dashboard-sheet"

SETUP = """(arg) => {
    const snapshot = window.dashboard.snapshot;
    const area = Object.keys(snapshot.areas)[0];
    snapshot.devices.nvr = { id: "nvr", name: "Korytarz NVR", area_id: area };
    snapshot.devices.eufy = { id: "eufy", name: "Korytarz", area_id: area, serial_number: "T8410ABC" };
    const add = (id, device, platform, state = "idle", attributes = {}) => {
        snapshot.entities[id] = { entity_id: id, device_id: device, platform, hidden: false };
        snapshot.states[id] = { entity_id: id, state, attributes: { friendly_name: id, ...attributes } };
    };
    add("camera.hall_nvr", "nvr", "frigate", "idle", { camera_name: "hall", client_id: "frigate", entity_picture: "/api/camera_proxy/camera.hall_nvr" });
    add("camera.hall", "eufy", "eufy_sdk");
    if (arg.speaker) add("switch.hall_speaker", "eufy", "eufy_sdk", "on");
}"""

CONFIG = {"cameras": {"tiles": ["camera.hall_nvr"], "controls": {"camera.hall_nvr": "camera.hall"}, "talk": "camera"}}


def run(page, body: str, config=None):
    return page.evaluate(
        f"""async (config) => {{ const t = await import('/custom_components/home_dashboard/www/app/talk.js');
        const {{ model, hass }} = window.dashboard; const instance = hass(); const cfg = model.normalizeConfig(config);
        {body} }}""",
        config or CONFIG,
    )


def test_a_camera_whose_eufy_device_has_a_speaker_can_be_talked_through(phone):
    phone.evaluate(SETUP, {"speaker": True})
    found = {"path": "/api/eufy_sdk/talk/T8410ABC", "speaker": "switch.hall_speaker"}
    assert run(phone, "return t.cameraSpeaker(instance, 'camera.hall_nvr', cfg);") == found
    assert run(phone, "return t.cameraSpeaker(instance, 'camera.hall', cfg);") == found


def test_without_a_speaker_there_is_nothing_to_talk_through(phone):
    phone.evaluate(SETUP, {"speaker": False})
    assert run(phone, "return t.cameraSpeaker(instance, 'camera.hall_nvr', cfg);") is None


def test_the_setting_picks_the_way_and_falls_back_to_the_intercom(phone):
    phone.evaluate(SETUP, {"speaker": True})
    modes = run(phone, """const room = { id: 'x', name: 'Korytarz' };
        const intercom = model.normalizeConfig({ ...config, cameras: { ...config.cameras, talk: 'intercom' } });
        const elsewhere = Object.keys(instance.states).find((id) => id.startsWith('light.'));
        return [t.talkMode(instance, 'camera.hall_nvr', cfg, { room }).kind,
                t.talkMode(instance, 'camera.hall_nvr', intercom, { room }).kind,
                t.talkMode(instance, elsewhere, cfg, { room }).kind,
                t.talkMode(instance, elsewhere, cfg, {})];""")
    assert modes == ["camera", "intercom", "intercom", None]


def test_the_microphone_becomes_16_bit_pcm(phone):
    pcm = phone.evaluate("""async () => {
        const t = await import('/custom_components/home_dashboard/www/app/talk.js');
        return [...new Int16Array(t.toPcm16(new Float32Array([0, 1, -1, 0.5, 2])))]; }""")
    assert pcm == [0, 32767, -32768, 16383, 32767]


FAKES = """
    window.events = [];
    const track = { stop: () => window.events.push('track stopped') };
    const stream = { getTracks: () => [track] };
    window.fakeMedia = { getUserMedia: async () => { window.events.push('mic'); return stream; } };
    window.FakeContext = class {
        constructor() { this.sampleRate = 48000; this.audioWorklet = { addModule: async () => window.events.push('worklet') }; }
        createMediaStreamSource() { return { connect: (node) => { window.capture = node; window.events.push('connected'); } }; }
        close() { window.events.push('context closed'); }
    };
    window.FakeNode = class { constructor() { this.port = {}; } };
    window.FakeSocket = class {
        constructor(url) { window.socket = this; this.url = url; this.readyState = 0; window.events.push(`socket ${url}`);
            setTimeout(() => { this.readyState = 1; this.onopen?.(); }, 5); }
        send(data) { window.events.push(typeof data === 'string' ? `send ${data}` : `send ${data.byteLength} bytes`); }
        close() { window.events.push('socket closed'); this.readyState = 3; }
    };
    window.fakeHass = { callWS: async (m) => { window.events.push(`sign ${m.path}`); return { path: `${m.path}&authSig=x` }; },
        hassUrl: (p) => `http://ha.local:8123${p}` };
    window.options = (extra = {}) => ({ media: window.fakeMedia, AudioContextImpl: window.FakeContext,
        WebSocketImpl: window.FakeSocket, WorkletNodeImpl: window.FakeNode, ...extra });
"""


def test_talking_streams_the_microphone_to_the_integration_and_stops_cleanly(phone):
    events = phone.evaluate(f"""async () => {{ {FAKES}
        const t = await import('/custom_components/home_dashboard/www/app/talk.js');
        const session = await t.startCameraTalk(window.fakeHass, '/api/eufy_sdk/talk/T8410ABC', window.options());
        window.capture.port.onmessage({{ data: new Float32Array(128) }});
        session.stop();
        return window.events; }}""")
    assert events == [
        "mic", "worklet", "sign /api/eufy_sdk/talk/T8410ABC?rate=48000",
        "socket ws://ha.local:8123/api/eufy_sdk/talk/T8410ABC?rate=48000&authSig=x", "connected",
        "send 256 bytes", "send stop", "track stopped", "context closed",
    ]


def test_the_camera_side_ending_the_talk_is_reported(phone):
    reason = phone.evaluate(f"""async () => {{ {FAKES}
        const t = await import('/custom_components/home_dashboard/www/app/talk.js');
        let ended;
        await t.startCameraTalk(window.fakeHass, '/api/eufy_sdk/talk/T8410ABC', window.options({{ onEnd: (r) => (ended = r) }}));
        window.socket.onmessage({{ data: JSON.stringify({{ ok: false, error: 'busy' }}) }});
        return [ended, window.events.includes('track stopped')]; }}""")
    assert reason == ["busy", True]


def test_no_microphone_says_so(phone):
    reason = phone.evaluate("""async () => {
        const t = await import('/custom_components/home_dashboard/www/app/talk.js');
        try { await t.startCameraTalk({}, '/api/eufy_sdk/talk/T8410ABC', { media: { getUserMedia: async () => { throw new Error('denied'); } } }); }
        catch (error) { return error.reason; } }""")
    assert reason == "microphone"


SHEET_JS = "document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')"


def see_live(page) -> None:
    """The live view runs and its video moves, as once a camera has woken."""
    page.evaluate(f"async () => {{ const sheet = {SHEET_JS}; sheet._live = true; sheet._liveShown = true; await sheet.updateComplete; }}")


def open_hall(page) -> None:
    page.evaluate(SETUP, {"speaker": True})
    mount_admin(page, CONFIG)
    page.evaluate("""() => document.querySelector('home-dashboard-chrome')
        .open({ type: 'sheet', sheet: { kind: 'camera', entityId: 'camera.hall_nvr' } })""")
    page.wait_for_selector(f"{SHEET} .stage [data-camera-talk]")


def test_nobody_is_talked_to_before_they_can_be_seen(phone):
    open_hall(phone)
    button = phone.locator(f"{SHEET} [data-camera-talk]")
    assert button.is_disabled()
    assert "podglądu na żywo" in button.get_attribute("aria-label")
    # Live, but the camera still wakes: still nobody to see.
    phone.evaluate(f"async () => {{ const sheet = {SHEET_JS}; sheet._live = true; await sheet.updateComplete; }}")
    assert button.is_disabled()
    see_live(phone)
    assert button.is_enabled()


def test_the_end_of_the_live_view_ends_the_talk(phone):
    open_hall(phone)
    stopped = phone.evaluate(f"""async () => {{ const sheet = {SHEET_JS};
        let stopped = 0;
        sheet._talking = {{ stop: () => (stopped += 1) }};
        sheet._live = true; sheet._liveShown = true; await sheet.updateComplete;
        sheet._stopLive(); await sheet.updateComplete;
        return [stopped, sheet._talking]; }}""")
    assert stopped == [1, None]


def test_the_window_has_one_talk_button_for_the_camera_speaker(phone):
    phone.evaluate(SETUP, {"speaker": True})
    mount_admin(phone, CONFIG)
    phone.evaluate("""() => document.querySelector('home-dashboard-chrome')
        .open({ type: 'sheet', sheet: { kind: 'camera', entityId: 'camera.hall_nvr' } })""")
    phone.wait_for_selector(f"{SHEET} .stage [data-camera-talk]")
    assert phone.locator(f"{SHEET} [data-voice]").count() == 0
    see_live(phone)
    # Without a microphone the window says why instead of failing silently.
    phone.evaluate("""() => Object.defineProperty(navigator, 'mediaDevices', { configurable: true,
        value: { getUserMedia: async () => { throw new Error('denied'); } } })""")
    phone.locator(f"{SHEET} [data-camera-talk]").click()
    phone.wait_for_selector(f"{SHEET} [data-talk-problem]")
    assert "mikrofonu" in phone.locator(f"{SHEET} [data-talk-problem]").inner_text()


def test_the_settings_choose_who_talks(phone):
    mount_admin(phone, {"cameras": {"tiles": []}})
    phone.evaluate("""async () => {
        const chrome = document.querySelector("home-dashboard-chrome");
        chrome.open({ type: "settings" });
        await chrome.updateComplete;
    }""")
    assert phone.locator("[data-talk]").input_value() == "intercom"
    phone.locator("[data-talk]").select_option("camera")
    draft = phone.evaluate("""() => document.querySelector("home-dashboard-chrome").shadowRoot
        .querySelector("home-dashboard-settings")._draft.cameras""")
    assert draft["talk"] == "camera" and draft["tiles"] == []


def test_any_integration_offers_its_speaker_with_a_talk_path(phone):
    phone.evaluate(SETUP, {"speaker": False})
    phone.evaluate("""() => {
        const snapshot = window.dashboard.snapshot;
        snapshot.devices.reolink = { id: "reolink", name: "Brama", area_id: null };
        snapshot.entities["camera.brama"] = { entity_id: "camera.brama", device_id: "reolink", platform: "neolink", hidden: false };
        snapshot.states["camera.brama"] = { entity_id: "camera.brama", state: "idle", attributes: {} };
        snapshot.entities["switch.brama_speaker"] = { entity_id: "switch.brama_speaker", device_id: "reolink", platform: "neolink", hidden: false };
        snapshot.states["switch.brama_speaker"] = { entity_id: "switch.brama_speaker", state: "on",
            attributes: { talk_path: "/api/neolink/talk/brama" } };
    }""")
    found = run(phone, "return t.cameraSpeaker(instance, 'camera.brama', cfg);")
    assert found == {"path": "/api/neolink/talk/brama", "speaker": "switch.brama_speaker"}


def test_a_path_with_a_query_gets_the_rate_appended(phone):
    events = phone.evaluate(f"""async () => {{ {FAKES}
        const t = await import('/custom_components/home_dashboard/www/app/talk.js');
        const session = await t.startCameraTalk(window.fakeHass, '/api/x/talk?camera=1', window.options());
        session.stop();
        return window.events; }}""")
    assert "sign /api/x/talk?camera=1&rate=48000" in events


def test_each_camera_can_choose_how_it_talks(phone):
    phone.evaluate(SETUP, {"speaker": True})
    modes = run(phone, """const room = { id: 'x', name: 'Korytarz' };
        const per = (way) => model.normalizeConfig({ ...config, cameras: { ...config.cameras, talk_with: { 'camera.hall_nvr': way } } });
        const kind = (mode) => mode && (mode.speaker?.go2rtc ? `go2rtc:${mode.speaker.go2rtc}` : mode.kind);
        return [kind(t.talkMode(instance, 'camera.hall_nvr', per('go2rtc'), { room })),
                kind(t.talkMode(instance, 'camera.hall_nvr', per('intercom'), { room })),
                kind(t.talkMode(instance, 'camera.hall_nvr', per('none'), { room })),
                kind(t.talkMode(instance, 'camera.hall_nvr', per('auto'), { room }))];""")
    # go2rtc talks to the camera the window is linked to (cameras.controls), which is the one with the speaker.
    assert modes == ["go2rtc:camera.hall", "intercom", None, "camera"]


GO2RTC_FAKES = """
    window.events = [];
    const track = { stop: () => window.events.push('track stopped') };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
    window.fakeMedia = { getUserMedia: async () => { window.events.push('mic'); return stream; } };
    window.FakePeer = class {
        constructor() { window.peer = this; }
        addTransceiver(track, init) { window.events.push(`transceiver ${init.direction}`); }
        async createOffer() { return { type: 'offer', sdp: 'v=0 offer' }; }
        async setLocalDescription() { setTimeout(() => this.onicecandidate?.({ candidate: { candidate: 'c1', sdpMid: '0' } }), 0); }
        async setRemoteDescription(answer) { window.events.push(`answer ${answer.sdp}`); }
        async addIceCandidate(candidate) { window.events.push(`remote candidate ${candidate.candidate}`); }
        close() { window.events.push('peer closed'); }
    };
    window.fakeHass = {
        callWS: async (m) => { window.events.push(`${m.type} ${m.session_id} ${m.candidate.candidate}`); },
        connection: { subscribeMessage: async (callback, message) => {
            window.events.push(`${message.type} ${message.entity_id} ${message.offer}`);
            setTimeout(() => { callback({ type: 'session', session_id: 's1' });
                callback({ type: 'candidate', candidate: { candidate: 'c2', sdpMid: '0' } });
                callback({ type: 'answer', answer: 'v=0 answer' }); }, 5);
            return () => window.events.push('unsubscribed'); } },
    };
"""


def test_go2rtc_talk_offers_only_the_microphone_and_trades_candidates(phone):
    events = phone.evaluate(f"""async () => {{ {GO2RTC_FAKES}
        const t = await import('/custom_components/home_dashboard/www/app/talk.js');
        const session = await t.startGo2rtcTalk(window.fakeHass, 'camera.brama',
            {{ media: window.fakeMedia, PeerConnectionImpl: window.FakePeer }});
        await new Promise((resolve) => setTimeout(resolve, 20));
        session.stop();
        return window.events; }}""")
    assert events[:3] == ["mic", "transceiver sendonly", "camera/webrtc/offer camera.brama v=0 offer"]
    # Our candidate waits for the session Home Assistant names, then goes out with it.
    assert "camera/webrtc/candidate s1 c1" in events
    assert "remote candidate c2" in events
    assert "answer v=0 answer" in events
    assert events[-3:] == ["track stopped", "peer closed", "unsubscribed"]


def test_go2rtc_talk_reports_an_error_of_home_assistant(phone):
    reason = phone.evaluate(f"""async () => {{ {GO2RTC_FAKES}
        window.fakeHass.connection.subscribeMessage = async (callback) => {{
            setTimeout(() => callback({{ type: 'error', code: 'webrtc_offer_failed', message: 'no' }}), 5); return () => {{}}; }};
        const t = await import('/custom_components/home_dashboard/www/app/talk.js');
        try {{ await t.startGo2rtcTalk(window.fakeHass, 'camera.brama', {{ media: window.fakeMedia, PeerConnectionImpl: window.FakePeer }}); }}
        catch (error) {{ return error.reason; }}
        return 'started'; }}""")
    assert reason == "failed"


def test_states_on_the_way_are_passed_on_and_only_the_outcome_ends_the_talk(phone):
    result = phone.evaluate(f"""async () => {{ {FAKES}
        const t = await import('/custom_components/home_dashboard/www/app/talk.js');
        const states = [];
        let ended = 'not yet';
        await t.startCameraTalk(window.fakeHass, '/api/neolink/talk/G330',
            window.options({{ onState: (state) => states.push(state), onEnd: (reason) => (ended = reason) }}));
        window.socket.onmessage({{ data: JSON.stringify({{ state: 'connecting' }}) }});
        window.socket.onmessage({{ data: JSON.stringify({{ state: 'connected' }}) }});
        const during = ended;
        window.socket.onmessage({{ data: JSON.stringify({{ ok: false, error: 'busy' }}) }});
        return {{ states, during, ended }}; }}""")
    assert result == {"states": ["connecting", "connected"], "during": "not yet", "ended": "busy"}
