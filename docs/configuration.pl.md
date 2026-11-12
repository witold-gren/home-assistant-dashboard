# Opis konfiguracji Home Dashboard

Wszystkie klucze, które czyta dashboard, z typem, wartością domyślną i krótkim przykładem, oraz wszystkie okna edycji
razem z kluczami, które zapisują. [Przewodnik](guide.pl.md) prowadzi przez funkcje krok po kroku; ta strona służy do
szybkiego sprawdzenia klucza.

[English](configuration.md) · [Przewodnik](guide.pl.md) · [README](../README.pl.md)

Wszystkie identyfikatory encji, nazwy i adresy poniżej są zmyślone.

## 1. Gdzie jest konfiguracja

Konfiguracja to blok `strategy:` dashboardu. Wymagany jest tylko `type`:

```yaml
strategy:
  type: custom:home-dashboard
  favorites: [climate.living_room]
  layout: []
```

Cała reszta jest opcjonalna i ma wartość domyślną. Zmienisz ją w trzech miejscach:

| Gdzie | Kto | Co |
|---|---|---|
| Menu → **Ustawienia dashboardu** → **Edytuj konfigurację** | administratorzy | cały blok jako YAML, bez `type` |
| **Edytor surowej konfiguracji** dashboardu w Home Assistant | administratorzy | to samo, razem z `type` |
| okna edycji dashboardu | patrz [rozdział 13](#13-okna-edycji) | jego części, bez YAML |

Do edytora Home Assistant dojdziesz przez Ustawienia → Dashboardy → dashboard → trzy kropki → **Edytuj dashboard** →
trzy kropki → **Edytor surowej konfiguracji**, bo dashboard chowa nagłówek Home Assistant.

Home Assistant przechowuje dashboard jako JSON, więc komentarze z YAML znikają po zapisie.

Ustawienia leżą w trzech miejscach:

| Rodzaj | Gdzie | Przykłady |
|---|---|---|
| **Wspólne** | blok `strategy:` | `layout`, `shortcuts`, `appearance`, `access` |
| **Osoby** | dane użytkownika konta (`home_dashboard`), na wszystkich urządzeniach | Mój układ, własny wygląd |
| **Urządzenia** | przeglądarka urządzenia | otwieranie przy starcie, kolumny ściany kamer |

Ustawienia osoby i urządzenia nie są częścią YAML. Wymienia je
[rozdział 15](#15-ustawienia-osoby-i-urządzenia).

## 2. Klucze najwyższego poziomu

| Klucz | Typ | Domyślnie | Co ustawia | Więcej |
|---|---|---|---|---|
| `layout` | lista pokoi | `[]` | pokoje opisane ręcznie: obszary, kafelki na głównej, sekcje | [3](#3-pokoje) |
| `rooms` | mapa | order `[]`, hidden `[]` | kolejność i ukrycie pokoi | [3](#rooms) |
| `entities` | mapa | puste | dodawanie, pomijanie i nadpisywanie encji | [3](#entities) |
| `lights` | mapa | `prefer_groups: true` | grupy świateł zamiast ich lamp | [3](#lights) |
| `favorites` | lista encji | `[]` | kafelki nad pokojami na stronie głównej | [4](#favorites) |
| `scenes` | lista kafelków | `[]` | rząd Sceny na stronie głównej | [4](#scenes-i-scenes_layout) |
| `scenes_layout` | `row` albo brak | brak | sceny w jednym rzędzie przewijanym w bok | [4](#scenes-i-scenes_layout) |
| `weather` | mapa albo `false` | wykrywane samo | chip pogody i jego okno | [4](#weather) |
| `security` | mapa | patrz sekcja | otwieranie na tablecie, grupa w filtrze Ochrona | [4](#security) |
| `idle` | mapa | `return_after: 180` | powrót tabletu na stronę główną | [4](#idle) |
| `cameras` | mapa | patrz sekcja | które kamery widać i jak działają | [5](#5-kamery) |
| `shortcuts` | lista bloków | `[]` | skróty na stronie głównej i w menu | [6](#6-skróty-i-bloki) |
| `music` | mapa | brak | strona Muzyka zamiast Mediów | [7](#music) |
| `media` | mapa | patrz sekcja | głośniki będące jednym urządzeniem, strona Media | [7](#media) |
| `map` | mapa | `track: []` | urządzenia z trasą na Mapie | [7](#map) |
| `energy` | mapa | wykrywane samo | fazy licznika, zakres napięcia, magazyny energii | [7](#energy) |
| `menu` | mapa | skróty i podstawowe linki | grupy lewego menu | [8](#8-menu) |
| `appearance` | mapa | zwykły wygląd | wspólny wygląd | [9](#appearance) |
| `themes` | lista | `[]` | biblioteka motywów | [9](#themes-i-theme) |
| `theme` | id motywu | brak | motyw, od którego zaczął się wygląd | [9](#themes-i-theme) |
| `backgrounds` | mapa | `{}` | wspólne tła stron | [9](#backgrounds-i-background) |
| `background` | tekst albo mapa | brak | starsze tło strony głównej | [9](#backgrounds-i-background) |
| `access` | mapa wg id użytkownika | `{}` | co zabrano danej osobie | [10](#access) |
| `visibility` | mapa wg klucza | `{}` | kto widzi kafelek albo blok | [10](#visibility) |
| `status_panel` | mapa | patrz sekcja | dane paska statusu tabletu | [11](#11-pasek-statusu-tabletu) |
| `intercom` | mapa | bez skryptu | wiadomości głosowe i tekstowe do pokoi | [12](#12-intercom) |
| `schema` | liczba | `1` | wersja formatu; nie zmieniaj jej | |

## 3. Pokoje

Bez `layout` każdy obszar, w którym jest coś do pokazania, staje się pokojem. Same z siebie kafelkami zostają tylko
światła, klimat, rolety i zamki, pogrupowane według rodzaju. Pierwszy zapis w edycji pokoju zapisuje pokój w `layout`.
Od tej chwili pokazuje on dokładnie to, co tam jest. Więcej w przewodniku: [Pokoje](guide.pl.md#3-pokoje).

### `layout`

Lista pokoi. Pokoje stoją w tej kolejności, a obszary nieobjęte żadnym pokojem idą po nich.

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `id` | tekst | **wymagany** | id pokoju; dla jednego obszaru użyj id obszaru |
| `name` | tekst | **wymagany** | nazwa na stronie głównej i na stronie pokoju |
| `areas` | lista id obszarów | `[]` | obszary złączone w ten pokój: ich kamery, rząd statusu i intercom |
| `home` | lista [kafelków](#kafelki) | `[]` | kafelki tego pokoju na stronie głównej |
| `sections` | lista [sekcji](#sekcje) | `[]` | strona pokoju |
| `scenes` | lista [kafelków](#kafelki) | sceny i skrypty obszarów | rząd Sceny pod kamerami |
| `status` | lista [grup statusu](#rząd-statusu-pokoju-status) | `[]` | własne kółka w rzędzie statusu |
| `background` | tekst albo mapa | brak | starsze tło pokoju; użyj [`backgrounds`](#backgrounds-i-background) |

```yaml
layout:
  - id: kitchen
    name: Kuchnia i jadalnia
    areas: [kitchen, dining_room]
    home:
      - {entity: light.kitchen, name: Główne}
    scenes:
      - {entity: scene.kitchen_dinner}
    sections:
      - title: Oświetlenie
        tiles:
          - {entity: light.kitchen, name: Główne}
          - {entity: light.kitchen_counter}
```

Pokój pasuje po `id` albo po dowolnym z `areas`, więc link do obszaru otwiera pokój, który go zawiera.

### Sekcje

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `title` | tekst | brak | nagłówek; po nim sekcję rozpoznają też Mój widok i Dostęp użytkowników |
| `tiles` | lista [kafelków](#kafelki) | **wymagany** | kafelki; lista może być pusta |
| `layout` | `row` | brak | jeden rząd przewijany w bok zamiast siatki |

```yaml
sections:
  - title: Automatyzacje
    layout: row
    tiles:
      - {entity: automation.blinds_at_dusk, calm: true, tap_toggle: true}
```

Sekcję bez tytułu rozpoznaje jej miejsce. Przesunięcie jej zmienia więc to, co ktoś w niej ukrył.

### Kafelki

Kafelek to jedna pozycja w `home`, `sections[].tiles`, `scenes`, `scenes` pokoju i `media.sections[].tiles`. Wskazuje
encję, [skrót](#6-skróty-i-bloki) albo sam jest całym blokiem (`kind: panel`, `kind: scale`, `kind: tv`).

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `entity` | id encji | **wymagany** bez `shortcut` i bloku | encja kafelka |
| `name` | tekst | nazwa encji bez nazwy pokoju | własna nazwa |
| `icon` | `mdi:…` | z Home Assistant | własna ikona; **Wygląd → Ikony** ma pierwszeństwo |
| `size` | `tall` | płaski | dwa wiersze wysokości, ikona u góry; nie dla bloków, które mają szerokość dwóch |
| `calm` | `true` | `false` | bez koloru po włączeniu, przygaszony po wyłączeniu; dla rzeczy prawie zawsze włączonych |
| `tap_toggle` | `true` | `false` | dotknięcie w dowolnym miejscu przełącza encję (`homeassistant.toggle`), bez okna |
| `action` | `domena.usługa` | brak | dotknięcie wywołuje tę usługę, bez danych, zamiast zwykłej akcji |
| `active_only` | `true` | `false` | widoczny tylko, gdy encja działa (nie off, idle, paused, standby…) |
| `turn_on_only` | `true` | `false` | dotknięcie tylko włącza; potem nic się nie dzieje, chyba że jest `off_pin` |
| `off_pin` | `{service, field}` | brak | z `turn_on_only`: klawiatura, PIN trafia do usługi w polu `field` |
| `confirm` | `true` | `false` | `select` lub `input_select`: okno zaznacza opcję, a uruchamia ją dopiero przycisk |
| `labels` | mapa opcja → tekst | brak | `select` lub `input_select`: własne nazwy opcji |
| `shortcut` | nazwa skrótu | brak | kafelek zastępuje ten blok; pozostałe klucze kafelka mają pierwszeństwo |
| `column` | tytuł kolumny | brak | ze skrótem `kind: host`: tylko ta maszyna |
| `kind` | `panel`, `scale`, `tv` | brak | kafelek jest blokiem tego rodzaju, patrz [rozdział 6](#6-skróty-i-bloki) |

Z `turn_on_only`, `tap_toggle` i `action` działa tylko jeden, w tej kolejności. `tap_toggle` i `action` nic nie robią,
gdy encja jest niedostępna.

```yaml
tiles:
  - {entity: input_boolean.guest_mode, turn_on_only: true, off_pin: {service: script.guest_off, field: pin}}
  - {entity: switch.garden_pump, action: script.water_garden_10_min}
  - {entity: media_player.tv, active_only: true}
  - {entity: light.sofa, size: tall}
```

**Lista z własnymi nazwami i przyciskiem uruchomienia.** `labels` i `confirm` działają na kafelku encji `select` albo
`input_select`: w pokoju, na stronie głównej, w Scenach i w kategoriach mediów (nie w `favorites`, które są samymi id
encji):

- `labels` zmienia nazwy opcji na kafelku i w jego oknie. Opcja bez własnej nazwy zostaje przy nazwie z Home Assistant.
- `confirm: true` zmienia okno: nad opcjami jest napis **Zaznacz, a potem uruchom**, dotknięcie tylko zaznacza opcję,
  a wybiera ją dopiero przycisk **Uruchom: …** pod opcjami. Przycisk jest szary, dopóki nic nie jest zaznaczone, i
  gdy encja jest niedostępna. Pasuje to do ekspresu, który nie powinien robić kawy od przypadkowego muśnięcia ekranu.

```yaml
tiles:
  - entity: select.coffee_drink
    name: Kawa
    confirm: true
    labels: {espresso: Espresso, lungo: Duża kawa, hot_water: Gorąca woda}
```

**Kafelek wskazujący skrót.** `{shortcut: Odkurzacz, entity: vacuum.robot}` pokazuje liczby bloku o nazwie `Odkurzacz`
i otwiera jego okno, bez drugiej kopii bloku. To, co kafelek ustawia sam, ma pierwszeństwo przed blokiem. Skrót
zabrany komuś w [Dostępie użytkowników](#access) znika też z pokoi. Maszyna ze skrótu `kind: host` (`column`) pokazuje
na kafelku stan swojego `entity` (moc gniazdka), a bez niego swój `subtitle`:

```yaml
tiles:
  - {shortcut: Odkurzacz, entity: vacuum.robot}
  - {shortcut: Serwery, column: NUC, entity: sensor.nuc_power, name: Intel NUC}
```

### Rząd statusu pokoju (`status`)

Pod nazwą pokoju dashboard sam pokazuje kółka: temperaturę, wilgotność, włączone światła, otwarte okna i inne.
`status` dodaje własne kółka. Ich encje znikają z kółek automatycznych.

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `name` | tekst | brak | tytuł kółka |
| `entities` | lista encji | **wymagany** | to, co liczy jako włączone |
| `type` | `motion`, `switch` albo brak | brak | `motion`: ruch albo nie; `switch`: wł., wył., „2 z 3"; brak: otwarte |
| `icon` | `mdi:…` | wg typu | własna ikona |

```yaml
layout:
  - id: hall
    name: Przedpokój
    areas: [hall]
    status:
      - {name: Drzwi, entities: [binary_sensor.front_door, binary_sensor.back_door]}
      - {name: Ruch, type: motion, entities: [binary_sensor.hall_motion]}
```

### `rooms`

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `order` | lista id pokoi | `[]` | te pokoje najpierw, w tej kolejności; reszta w zwykłej kolejności |
| `hidden` | lista id pokoi | `[]` | pokoje ukryte przed wszystkimi |

Zapisuje je **Mój układ → Obszary → Dla wszystkich**. Własna kolejność osoby zastępuje u niej `order`.

### `entities`

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `include` | mapa id pokoju → lista encji | `{}` | dodaje encje dowolnej domeny do pokoju bez `layout` |
| `exclude` | lista encji | `[]` | nigdy nie pokazuje ich samodzielnie |
| `overrides` | mapa encja → opcje | `{}` | dla jednej encji: `area`, `name`, `icon`, `card` |

Opcje `overrides`:

| Klucz | Znaczenie |
|---|---|
| `area` | id obszaru; encja liczy się tak, jakby tam była |
| `name` | nazwa w całym dashboardzie |
| `icon` | ikona w całym dashboardzie |
| `card` | karta Home Assistant otwierana zamiast okna dashboardu; okrągła ikona też ją otwiera |

```yaml
entities:
  include:
    kitchen: [switch.dishwasher]
  exclude: [light.tablet_screen]
  overrides:
    cover.window_3: {area: bedroom, name: Roleta, icon: mdi:blinds}
    light.aquarium: {card: {type: custom:lamp-card, entity: light.aquarium}}
```

### `lights`

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `prefer_groups` | logiczny | `true` | grupa świateł zastępuje swoje lampy; `false` pokazuje każdą lampę |

## 4. Strona główna

Więcej w przewodniku: [Strona główna](guide.pl.md#4-strona-główna).

### `favorites`

Lista id encji nad pokojami. Zapisuje ją **Mój układ → Ulubione → Dla wszystkich**. Osoba z własnymi ulubionymi widzi
swoje.

```yaml
favorites: [climate.living_room, lock.front_door]
```

### `scenes` i `scenes_layout`

`scenes` to lista [kafelków](#kafelki) pod kamerami na stronie głównej i na stronie Sceny. `scenes_layout: row`
układa je, razem z rzędami Sceny w pokojach, w jeden rząd przewijany w bok.

```yaml
scenes:
  - {entity: scene.movie_night, name: Film}
  - {entity: script.good_night}
scenes_layout: row
```

### `weather`

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `entity` | encja pogody | pierwsza | chip i bieżące odczyty |
| `forecast` | encja pogody | pierwsza z prognozą | prognoza godzinowa i dzienna |

`weather: false` usuwa chip. Więcej w przewodniku: [Pogoda](guide.pl.md#pogoda).

```yaml
weather:
  entity: weather.home_station
  forecast: weather.forecast_home
```

### `security`

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `unlock_on_tablet` | logiczny | `false` | pozwala otworzyć zamek na tablecie; zamek z kodem otwiera wtedy okno HA |
| `group` | `{name, entities}` | brak | te kafelki razem na górze filtra Ochrona; muszą być kafelkami pokoi |

```yaml
security:
  unlock_on_tablet: false
  group: {name: Gość, entities: [input_boolean.guest_mode]}
```

### `idle`

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `return_after` | sekundy | `180` | zostawiony tablet zamyka to, co otwarte, i wraca na stronę główną; `0` wyłącza |

**Ustawienia dashboardu → Powrót na tablecie do strony głównej po** zapisuje go w pełnych minutach (0, 1, 3, 5, 10).

## 5. Kamery

Więcej w przewodniku: [Kamery](guide.pl.md#5-kamery).

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `snapshot_platforms` | lista integracji | `[frigate]` | `camera.*` tych integracji są w pasku kamer |
| `battery_platforms` | lista integracji | `[]` | kamery na baterię, które jej nie zgłaszają; nigdy w pasku |
| `hero` | id encji | brak | razem z `tiles`: dokładnie ta lista i nic więcej, ta kamera pierwsza |
| `tiles` | lista encji | `[]` | razem z `hero`: reszta dokładnej listy |
| `order` | lista encji | `[]` | wspólna kolejność paska |
| `hide` | lista encji | `[]` | ukryte przed wszystkimi |
| `private` | lista `{entity, hide}` | `[]` | gdy `entity` jest włączona, kamery z `hide` znikają ze wszystkich stron |
| `guest` | `{entity, hide, users}` | brak | gdy `entity` jest wł., `hide` znika z głównej i Ochrony, w pokoju rozmyte |
| `live` | mapa obraz → kamera | `{}` | kamera grająca na żywo dla obrazu `image.*` |
| `controls` | mapa kamera → kamera | `{}` | ta sama kamera w innej integracji: sterowanie, przyciski, mówienie |
| `ptz` | mapa kamera → ustawienie | `{}` | jak obraca się kamera, patrz niżej |
| `quick` | mapa kamera → `{siren, light, night}` | `{}` | własne encje okrągłych przycisków albo `none` |
| `talk_with` | mapa kamera → tryb | `{}` | `auto`, `go2rtc`, `intercom` albo `none` |
| `talk` | `intercom` albo `camera` | `intercom` | mówienie w oknie kamery: intercom pokoju albo głośnik kamery |
| `settings` | mapa kamera → lista encji | `{}` | własny wybór encji pod trybikiem okna kamery |
| `columns` | od 2 do 5 | `3` | kamery w rzędzie wszystkich kamer na tablecie |
| `layout` | `grid` albo `featured` | `grid` | wszystkie kamery jednakowe albo jedna duża na żywo, a reszta mała |
| `recordings_folder` | adres źródła mediów | folder eufy | gdzie są nagrane podglądy kamer eufy |

`guest.users` ogranicza tryb gościa do tych kont, po nazwie albo id. Bez niego tryb gościa dotyczy wszystkich.

Ustawienie `ptz` jednej kamery:

| Klucz | Znaczenie |
|---|---|
| `mode` | `auto` (domyślnie), `eufy`, `onvif`, `manual` albo `none` |
| `left`, `right`, `up`, `down` | przy `manual`: przycisk, skrypt albo scena dla każdego kierunku |
| `select`, `button` | przy `manual`: lista pozycji i przycisk, który jedzie do wybranej |
| `presets` | przy `onvif`: tokeny zapisanych pozycji |

`quick` przyjmuje `siren`, `switch`, `input_boolean` albo `script` dla `siren`; `light`, `switch` albo `input_boolean`
dla `light`; `select` albo `input_select` dla `night`. Encja innej domeny jest pomijana, a przycisk dashboard
znajduje sam.

```yaml
cameras:
  snapshot_platforms: [frigate, generic]
  order: [camera.front_door, camera.garden]
  private:
    - {entity: switch.bedroom_privacy, hide: [camera.bedroom]}
  guest:
    entity: input_boolean.guest_mode
    hide: [camera.living_room]
    users: [Tablet]
  live: {image.front_door_last_screen: camera.front_door}
  controls: {camera.hall_frigate: camera.hall}
  ptz:
    camera.driveway: {mode: onvif, presets: ["1", "2"]}
  quick:
    camera.garden: {siren: switch.garden_alarm, light: light.garden_floodlight, night: none}
  talk_with: {camera.garden: go2rtc}
  settings:
    camera.garden: [switch.garden_microphone, select.garden_night_vision]
  columns: 4
  layout: featured
```

## 6. Skróty i bloki

`shortcuts` to lista bloków. Każdy jest przyciskiem za chipami na stronie głównej i pozycją lewego menu (chyba że
`menu` ma własne pozycje). Blok `kind: panel`, `scale` albo `tv` może też stać między kafelkami pokoju. Więcej w
przewodniku: [Skróty i bloki](guide.pl.md#7-skróty-i-bloki) i [Okna dla własnych urządzeń](own-devices.pl.md).

### Klucze każdego skrótu

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `kind` | tekst | **wymagany** | jeden z rodzajów poniżej |
| `name` | tekst | **wymagany** | nazwa; zarazem klucz skrótu w `access`, `visibility`, `menu` i kafelkach |
| `icon` | `mdi:…` | brak | ikona |
| `label` | tekst | brak | mały tekst nad nazwą na stronie głównej |
| `tone` | `green`, `purple`, `teal`, `pink` | wg kolejności | kolor ikony na stronie głównej |
| `hidden_when` | id encji | brak | skrót, a także kafelek bloku, znika, gdy ta encja jest `on` |

| Rodzaj | Okno | Sekcja |
|---|---|---|
| `panel` | wiersze, liczby, przyciski i karta kilku encji | [panel](#kind-panel) |
| `tv` | pilot | [tv](#kind-tv) |
| `host` | maszyny: obciążenie, fakty, maszyny wirtualne, gniazdko | [host](#kind-host) |
| `scale` | waga łazienkowa z BodyMiScale | [scale](#kind-scale) |
| `overview` | ekran Status | [overview](#kind-overview) |
| `departures` | tramwaje i autobusy | [departures](#kind-departures) |
| `news` | artykuły do czytania | [news](#kind-news) |
| `school` | rok szkolny | [school](#kind-school) |
| `page` | strona dashboardu w oknie | [page](#kind-page) |
| `app` | dodatek z interfejsem WWW | [app](#kind-app) |

### `kind: panel`

Blok kilku encji. Na kafelku pokazuje stan i liczby, a dotknięcie otwiera jego okno. Jako kafelek potrzebuje `name`;
`entity` jest opcjonalne.

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `entity` | id encji | brak | główna encja: stan i podświetlenie; blok z nieistniejącą `entity` się nie pokazuje |
| `status` | id encji | `entity` | encja, której stan pokazuje kafelek |
| `labels` | mapa stan → tekst | brak | własne słowa dla tego stanu na kafelku |
| `state_text` | tekst | brak | stały tekst na kafelku zamiast stanu |
| `active` | id encji | `entity` | kafelek świeci, gdy ta encja ma stan `active_state` |
| `active_state` | tekst | `on` | stan, który podświetla kafelek |
| `compact` | `true` | `false` | zwykły kafelek bez liczb, o szerokości jednego |
| `stats` | lista | `[]` | liczby na kafelku i u góry okna |
| `actions` | lista | `[]` | przyciski |
| `groups` | lista | `[]` | wiersze encji |
| `details` | id encji | brak | trybik w nagłówku otwiera okno tej encji |
| `card` | karta Home Assistant | brak | karta w oknie, uruchamiana przyciskiem |
| `card_open` | `true` | `false` | karta od razu, bez przycisku |
| `card_last` | `true` | `false` | z `card_open`: karta pod grupami |
| `card_label`, `card_icon` | tekst, `mdi:…` | „Steruj" | przycisk uruchamiający kartę |
| `admin_card` | `true` | `false` | z `auto_card`: karta tylko dla administratorów, inni dostają `frame` lub wiersze |
| `auto_card` | `true` | `false` | okno jest samą kartą |
| `frame` | adres | brak | strona WWW na całe okno zamiast wszystkiego innego |
| `fullscreen` | `true` | `false` | cały ekran; z `card_open` dwie kolumny na tablecie w poziomie |

Pozycje `stats`: `name`, `entity`, `unit`, `digits` (miejsca po przecinku), `format: duration` (sekundy jako m:ss) i
`labels` (stan → tekst). Liczba z `unit: "%"` dostaje pasek w dwóch kolumnach `fullscreen`.

Pozycje `actions`:

| Klucz | Znaczenie |
|---|---|
| `name`, `icon` | przycisk |
| `entity` | **wymagany**: przycisk bez istniejącej encji się nie pokazuje |
| `service` | `domena.usługa` wywołana z `entity_id` z `entity`; bez niej encja zostaje naciśnięta albo włączona |
| `confirm` | treść pytania zadanego najpierw |

Pozycje `groups`:

| Klucz | Znaczenie |
|---|---|
| `title` | nagłówek |
| `layout` | brak: wiersze; `controls`: duże przełączniki, wybory, suwaki, małe karty; `summary`: jedna linia |
| `rows` | lista wierszy |

Wiersz to `{entity, name}`, opcjonalnie z `icon`, `unit`, `digits`, `format`, `labels`, `icons` (opcja → ikona, dla
wyborów w `controls`), `order` (kolejność opcji listy) i `hide` (opcje listy, których nikt nie używa; znikają, chyba że
urządzenie jest akurat na jedną z nich ustawione). Co robi wiersz, zależy od domeny:

| Domena | Wiersz |
|---|---|
| `switch`, `input_boolean`, `light`, `fan` | przełącznik |
| `select`, `input_select` | lista (`controls`: wybory) |
| `number`, `input_number` | suwak |
| `button`, `input_button`, `script` | przycisk |
| każda inna | wartość; dotknięcie otwiera jej okno |

Grupa `summary` rozwija się sama, gdy czujnik drzwi, okna albo problemu w niej jest włączony.

```yaml
shortcuts:
  - kind: panel
    name: Pralka
    icon: mdi:washing-machine
    entity: sensor.washer_state
    labels: {running: Pierze}
    active: sensor.washer_state
    active_state: running
    stats:
      - {name: Zostało, entity: sensor.washer_time_left, format: duration}
      - {name: Woda, entity: sensor.washer_water, unit: l, digits: 1}
    actions:
      - {name: Start, icon: mdi:play, entity: button.washer_start, confirm: Uruchomić pranie?}
    groups:
      - title: Pranie
        layout: controls
        rows:
          - {entity: select.washer_spin, name: Wirowanie, order: ["400", "800", "1200"]}
      - title: Stan
        layout: summary
        rows:
          - {entity: binary_sensor.washer_door, name: Drzwi}
    card: {type: custom:washer-card, entity: sensor.washer_state}
    card_open: true
    card_last: true
```

### `kind: tv`

Pilot. Jako kafelek otwiera pilota, jako skrót także.

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `entity` | odtwarzacz | **wymagany** | telewizor |
| `on`, `off` | `{service, target}` | `media_player.turn_on` / `turn_off` | własny sposób włączania i wyłączania |
| `shortcuts` | lista `{name, icon}` | `[]` | źródła jako przyciski, dopasowane po nazwie do listy telewizora |
| `source_script` | `{service, field}` | brak | źródło wybrane przy wyłączonym TV trafia do tej usługi w `field` |
| `sound_mode` | `true` | `false` | wybór trybu dźwięku |

Telewizor webOS sam dostaje strzałki i klawisze, a Apple TV pilota przez encję `remote` swojego urządzenia.

```yaml
tiles:
  - kind: tv
    entity: media_player.living_room_tv
    name: Telewizor
    on: {service: script.tv_on}
    shortcuts:
      - {name: YouTube, icon: mdi:youtube}
      - {name: HDMI 1, icon: mdi:video-input-hdmi}
```

### `kind: host`

Maszyny: paski obciążenia, fakty, maszyny wirtualne, karta wykresu i gniazdko każdej z nich. Tylko do odczytu.

| Klucz | Typ | Znaczenie |
|---|---|---|
| `columns` | lista | jedna karta na maszynę |
| `columns[].title` | tekst | nazwa maszyny; `column` kafelka wybiera ją |
| `columns[].icon`, `subtitle` | `mdi:…`, tekst | nagłówek |
| `columns[].status` | id encji | kropka: on, running, home, online albo true to zielona |
| `columns[].bars` | lista `{name, entity, unit, digits, max, warn, alert}` | paski obciążenia, patrz niżej |
| `columns[].info` | lista `{name, entity, unit, digits, type}` | fakty, patrz niżej |
| `columns[].machines` | lista `{name, status, cpu, ram}` | maszyny wirtualne z CPU i RAM w % |
| `columns[].graph` | karta Home Assistant | karta pod maszyną |
| `columns[].power` | `{entity, switch, voltage, current, energy}` | inteligentne gniazdko, patrz niżej |

Pasek jest pełny przy `max` (domyślnie 100), pomarańczowy od `warn` % (70) i czerwony od `alert` % (90). `type` faktu:
`since` (czas od daty), `seconds` (czas trwania), `date` (dziś, wczoraj, n dni temu), `update` (wersja zainstalowana →
najnowsza) albo `state` (surowy stan); bez niego liczba z `unit` i `digits`. `power` pokazuje waty z `entity`, stan
`switch` (nigdy nie przełączany stąd), `voltage`, `current`, `energy` dziś i łącznie oraz wykres mocy.

```yaml
shortcuts:
  - kind: host
    name: Serwery
    icon: mdi:server
    columns:
      - title: NUC
        status: binary_sensor.nuc_online
        bars:
          - {name: CPU, entity: sensor.nuc_cpu, unit: "%"}
        info:
          - {name: Działa od, entity: sensor.nuc_last_boot, type: since}
        power: {entity: sensor.nuc_power, energy: sensor.nuc_energy, switch: switch.nuc_plug}
```

### `kind: scale`

Waga łazienkowa z ciałem każdej osoby z BodyMiScale. Więcej w przewodniku: [Waga](guide.pl.md#waga).

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `entity` | sensor | brak | to, co waga pokazuje teraz |
| `people` | lista | każdy `bodymiscale.*` | id encji albo `{entity, name, weight}`; `weight` wskazuje sensor wagi |

### `kind: overview`

Ekran Status: zegar i tylko to, na co warto teraz spojrzeć. Więcej w przewodniku:
[Ostrzeżenia na stronie głównej](guide.pl.md#ostrzeżenia-na-stronie-głównej).

| Klucz | Typ | Znaczenie |
|---|---|---|
| `sections` | lista | `{title, alert, bottom, items}` |
| `sections[].alert` | `true` | pozycje liczą się do podsumowania przy zegarze |
| `sections[].bottom` | `true` | sekcja zawsze stoi na samym dole |

Pozycja pokazuje się tylko wtedy, gdy ma coś do powiedzenia:

| Klucz | Znaczenie |
|---|---|
| `name`, `icon` | tytuł i ikona |
| `entities` | id encji albo `{entity, name}`; widoczne, gdy mają stan z `state` (domyślnie `on`) |
| `state` | stan albo lista stanów |
| `below` | z `entities` albo `auto`: wartości niższe niż ta; `attribute` czyta atrybut, `unit` podaje jednostkę |
| `auto: battery` | każdy poziom baterii w %; `platforms` i `device_has` go zawężają |
| `auto: alarm` | każdy czujnik w domu, który wykrywa wodę, dym, gaz albo czad, gdy to wykrywa; `classes` go zawęża (`moisture`, `smoke`, `gas`, `carbon_monoxide`, a `safety` tylko wpisane) |
| `alarm` | `true`: czerwona pozycja w Statusie, a z `notify` czerwona karta na stronie głównej, której nie da się zamknąć ani wyciszyć, dopóki trwa; dla `auto: alarm` włączone samo |
| `list` | `{entity, attribute, name, detail, since}`: wiersze listy z atrybutu |
| `entity` | ze `state`: urządzenie w jednym ze stanów; `labels` (stan → tekst), `facts` (`{name, entity, unit}`) |
| `text` | zawsze ten tekst |
| `weekdays`, `months` | tylko w te dni (1 to poniedziałek) i miesiące (od 1 do 12) |
| `notify` | `true`: także karta na stronie głównej; działa dla pozycji `entities`, `below`, `auto` i `list` |

```yaml
shortcuts:
  - kind: overview
    name: Status
    icon: mdi:clipboard-pulse-outline
    sections:
      - title: Do sprawdzenia
        alert: true
        items:
          - {name: Wyciek wody, icon: mdi:water-alert, auto: alarm, classes: [moisture], notify: true}
          - {name: Dym lub gaz, icon: mdi:smoke-detector-alert, auto: alarm, classes: [smoke, gas], notify: true}
          - {name: Baterie, icon: mdi:battery-alert, auto: battery, below: 20, notify: true}
          - {name: Otwarte okna, icon: mdi:window-open-variant, entities: [binary_sensor.kitchen_window]}
```

### `kind: departures`

| Klucz | Typ | Znaczenie |
|---|---|---|
| `entities` | lista encji | sensory z atrybutem `list` z odjazdami |
| `colors` | mapa linia → `#rrggbb` | własne kolory linii |
| `news` | id encji | komunikaty przewoźnika z jego atrybutu `list` |

Odjazd w `list` ma `line`, `direction`, `departure`, `time_to_departure` i `delay`.

```yaml
shortcuts:
  - {kind: departures, name: Tramwaje, icon: mdi:tram, entities: [sensor.tram_4], colors: {"4": "#ff9f0a"}}
```

### `kind: news`

| Klucz | Typ | Znaczenie |
|---|---|---|
| `sections` | lista `{title, entity}` | sensor z atrybutem `news`; patrz [Wiadomości](guide.pl.md#wiadomości) |

### `kind: school`

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `children` | lista imion | brak | kolejność dzieci; pozostałe idą na koniec |
| `sources` | mapa | `sensor.rodzinnik_*` | sensor dla każdej części, patrz niżej |

Części to `plan`, `grades`, `events`, `meals`, `duties`, `jobs`, `bank` i `librus`. Jakie dane ma mieć każdy sensor,
opisuje przewodnik: [Rok szkolny z własnych danych](guide.pl.md#rok-szkolny-z-własnych-danych).

### `kind: page`

| Klucz | Typ | Znaczenie |
|---|---|---|
| `page` | `media`, `energy`, `map` albo `music` | strona otwiera się w oknie, które można ściągnąć w dół |

```yaml
shortcuts:
  - {kind: page, name: Media, icon: mdi:play-box-multiple-outline, page: media}
```

### `kind: app`

| Klucz | Typ | Znaczenie |
|---|---|---|
| `addon` | slug dodatku | dodatek otwiera się w oknie przez ingress |
| `frame` | adres | używany, gdy dodatek nie ma interfejsu WWW albo jest nieosiągalny |
| `path` | adres | przycisk „otwórz w Home Assistant", gdy się nie uda; domyślnie `/<addon>` |

## 7. Strony

Więcej w przewodniku: [Muzyka, Energia i Mapa](guide.pl.md#8-muzyka-energia-i-mapa).

### `music`

Z `music` strona Muzyka zajmuje na pasku miejsce Mediów; Media mogą wtedy być skrótem `kind: page`.

| Klucz | Typ | Znaczenie |
|---|---|---|
| `addon` | slug dodatku | dodatek, np. Music Assistant, przez ingress; ma pierwszeństwo przed resztą |
| `card` | karta Home Assistant | karta na całą stronę |
| `admin_card` | `true` | karta tylko dla administratorów; inni dostają `frame` |
| `frame` | adres | strona WWW; także zapas dla `addon` |
| `fullscreen` | `true` | dolny pasek znika przy pełnoekranowym odtwarzaczu |

```yaml
music:
  addon: abcd1234_music_assistant
  fullscreen: true
```

### `media`

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `group_patterns` | lista wyrażeń regularnych | patrz niżej | odtwarzacze z tą samą pierwszą grupą id to jeden |
| `sections` | lista `{title, tiles}` | `[]` | strona Media we własnych grupach; kafelki jak w pokoju |

Domyślne `group_patterns` to `["^(.+)_homepod(_muzyka)?$"]`.

Kafelki z `media.sections`, które stoją też w pokoju z `areas`, trafiają do filtra Media na stronie głównej.

### `map`

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `track` | lista id `device_tracker` | `[]` | urządzenia z trasą, obok osób |

### `energy`

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `phases` | lista `{power, voltage, current, factor}` | wykrywane na liczniku sieci | fazy L1, L2, L3 po kolei |
| `voltage_range` | `[dolne, górne]` | `[207, 253]` | skala napięcia i jej kolory |
| `storage` | lista | `[]` | magazyny energii na baterię, każdy z kartą |

Pozycje `storage`: `block` (nazwa bloku otwieranego dotknięciem), `name` (domyślnie `block`), `icon`, `battery`
(**wymagany**, %), `state`, `labels` (stan → tekst), `input` i `output` (W), `remaining` (minuty). Więcej w
przewodniku: [Magazyn energii](guide.pl.md#magazyn-energii).

```yaml
energy:
  voltage_range: [207, 253]
  storage:
    - block: Stacja zasilania
      battery: sensor.station_battery
      state: sensor.station_state
      labels: {charging: Ładuje się}
      input: sensor.station_in
      output: sensor.station_out
      remaining: sensor.station_time_left
```

## 8. Menu

Bez `menu` lewe menu pokazuje skróty i podstawowe linki (Historia, Dziennik, Urządzenia, Automatyzacje, Zwykły
dashboard). Z nim menu pokazuje dokładnie jego grupy. Więcej w przewodniku: [Lewe menu](guide.pl.md#lewe-menu).

| Klucz | Typ | Znaczenie |
|---|---|---|
| `groups` | lista | `{title, items}` |
| `groups[].title` | tekst | nagłówek grupy |
| `groups[].items` | lista | pozycje, poniżej |

Pozycja ma jedno z: `shortcut`, `addon`, `action` i `path`:

| Klucz | Znaczenie |
|---|---|
| `name`, `icon` | pozycja; przy `shortcut` domyślnie te ze skrótu |
| `shortcut` | nazwa skrótu; otwiera jego okno |
| `addon` | dodatek w oknie, jak `kind: app` (także `frame` i `path`) |
| `action` | `notifications`: okno powiadomień |
| `path` | adres w Home Assistant; `/history` i `/logbook` otwierają własne okna dashboardu |
| `admin` | `true`: tylko administratorzy |
| `users` | lista id użytkowników; pusta znaczy wszyscy |
| `hide_for_guests` | `true`: ukryte, gdy dla tego konta działa [tryb gościa](#5-kamery) |

```yaml
menu:
  groups:
    - items:
        - {shortcut: Status}
        - {name: Powiadomienia, icon: mdi:bell-outline, action: notifications}
    - title: System
      items:
        - {name: Ustawienia, icon: mdi:cog-outline, path: /config, admin: true}
```

## 9. Wygląd

Więcej w przewodniku: [Wygląd](guide.pl.md#wygląd) i [Motywy](guide.pl.md#motywy).

### `appearance`

Wspólny wygląd. Każdy może zmienić dowolną jego część dla siebie; zapisuje się tylko to, co się różni. Błędna wartość
jest pomijana i zostaje domyślna. Kolor to `#rrggbb` albo `#rrggbbaa`; brak wartości zostawia kolor jasnego albo
ciemnego wyglądu.

| Klucz | Zakres | Domyślnie | Znaczenie |
|---|---|---|---|
| `background_strength` | 0-100 | `40` | jak wyraźnie widać tło |
| `bounce` | logiczny | `true` | strona odbija się na końcach |
| `page.background_light`, `page.background_dark` | kolor albo gradient | brak | tło stron bez własnego |
| `tiles.opacity` | 20-100 | `100` | krycie przycisków |
| `tiles.radius` | 0-36 | `20` | zaokrąglenie rogów |
| `tiles.fill` | `tile`, `icon` | `tile` | kolor na całym przycisku albo tylko na ikonie |
| `tiles.background`, `text`, `icon`, `icon_background` | kolor | brak | wyłączone przyciski |
| `tiles.colours` | mapa rodzaj → kolor | `{}` | kolor rodzaju, gdy włączony |
| `text.title`, `text.headings` | kolor | brak | tytuł i nagłówki |
| `chips.background`, `chips.text` | kolor | brak | bloki u góry |
| `chips.opacity`, `chips.radius` | 20-100, 0-30 | `100`, `14` | bloki u góry |
| `buttons.background`, `buttons.icon` | kolor | brak | okrągłe przyciski (intercom, trzy kropki) |
| `buttons.opacity` | 20-100 | `100` | okrągłe przyciski |
| `badges.text`, `badges.icon` | kolor | brak | kółka statusu pokoju |
| `badges.kinds` | logiczny | `true` | kółka w kolorach swoich rodzajów |
| `badges.fill` | logiczny | `true` | `false`: kółka puste w środku |
| `sheets.background`, `text`, `controls`, `cards` | kolor | brak | okna; `cards`: tło kart w nich |
| `sheets.opacity`, `blur`, `scrim` | 20-100, 0-40, 0-80 | `100`, `0`, `45` | okna i przyciemnienie strony |
| `map.theme` | `auto`, `light`, `dark` | `auto` | kolory mapy |
| `map.hours` | 6, 24, 72, 168 | `24` | początkowy zakres tras |
| `player.background`, `player.text` | kolor | brak | mały odtwarzacz |
| `player.opacity`, `blur`, `radius` | 20-100, 0-30, 0-32 | `100`, `0`, `16` | mały odtwarzacz |
| `player.paused_minutes` | 0-120 | `10` | jak długo zostaje coś wstrzymanego |
| `nav.items` | od 2 do 5 pozycji | home, media/music, energy, map | pozycje paska, patrz niżej |
| `nav.style` | `docked`, `floating` | `docked` | pasek przy krawędzi albo pływający |
| `nav.background`, `icon`, `active` | kolor | brak | pasek |
| `nav.opacity`, `nav.blur` | 20-100, 0-30 | `100`, `0` | pasek |
| `status.shown` | logiczny | `false` | pasek statusu tabletu w poziomie |
| `status.widgets` | lista | wszystkie sześć | `weather`, `home`, `alerts`, `now`, `departures`, `power`, po kolei |
| `status.colourful` | logiczny | `false` | kolorowe ikony, linie i wykresy |
| `status.background`, `status.text` | kolor | szkło | pasek statusu |
| `status.opacity`, `status.blur` | 20-100, 0-30 | `100`, `30` | pasek statusu |
| `icons` | mapa encja → `mdi:…` | `{}` | własne ikony urządzeń, ważniejsze od każdej innej |

Pozycje `nav.items`: `home`, `media`, `music`, `energy`, `map`, `scenes`, `menu` i `room:<id>`.

Rodzaje w `tiles.colours`: `light`, `switch`, `cover`, `climate`, `media_player`, `lock`, `fan`, `scene`, `script`,
`automation`, `binary_sensor`, `sensor`. `input_boolean` liczy się jako `switch`, `alarm_control_panel` jako `lock`,
`button` i `input_button` jako `script`, `water_heater` jako `climate`.

```yaml
appearance:
  background_strength: 70
  tiles: {opacity: 85, radius: 28, fill: icon, colours: {light: "#ffb300"}}
  nav: {items: [home, scenes, "room:living_room", menu], style: floating}
  status: {shown: true, widgets: [weather, home, alerts, now]}
  icons: {light.led_strip: mdi:led-strip-variant}
```

### `themes` i `theme`

`themes` to biblioteka zakładki **Motywy**: każdy wpis to `{id, name, appearance, backgrounds}`. `theme` to id motywu,
od którego zaczął się obecny wygląd. Motywy dołączone do dashboardu mają id `home_dashboard` i `apple_home`; wpis o tym
samym id to wersja tego motywu w Twoim domu. Oba klucze zapisuje zakładka Motywy; ręczna edycja rzadko ma sens.

### `backgrounds` i `background`

`backgrounds` trzyma wspólne tło każdej strony, pod kluczem: `home`, `scenes`, `map`, `energy` albo id pokoju.

| Klucz | Znaczenie |
|---|---|
| `light`, `dark` | ekrany pionowe, w jasnym i ciemnym wyglądzie |
| `light_wide`, `dark_wide` | ekrany poziome; bez nich używane jest tło pionowe |
| `position` | `top` albo `bottom`: część zdjęcia, która zostaje po przycięciu; bez niej środek |

Wartością jest kolor, gradient albo adres zdjęcia. Zwykły tekst zamiast mapy działa w obu wyglądach. Starsze
`background` (strona główna) i `layout[].background` (pokój) są czytane, gdy `backgrounds` nie ma wpisu; okno tła
przenosi je do `backgrounds` przy pierwszym zapisie.

```yaml
backgrounds:
  home:
    light: /api/image/serve/abc123/original
    light_wide: /api/image/serve/def456/original
    dark: "#121316"
    position: top
  energy: "linear-gradient(170deg, #3b4a6e, #1b2033)"
```

## 10. Osoby

Więcej w przewodniku: [Osoby](guide.pl.md#9-osoby). Oba klucze tylko ukrywają rzeczy w dashboardzie; to nie są
uprawnienia.

### `access`

To, co administrator zabrał danej osobie, pod jej id użytkownika. Ta osoba nie może tego przywrócić.

| Klucz | Zawartość |
|---|---|
| `hide` | id encji (kamery, urządzenia, sceny…), `chip:<chip>` i `block:<nazwa skrótu>` |
| `rooms` | id pokoi albo obszarów; ich kamery też znikają |
| `sections` | `<id pokoju>\|title:<tytuł>` albo `<id pokoju>\|index:<n>` dla sekcji bez tytułu |

Chipy to `chip:weather`, `chip:climate`, `chip:lights`, `chip:security` i `chip:media`.

```yaml
access:
  0a1b2c3d4e5f: {hide: [camera.bedroom, chip:media, "block:Serwery"], rooms: [garage]}
```

### `visibility`

Kto widzi kafelek albo blok, wszędzie tam, gdzie się pokazuje, pod jego kluczem: id encji, `shortcut:<nazwa>` dla
kafelka wskazującego skrót albo `block:<nazwa>` dla bloku.

| Klucz | Znaczenie |
|---|---|
| `only` | lista id użytkowników, którzy to widzą; reszta nie |
| `except` | lista id użytkowników, którzy tego nie widzą (gdy `only` jest puste) |

```yaml
visibility:
  light.shelf: {only: [0a1b2c3d4e5f]}
  switch.coffee: {except: [0a1b2c3d4e5f]}
```

## 11. Pasek statusu tabletu

`status_panel` mówi, skąd pasek statusu bierze dane. To, czy się pokazuje, i jego części ustawia
[`appearance.status`](#appearance). Więcej w przewodniku:
[Pasek statusu na tablecie](guide.pl.md#pasek-statusu-na-tablecie).

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `doors` | lista encji albo `{entity, name}` | `[]` | drzwi i okna w **W domu**; otwarte przy `on` lub `open` |
| `now` | lista | `[]` | pozycje **Teraz**, patrz niżej |
| `power` | lista encji albo `{entity, name, color}` | `[]` | moc teraz z linią z 6 godzin |
| `departures` | lista encji albo `null` | `null` | tramwaje; `null` bierze pierwszy blok odjazdów |

Pozycja `now` to id encji albo mapa: `entity` (**wymagany**), `name`, `icon`, `detail` (dopisywany po stanie),
`remaining` (po prawej), `resting` (własna lista stanów oznaczających, że nic nie działa) i `block` (nazwa bloku
otwieranego dotknięciem).

```yaml
status_panel:
  doors: [binary_sensor.front_door, {entity: binary_sensor.balcony_door, name: Balkon}]
  now:
    - {entity: sensor.washer_phase, detail: sensor.washer_program, remaining: sensor.washer_left, block: Pralka}
    - vacuum.robot
  power: [sensor.nuc_power]
  departures: null
```

## 12. Intercom

Więcej w przewodniku: [Intercom](guide.pl.md#11-intercom).

| Klucz | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `script` | `domena.usługa` | brak | bez niego nie ma przycisków intercomu |
| `areas` | lista id obszarów | głośniki wykryte same | pokoje, w których można mówić |
| `areas_field` | tekst | `areas` | pole z obszarami w wywołaniu |
| `text_field` | tekst | `text` | pole z wpisaną wiadomością |
| `file_field` | tekst | `file` | pole z nagraniem wysłanym do `media_folder` |
| `played_field` | tekst | brak | pole odpowiedzi z listą miejsc, gdzie zagrało; pusta to brak głośnika |
| `upload` | adres | brak | punkt, który przyjmuje WAV (`?areas=a,b`) i go odtwarza; nagrywa każdy zalogowany |
| `media_folder` | adres źródła mediów | brak | dokąd idą nagrania bez `upload`; tylko administratorzy |

```yaml
intercom:
  script: intercom.announce
  text_field: message
  played_field: played
  upload: /api/intercom/message
```

## 13. Okna edycji

Przy każdym oknie podane jest, jak je otworzyć, kto je widzi i co zapisuje. Okno, które zapisuje wspólną
konfigurację, zapisuje od razu cały blok `strategy:`.

### Ustawienia dashboardu

**Otwierasz:** Menu → **Ustawienia dashboardu**. **Kto:** administratorzy. **Zapis:** przyciskiem **Zapisz** u góry.

| Pole | Zapisuje |
|---|---|
| **Powrót na tablecie do strony głównej po** | `idle.return_after` |
| **Otwieraj ten dashboard przy starcie na tym urządzeniu** | tylko to urządzenie |
| **Ostrzeżenia na stronie głównej** → Wycisz na tydzień / Pokaż znowu | Twoje dane użytkownika |
| **Mówienie w oknie kamery** | `cameras.talk` |
| **Kolumny wszystkich kamer na tablecie** | `cameras.columns` |
| **Układ wszystkich kamer na tablecie** | `cameras.layout` |
| **Ta sama kamera w innej integracji** | `cameras.controls` |
| **Sterowanie i mówienie każdej kamery** → Sterowanie | `cameras.ptz` |
| → Przycisk syreny, Przycisk światła, Przycisk noktowizji | `cameras.quick` |
| → Mówienie | `cameras.talk_with` |
| **Edytuj konfigurację** | otwiera edytor YAML |
| **Wczytaj aplikację od nowa** | nic; wczytuje na nowo pliki dashboardu |

### Edytuj konfigurację (YAML)

**Otwierasz:** Ustawienia dashboardu → **Edytuj konfigurację**. **Kto:** administratorzy. **Zapisuje:** wszystko.

Zapis sprawdza składnię i odrzuca konfigurację, przez którą dashboard by się nie narysował, podając ścieżkę problemu:

- `rooms`, `cameras`, `intercom`, `entities`, `media`, `menu`, `lights`, `security` i `idle` muszą być mapami;
- `favorites`, `layout`, `scenes` i `shortcuts` muszą być listami;
- pokój potrzebuje `id` i `name`; jego `areas`, `home`, `sections` i `status` muszą być listami;
- sekcja potrzebuje listy `tiles`, a grupa statusu listy `entities`;
- kafelek potrzebuje `entity`, chyba że ma `shortcut` albo jest `kind: panel` lub `kind: scale` z `name`;
- skrót potrzebuje `name` i `kind`.

**Wczytaj wersję sprzed ostatniego zapisu** przywraca konfigurację sprzed ostatniego zapisu, trzymaną na tym urządzeniu.

### Edytuj ten ekran (edycja pokoju)

**Otwierasz:** w pokoju trzy kropki → **Edytuj ten ekran**; dla Scen ze strony głównej najpierw otwórz stronę
**Sceny**. **Kto:** administratorzy. **Zapis:** przyciskiem **Zapisz**; krzyżyk porzuca zmiany.

| Zakładka | Zmienia | Zapisuje |
|---|---|---|
| **Karta pokoju** | sekcje: nazwa, strzałki, jeden rząd (`layout: row`), usuń, **Dodaj sekcję** | `layout[].sections` |
| **Sceny** | rząd Sceny pokoju | `layout[].scenes` |
| **Strona główna** | kafelki pokoju na stronie głównej | `layout[].home` |

Kafelki przeciągasz za uchwyt, także między sekcjami. **Dodaj kafelek** otwiera wyszukiwanie, a dotknięcie kafelka
otwiera okno kafelka. Pierwszy zapis pokoju zbudowanego z obszaru zapisuje cały pokój w `layout`. Na stronie Sceny
edycja ma jedną listę (`scenes`), a przycisk ze strzałkami ustawia `scenes_layout: row`. Reguły **Kto to widzi**
zapisują się razem z resztą, do `visibility` i `access`.

Zielony kafelek widzą tylko wybrane osoby; czerwony jest przed kimś ukryty.

### Dodaj kafelek

**Otwierasz:** **Dodaj kafelek** w edycji pokoju. Bez wpisanego tekstu pokazuje to, co należy do obszarów pokoju i nie
ma jeszcze kafelka; wpisany tekst przeszukuje cały Home Assistant. W Scenach podpowiada tylko sceny i skrypty. Wybór
dodaje `{entity: …}` do listy.

### Okno kafelka

**Otwierasz:** dotknięciem kafelka w edycji pokoju.

| Pole | Zapisuje |
|---|---|
| **Nazwa na kafelku** | `name` kafelka; puste pole go usuwa |
| **Rozmiar**: Płaski, Wysoki (dwa wiersze) | `size: tall`; nie dla bloków |
| **Kto to widzi**: Wszyscy, Tylko wybrani, Wszyscy oprócz | `visibility.<klucz>`; klucz znika z `access.*.hide` |
| **Edytuj blok** (kafelek `kind: panel`) | otwiera [formularz bloku](#formularz-bloku); wynik zastępuje kafelek |
| **Usuń kafelek** | usuwa pozycję |

Pozostałe klucze kafelka (`calm`, `confirm`, `labels`…) ustawiasz w YAML, a okno je zachowuje.

### Odznaki podsumowania

**Otwierasz:** na stronie głównej trzy kropki → **Odznaki podsumowania**. **Kto:** administratorzy. **Zapisuje:**
`shortcuts`, od razu.

Pokazuje skróty z ołówkiem i strzałkami do kolejności, **Kategorie mediów** oraz **Nowy blok**: Status, Odjazdy,
Aplikacja, Wiadomości, Maszyny, Blok i Strona. Blok Szkoła dodajesz w YAML, a potem edytujesz tutaj. Skrót po zmianie
nazwy zachowuje swoje reguły w `access` i `visibility`; czyjąś własną kolejność i ukrycie chipów trzeba ustawić od nowa.

### Formularz bloku

**Otwierasz:** ołówkiem w Odznakach podsumowania, nowym blokiem tamże albo **Edytuj blok** w oknie kafelka.
**Kto:** administratorzy.

| Rodzaj | Pola |
|---|---|
| wszystkie | Nazwa, Mały tekst nad nazwą (`label`), Ikona, Kolor (`tone`) |
| Status (`overview`) | Sekcje: Tytuł, Liczy się do sprawdzenia (`alert`), Zawsze na dole (`bottom`), Pozycje |
| Odjazdy | Encje, Komunikaty (`news`) |
| Aplikacja | Aplikacja (`addon`), Strona WWW (`frame`) |
| Wiadomości | Sekcje: Tytuł, Encja |
| Maszyny (`host`) | Maszyny: Tytuł, Ikona, Podtytuł, Encja stanu, Paski, Szczegóły, Maszyny w środku, Karta wykresu |
| Blok (`panel`) | Encja, Otwieraj na całym ekranie, Liczby u góry, Przyciski, Grupy, Karta, Pokazuj kartę |
| | od razu, Tylko karta, Strona WWW |
| Strona | Strona |
| Szkoła | Dzieci, Sensory (`sources`, YAML) |

Pozycja Statusu ma **Pokazuj, gdy**: encja ma stan, wartość jest poniżej progu, bateria jest słaba, lista nie jest
pusta, urządzenie pracuje albo zawsze (tekst). Każdy wybór ma swoje pola, a każda pozycja ma **Pokazuj też jako
ostrzeżenie na stronie głównej** (`notify`), dni tygodnia i miesiące. Opcje, których formularz nie zna, zostają w
bloku bez zmian, a puste pole jest pomijane. **Usuń blok** wymaga drugiego dotknięcia.

### Kategorie mediów

**Otwierasz:** Odznaki podsumowania → **Kategorie mediów**. **Kto:** administratorzy. **Zapisuje:** `media.sections`:
sekcje z tytułem i kafelkami (Nazwa, Encja, Ikona, Rodzaj `tv` albo `panel`, Włączanie i Wyłączanie w YAML).

### Edytuj menu

**Otwierasz:** na dole lewego menu, **Edytuj menu**. **Kto:** administratorzy. **Zapisuje:** `menu.groups`: grupy z
tytułem i pozycjami (Nazwa, Ikona, Aplikacja, Adres, Skrót, Akcja, Tylko administratorzy, Kto to widzi, Ukryj w
trybie gościa). Do pierwszego zapisu formularz zaczyna od menu, które widać teraz.

### Mój układ

**Otwierasz:** na stronie głównej trzy kropki → **Mój układ**. **Kto:** wszyscy. **Zapisuje:** Twoje dane użytkownika,
od razu.

Zakładki: Kamery, Obszary, Plakietki (chipy), Sceny, Ulubione (kolejność, ukrywanie, dodawanie przez wyszukiwanie) i
Menu (ukrywanie). Na dole: **Otwieraj ten dashboard przy starcie na moich urządzeniach** i **Przywróć wspólny układ**.
Na Obszarach i Ulubionych administrator może zaznaczyć **Dla wszystkich**; **Zapisz dla wszystkich** zapisuje wtedy
`rooms.order`, `rooms.hidden` i `favorites`.

### Mój widok

**Otwierasz:** w pokoju trzy kropki → **Mój widok**. **Kto:** wszyscy. **Zapisuje:** Twoje dane użytkownika: ukryte
sekcje i kafelki tego pokoju, razem z rzędem Sceny. **Pokaż wszystko w tym pokoju** przywraca je.

### Dostęp użytkowników

**Otwierasz:** trzy kropki → **Dostęp użytkowników**. **Kto:** administratorzy. **Zapisuje:** `access`, przyciskiem
**Zapisz**.

Wybierz osobę albo **Wszyscy oprócz mnie** (każde inne istniejące teraz konto). Zakładki: Kamery, Obszary (`rooms`),
Sekcje (`sections`), Plakietki (pogoda, chipy i skróty), Światła, Media, Ochrona, Sceny i skrypty, Inne (pozostałe
encje i bloki). Wszystko poza Obszarami i Sekcjami trafia do `hide`.

### Tło tego ekranu

**Otwierasz:** na stronie głównej, w pokoju, na stronie Sceny, na Mapie albo w Energii: trzy kropki → **Tło tego
ekranu**. **Kto:** wszyscy. **Zapisuje:** Twoje dane użytkownika; z **Dla wszystkich** (administratorzy)
`backgrounds.<strona>`.

Gradient, kolor albo zdjęcie dla jasnego i ciemnego wyglądu, **Pionowy / Poziomy** dla kształtu ekranu i część zdjęcia,
która zostaje po przycięciu (`position`). Na górze Twój wygląd: Systemowy, Jasny albo Ciemny, zapisany w Twoich
danych użytkownika.

### Wygląd

**Otwierasz:** lewe menu → **Wygląd**. **Kto:** wszyscy. **Zapisuje:** Twoje dane użytkownika; administrator z
zaznaczonym **Dla wszystkich** zapisuje `appearance` przyciskiem **Zapisz dla wszystkich**.

| Zakładka | Klucze `appearance` |
|---|---|
| **Tło** | `background_strength`, `bounce`, `page.*`, `map.*` |
| **Przyciski** | `tiles.opacity`, `tiles.radius`, `tiles.fill`, `tiles.colours` |
| **Kolory** | `text.*`, `tiles.background`, `text`, `icon`, `icon_background`, `chips.*`, `buttons.*`, `badges.*` |
| **Pasek** | `nav.*`, `status.*`, `player.*` |
| **Okna** | `sheets.*` |
| **Ikony** | `icons` |
| **Motywy** (z Dla wszystkich) | `themes`, `theme` oraz `appearance` i `backgrounds` przy użyciu motywu |

**Wróć do wyglądu dla wszystkich** usuwa Twoje własne zmiany.

### Ustawienia urządzenia i ołówek

Trybik w oknie urządzenia pokazuje jego pozostałe encje w zakładkach (Ustawienia, Stan, Akcje, Aktywność); niczego nie
zapisuje w konfiguracji. Trybik kamery bierze encje z `cameras.settings`, jeśli są ustawione. Ołówek (administratorzy)
zmienia nazwę, obszar, etykiety i to, czy urządzenie jest włączone, w samym Home Assistant. Więcej w przewodniku:
[Ustawienia i edycja urządzenia](guide.pl.md#ustawienia-i-edycja-urządzenia).

## 14. Jakie okno otwiera kafelek

| Encja | Dotknięcie kafelka | Okrągła ikona |
|---|---|---|
| `light` | okno lampy: jasność, kolor, biel | przełącza |
| `switch`, `input_boolean` | okno przełącznika; z czujnikiem mocy na urządzeniu także wykres mocy | przełącza |
| `automation` | okno przełącznika z czasem ostatniego uruchomienia | przełącza |
| `fan` | okno Home Assistant | przełącza |
| `cover` | okno rolety | |
| `climate` | okno termostatu | |
| `lock` | suwak zamka; na tablecie tylko zamykanie, chyba że `security.unlock_on_tablet` | |
| `lock` z kodem | okno Home Assistant na telefonie; na tablecie nic, chyba że otwieranie jest dozwolone | |
| `alarm_control_panel` | tryby alarmu; z kodem okno Home Assistant | |
| `media_player` | okno odtwarzacza | |
| `binary_sensor` | stan, kiedy się zmienił, bateria urządzenia i pasek z momentami włączenia | |
| `select`, `input_select` | opcje jako przyciski; działają `labels` i `confirm` kafelka | |
| `sensor` z liczbą i jednostką albo klasą stanu | wartość i jej wykres | |
| `scene`, `script`, `button` | uruchamia od razu, kafelek pokazuje ptaszek; niedostępne: okno Home Assistant | |
| każda inna (`vacuum`, `number`, tekstowy `sensor`…) | okno Home Assistant | |

Klucze kafelka to zmieniają: `tap_toggle`, `action` i `turn_on_only` działają bez okna,
`entities.overrides.<id>.card` otwiera kartę, a `kind: tv`, `kind: panel`, `kind: scale` i `kind: host` otwierają
własne okna. Każde okno urządzenia ma trybik (ustawienia urządzenia), a administratorzy także ołówek.

## 15. Ustawienia osoby i urządzenia

Dla osoby, w danych użytkownika `home_dashboard` (na wszystkich urządzeniach konta):

| Co | Okno |
|---|---|
| kolejność i ukrycie kamer, obszarów, chipów, scen; ulubione; ukryte pozycje menu | Mój układ |
| otwieranie dashboardu przy starcie | Mój układ |
| ukryte sekcje i kafelki pokoju | Mój widok |
| własne tła oraz Systemowy / Jasny / Ciemny | Tło tego ekranu |
| własny wygląd | Wygląd |
| ostrzeżenia wyciszone na tydzień | Ustawienia dashboardu |

Dla urządzenia, w przeglądarce:

| Co | Okno |
|---|---|
| otwieranie dashboardu przy starcie na tym urządzeniu | Ustawienia dashboardu |
| konfiguracja sprzed ostatniego zapisu | Edytuj konfigurację |
| kolumny i układ wszystkich kamer wybrane na tym tablecie | okno wszystkich kamer |
| karty ostrzeżeń zamknięte dzisiaj | krzyżyk na karcie |
| zwinięty pasek statusu | przycisk paska statusu |
