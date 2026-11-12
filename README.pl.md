# Home Dashboard

[English](README.md)

Strategia dashboardu dla Home Assistant zaprojektowana pod dotyk: jeden dashboard na telefon
i tablet ścienny, z pastelowymi kafelkami, podsumowaniami, dolnym paskiem na telefonie i bocznym
na tablecie. Całość powstaje automatycznie z Twoich pokoi, więc nie piszesz kart ręcznie. Wygląd ustawiasz w
samym dashboardzie i zapisujesz jako motyw, którym możesz się podzielić; w zestawie są dwa: **Home Dashboard** i
**Apple Home**.

Stan: wczesna wersja.

<p align="center">
  <img src="docs/screenshots/pl/home.png" alt="Strona główna na iPhonie" height="380">
  <img src="docs/screenshots/pl/tablet-status.png" alt="Strona główna na iPadzie z paskiem statusu" height="380">
</p>
<p align="center">
  <img src="docs/screenshots/pl/apple-tablet-status.png" alt="Motyw Apple Home na iPadzie z paskiem statusu" height="380">
  <img src="docs/screenshots/pl/apple-home.png" alt="Motyw Apple Home na iPhonie" height="380">
</p>

<p align="center">
  <a href="docs/gallery.pl.md"><img src="https://img.shields.io/badge/Galeria-wszystkie_zrzuty-2c6fb7?style=for-the-badge" alt="Galeria"></a>
</p>

**[Otwórz galerię](docs/gallery.pl.md)** ze wszystkimi ekranami: kamery, energia z fazami licznika, interkom, motyw
Apple Home, edytory i wygląd. **[Przeczytaj przewodnik](docs/guide.pl.md)**, który krok po kroku opisuje pokoje, stronę główną, kamery, bloki i osoby.

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
    controls: {camera.hall_frigate: camera.hall}   # ta sama kamera w innej integracji: obraca i mówi (np. obraz z Frigate)
    talk: camera                       # mówienie przez głośnik kamery zamiast intercomu (domyślnie intercom)
    quick: {camera.garden: {siren: switch.garden_alarm, light: light.garden_floodlight}}   # przyciski syreny/światła/noktowizji
    battery_platforms: [my_platform]   # tylko kamery, które nie zgłaszają baterii
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

Administrator dodaje je i edytuje w formularzu: trzy kropki na stronie głównej → **Odznaki podsumowania**. Opis pól jest też niżej i w przewodniku.

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
`subtitle`, `status`, `bars`, `info`, `machines` i kartę `graph`. `power` kolumny pokazuje jej gniazdko:
`entity` (W), `voltage`, `current`, `energy` (kWh, liczone też od północy) i `switch` (tylko stan: gniazdka
serwera nie da się stąd wyłączyć), z wykresem mocy. Kafelek w pokoju
`{shortcut: Host, column: Proxmox, entity: sensor.nuc_moc, name: Intel NUC}` pokazuje moc i otwiera tylko
tę jedną maszynę. Blok z `card_open: true` pokazuje kartę bez przycisku.

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

Menu → **Wygląd** ustawia wygląd całego dashboardu: wyrazistość tła, odbicie przewijania, przyciski (krycie,
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
`order` w wierszu ustawia kolejność listy (`[400 Rpm, 800 Rpm, 1400 Rpm]`), gdy urządzenie podaje ją bez sensu.
Na tablecie blok z dwiema lub więcej grupami i bez karty otwiera się szerzej, z grupami w kolumnach, żeby zmieścił
się bez przewijania.
`card` dodaje kartę sterowania uruchamianą przyciskiem, a `frame` otwiera stronę WWW na całym ekranie.
`hidden_when` ukrywa blok, gdy ta encja jest włączona, a `compact` zostawia zwykły kafelek. Kafelek
`{shortcut: <nazwa>}` w pokoju pokazuje tam blok ze `shortcuts` bez drugiej kopii. `kind: scale` to waga łazienkowa
z ciałem każdej osoby z BodyMiScale ([przewodnik](docs/guide.pl.md#waga)).

Apple TV jako `kind: tv` sam dostaje pilota (strzałki, OK, wstecz, ekran główny, menu główne, odtwarzanie i
przewijanie, przez encję pilota swojego urządzenia), to, co teraz gra, z obrazkiem, i budzi się oraz usypia bez
`on` i `off`.
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
  upload: /api/intercom/message   # opcjonalnie: adres, który przyjmuje nagranie i sam je odtwarza
```

Bez `script` przyciski się nie pokazują. Bez `areas` lista pokoi powstaje z satelitów Assist
i odtwarzaczy pasujących do `media.group_patterns`. Na stronie głównej jest przycisk do całego domu,
na stronie pokoju przycisk w nagłówku, który mówi tylko w tym pokoju, a na ekranie kamery przycisk do
pokoju tej kamery. Nagrywanie wymaga HTTPS i konta administratora; w pozostałych przypadkach jest pole
tekstowe, w którym działa dyktowanie z klawiatury. Z `upload` (np. `/api/intercom/message` integracji Intercom)
plik WAV trafia pod ten adres z obszarami w adresie, a nagrywać może każdy zalogowany. Szczegóły są w
[przewodniku](docs/guide.pl.md#11-intercom).

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

## Pasek statusu na tablecie

Tablet trzymany poziomo może zamiast wąskiego paska pokazać kolumnę szerokości 320 px: godzinę i datę, pogodę z
najbliższym deszczem, co jest włączone i otwarte w domu, uwagi, co teraz działa (pralka, odkurzacz), odjazdy i pobór
mocy wybranych urządzeń. Część, która nie ma nic do powiedzenia, znika, a dotknięcie części otwiera jej okno. Włączasz
go w menu → **Wygląd** → **Pasek** → **Pasek statusu**, gdzie wybierasz też jego części, ich kolejność i kolory
(`appearance.status`). Dane bierze ze `status_panel`:

```yaml
status_panel:
  doors: [binary_sensor.drzwi_wejsciowe, binary_sensor.drzwi_balkonowe]
  now:
    - {entity: sensor.pralka_faza, detail: sensor.pralka_program, remaining: sensor.pralka_pozostalo}
    - vacuum.robot
  power: [sensor.pompa_ciepla_moc, sensor.komputer_moc]
  departures: [sensor.tramwaj_4]       # bez tego: pierwszy blok odjazdów
```

Jego przycisk zwija go na tym tablecie do wąskiego paska, a przytrzymanie przycisku otwiera menu. Szczegóły są w
[przewodniku](docs/guide.pl.md#pasek-statusu-na-tablecie).

## Energia

Strona Energia powstaje z ustawień energii Home Assistant: Teraz, Zużycie w porównaniu z poprzednim okresem, Koszt i
udział mierzony przez urządzenia, wykres z poprzednim okresem w tle oraz urządzenia. Licznik z fazami (np. ZAMEL
MEW-01) dodaje kartę każdej fazy z mocą, prądem, współczynnikiem mocy i napięciem na skali 207–253 V. Fazy są
znajdowane na urządzeniu licznika albo wpisane ręcznie:

```yaml
energy:
  phases:
    - {power: sensor.licznik_l1_moc, voltage: sensor.licznik_l1_napiecie, current: sensor.licznik_l1_prad, factor: sensor.licznik_l1_wspolczynnik_mocy}
  voltage_range: [207, 253]
```

Dotknięcie fazy, urządzenia lub kafelka otwiera własny wykres dashboardu z zakresami oraz wartością najniższą,
średnią i najwyższą. Szczegóły są w [przewodniku](docs/guide.pl.md#8-muzyka-energia-i-mapa).

Magazyn energii na baterię (stacja zasilania, np. EcoFlow) dostaje na stronie swoją kartę: naładowanie jako pasek,
co robi (ładuje się, rozładowuje), moc wejścia i wyjścia oraz na jak długo wystarczy. Dotknięcie otwiera okno jego
bloku, wskazanego przez `block`:

```yaml
energy:
  storage:
    - block: EcoFlow                     # blok z pokoju lub skrótów, otwierany po dotknięciu
      name: EcoFlow Delta 2
      battery: sensor.ecoflow_battery_level
      state: sensor.ecoflow_battery_charging_state
      labels: {charging: Ładuje się, discharging: Rozładowuje się}
      input: sensor.ecoflow_total_in_power
      output: sensor.ecoflow_total_out_power
      remaining: sensor.ecoflow_remaining_time   # minuty
```

## Kamery

Kamery są u góry strony jako pasek przewijany w bok, z wszystkimi kamerami, które mają przypisany
obszar. Na każdej miniaturze widać wiek obrazu. Pasek pokazuje dwa rodzaje źródeł:

- **Zapisane obrazy** (encje `image.*` kończące się na `_last_screen` lub `_last_snapshot`).
- **Kamery z platform z listy `cameras.snapshot_platforms`**, domyślnie `frigate`. Ich obraz pochodzi
  z serwera, który ma już gotową klatkę, więc nie budzi kamery. Odświeża się co 30 sekund, gdy
  strona jest widoczna.

Pozostałe encje `camera.*` są celowo odrzucane, bo ich miniatura pobierana jest z samego urządzenia,
a to rozładowuje kamery na baterię. Kamera na baterię (jej urządzenie ma czujnik `device_class: battery`
albo jej platforma jest w `cameras.battery_platforms`) nigdy nie trafi do paska, nawet gdy dopiszesz
jej platformę do `snapshot_platforms`.

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

Dotknięcie obrazu otwiera okno kamery, nadal bez strumienia. U góry są dni tygodnia, na dole linia czasu z
nagraniami: z Frigate albo z nagranych podglądów kamer eufy na baterię (folder mediów). **▶** odtwarza nagranie i
nigdy nie budzi kamery. **NA ŻYWO** uruchamia strumień z kamery tego samego urządzenia albo wskazanej w
`cameras.live`. Dopóki kamera się budzi, okno pokazuje jej ostatni obrazek z kółkiem ładowania, a plakietka jest
szara. Gdy wideo ruszy, przycisk zmienia się na **ROZŁĄCZ**, który kończy podgląd bez zamykania okna; przesunięcie
linii czasu też rozłącza. Podgląd zatrzymuje się po dwóch minutach albo po zamknięciu okna.

`cameras.controls` wskazuje kamerę, której urządzenie ma przyciski obracania i głośnik, gdy obraz pochodzi z innego
systemu (np. Frigate, a obracanie i mówienie z eufy). Ustawisz to też w **Ustawienia dashboardu → Ta sama kamera w
innej integracji**. Sposób obracania (eufy, ONVIF, wybrane ręcznie) i mówienia (głośnik kamery, go2rtc, interkom)
każdej kamery wybierasz w **Ustawienia dashboardu → Sterowanie i mówienie każdej kamery**. Mówienie przez kamerę działa
dopiero, gdy podgląd na żywo ruszy. Kamera niedostępna w Home Assistant zostaje w oknie z przygaszonym ostatnim
obrazkiem i napisem „Kamera jest niedostępna”. Na telefonie i tablecie trzymanym poziomo oraz w szerokim oknie komputera obraz zajmuje cały ekran, a dni i linię
czasu wysuwają przyciski. Szczegóły są w [przewodniku](docs/guide.pl.md#5-kamery).

Na tablecie wszystkie kamery wypełniają ekran, od 2 do 5 w rzędzie (`cameras.columns`), albo jedna duża kamera na
żywo z resztą małych (`cameras.layout: featured`). Kamera na baterię pokazuje czerwoną, migającą kropkę, gdy jej
strumień jest otwarty, a jej ustawienia mają zakładkę **Połączenia**: ile razy i jak długo była aktywna w ostatnich
24 godzinach lub 7 dniach. Przycisk z taśmą filmową pokazuje nagrania z dysku według dni, każde z obrazkiem, a kamera,
która udostępnia nagrania z własnej karty (`sd_recordings`, np. Neolink), dostaje przycisk karty, który je pobiera.

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

**Koniec nagranej wiadomości interkomu jest ucięty** — przeglądarka trzyma ostatnią chwilę głosu w buforach dźwięku,
a natychmiastowe zatrzymanie po „Gotowe” ją gubiło. Od tej wersji nagrywanie trwa jeszcze 0,7 s po „Gotowe” (okno
pokazuje w tym czasie wysyłanie), więc ostatnie słowa docierają do głośników.

**Przycisk mówienia przez kamerę nic nie robi albo jest przekreślony** — mówienie potrzebuje mikrofonu, a przeglądarka
daje go tylko przez HTTPS. Przez zwykłe `http://` (np. `http://homeassistant.local:8123`) przycisk pokazuje
przekreślony mikrofon, a dotknięcie mówi: „Mówienie przez kamerę wymaga połączenia HTTPS”. Otwórz Home Assistant przez
`https://`; w aplikacji Companion ustawisz to w Ustawienia → Aplikacja towarzysząca → Serwery → adres wewnętrzny. Zanim
podgląd na żywo ruszy, dotknięcie mówi: „Mówienie przez kamerę działa po włączeniu podglądu na żywo”. Intercom działa
bez HTTPS: otwiera pole do wpisania wiadomości.

**Suwak głośności kamery na iPhonie nic nie zmieniał, a dźwięk znikał dopiero w skrajnym położeniu** — iPhone i iPad
pozwalają zmieniać głośność wideo tylko przyciskami urządzenia. Od tej wersji dźwięk idzie przez Web Audio i suwak
działa płynnie. Wyjątek: podgląd odtwarzany jako HLS na iPhonie da się tylko włączyć i wyciszyć.

**Okno kamery robiło się czarne, gdy kamera się rozłączyła** — od tej wersji zostaje ostatni obrazek, przygaszony, z
napisem „Kamera jest niedostępna”, a NA ŻYWO jest zablokowane do jej powrotu.

**W poziomie podgląd na żywo był przesunięty w lewo, a z prawej był czarny pas** — poprawione: podgląd i obrazek
zastępczy są wyśrodkowane.

**Przycisk mówienia przez kamerę jest szary** — mówienie przez kamerę działa dopiero, gdy podgląd na żywo ruszy, czyli
widzisz, do kogo mówisz. Włącz NA ŻYWO i poczekaj, aż obraz się poruszy.

**Podgląd NA ŻYWO nie ma dźwięku, choć głośnik jest włączony (nagrania mają)** — karta kamery Home Assistant
uruchamia odtwarzacz wyciszony, a wyciszony odtwarzacz WebRTC na stałe wyrzuca ścieżkę audio strumienia. Dźwięk był
więc tylko wtedy, gdy wygrał HLS. Od tej wersji odtwarzacz zawsze przyjmuje dźwięk, a słychać go dopiero po
dotknięciu głośnika. Jeśli dalej go nie ma, wczytaj aplikację od nowa (niżej).

**Po naciśnięciu NA ŻYWO okno było czarne, zanim kamera się połączyła** — odtwarzacz Home Assistant jest czarny do
pierwszej klatki, a kamera na baterię budzi się kilka sekund. Od tej wersji do chwili, gdy wideo ruszy, okno pokazuje
ostatni obrazek kamery. Jeśli dalej widzisz czarny ekran, wczytaj aplikację od nowa (niżej).

**Kamera Frigate ma w oknie intercom zamiast głośnika kamery** — obraz pochodzi z Frigate, które nie ma głośnika.
Połącz ją z tą samą kamerą z eufy w **Ustawienia dashboardu → Ta sama kamera w innej integracji** i ustaw **Mówienie
w oknie kamery → Głośnik kamery**.

**Poza domem aplikacja pokazuje starą wersję dashboardu** — aplikacja Home Assistant wraca z tła ze starym kodem
w pamięci albo trzyma kopię pliku. Menu → **Ustawienia dashboardu** → na dole **Wczytaj aplikację od nowa** (administratorzy): czyści pamięć
podręczną, pobiera świeże pliki dashboardu i otwiera stronę od nowa. Działa przez każdą sieć, którą aplikacja łączy
się z Home Assistant. Gdy i to nie pomoże: Ustawienia aplikacji → Companion App → Debugowanie → Resetuj pamięć
frontendu.

**Po obróceniu telefonu dolny pasek jest wąski i przyklejony do prawej krawędzi** — pasek omija boczne menu Home
Assistant, które w poziomie na szerszym telefonie (powyżej 870 px) się pokazuje. Gdy telefon obrócono przy
schowanej aplikacji, pasek zapamiętywał położenie strony z poziomu. Od tej wersji mierzy się na nowo przy każdym
obrocie i po powrocie do aplikacji. Na starszej wersji pomaga dotknięcie strony albo jej odświeżenie.

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
