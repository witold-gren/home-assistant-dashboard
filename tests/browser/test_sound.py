"""The sound of a camera window goes through one Web Audio gain, which turns smoothly also on iPhone and iPad."""

from __future__ import annotations

# A stand-in Web Audio API that notes what was connected and how loud the gain is, and videos whose own volume
# cannot be changed, as on iPhone and iPad.
SETUP = """async () => {
    const { createSoundMixer } = await import('/custom_components/home_dashboard/www/app/sound.js');
    const log = { contexts: 0, streamSources: 0, elementSources: 0, resumed: 0, disconnected: 0 };
    class FakeContext {
        constructor() { log.contexts++; this.state = 'suspended'; this.destination = {}; }
        createGain() { const gain = { gain: { value: 1 }, connect() {} }; log.gain = gain; return gain; }
        createMediaStreamSource() { log.streamSources++; return { connect() {}, disconnect() { log.disconnected++; } }; }
        createMediaElementSource() { log.elementSources++; return { connect() {} }; }
        async resume() { log.resumed++; this.state = 'running'; }
        async close() {}
    }
    const fixedVolume = (video) => Object.defineProperty(video, 'volume', { get: () => 1, set: () => {} });
    const live = (tracks) => {
        const video = fixedVolume(document.createElement('video'));
        const stream = { tracks, getAudioTracks: () => stream.tracks };
        video.srcObject = null;
        Object.defineProperty(video, 'srcObject', { value: stream, writable: true });
        return video;
    };
    const clip = (src) => { const video = fixedVolume(document.createElement('video')); video.src = src; return video; };
    window.sound = { createSoundMixer, FakeContext, log, live, clip };
}"""


def run(page, body: str):
    page.evaluate(SETUP)
    return page.evaluate(f"async () => {{ const {{ createSoundMixer, FakeContext, log, live, clip }} = window.sound; {body} }}")


def test_nothing_starts_audio_while_the_sound_is_off(phone):
    result = run(phone, """const mixer = createSoundMixer(FakeContext);
        const video = live([{ id: 'a' }]);
        mixer.apply([video], { muted: true, volume: 1 });
        return { contexts: log.contexts, muted: video.muted };""")
    assert result == {"contexts": 0, "muted": True}


def test_the_live_view_is_heard_through_the_gain_at_any_level(phone):
    result = run(phone, """const mixer = createSoundMixer(FakeContext);
        const video = live([{ id: 'a' }]);
        mixer.resume();
        const levels = [];
        for (const volume of [1, 0.6, 0.25]) { mixer.apply([video], { muted: false, volume }); levels.push(log.gain.gain.value); }
        mixer.apply([video], { muted: true, volume: 0.25 });
        levels.push(log.gain.gain.value);
        return { levels, sources: log.streamSources, videoMuted: video.muted, resumed: log.resumed };""")
    # The video itself stays silent, so the sound is not heard twice; one source however often it is applied.
    assert result == {"levels": [1, 0.6, 0.25, 0], "sources": 1, "videoMuted": True, "resumed": 1}


def test_a_sound_track_that_comes_later_is_taken_then(phone):
    result = run(phone, """const mixer = createSoundMixer(FakeContext);
        const video = live([]);
        mixer.resume();
        mixer.apply([video], { muted: false, volume: 0.5 });
        const before = log.streamSources;
        video.srcObject.tracks = [{ id: 'a' }];
        mixer.apply([video], { muted: false, volume: 0.5 });
        video.srcObject.tracks = [{ id: 'b' }];
        mixer.apply([video], { muted: false, volume: 0.5 });
        return { before, after: log.streamSources, disconnected: log.disconnected };""")
    assert result == {"before": 0, "after": 2, "disconnected": 1}


def test_a_recording_is_heard_through_the_gain_and_its_video_left_unmuted(phone):
    result = run(phone, """const mixer = createSoundMixer(FakeContext);
        const video = clip('/media/a.mp4');
        mixer.resume();
        mixer.apply([video], { muted: false, volume: 0.3 });
        mixer.apply([video], { muted: false, volume: 0.4 });
        return { sources: log.elementSources, level: log.gain.gain.value, muted: video.muted };""")
    assert result == {"sources": 1, "level": 0.4, "muted": False}


def test_a_playlist_played_natively_keeps_the_mute_of_the_video(phone):
    result = run(phone, """const mixer = createSoundMixer(FakeContext);
        const video = clip('/api/hls/x/master_playlist.m3u8');
        mixer.resume();
        mixer.apply([video], { muted: false, volume: 0.5 });
        const heard = video.muted;
        mixer.apply([video], { muted: true, volume: 0.5 });
        return { sources: log.elementSources + log.streamSources, heard, silenced: video.muted };""")
    assert result == {"sources": 0, "heard": False, "silenced": True}


def test_without_web_audio_the_volume_cannot_be_set(phone):
    result = run(phone, """const mixer = createSoundMixer(null);
        const video = clip('/media/a.mp4');
        mixer.apply([video], { muted: false, volume: 0.5 });
        return { adjustable: mixer.adjustable, muted: video.muted };""")
    assert result == {"adjustable": False, "muted": False}
