# Home Dashboard

[English](README.md)

Strategia dashboardu dla Home Assistant zaprojektowana pod dotyk: jeden dashboard na telefon
i tablet ścienny, z pastelowymi kafelkami, podsumowaniami, dolnym paskiem na telefonie i bocznym
na tablecie. Całość powstaje automatycznie z Twoich pokoi, więc nie piszesz kart ręcznie. Wygląd ustawiasz w
samym dashboardzie i zapisujesz jako motyw, którym możesz się podzielić; w zestawie są dwa: **Home Dashboard** i
**Apple Home**.

Stan: wczesna wersja.

| Apple Home | Apple Home: pokój | Apple Home: lampa | Apple Home: energia |
|---|---|---|---|
| ![Apple Home](docs/screenshots/pl/apple-home.png) | ![Apple Home: pokój](docs/screenshots/pl/apple-room.png) | ![Apple Home: lampa](docs/screenshots/pl/apple-light.png) | ![Apple Home: energia](docs/screenshots/pl/apple-energy.png) |

| Strona główna | Pokój | Tryb ciemny | Edycja kafelka |
|---|---|---|---|
| ![Strona główna](docs/screenshots/pl/home.png) | ![Pokój](docs/screenshots/pl/room.png) | ![Tryb ciemny](docs/screenshots/pl/dark.png) | ![Edycja kafelka](docs/screenshots/pl/editor.png) |

| Światło | Termostat | Tablet |
|---|---|---|
| ![Światło](docs/screenshots/pl/light.png) | ![Termostat](docs/screenshots/pl/thermostat.png) | ![Tablet](docs/screenshots/pl/tablet.png) |

| Pogoda | Odtwarzacz | Muzyka | Media |
|---|---|---|---|
| ![Pogoda](docs/screenshots/pl/weather.png) | ![Odtwarzacz](docs/screenshots/pl/player.png) | ![Muzyka](docs/screenshots/pl/music.png) | ![Media](docs/screenshots/pl/media.png) |

| Mapa | Menu | Wybór obszaru | Odkurzacz |
|---|---|---|---|
| ![Mapa](docs/screenshots/pl/map.png) | ![Menu](docs/screenshots/pl/menu.png) | ![Wybór obszaru](docs/screenshots/pl/rooms.png) | ![Odkurzacz](docs/screenshots/pl/vacuum.png) |

| Roleta | Przełącznik | Tło ekranu | Mój układ |
|---|---|---|---|
| ![Roleta](docs/screenshots/pl/blind.png) | ![Przełącznik](docs/screenshots/pl/switch.png) | ![Tło ekranu](docs/screenshots/pl/background.png) | ![Mój układ](docs/screenshots/pl/layout.png) |

| Dostęp użytkowników | Energia | Kamera |
|---|---|---|
| ![Dostęp użytkowników](docs/screenshots/pl/access.png) | ![Energia](docs/screenshots/pl/energy.png) | ![Kamera](docs/screenshots/pl/camera.png) |

| Status | Odjazdy | Rok szkolny | Plakietki |
|---|---|---|---|
| ![Status](docs/screenshots/pl/status.png) | ![Odjazdy](docs/screenshots/pl/departures.png) | ![Rok szkolny](docs/screenshots/pl/school.png) | ![Plakietki](docs/screenshots/pl/chips.png) |

| Powiadomienia | Aplikacja w oknie | Bloki | Edycja bloku |
|---|---|---|---|
| ![Powiadomienia](docs/screenshots/pl/notifications.png) | ![Aplikacja w oknie](docs/screenshots/pl/app.png) | ![Bloki](docs/screenshots/pl/blocks.png) | ![Edycja bloku](docs/screenshots/pl/block-editor.png) |

| Edycja menu | Kategorie mediów | Dziennik | Historia |
|---|---|---|---|
| ![Edycja menu](docs/screenshots/pl/menu-editor.png) | ![Kategorie mediów](docs/screenshots/pl/media-editor.png) | ![Dziennik](docs/screenshots/pl/logbook.png) | ![Historia](docs/screenshots/pl/history.png) |

| Wiadomości | Mój widok pokoju | Moje sceny |
|---|---|---|
| ![Wiadomości](docs/screenshots/pl/news.png) | ![Mój widok pokoju](docs/screenshots/pl/my-view.png) | ![Moje sceny](docs/screenshots/pl/my-scenes.png) |

**[Przeczytaj przewodnik](docs/guide.pl.md)**, który krok po kroku opisuje pokoje, stronę główną, kamery, bloki i osoby.

Zrzuty pokazują wymyślony dom z `dev/demo.js`, a obrazy z kamer to wolne zdjęcia CC0 cudzych domów
([źródła](dev/demo-pictures/CREDITS.md)). Tła na zrzutach Apple Home przygotował autor dashboardu. Muzyka i Mapa
używają zastępczej aplikacji muzycznej i mapy, a Energia wymyślonych statystyk. `make screenshots` tworzy je od nowa.

Dashboard mówi językiem użytkownika Home Assistant. W zestawie są angielski i polski, a nowy język to
kolejny blok w `www/app/i18n.js`. Test pilnuje, żeby miał wszystkie teksty.

## Instalacja

1. W HACS (od Home Assistant 2026.11 to Marketplace) otwórz trzy kropki → **Niestandardowe repozytoria**, dodaj
   `https://github.com/witold-gren/home-assistant-dashboard` jako **Integrację**, pobierz **Home Dashboard**
   i uruchom ponownie Home Assistant. Bez HACS skopiuj `custom_components/home_dashboard`.
2. Ustawienia → Urządzenia oraz usługi → Dodaj integrację → **Home Dashboard**.
3. Ustawienia → Dashboardy → Dodaj dashboard → **Nowy dashboard od podstaw**.
4. Otwórz go, wybierz **Edytuj** → **Edytor konfiguracji** i wklej:

```yaml
strategy:
  type: custom:home-dashboard
```

Strategia nie wymaga wpisu w `lovelace: resources` i działa przy `resource_mode: yaml`.

## Co jest pokazywane

Domyślnie: światła, klimatyzacja, rolety i zamki przypisane do pokoju, bez encji ukrytych,
konfiguracyjnych i diagnostycznych. Encje bez pokoju czekają, aż je przypiszesz. Przełączniki,
sensory i sceny dodajesz tylko ręcznie.

- Grupa świateł zastępuje swoje lampy. Ustaw `lights.prefer_groups: false`, aby pokazać każdą lampę.
- Odtwarzacze będące tym samym głośnikiem scala `media.group_patterns`.
- `media.sections` układa stronę Media we własne grupy kafelków, które trafiają też do filtra Media na stronie głównej.
- Dotknięcie okrągłej ikony przełącza światło, a dotknięcie kafelka otwiera sterowanie.
- Podsumowania filtrują stronę: klimat, światła, ochrona, media.
- Menu prowadzi do wszystkich stron i, dla administratorów, do ustawień dashboardu. Pokój otwiera się
  na osobnym ekranie, z urządzeniami pogrupowanymi według rodzaju i kamerami tego pokoju.

## Konfiguracja

Wszystko jest opcjonalne:

```yaml
strategy:
  type: custom:home-dashboard
  favorites: [climate.salon, lock.drzwi]
  rooms:
    order: [living_room, kitchen]
    hidden: [garaz]
  cameras:
    hero: image.korytarz_dzwonek_last_screen
    tiles: [image.garage_last_screen]
    live: {image.korytarz_dzwonek_last_screen: camera.dzwonek}
    battery_platforms: [eufy_sdk]
    snapshot_platforms: [frigate]
  entities:
    include:
      kitchen: [switch.zmywarka]
    exclude: [light.ekran_tabletu]
    overrides:
      cover.roleta_3: {area: bedroom, name: Roleta, icon: mdi:blinds}
  media:
    group_patterns: ["^(.+)_homepod(_muzyka)?$"]
  lights:
    prefer_groups: true
  security:
    unlock_on_tablet: false
```

### Edycja na urządzeniu

Menu → ustawienia → **Edytuj konfigurację** otwiera całą konfigurację jako YAML, dla administratorów.
Zapis sprawdza składnię oraz budowę pokoi i kafelków, a błąd zostaje w edytorze z numerem wiersza.
Wersję sprzed ostatniego zapisu można wczytać na tym samym urządzeniu. Komentarze nie są zachowywane,
bo Home Assistant trzyma dashboard jako JSON.

### Edycja dotykiem

Na stronie pokoju administrator ma pod trzema kropkami pozycję **Edytuj ten ekran**. Pozwala dodawać, nazywać i usuwać kafelki, przeciągać
je za uchwyt, także między sekcjami, oraz zarządzać sekcjami. Zakładka Strona główna ustawia kafelki
tego pokoju na stronie głównej. Nic nie trafia na serwer przed **Zapisz**, a zamknięcie edycji odrzuca
zmiany. Bloki można tu przenosić i usuwać, a dodawać w edytorze YAML.

### Skróty

Administrator dodaje je i edytuje w formularzu: trzy kropki na stronie głównej → **Bloki**. Opis pól jest też niżej i w przewodniku.

`shortcuts` dodaje przyciski za chipami na stronie głównej i w menu. Każdy to blok (`kind: panel`) albo
ekran szkoły (`kind: school`), przegląd domu (`kind: overview`, opis w przewodniku), wiadomości (`kind: news`) albo odjazdy (`kind: departures` z `entities`, encjami z atrybutem `list`). Blok może otwierać się na cały ekran (`fullscreen: true`), od razu
pokazywać kartę (`auto_card: true`), zostawiać kartę administratorom (`admin_card: true`, a pozostali
widzą `frame`) i nazywać przycisk karty przez `card_label` i `card_icon`. `tone` wybiera kolor ikony (green, purple,
teal, pink), a bez niego kolory idą po kolei. Akcja może wywołać usługę
swojej encji: `{name: Start, entity: vacuum.robot, service: vacuum.start}`.

Ekran szkoły u góry pokazuje ważne wydarzenia na dziś i jutro, wszystkich dzieci razem (`important` w wydarzeniach z
`sensor.rodzinnik_librus`), plan lekcji pokazuje wszystkie wydarzenia danego dnia, a terminarz dziecka dokłada je do wpisów ze szkoły.

### Pogoda

Pierwszy chip na stronie głównej pokazuje temperaturę i otwiera ekran z bieżącymi odczytami oraz prognozą
godzinową i dzienną. Pojawia się sam, gdy Home Assistant ma encję `weather`. Chip używa pierwszej z nich, a prognoza
pochodzi z pierwszej, która ją ma, więc stacja domowa może działać razem z usługą pogody:

```yaml
strategy:
  type: custom:home-dashboard
  weather:
    entity: weather.home_station
    forecast: weather.forecast_home
```

`weather: false` usuwa chip.

### Sceny

`scenes` to kafelki pod kamerami na stronie głównej. Nagłówek otwiera ich osobną stronę, a tam **Edytuj ten ekran** pozwala
edytować je dotykiem i podpowiada tylko sceny i skrypty. Kafelek może mieć `name` i `icon`.

### Strona muzyki i maszyny

`music` dodaje stronę w miejsce Mediów na pasku nawigacji, a Media mogą być wtedy skrótem:
`{kind: page, name: Media, icon: mdi:play-box-multiple-outline, page: media}`. Taki skrót otwiera stronę
w oknie, które można zsunąć. `music` przyjmuje `card`, `frame`
i `admin_card`, tak jak blok. Skrót `kind: host` pokazuje maszyny z `columns`, każda ma `title`, `icon`,
`subtitle`, `status`, `bars`, `info`, `machines` i kartę `graph`. Blok z `card_open: true` pokazuje
kartę bez przycisku.

### Własna karta urządzenia

`entities.overrides` przyjmuje `card`. Kafelek tej encji otwiera wtedy podaną kartę zamiast okna
dashboardu, na każdej stronie i w filtrach, a ikona kafelka też ją otwiera, zamiast przełączać:
`light.lampa: {card: {type: custom:skylight-lamp-card, entity: light.lampa, title: false}}`.

### Karta na końcu panelu

`card_last: true` razem z `card_open: true` pokazuje kartę bloku pod wszystkimi grupami, np. mapę.

### Układ grup w panelu

Grupa bloku `panel` może mieć `layout`. `controls` zamienia wiersze na duże przyciski, wybór, suwak
i małe karty. `summary` pokazuje grupę jako jedną linię, która rozwija się na dotknięcie i sama, gdy
drzwi, okno albo czujnik problemu zgłasza stan włączony.

### Mój układ i dostęp użytkowników

Trzy kropki → **Mój układ**: każdy ustawia kolejność i ukrywa kamery oraz obszary dla siebie. Układ
zapisuje się na koncie w Home Assistant, więc jest taki sam na każdym urządzeniu tej osoby, i nie
wymaga konta administratora. Lista kamer dotyczy strony głównej, pokoi i Ochrony. Administrator w zakładkach Obszary
i Ulubione zaznacza **Dla wszystkich** i ustawia wspólną kolejność obszarów, ich ukrycie i wspólne ulubione.

Trzy kropki na stronie głównej → **Mój układ** (każdy): kolejność i ukrywanie kamer, obszarów i plakietek strony głównej.

Trzy kropki → **Dostęp użytkowników** (administrator): wybierasz osobę albo **Wszyscy oprócz mnie** i ukrywasz jej obszary, kamery,
sceny, skrypty, światła, media, ochronę i inne encje. W zakładce Inne są też bloki i skróty, np. Frigate.
Zapisuje się to w `access` jako `{<id użytkownika>: {rooms: [...], hide: [...]}}`.
Ukrycie obszaru ukrywa też jego kamery. Ta osoba nie przywróci sobie tych pozycji.

W edycji pokoju lub scen dotknij kafelka i ustaw **Kto to widzi**: Wszyscy, Tylko wybrani albo Wszyscy oprócz.
Zapisuje się to w `visibility` jako `{<encja>: {only: [...], except: [...]}}` i dotyczy encji w każdym
miejscu dashboardu, także Twojego konta. W trybie edycji administrator zawsze widzi wszystko: kafelek
zielony widzą tylko wybrane osoby, a czerwony jest przed kimś ukryty, też w Dostępie użytkowników.

To ukrycie w dashboardzie, a nie uprawnienia. Home Assistant nie ma uprawnień do pojedynczych encji, więc
ta sama osoba nadal może dojść do nich w innym dashboardzie albo w aplikacji.

### Kamera wyłączana dla prywatności

`cameras.private` usuwa kamerę ze wszystkich stron, gdy podany przełącznik jest włączony:
`[{entity: switch.bedroom_privacy, hide: [camera.bedroom]}]`. Bez tego kamera bez
zasilania pokazałaby się jako niedostępna. Kafelek z `tap_toggle: true` przełącza encję jednym dotknięciem.

### Rząd przewijany w bok

Przycisk ze strzałkami w nagłówku sekcji w edycji pokoju układa jej kafelki w jeden rząd przewijany w bok
(`layout: row`). Ten sam przycisk w edycji scen ustawia `scenes_layout: row` dla sekcji Sceny na stronie głównej.

### Spokojne kafelki

Kafelek z `calm: true` nie świeci się, gdy jest włączony: ma zwykły kolor, a wyłączony jest przygaszony. To
wygląd dla ustawień, które prawie zawsze są włączone, np. automatyzacji.

### Grupa w Ochronie

`security.group` pokazuje wybrane kafelki razem na górze filtra Ochrona, niezależnie od ich pokoi:
`{name: Gość, entities: [input_boolean.guest, input_boolean.guest_cabin]}`. Encje muszą być kafelkami
w `layout`.

### Tła

Trzy kropki → **Tło tego ekranu** ustawia tło strony głównej lub pokoju: gradient, kolor albo wgrane zdjęcie,
osobno dla jasnego i ciemnego wyglądu oraz dla ekranu pionowego (telefon) i poziomego (tablet obrócony, laptop), z wyborem części zdjęcia, która zostaje po przycięciu. Administrator przy każdym z nich zaznacza **Dla wszystkich** i wtedy
zapisuje się ono w `backgrounds`. Bez zaznaczenia tło zostaje na koncie tej osoby i wygrywa ze wspólnym. Strona trzyma nad tłem warstwę w kolorze
motywu, więc nagłówki są czytelne w trybie jasnym i ciemnym; jej siłę ustawia **Wygląd → Tło**. Tło stoi w miejscu,
gdy strona się przewija i odbija na końcach. Własne tło mają też strona Scen, Mapa i Energia.

### Wygląd i motywy

Trzy kropki → **Wygląd** ustawia wygląd całego dashboardu: wyrazistość tła, odbicie przewijania, przyciski (krycie,
zaokrąglenie, kolor całego przycisku albo samej ikony, kolor każdego rodzaju), kolory napisów, górnych bloków i
plakietek, dolny pasek (pozycje, styl przyklejony albo pływający, szkło), mały odtwarzacz, okna (przezroczystość i
rozmycie), mapę i własne ikony urządzeń. Administrator ustawia wygląd dla wszystkich, a każdy może go dopasować dla
siebie. Zakładka **Motywy** trzyma bibliotekę wyglądów: **Home Dashboard** i **Apple Home** przychodzą w zestawie,
swój wygląd zachowujesz jako motyw, a każdy eksportujesz do pliku razem ze zdjęciami teł i wczytujesz w innym domu.
Szczegóły są w [przewodniku](docs/guide.pl.md#wygląd), a cały wygląd Apple Home od zera, z przygotowaniem teł, w
[poradniku Apple Home](docs/apple-home.pl.md). Jak zbudować okno dla własnego urządzenia, którego dashboard nie zna,
opisuje [poradnik o własnych urządzeniach](docs/own-devices.pl.md).

### Otwieranie przy starcie na jednym urządzeniu

Domyślny dashboard HA należy do konta albo całego systemu. Przełącznik w ustawieniach tego dashboardu
zapisuje się na urządzeniu: przy starcie aplikacji, z domyślnej strony, otwiera ten dashboard. Linki do
innych stron działają normalnie.

## Układ pokoi

Bez konfiguracji pokoje budują się same z obszarów. Możesz też opisać je w `layout`: kolejność pokoi,
połączone obszary, kafelki na stronie głównej i sekcje na stronie pokoju. Obszary spoza `layout` są
dokładane na końcu.

```yaml
layout:
  - id: kitchen
    name: Kuchnia i Jadalnia
    areas: [kitchen, jadalnia]
    home:
      - {entity: light.kuchnia, name: Główne}
    sections:
      - title: Oświetlenie
        tiles:
          - {entity: light.kuchnia, name: Główne}
```

Kafelek może mieć `action` (skrypt zamiast przełączania), `active_only` (tylko gdy urządzenie gra)
albo `turn_on_only` (można tylko włączyć, nawet okno szczegółów się nie otwiera; dla trybu gościa
wyłączanego PIN-em).

### Bloki

Blok pokazuje kilka encji na jednym szerokim kafelku i otwiera ekran ze szczegółami. To zwykłe dane
w `layout`, więc nowy blok nie wymaga kodu:

```yaml
- kind: panel
  name: Ekspres
  icon: mdi:coffee-maker-outline
  entity: sensor.ekspres_status
  labels: {ready: Gotowy}
  active: binary_sensor.ekspres_parzy
  stats:
    - {name: Dziś, entity: sensor.ekspres_dzis, digits: 0}
    - {name: Woda, entity: sensor.ekspres_woda, digits: 1, unit: l}
  actions:
    - {name: Płukanie, entity: button.ekspres_plukanie, confirm: Uruchomić płukanie?}
  groups:
    - title: Ustawienia
      rows:
        - {entity: select.ekspres_profil, name: Profil}
        - {entity: switch.ekspres_swiatlo}
```

Wiersz dopasowuje się do encji: lista dla `select`, przełącznik dla `switch`, suwak dla `number`,
przycisk dla `button` i `script`. Reszta, także zamek, jest tylko do odczytu i otwiera okno szczegółów.
`card` dodaje kartę sterowania uruchamianą przyciskiem, a `frame` otwiera stronę WWW na całym ekranie.
`hidden_when` ukrywa blok, gdy ta encja jest włączona, a `compact` zostawia zwykły kafelek.

Pilot ma `kind: tv` oraz `entity`, `on` i `off` (`{service, target}`), `shortcuts` (`{name, icon}`,
dopasowywane do listy źródeł telewizora), `source_script` (`{service, field}`, dla wyłączonego
telewizora) i `sound_mode: true`.

## Pasek stanu pokoju

Pod nazwą pokoju jest jeden rząd ikon przewijany w bok: temperatura, wilgotność, jakość powietrza,
jasność, klimat, włączone światła i przełączniki, otwarte rolety, okna i drzwi, ruch, obecność,
alarmy. Dotknięcie ikony otwiera listę urządzeń z tej grupy. Sceny i skrypty pokoju stoją w osobnym rzędzie **Sceny** pod kamerami, ułożone tak jak sceny na stronie głównej.

## Intercom

```yaml
intercom:
  script: script.announce
  areas_field: obszary
  text_field: tekst
  file_field: plik
  played_field: odtworzono
  media_folder: media-source://media_source/media/wiadomosci
  areas: [living_room, bedroom]
```

Bez `script` przyciski się nie pokazują. Bez `areas` lista pokoi powstaje z satelitów Assist
i odtwarzaczy pasujących do `media.group_patterns`. Na stronie głównej jest przycisk do całego domu,
na stronie pokoju przycisk w nagłówku, który mówi tylko w tym pokoju, a na ekranie kamery przycisk do
pokoju tej kamery. Nagrywanie wymaga HTTPS i konta administratora; w pozostałych przypadkach jest pole
tekstowe, w którym działa dyktowanie z klawiatury.

## Tryb ciemny

Ustawienia → Urządzenia i usługi → Home Dashboard → **Konfiguruj** pozwala wybrać tryb Automatyczny,
Jasny albo Ciemny. Wybór działa od razu na wszystkich urządzeniach, bez odświeżania. Każdy może wybrać coś innego dla
siebie w **Tło tego ekranu** (Systemowy, Jasny, Ciemny), a ten wybór zostaje na jego koncie. Automatyczny idzie
za systemem, więc iPad ustawiony na Automatycznie ściemnia się o zmierzchu. Mapa dobiera kolory przy
otwarciu.

## Powrót do strony głównej na tablecie

Tablet pozostawiony bez dotyku zamyka to, co jest otwarte, i wraca na stronę główną po 3 minutach.
Zmienisz to w ustawieniach albo przez `idle: {return_after: 300}` w sekundach; `0` wyłącza powrót.
Telefony zostają tam, gdzie są. Pisana wiadomość, ustawienia, strona WWW i karta sterowania robotem
nigdy nie są zamykane.

## Kamery

Kamery są u góry strony jako pasek przewijany w bok, z wszystkimi kamerami, które mają przypisany
obszar. Na każdej miniaturze widać wiek obrazu. Pasek pokazuje dwa rodzaje źródeł:

- **Zapisane obrazy** (encje `image.*` kończące się na `_last_screen` lub `_last_snapshot`).
- **Kamery z platform z listy `cameras.snapshot_platforms`**, domyślnie `frigate`. Ich obraz pochodzi
  z serwera, który ma już gotową klatkę, więc nie budzi kamery. Odświeża się co 30 sekund, gdy
  strona jest widoczna.

Pozostałe encje `camera.*` są celowo odrzucane, bo ich miniatura pobierana jest z samego urządzenia,
a to rozładowuje kamery na baterię. Platforma z `cameras.battery_platforms` nigdy nie trafi do
paska, nawet gdy dopiszesz ją do `snapshot_platforms`.

Filtr **Ochrona** chowa pasek i pokazuje wszystkie kamery jedna pod drugą. Na ekranie kamery pasek
miniatur przełącza między kamerami, a przełączenie zatrzymuje strumień poprzedniej.

`cameras.guest` ukrywa wskazane kamery, gdy włączony jest tryb gościa. Bez `users` działa na każdym koncie.
Z `users` działa tylko na podanych kontach, po nazwie lub identyfikatorze, np. na koncie tabletu na ścianie:

```yaml
cameras:
  guest:
    entity: input_boolean.guest
    hide: [camera.living_room, camera.bedroom]
    users: [Tablet]
```

Dotknięcie obrazu otwiera go na pełnym ekranie, nadal bez strumienia. **Oglądaj na żywo** uruchamia
strumień z kamery tego samego urządzenia albo wskazanej w `cameras.live`. Zatrzymuje się po dwóch
minutach lub po zamknięciu ekranu.

## Zamki na tablecie ściennym

Na ekranie wielkości tabletu zamek można tylko zamknąć, bo tablet jest dostępny dla każdego. Ustaw
`security.unlock_on_tablet: true`, aby pozwolić na otwieranie. Na telefonie suwak musi dojść do
końca toru, więc przypadkowe przesunięcie nic nie zrobi. Zamek wymagający kodu używa na telefonie
zwykłego okna, a z tabletu nie da się go otworzyć.

## Rozwój

`make help` pokazuje kolejne kroki. `make ui` uruchamia testowy Home Assistant z prawdziwym
frontendem i encjami demo pod <http://127.0.0.1:8124/home-dashboard/home> (użytkownik `dev`, hasło `dev`).
`make test-all` uruchamia wszystko. Dopisz `?dashboard_debug=1` do adresu, aby zobaczyć pomiary ekranu.

Frontend nie ma kroku budowania: to zwykłe moduły ES, a Lit jest w `www/vendor`.

`tests/fixtures/registry_snapshot.json` to zanonimizowana kopia rzeczywistej instalacji, utworzona
skryptem `scripts/make_fixture.py`.

## FAQ

**Mały odtwarzacz cały czas pokazuje głośnik, na którym nic nie gra** — niektóre głośniki, np. HomePod po
zakończonym strumieniu AirPlay, dalej zgłaszają stan `playing`, ale bez tytułu. Od tej wersji taki głośnik się nie
pokazuje. Wstrzymane odtwarzanie znika po czasie z **Wygląd → Pasek → Wstrzymany zostaje** (domyślnie 10 minut), a
przycisk × zamyka odtwarzacz do czasu, aż coś zacznie grać.

**Dashboard zostaje jasny w nocy** — sprawdź tryb kolorów w opcjach integracji, ustawienie systemu, a w aplikacji Companion także jej
ustawienie motywu (Konfiguracja aplikacji → Motyw). Może też pomóc wyczyszczenie pamięci frontendu.

**Gdzie jest plik dashboardu** — to dashboard w pamięci HA: `.storage/lovelace.home_dashboard`. Home Assistant
trzyma go w pamięci, więc ręczna zmiana przy działającym systemie przepadnie. Użyj edytorów w dashboardzie.

**Blok ze stroną WWW pisze, że nie otworzy się przez HTTPS** — przeglądarka blokuje stronę `http://`
wewnątrz dashboardu `https://`. Otwórz dashboard w sieci domowej.

**Przeglądarka na dużym ekranie sama wraca na stronę główną** — wszystko od 900 px szerokości liczy się
jako tablet. Ustaw `idle: {return_after: 0}`.

**W pokoju nie ma ikony Intercomu** — blok `intercom` nie ma `script` albo w tym pokoju nie ma głośnika.

**Dashboard pokazuje „Timeout waiting for strategy element”** — integracja nie jest skonfigurowana
albo Home Assistant nie został uruchomiony ponownie po skopiowaniu plików.

**Brakuje światła** — prawdopodobnie należy do grupy świateł, która je zastępuje, albo nie ma pokoju.

**Pokój w menu przewija stronę zamiast się otworzyć** — urządzenie ma jeszcze starszą wersję. Odśwież
stronę, a w aplikacji Companion użyj Ustawienia → Companion App → Debugowanie → Resetuj pamięć
podręczną frontendu.

**Nazwa obszaru na stronie głównej nic nie robi albo pokój ma tylko światła** — strona ma starszą
wersję albo brakuje bloku `layout`. Odśwież stronę i opisz pokoje w `layout`.

**Nie widzę przycisków Intercom** — blok `intercom` nie ma `script`.

**Intercom: „Nie wysłano: w tym pokoju nie ma dostępnego głośnika”** — skrypt nie znalazł głośnika
w tym pokoju. Sprawdź, czy głośnik jest dostępny.

**Na pasku brakuje kamery** — kamera musi mieć przypisany obszar i być dostępna. Kamera bez
zapisanego obrazu musi pochodzić z platformy z `cameras.snapshot_platforms`.

**Roleta nie reaguje na przycisk albo procenty się rozjeżdżają** — większość rolet podaje pozycję dopiero
po zatrzymaniu, więc okno pokazuje postęp szacowany na 35 s pełnego przejazdu. Rzeczywista pozycja
zastępuje szacunek, gdy roleta stanie.

**Przycisk Zatrzymaj rolety jest wyszarzony** — ta roleta nie obsługuje zatrzymywania w Home Assistant.

**Okna nie da się zsunąć palcem** — ciągnij za uchwyt lub nagłówek. Suwak, tarcza termostatu, karty
i przewinięta treść zostawiają ruch palca dla siebie.

**Tło kończy się pod paskiem stanu, a pod dolną belką pojawia się czarny pasek** — strona ma starszą
wersję. Zamknij i otwórz aplikację, żeby ją odświeżyć.

**Pociągnięcie strony w dół nie odświeża jej w aplikacji** — strona przewija się w widoku dashboardu,
nie w oknie aplikacji. Zamknij i otwórz aplikację.

**Po wybraniu filtra na końcu strony jest pusta przestrzeń** — strona ma starszą wersję. Zamknij
i otwórz aplikację, żeby ją odświeżyć.

**Nie ma ołówka do edycji** — edycja jest w menu pod trzema kropkami, pod listą obszarów, dla
administratorów.

**Alarm otwiera okno Home Assistant zamiast okna dashboardu** — ten alarm wymaga kodu, a okno
dashboardu nie ma klawiatury.

**W Ochronie jest kafelek „Security mode” i jest niedostępny** — to alarm urządzenia, którego integracja
już nie ma. Dashboard pomija takie encje, a samo urządzenie można usunąć w Home Assistant.

**Alarm jest wyszarzony** — encja jest niedostępna, bo kamera nie odpowiada. Sprawdź kamerę
w aplikacji Eufy, nie ustawienia dashboardu.

**Kafelek nie ma ikony** — encja ma ikonę z zestawu, którego nie ma w Home Assistant. Dashboard
pokazuje wtedy ikonę domyślną, a własną ustawisz polem `icon` kafelka.

**Okno światła nie ma opcji urządzenia, np. harmonogramu** — takie urządzenie ma własną kartę. Podaj ją
w `entities.overrides` polem `card`.

**Dolny pasek zasłania odtwarzacz Music Assistant** — pasek chowa się tylko wtedy, gdy strona może
zajrzeć do ramki, czyli dla administratorów z kartą dodatku. Zwykła ramka z adresem `:8095` jest
niedostępna dla strony. Na tablecie pasek jest z boku i zostaje.

**Nie mogę wyłączyć trybu gościa** — kafelek z `turn_on_only` wyłącza się tylko przez klawiaturę PIN,
która wymaga pola `off_pin: {service: script.guest_unlock, field: pin}`. PIN sprawdza serwer.

**Strona nadal się powiększa palcami** — zamknij i otwórz aplikację. Sprawdź też w Companion ustawienie
powiększania gestem i wyłącz je.

**Kamera w pokoju jest rozmyta z napisem „Tryb gościa”** — włączony jest tryb gościa. Na stronie pokoju kamera zostaje
rozmyta i nie można jej otworzyć, a ze strony głównej i Ochrony znika.

**Klawisze pilota są wyszarzone** — telewizor jest wyłączony. Włącz go przyciskiem zasilania.

**Okna Home Assistant są ciemne przy jasnym dashboardzie** — strona ma starszą wersję. Dashboard
przełącza motyw HA na jasny tylko na czas otwarcia, bez zapisu, więc po wyjściu wraca Twój motyw.

**Mam dwie kamery tego samego miejsca** — jedna to zwykle zapisany obraz z innej integracji. Ukryj ją
listą `cameras.hide`, np. `hide: [image.garage_last_screen]`.

**Kamera jest rozmyta z napisem „Kamera niedostępna”** — encja jest niedostępna, np. Frigate nie dostaje
z niej obrazu. Sprawdź kamerę, a gdy wróci, obraz pojawi się sam.

**Chcę ukryć kamery z sypialni na tablecie** — podaj listę kamer w `cameras.hero` i `cameras.tiles`.
Wtedy strona pokazuje tylko je.

## Pochodzenie

Ten dashboard powstał jako koncepcja dla Home Assistant w projekcie Figma
[Future concept](https://www.figma.com/proto/ZPRTON7huEj9kyXzPNxNgK/Future-concept?node-id=263-7391&comments-enabled=1&starting-point-node-id=263%3A7391).

## Licencja

MIT. Lit jest dołączony na licencji BSD-3-Clause.
