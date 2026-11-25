"""A block of text (`kind: text`): sections of text from entities — here the readings of the day and a plain quote —
its badge, its window and reading it aloud on a speaker or through a script."""

from __future__ import annotations

import os

from .test_page import mount
from .test_panels import add_entity

SCREEN = "home-dashboard-text-block"
P = "sensor.readings"
BLOCK = {
    "kind": "text",
    "name": "Słowo Boże",
    "icon": "mdi:book-cross",
    "heading": f"{P}_day",
    "label_entity": f"{P}_gospel",
    "sections": [
        {"entity": f"{P}_first", "name": "Pierwsze czytanie"},
        {"entity": f"{P}_psalm", "name": "Psalm"},
        {"entity": f"{P}_second", "name": "Drugie czytanie"},
        {"entity": f"{P}_gospel", "name": "Ewangelia", "read": True},
    ],
}


def add_day(page, sunday: bool = False) -> None:
    add_entity(page, f"{P}_day", "Czwartek XXXIII tygodnia Okresu Zwykłego", {"data": "2026-11-19"})
    add_entity(
        page,
        f"{P}_first",
        "Ap 5, 1-10",
        {
            "tytul": "Bóg wręcza Barankowi księgę",
            "wstep": "Czytanie z Apokalipsy Świętego Jana Apostoła",
            "akapity": ["Ja, Jan, ujrzałem księgę.", "I ujrzałem anioła."],
            "zakonczenie": "Oto słowo Boże.",
            "attribution": "Źródło: test",
        },
    )
    add_entity(
        page,
        f"{P}_psalm",
        "Ps 149",
        {
            "refren": "Tyś nas uczynił kapłanami Boga.",
            "refren_zamienny": "Alleluja.",
            "akapity": ["Śpiewajcie Panu pieśń nową, *\ngłoście Jego chwałę."],
        },
    )
    add_entity(
        page,
        f"{P}_second",
        "1 Kor 15" if sunday else "brak",
        {"akapity": ["Bracia: Chrystus zmartwychwstał."]} if sunday else {},
    )
    add_entity(
        page,
        f"{P}_gospel",
        "Łk 19, 41-44",
        {
            "tytul": "Zapowiedź zburzenia Jerozolimy",
            "wstep": "Słowa Ewangelii według Świętego Łukasza",
            "akapity": ["Gdy Jezus był już blisko Jerozolimy, zapłakał nad nim: «O gdybyś i ty poznało»"],
            "zakonczenie": "Oto słowo Pańskie.",
        },
    )


def open_block(page, block: dict | None = None, sunday: bool = False) -> None:
    add_day(page, sunday)
    mount(page, {"shortcuts": [block or BLOCK]})
    page.locator("home-dashboard-page [data-shortcut='Słowo Boże']").click()
    page.wait_for_selector(f"home-dashboard-sheet {SCREEN} [data-text-section]")


def choose(page, mode: str) -> None:
    page.locator(f"{SCREEN} [data-text-mode='{mode}']").click()


def set_state(page, entity: str, state: str, attributes: dict | None = None) -> None:
    page.locator(SCREEN).evaluate(
        """(screen, [id, state, attributes]) => {
            const states = { ...screen.hass.states, [id]: { entity_id: id, state, attributes } };
            screen.hass = Object.assign(Object.create(screen.hass), { states });
        }""",
        [entity, state, attributes or {}],
    )


def sections(page) -> list:
    return page.locator(f"{SCREEN} [data-text-section]").evaluate_all(
        "(all) => all.map((s) => s.dataset.textSection)"
    )


def test_the_badge_shows_the_state_of_its_label_entity(phone):
    add_day(phone)
    mount(phone, {"shortcuts": [BLOCK]})
    badge = phone.locator("home-dashboard-page [data-shortcut='Słowo Boże']")
    assert badge.locator("[data-shortcut-label]").inner_text() == "Łk 19, 41-44"


def test_a_block_with_none_of_its_entities_is_not_shown(phone):
    mount(phone, {"shortcuts": [BLOCK]})
    phone.wait_for_selector("home-dashboard-page [data-chip]", state="attached")
    assert phone.locator("home-dashboard-page [data-shortcut='Słowo Boże']").count() == 0


def test_the_window_shows_the_heading_and_each_section_with_its_text(phone):
    open_block(phone)
    heading = phone.locator(f"{SCREEN} [data-text-heading]").inner_text()
    assert "Czwartek XXXIII tygodnia Okresu Zwykłego" in heading and "19 listopada" in heading
    # The section without text („brak”, a weekday) is left out
    assert sections(phone) == [f"{P}_first", f"{P}_psalm", f"{P}_gospel"]
    first = phone.locator(f"{SCREEN} [data-text-section='{P}_first']").inner_text()
    assert "Ap 5, 1-10" in first and "Czytanie z Apokalipsy" in first and "Oto słowo Boże." in first
    refrain = phone.locator(f"{SCREEN} [data-text-section='{P}_psalm'] [data-text-refrain]").inner_text()
    assert "Tyś nas uczynił kapłanami Boga." in refrain and "albo: Alleluja." in refrain
    # Lines keep their breaks, without the caesura of a psalm
    verses = phone.locator(f"{SCREEN} [data-text-section='{P}_psalm'] p:not(.refrain)").first.inner_text()
    assert verses == "Śpiewajcie Panu pieśń nową,\ngłoście Jego chwałę."
    assert "Źródło: test" in phone.locator(f"{SCREEN} .source").inner_text()
    # Without a speaker only listening on this device is offered: the Gospel by itself and everything
    assert phone.locator(f"{SCREEN} [data-text-read]").count() == 0
    assert phone.locator(f"{SCREEN} [data-text-read-here]").count() == 1
    listen = phone.locator(f"{SCREEN} [data-text-listen]")
    assert listen.evaluate_all("(all) => all.map((b) => b.dataset.textListen)") == [f"{P}_gospel", "all"]
    assert [text.strip() for text in listen.all_inner_texts()] == ["Czytaj: Ewangelia", "Czytaj całość"]


def test_listen_here_can_be_hidden(phone):
    open_block(phone, {**BLOCK, "hide_read_here": True})
    assert phone.locator(f"{SCREEN} [data-text-actions]").count() == 0


def test_a_sunday_has_its_second_section(phone):
    open_block(phone, sunday=True)
    assert sections(phone) == [f"{P}_first", f"{P}_psalm", f"{P}_second", f"{P}_gospel"]


def test_any_entity_shows_its_state_as_the_text(phone):
    add_entity(
        phone, "sensor.quote", "Wszystko mogę w Tym, który mnie umacnia.", {"friendly_name": "Myśl na dziś"}
    )
    mount(
        phone,
        {
            "shortcuts": [
                {
                    "kind": "text",
                    "name": "Myśl",
                    "icon": "mdi:format-quote-open",
                    "sections": [{"entity": "sensor.quote"}],
                }
            ]
        },
    )
    phone.locator("home-dashboard-page [data-shortcut='Myśl']").click()
    phone.wait_for_selector(f"home-dashboard-sheet {SCREEN} [data-text-section]")
    section = phone.locator(f"{SCREEN} [data-text-section='sensor.quote']")
    assert section.locator("h3").inner_text().lower() == "myśl na dziś"
    assert "Wszystko mogę w Tym, który mnie umacnia." in section.inner_text()
    assert section.locator("[data-text-reference]").count() == 0


def test_a_speaker_reads_one_section_or_everything(phone):
    open_block(phone, {**BLOCK, "speaker": "media_player.kitchen", "tts": "tts.piper"})
    choose(phone, "speaker")
    phone.locator(f"{SCREEN} [data-text-read='{P}_gospel']").click()
    phone.wait_for_function("window.hass.calls.some((call) => call.domain === 'tts')")
    call = phone.evaluate("window.hass.calls.find((call) => call.domain === 'tts')")
    assert (
        call["data"]["entity_id"] == "tts.piper"
        and call["data"]["media_player_entity_id"] == "media_player.kitchen"
    )
    message = call["data"]["message"]
    assert message.startswith("Słowa Ewangelii według Świętego Łukasza.\nGdy Jezus")
    assert message.endswith("Oto słowo Pańskie.") and "«" not in message and "Apokalipsy" not in message
    phone.locator(f"{SCREEN} [data-text-read='all']").click()
    phone.wait_for_function("window.hass.calls.filter((call) => call.domain === 'tts').length === 2")
    everything = phone.evaluate("window.hass.calls.filter((call) => call.domain === 'tts')[1].data.message")
    assert (
        everything.index("Czytanie z Apokalipsy")
        < everything.index("Refren: Tyś nas")
        < everything.index("Słowa Ewangelii")
    )
    assert "*" not in everything
    phone.locator(f"{SCREEN} [data-text-stop]").click()
    phone.wait_for_function("window.hass.calls.some((call) => call.service === 'media_stop')")


def test_a_script_reads_it_for_a_speaker_that_needs_a_whole_file(phone):
    block = {
        **BLOCK,
        "speaker": "media_player.hall_homepod",
        "script": "script.announce",
        "script_field": "text",
        "script_data": {"areas": "hall"},
    }
    open_block(phone, block)
    choose(phone, "speaker")
    phone.locator(f"{SCREEN} [data-text-read='{P}_gospel']").click()
    phone.wait_for_function("window.hass.calls.some((call) => call.domain === 'script')")
    call = phone.evaluate("window.hass.calls.find((call) => call.domain === 'script')")
    assert call["service"] == "turn_on" and call["data"]["entity_id"] == "script.announce"
    assert call["data"]["variables"]["areas"] == "hall"
    assert call["data"]["variables"]["text"].startswith("Słowa Ewangelii")
    assert not phone.evaluate("window.hass.calls.some((call) => call.domain === 'tts')")
    phone.locator(f"{SCREEN} [data-text-stop]").click()
    phone.wait_for_function(
        "window.hass.calls.some((c) => c.service === 'media_stop' && c.data.entity_id === 'media_player.hall_homepod')"
    )


# Playing in the browser is recorded instead of heard: the sources it played, its pauses and the voice of the browser.
FAKE_AUDIO = """
window.played = []; window.spoken = [];
HTMLMediaElement.prototype.play = function () { window.played.push(this.src); this.dataset.on = "1"; return Promise.resolve(); };
HTMLMediaElement.prototype.pause = function () { window.played.push("pause"); };
window.speechSynthesis.speak = (utterance) => window.spoken.push({ text: utterance.text, lang: utterance.lang });
window.speechSynthesis.cancel = () => window.spoken.push("cancel");
"""


def test_listen_here_plays_a_recording_on_this_device(phone):
    open_block(phone, {**BLOCK, "speaker": "media_player.kitchen", "tts": "tts.piper"})
    phone.evaluate(FAKE_AUDIO)
    choose(phone, "here")
    assert phone.locator(f"{SCREEN} [data-text-read]").count() == 0
    phone.locator(f"{SCREEN} [data-text-read-here]").click()
    phone.wait_for_function("window.played.some((src) => src.endsWith('/api/tts_proxy/test.mp3'))")
    call = phone.evaluate("window.hass.calls.find((call) => call.path === 'tts_get_url')")
    assert call["method"] == "POST" and call["data"]["engine_id"] == "tts.piper"
    assert call["data"]["message"].startswith("Czytanie z Apokalipsy")
    assert "Słowa Ewangelii" in call["data"]["message"]
    # The speaker is not used, and a tap first starts it silent for Safari
    assert phone.evaluate("window.played[0]").startswith("data:audio/wav")
    assert not phone.evaluate("window.hass.calls.some((call) => call.domain === 'tts')")
    pause = phone.locator(f"{SCREEN} [data-text-pause]")
    pause.click()
    phone.wait_for_function("window.played.includes('pause')")
    assert pause.inner_text().strip() == "Wznów"
    phone.locator(f"{SCREEN} [data-text-stop]").click()
    phone.wait_for_selector(f"{SCREEN} [data-text-pause]", state="detached")
    # Stopping here leaves the speaker alone
    assert not phone.evaluate("window.hass.calls.some((call) => call.service === 'media_stop')")


def test_without_a_recording_the_browser_reads_it(phone):
    open_block(phone, {**BLOCK, "tts": "tts.piper"})
    phone.evaluate(FAKE_AUDIO + "window.ttsFails = true;")
    phone.locator(f"{SCREEN} [data-text-read-here]").click()
    phone.wait_for_function("window.spoken.some((each) => each.text)")
    spoken = phone.evaluate("window.spoken.find((each) => each.text)")
    assert spoken["lang"] == "pl" and spoken["text"].startswith("Czytanie z Apokalipsy")
    phone.locator(f"{SCREEN} [data-text-stop]").click()
    phone.wait_for_selector(f"{SCREEN} [data-text-stop]", state="detached")


def test_a_chosen_voice_reads_on_the_speaker_here_and_through_a_script(phone):
    voice = "pl_PL-gosia-medium"
    open_block(phone, {**BLOCK, "speaker": "media_player.kitchen", "tts": "tts.piper", "voice": voice})
    phone.evaluate(FAKE_AUDIO)
    choose(phone, "speaker")
    phone.locator(f"{SCREEN} [data-text-read='all']").click()
    phone.wait_for_function("window.hass.calls.some((call) => call.domain === 'tts')")
    speak = phone.evaluate("window.hass.calls.find((call) => call.domain === 'tts')")
    assert speak["data"]["options"] == {"voice": voice}
    choose(phone, "here")
    phone.locator(f"{SCREEN} [data-text-read-here]").click()
    phone.wait_for_function("window.hass.calls.some((call) => call.path === 'tts_get_url')")
    url = phone.evaluate("window.hass.calls.find((call) => call.path === 'tts_get_url')")
    assert url["data"]["options"] == {"voice": voice}


def test_a_script_gets_the_voice_in_its_field(phone):
    block = {**BLOCK, "script": "script.announce", "script_field": "text", "voice": "pl_PL-gosia-medium"}
    open_block(phone, {**block, "script_voice_field": "voice"})
    choose(phone, "speaker")
    phone.locator(f"{SCREEN} [data-text-read='all']").click()
    phone.wait_for_function("window.hass.calls.some((call) => call.domain === 'script')")
    call = phone.evaluate("window.hass.calls.find((call) => call.domain === 'script')")
    assert call["data"]["variables"]["voice"] == "pl_PL-gosia-medium"


def test_without_a_voice_nothing_is_said_about_it(phone):
    open_block(phone, {**BLOCK, "script": "script.announce", "script_field": "text"})
    choose(phone, "speaker")
    phone.locator(f"{SCREEN} [data-text-read='all']").click()
    phone.wait_for_function("window.hass.calls.some((call) => call.domain === 'script')")
    call = phone.evaluate("window.hass.calls.find((call) => call.domain === 'script')")
    assert "voice" not in call["data"]["variables"]


def test_listen_to_one_section_plays_only_its_text_and_another_button_takes_over(phone):
    open_block(phone, {**BLOCK, "speaker": "media_player.kitchen", "tts": "tts.piper"})
    phone.evaluate(FAKE_AUDIO)
    choose(phone, "here")
    assert phone.locator(f"{SCREEN} [data-text-listen]").count() == 2
    gospel = phone.locator(f"{SCREEN} [data-text-listen='{P}_gospel']")
    gospel.click()
    phone.wait_for_function("window.hass.calls.some((call) => call.path === 'tts_get_url')")
    message = phone.evaluate("window.hass.calls.find((call) => call.path === 'tts_get_url')")["data"][
        "message"
    ]
    assert message.startswith("Słowa Ewangelii") and "Apokalipsy" not in message
    phone.wait_for_selector(f"{SCREEN} [data-text-listen='{P}_gospel'].on")
    assert "on" not in (phone.locator(f"{SCREEN} [data-text-read-here]").get_attribute("class") or "")
    assert not phone.evaluate("window.hass.calls.some((call) => call.domain === 'tts')")
    # Everything starts its own reading instead of the Gospel
    phone.locator(f"{SCREEN} [data-text-read-here]").click()
    phone.wait_for_function("window.hass.calls.filter((call) => call.path === 'tts_get_url').length === 2")
    messages = phone.evaluate(
        "window.hass.calls.filter((call) => call.path === 'tts_get_url').map((c) => c.data.message)"
    )
    assert messages[1].startswith("Czytanie z Apokalipsy")
    phone.wait_for_selector(f"{SCREEN} [data-text-read-here].on")
    assert "on" not in (gospel.get_attribute("class") or "")
    # The same button stops it
    phone.locator(f"{SCREEN} [data-text-read-here]").click()
    phone.wait_for_selector(f"{SCREEN} [data-text-stop]", state="detached")


SPOKEN_ALL = "Czytanie z Apokalipsy.\nTyś nas uczynił kapłanami Boga.\nŚpiewajcie Panu.\nTyś nas uczynił kapłanami Boga."
SPOKEN_GOSPEL = "Słowa Ewangelii według Świętego Łukasza.\nGdy Jezus był już blisko.\nOto słowo Pańskie."


def test_entities_with_the_text_made_to_be_read_aloud_are_read_instead_of_the_sections(phone):
    """The screen shows the readings laid out; the voice reads the text made for it (the refrain after every stanza)."""
    block = {
        **BLOCK,
        "speaker": "media_player.kitchen",
        "tts": "tts.piper",
        "speech_entity": f"{P}_spoken_all",
        "sections": [
            *BLOCK["sections"][:3],
            {**BLOCK["sections"][3], "speech_entity": f"{P}_spoken_gospel"},
        ],
    }
    add_entity(phone, f"{P}_spoken_all", "2026-11-19", {"tekst": SPOKEN_ALL})
    add_entity(phone, f"{P}_spoken_gospel", "2026-11-19", {"tekst": SPOKEN_GOSPEL})
    open_block(phone, block)
    phone.evaluate(FAKE_AUDIO)
    tts = "window.hass.calls.filter((call) => call.domain === 'tts').map((call) => call.data.message)"
    choose(phone, "speaker")
    phone.locator(f"{SCREEN} [data-text-read='all']").click()
    phone.wait_for_function(f"{tts}.length === 1")
    phone.locator(f"{SCREEN} [data-text-read='{P}_gospel']").click()
    phone.wait_for_function(f"{tts}.length === 2")
    assert phone.evaluate(tts) == [SPOKEN_ALL, SPOKEN_GOSPEL]
    # On this device too
    here = "window.hass.calls.filter((call) => call.path === 'tts_get_url').map((call) => call.data.message)"
    choose(phone, "here")
    phone.locator(f"{SCREEN} [data-text-listen='{P}_gospel']").click()
    phone.wait_for_function(f"{here}.length === 1")
    phone.locator(f"{SCREEN} [data-text-read-here]").click()
    phone.wait_for_function(f"{here}.length === 2")
    assert phone.evaluate(here) == [SPOKEN_GOSPEL, SPOKEN_ALL]
    # The window still shows the sections, not the text for the voice
    assert sections(phone) == [f"{P}_first", f"{P}_psalm", f"{P}_gospel"]


def test_an_entity_for_the_voice_without_text_leaves_the_sections_to_be_read(phone):
    add_entity(phone, f"{P}_spoken_all", "unavailable", {})
    open_block(phone, {**BLOCK, "speaker": "media_player.kitchen", "speech_entity": f"{P}_spoken_all"})
    choose(phone, "speaker")
    phone.locator(f"{SCREEN} [data-text-read='all']").click()
    phone.wait_for_function("window.hass.calls.some((call) => call.domain === 'tts')")
    message = phone.evaluate("window.hass.calls.find((call) => call.domain === 'tts').data.message")
    assert message.startswith("Czytanie z Apokalipsy") and "Słowa Ewangelii" in message


HALL = "media_player.hall_homepod"
PLAYER = {"volume_level": 0.3, "supported_features": 4, "friendly_name": "Korytarz HomePod"}
SCRIPT_BLOCK = {
    **BLOCK,
    "speaker": HALL,
    "script": "script.announce",
    "script_field": "text",
    "tts": "tts.piper",
}


def open_player(page, block: dict | None = None, state: str = "idle", **attributes) -> None:
    add_entity(page, HALL, state, {**PLAYER, **attributes})
    open_block(page, block or SCRIPT_BLOCK)


def test_first_where_then_what(phone):
    open_player(phone)
    modes = phone.locator(f"{SCREEN} [data-text-mode]")
    assert [text.strip() for text in modes.all_inner_texts()] == [
        "Słuchaj na telefonie",
        "Słuchaj na odtwarzaczu",
    ] or "Słuchaj na komputerze" in modes.first.inner_text()
    assert phone.locator(f"{SCREEN} .what").count() == 0
    choose(phone, "here")
    assert phone.locator(f"{SCREEN} .what").count() == 2
    assert phone.locator(f"{SCREEN} [data-text-volume]").count() == 0
    choose(phone, "speaker")
    assert phone.locator(f"{SCREEN} [data-text-read]").count() == 2
    assert phone.locator(f"{SCREEN} [data-text-listen]").count() == 0
    assert "Korytarz HomePod" in phone.locator(f"{SCREEN} [data-text-volume]").inner_text()
    assert "30%" in phone.locator(f"{SCREEN} [data-text-volume]").inner_text()
    # All of it fits the width of a phone, each pair in one row.
    for pair in phone.locator(f"{SCREEN} .pair").all():
        boxes = [button.bounding_box() for button in pair.locator("button").all()]
        assert boxes[0]["y"] == boxes[1]["y"] and boxes[1]["x"] + boxes[1]["width"] <= 390
    if os.environ.get("TEXT_SHOTS"):
        phone.locator(f"{SCREEN} [data-text-read='all']").click()
        phone.wait_for_selector(f"{SCREEN} [data-text-spinner]")
        phone.screenshot(path=f"{os.environ['TEXT_SHOTS']}/listen.png")


def test_the_name_of_the_device(phone):
    kinds = phone.evaluate(
        """async () => {
            const m = await import("/custom_components/home_dashboard/www/app/text-block.js");
            const view = (coarse, width, height) => ({ matchMedia: () => ({ matches: coarse }), screen: { width, height } });
            return [view(true, 390, 844), view(true, 820, 1180), view(false, 390, 844)].map((v) => m.deviceKind(v));
        }"""
    )
    assert kinds == ["phone", "tablet", "computer"]


def test_with_one_place_there_is_nothing_to_choose(phone):
    open_player(phone, {**SCRIPT_BLOCK, "hide_read_here": True})
    assert phone.locator(f"{SCREEN} [data-text-mode]").count() == 0
    assert phone.locator(f"{SCREEN} [data-text-read]").count() == 2


def test_the_slider_sets_the_volume_of_the_player(phone):
    open_player(phone)
    choose(phone, "speaker")
    phone.locator(f"{SCREEN} [data-text-volume] input").evaluate(
        """(input) => { input.value = 45; input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true })); }"""
    )
    phone.wait_for_function("window.hass.calls.some((call) => call.service === 'volume_set')")
    call = phone.evaluate("window.hass.calls.find((call) => call.service === 'volume_set')")
    assert call["data"] == {"entity_id": HALL, "volume_level": 0.45}
    assert "45%" in phone.locator(f"{SCREEN} [data-text-volume]").inner_text()


def test_a_player_without_volume_has_no_slider(phone):
    open_player(phone, supported_features=0)
    choose(phone, "speaker")
    assert phone.locator(f"{SCREEN} [data-text-read]").count() == 2
    assert phone.locator(f"{SCREEN} [data-text-volume]").count() == 0


def test_loading_lasts_until_the_player_plays_and_the_button_goes_out_at_its_end(phone):
    open_player(phone)
    choose(phone, "speaker")
    phone.locator(f"{SCREEN} [data-text-read='all']").click()
    phone.wait_for_selector(f"{SCREEN} [data-text-spinner]")
    assert "10 sekund" in phone.locator(f"{SCREEN} [data-text-loading]").inner_text()
    set_state(phone, "sensor.other", "1")
    assert phone.locator(f"{SCREEN} [data-text-loading]").count() == 1
    set_state(phone, HALL, "playing", PLAYER)
    phone.wait_for_selector(f"{SCREEN} [data-text-loading]", state="detached")
    assert phone.locator(f"{SCREEN} [data-text-read='all'].on").count() == 1
    set_state(phone, HALL, "idle", PLAYER)
    phone.wait_for_selector(f"{SCREEN} [data-text-stop]", state="detached")


def test_music_that_was_on_is_not_taken_for_the_voice(phone):
    open_player(phone, state="playing", media_title="Song")
    choose(phone, "speaker")
    phone.locator(f"{SCREEN} [data-text-read='all']").click()
    phone.wait_for_selector(f"{SCREEN} [data-text-loading]")
    set_state(phone, HALL, "playing", {**PLAYER, "media_title": "Song", "volume_level": 0.5})
    assert phone.locator(f"{SCREEN} [data-text-loading]").count() == 1
    set_state(phone, HALL, "idle", PLAYER)
    assert phone.locator(f"{SCREEN} [data-text-loading]").count() == 1
    set_state(phone, HALL, "playing", {**PLAYER, "media_title": "homepod.wav"})
    phone.wait_for_selector(f"{SCREEN} [data-text-loading]", state="detached")


def test_stop_while_loading_also_ends_the_script(phone):
    open_player(phone)
    choose(phone, "speaker")
    phone.locator(f"{SCREEN} [data-text-read='all']").click()
    phone.locator(f"{SCREEN} [data-text-stop]").click()
    phone.wait_for_function("window.hass.calls.some((call) => call.service === 'turn_off')")
    assert phone.locator(f"{SCREEN} [data-text-loading]").count() == 0


def test_the_other_place_ends_what_this_one_reads(phone):
    open_player(phone)
    phone.evaluate(FAKE_AUDIO)
    choose(phone, "here")
    phone.locator(f"{SCREEN} [data-text-read-here]").click()
    phone.wait_for_selector(f"{SCREEN} [data-text-pause]")
    choose(phone, "speaker")
    assert phone.locator(f"{SCREEN} [data-text-stop]").count() == 0
    assert "pause" in phone.evaluate("window.played")


def test_loading_on_this_device_shows_until_it_plays(phone):
    open_player(phone)
    phone.evaluate(FAKE_AUDIO)
    choose(phone, "here")
    phone.locator(SCREEN).evaluate(
        """(screen) => { screen.hass = Object.assign(Object.create(screen.hass), {
            callApi: () => new Promise((resolve) => { window.ready = () => resolve({ path: "/api/tts_proxy/x.mp3" }); }) }); }"""
    )
    phone.locator(f"{SCREEN} [data-text-read-here]").click()
    phone.wait_for_selector(f"{SCREEN} [data-text-spinner]")
    assert phone.locator(f"{SCREEN} [data-text-pause]").count() == 0
    phone.evaluate("window.ready()")
    phone.wait_for_selector(f"{SCREEN} [data-text-pause]")
    assert phone.locator(f"{SCREEN} [data-text-loading]").count() == 0
