"""Writes docs/gallery.md and docs/gallery.pl.md from one list of the screenshots of dev/screenshots.py."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# (file, English, Polish, wide): wide pictures (tablet, phone on its side) go two in a row, phones four.
GROUPS = [
    (("Phone and tablet", "Telefon i tablet"), [
        ("home", "Home", "Strona główna", False),
        ("room", "Room", "Pokój", False),
        ("dark", "Dark mode", "Tryb ciemny", False),
        ("menu", "Menu", "Menu", False),
        ("tablet-status", "Tablet with the status bar", "Tablet z paskiem statusu", True),
        ("tablet", "Tablet with the narrow bar", "Tablet z wąskim paskiem", True),
        ("rooms", "Choosing an area", "Wybór obszaru", False),
        ("weather", "Weather", "Pogoda", False),
        ("player", "Player", "Odtwarzacz", False),
        ("notifications", "Notifications", "Powiadomienia", False),
        ("weather-tablet", "Weather on a tablet", "Pogoda na tablecie", True),
    ]),
    (("Apple Home theme", "Motyw Apple Home"), [
        ("apple-home", "Apple Home", "Apple Home", False),
        ("apple-home-dark", "Apple Home, dark", "Apple Home, ciemny", False),
        ("apple-room", "Apple Home: room", "Apple Home: pokój", False),
        ("apple-light", "Apple Home: lamp", "Apple Home: lampa", False),
        ("apple-energy", "Apple Home: energy", "Apple Home: energia", False),
        (
            "apple-tablet-status",
            "Apple Home on a tablet with the status bar",
            "Apple Home na tablecie z paskiem statusu",
            True,
        ),
        ("apple-tablet", "Apple Home on a tablet", "Apple Home na tablecie", True),
    ]),
    (("Devices", "Urządzenia"), [
        ("light", "Light", "Światło", False),
        ("thermostat", "Thermostat", "Termostat", False),
        ("blind", "Blind", "Roleta", False),
        ("switch", "Switch", "Przełącznik", False),
        ("vacuum", "Vacuum", "Odkurzacz", False),
        ("media", "Media", "Media", False),
        ("music", "Music", "Muzyka", False),
        ("map", "Map", "Mapa", False),
        ("scale", "Scale", "Waga", False),
        ("washer", "Washer", "Pralka", False),
        ("apple-tv", "Apple TV with its remote", "Apple TV z pilotem", False),
        (
            "laundry-tablet",
            "Washer, dryer, power station and vacuum in a room",
            "Pralka, suszarka, stacja zasilania i odkurzacz w pokoju",
            True,
        ),
        ("washer-tablet", "Washer on a tablet", "Pralka na tablecie", True),
        ("scale-tablet", "Scale on a tablet", "Waga na tablecie", True),
        ("station-tablet", "Power station on a tablet", "Stacja zasilania na tablecie", True),
        ("leak", "Leak sensor with its history", "Czujnik zalania z historią", False),
        ("plug", "Switch of a plug with its power", "Przełącznik gniazdka z mocą", False),
        (
            "drink-tablet",
            "A list with a run button: a coffee machine",
            "Lista z przyciskiem uruchomienia: ekspres",
            True,
        ),
        ("machine-tablet", "A machine and its plug", "Maszyna i jej gniazdko", True),
    ]),
    (("Cameras and intercom", "Kamery i interkom"), [
        ("camera", "Camera", "Kamera", False),
        ("cameras", "All cameras", "Wszystkie kamery", False),
        ("connections", "Connections of a camera on a battery", "Połączenia kamery na baterię", False),
        ("intercom", "Intercom", "Interkom", False),
        ("cameras-tablet", "All cameras on a tablet", "Wszystkie kamery na tablecie", True),
        ("cameras-featured", "One big camera, live", "Jedna duża kamera na żywo", True),
        ("camera-tablet", "Camera window on a tablet", "Okno kamery na tablecie", True),
        ("camera-landscape", "Camera on a phone on its side", "Kamera na telefonie trzymanym poziomo", True),
        ("camera-landscape-positions", "Saved positions", "Zapisane pozycje", True),
        ("camera-landscape-line", "Line of time", "Oś czasu", True),
    ]),
    (("Energy", "Energia"), [
        ("energy", "Energy", "Energia", False),
        (
            "energy-tablet",
            "Energy on a tablet, with the phases of the meter",
            "Energia na tablecie z fazami licznika",
            True,
        ),
        ("energy-chart", "Chart of a phase", "Wykres fazy", True),
        ("energy-storage", "Energy storage on the Energy page", "Magazyn energii na stronie Energii", True),
    ]),
    (("Shortcuts and blocks", "Skróty i bloki"), [
        ("status", "Status", "Status", False),
        ("departures", "Departures", "Odjazdy", False),
        ("school", "School year", "Rok szkolny", False),
        ("news", "News", "Wiadomości", False),
        ("app", "App in a window", "Aplikacja w oknie", False),
        ("logbook", "Logbook", "Dziennik", False),
        ("history", "History", "Historia", False),
        ("blocks", "Summary badges", "Odznaki podsumowania", False),
        ("block-editor", "Block editor", "Edycja bloku", False),
        ("menu-editor", "Menu editor", "Edycja menu", False),
        ("media-editor", "Media categories", "Kategorie mediów", False),
        ("chips", "Chips", "Plakietki", False),
        ("vacuum-tablet", "Vacuum on a tablet", "Odkurzacz na tablecie", True),
        ("departures-tablet", "Departures on a tablet", "Odjazdy na tablecie", True),
        ("status-tablet", "Status on a tablet", "Status na tablecie", True),
        ("news-tablet", "News on a tablet", "Wiadomości na tablecie", True),
    ]),
    (("Personal layout and settings", "Własny układ i ustawienia"), [
        ("editor", "Tile editor", "Edycja kafelka", False),
        ("layout", "My layout", "Mój układ", False),
        ("my-view", "My view of a room", "Mój widok pokoju", False),
        ("my-scenes", "My scenes", "Moje sceny", False),
        ("background", "Background of a screen", "Tło ekranu", False),
        ("access", "User access", "Dostęp użytkowników", False),
        ("settings", "Dashboard settings", "Ustawienia dashboardu", False),
    ]),
    (("Look and themes", "Wygląd i motywy"), [
        ("look-background", "Background", "Tło", False),
        ("look-buttons", "Buttons", "Przyciski", False),
        ("look-colours", "Colours", "Kolory", False),
        ("look-icons", "Icons", "Ikony", False),
        ("look-nav", "Bar", "Pasek", False),
        ("look-sheets", "Windows", "Okna", False),
        ("look-themes", "Themes", "Motywy", False),
        ("theme-import", "Importing a theme", "Import motywu", False),
    ]),
]
TIMES = "\u00d7"
TEXT = {
    "en": {
        "title": "# Home Dashboard: gallery",
        "back": "[← Back to the README](../README.md) · [Polski](gallery.pl.md)",
        "intro": (
            f"Every screenshot of the dashboard, on a phone (iPhone 16 Pro, 402 {TIMES} 874) "
            f"and a tablet on its side (1180 {TIMES} 820).\n"
            "They show a made-up home from `dev/demo.js`; "
            "the camera pictures are free CC0 photos of other homes\n"
            "([credits](../dev/demo-pictures/CREDITS.md)). `make screenshots` makes them again."
        ),
    },
    "pl": {
        "title": "# Home Dashboard: galeria",
        "back": "[← Powrót do README](../README.pl.md) · [English](gallery.md)",
        "intro": (
            f"Wszystkie zrzuty dashboardu na telefonie (iPhone 16 Pro, 402 {TIMES} 874) "
            f"i na tablecie trzymanym poziomo (1180 {TIMES} 820).\n"
            "Pokazują wymyślony dom z `dev/demo.js`, a obrazy z kamer to wolne zdjęcia CC0 cudzych domów\n"
            "([źródła](../dev/demo-pictures/CREDITS.md)). `make screenshots` tworzy je od nowa."
        ),
    },
}


def rows(items, size):
    for start in range(0, len(items), size):
        yield items[start : start + size]


def table(lang, items, size):
    out = []
    for chunk in rows(items, size):
        names = [english if lang == "en" else polish for _, english, polish, _ in chunk]
        pairs = zip(chunk, names, strict=True)
        pictures = [f"![{name}](screenshots/{lang}/{file}.png)" for (file, *_), name in pairs]
        out += ["| " + " | ".join(names) + " |", "|" + "---|" * len(chunk)]
        out += ["| " + " | ".join(pictures) + " |", ""]
    return out


def anchor(title):
    return f"[{title}](#{title.lower().replace(' ', '-')})"


def main():
    used = set()
    for lang, name in (("en", "gallery.md"), ("pl", "gallery.pl.md")):
        text = TEXT[lang]
        lines = [text["title"], "", text["back"], "", text["intro"], ""]
        titles = [english if lang == "en" else polish for (english, polish), _ in GROUPS]
        lines.append(" · ".join(anchor(title) for title in titles))
        lines.append("")
        for (english, polish), items in GROUPS:
            lines += [f"## {english if lang == 'en' else polish}", ""]
            lines += table(lang, [item for item in items if not item[3]], 4)
            lines += table(lang, [item for item in items if item[3]], 2)
            used |= {item[0] for item in items}
        lines.append(text["back"])
        (ROOT / "docs" / name).write_text("\n".join(lines) + "\n")
    shots = {path.stem for path in (ROOT / "docs/screenshots/en").glob("*.png")}
    print("missing from gallery:", sorted(shots - used))
    print("not made yet:", sorted(used - shots))


if __name__ == "__main__":
    main()
