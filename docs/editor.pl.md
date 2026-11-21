# Edytor dashboardu: od zera do gotowego dashboardu

[English](editor.md) · [README](../README.pl.md) · [Przewodnik](guide.pl.md) · [Opis konfiguracji](configuration.pl.md)

<b class="ui">Edytor dashboardu</b> służy do budowania i zmieniania Home Dashboard na komputerze. Po lewej widzisz cały dashboard
jako drzewo, pośrodku prawdziwy dashboard iPhone'a i iPada, a po prawej formularz tego, co wybrałeś. Każda zmiana od
razu pojawia się w podglądzie. **Na telefonach i tabletach w domu nic się nie zmienia, dopóki nie opublikujesz.** YAML
nie jest potrzebny, ale zawsze jest obok każdego formularza, jeśli wolisz pisać.

Ten dokument prowadzi krok po kroku od pustego Home Assistanta do dashboardu takiego jak na zrzutach: pokoje z
urządzeniami, strona główna, bloki dla maszyn, własny wygląd, pasek statusu tabletu na ścianie, menu i zasady, kto co
widzi. Za pierwszym razem czytaj po kolei; później każdy rozdział można czytać osobno.

Zrzuty ekranu pokazują zmyślony dom (`dev/demo.js`), nigdy prawdziwy.

## Spis treści {#contents}

1. [Zanim zaczniesz](#before-you-start)
2. [Otwieranie edytora](#opening-the-editor)
3. [Pierwszy dashboard i jego pokoje](#the-first-dashboard-and-its-rooms)
4. [Co jest na ekranie](#a-tour-of-the-screen)
5. [Podgląd](#the-preview)
6. [Pokoje](#rooms)
7. [Sekcje i kafelki](#sections-and-tiles)
8. [Strona główna](#the-home-page)
9. [Bloki: maszyny, urządzenia, własne ekrany](#blocks-machines-appliances-screens-of-their)
10. [Wygląd, motywy i tła](#look-themes-and-backgrounds)
11. [Pasek statusu tabletu i kalendarze](#the-status-bar-of-a-tablet)
12. [Menu i pasek stron](#menu-and-bar-of-pages)
13. [Kamery, energia, interkom i pozostałe ustawienia](#cameras-energy-intercom-and-the-other)
14. [Kto co widzi](#who-sees-what)
15. [Zapisywanie, publikowanie i historia](#saving-publishing-and-history)
16. [Ustawienia edytora: własne telefony i tablety](#editor-settings-your-own-phones-and)
17. [Cały dashboard w dziesięciu krokach](#a-whole-dashboard-in-ten-steps)
18. [Wskazówki i problemy](#tips-and-problems)

## 1. Zanim zaczniesz {#before-you-start}

Potrzebujesz:

- **Home Assistanta** z zainstalowaną i dodaną integracją **Home Dashboard** (zob.
  [Instalacja w README](../README.pl.md#instalacja)). Po dodaniu integracji Home Assistant potrzebuje jednego restartu.
- **Konta administratora.** Edytor jest tylko dla administratorów; pozostałe osoby tylko używają dashboardu.
- **Komputera** z aktualną przeglądarką (Chrome, Safari, Edge, Firefox). Wygodne jest okno szersze niż 1400 px; w
  mniejszym przeciągnij boczne kolumny węziej.
- **Obszarów w Home Assistant** (Ustawienia → Obszary, etykiety i strefy) z przypisanymi urządzeniami. Edytor tworzy
  pokoje z obszarów, więc czas poświęcony tutaj oszczędza czas później. Urządzenie bez obszaru też da się dodać, ale
  ręcznie.

Dobrze wiedzieć przed pierwszym kliknięciem:

- Edytor trzyma **szkic** na serwerze. Możesz zamknąć przeglądarkę i wrócić później, także na innym komputerze.
- **Podgląd niczego nie przełącza.** Dotknięcie lampy w podglądzie wybiera ją w drzewie; nigdy nie wywołuje usługi.
  Możesz klikać bez obaw.
- **Cofnij** i **Ponów** (⌘Z i ⇧⌘Z albo Ctrl+Z i Ctrl+Shift+Z) cofają każdy krok, nawet duży, jak utworzenie
  wszystkich pokoi naraz.
- **Esc** zamyka to, co otwarte, po jednej rzeczy, od najgłębszej: obrazek pokazany w dużym rozmiarze, okno obrazków,
  listę kafelków do dodania, dialog (jak jego ✕: nic się nie zapisuje ani nie publikuje).

## 2. Otwieranie edytora {#opening-the-editor}

<b class="ui">Edytor dashboardu</b> jest w bocznym menu Home Assistanta (widzą go tylko administratorzy). Jeśli wolisz krótsze
menu, otwórz Ustawienia → Urządzenia oraz usługi → Home Dashboard → **Konfiguruj** i wyłącz *Pokazuj edytor w pasku
bocznym*; edytor otwiera się wtedy pod adresem `/home-dashboard-editor`.

Edytor ma własny jasny i ciemny wygląd. Domyślnie idzie za Home Assistantem; przycisk z połową słońca na górnym pasku
przełącza Auto, Jasny i Ciemny, a przeglądarka to zapamiętuje. Dashboard w podglądzie ma własny wybór (rozdział 5).

## 3. Pierwszy dashboard i jego pokoje {#the-first-dashboard-and-its-rooms}

### Jeszcze nie ma dashboardu {#no-dashboard-yet}

Przy pierwszym uruchomieniu edytor nie znajduje dashboardu korzystającego z Home Dashboard i proponuje go utworzyć:

![Edytor bez dashboardu](screenshots/pl/editor-new.png)

<b class="ui">Utwórz dashboard i jego pokoje</b> dodaje dashboard *Home Dashboard* w Ustawienia → Dashboardy i otwiera go w
edytorze. (Można go też utworzyć ręcznie w Ustawienia → Dashboardy i wkleić `strategy: {type: custom:home-dashboard}`
do jego surowej konfiguracji; edytor go wtedy znajdzie.) Nowy dashboard otwiera się z szybkim startem.

### Szybki start {#quick-start}

![Szybki start w kroku Bezpieczeństwo](screenshots/pl/editor-quick-start.png)

<b class="ui">Szybki start</b> tworzy działający dashboard z tego, co jest w Home Assistant, w sześciu krótkich krokach. Otwiera
się sam dla nowego dashboardu, z pustego drzewa (<b class="ui">Szybki start</b> pod Pokojami) i w każdej chwili z ⚙. Każdy krok
zaczyna od tego, co znalazł (liczby po prawej stronie okna), a każdą odpowiedź od razu widać w podglądzie za oknem.

1. **Urządzenia:** telefony zawsze; <b class="ui">Tablet na ścianie</b> włącza jego panel stanu (i, jeśli zaznaczone, powrót na
   stronę główną po 3 minutach bezczynności).
2. **Pokoje:** obszary Home Assistant według pięter; każdy zaznaczony staje się pokojem, jak w *Pokojach z obszarów*
   niżej.
3. **Strona główna:** proponowane ulubione (zamki, alarm, termostaty, kilka rolet i świateł) i sceny.
4. **Bezpieczeństwo:** dla każdego znalezionego rodzaju (wyciek wody, dym lub gaz, słabe baterie z progiem, bramki i
   huby, które nie odpowiadają, wyzwolony alarm) <b class="ui">Alarm</b>, <b class="ui">Ostrzeżenie</b> albo <b class="ui">Nie pokazuj</b>. Stają się
   pozycjami ekranu Status z kartami na stronie głównej; otwarte drzwi i okna trafiają do „W domu” panelu stanu tabletu.
5. **Wygląd:** jeden z motywów dołączonych do Home Dashboard.
6. **Podsumowanie:** co zostanie dodane. <b class="ui">Utwórz dashboard</b> wstawia wszystko do szkicu jako jeden krok: jedno
   Cofnij wycofuje całość, a urządzenia pokażą to po Opublikuj. Potem może otworzyć przewodnik po edytorze.

Uruchomiony ponownie, szybki start dodaje tylko to, czego brakuje: pokoje dla obszarów bez pokoju, ulubione i sceny,
których jeszcze nie ma, ostrzeżenia, których nie ma na ekranie Status, i wygląd tylko tam, gdzie nic nie wybrano. Nic,
co zmieniłeś, nie zostaje nadpisane.

### Przewodnik po edytorze {#tour-of-the-editor}

![Przewodnik po edytorze w kroku Drzewo dashboardu](screenshots/pl/editor-tour.png)

Przy pierwszym otwarciu edytora w danej przeglądarce krótki przewodnik pokazuje w ramce po kolei jego części: drzewo,
podgląd, urządzenia i osobę podglądu, właściwości, szkic z Cofnij i Historią, Opublikuj oraz pomoc z ustawieniami.
Dymek mówi, czym jest każda część i gdzie się ją ustawia. <b class="ui">Dalej</b> i <b class="ui">Wstecz</b> (albo strzałki) przechodzą przez
kroki, <b class="ui">Pomiń</b> albo Escape go zamyka. Ponownie otwiera go ⚙ → <b class="ui">Przewodnik po edytorze</b>.

### Samouczki {#lessons}

![Lista samouczków](screenshots/pl/editor-lessons.png)

⚙ → <b class="ui">Samouczki</b> to lista dwudziestu zadań, każde jako krótki przewodnik po samym edytorze. *Na początek*: dodaj
urządzenie do pokoju, dodaj pokój, zbuduj stronę główną, zmień kolejność, dodaj odznakę na górze strony, światła w
odznakach i plakietkach, zmień tło, ostrzeżenie na stronie głównej, panel stanu tabletu, opublikuj i kto co widzi.
*Następne kroki*: ustaw kafelek, kolory kafelków i napisów, nazwy, obszary i ukryte encje, warianty strony, kamery,
głośniki i strona Media, strona Energia, menu i pasek stron, cofanie i historia, YAML i szukanie. *Ustawiane raz*:
zbuduj blok urządzenia, interkom, strona Mapa, blok szkoły, odjazdy komunikacji, blok tekstu, blok wiadomości — samouczek bloku,
którego dashboard jeszcze nie ma, zaczyna od jego utworzenia. Samouczek sam
przechodzi tam, gdzie zadanie się wykonuje (zaznacza węzeł drzewa, rozwija część ustawień), i pokazuje w ramce po
jednej rzeczy; tam, gdzie mówi *Kliknij to, co w ramce*, czeka na to kliknięcie i sam idzie dalej, więc zadanie robi
się w trakcie nauki. × albo Escape w każdej chwili go przerywa, a nic się nie zmienia, jeśli sam tego nie zmienisz.
Lista oznacza przerobione samouczki i mówi, czego samouczek najpierw potrzebuje (pokoju z sekcją, bloku Status).

**?** przy formularzu proponuje też samouczek tego, co zaznaczone: *Pokaż krok po kroku* uruchamia go od razu.

### Pokoje z obszarów {#rooms-from-areas}

Nowy dashboard nie ma pokoi. W drzewie jest <b class="ui">Utwórz pokoje z obszarów</b>; otwiera to okno:

![Pokoje z obszarów Home Assistanta](screenshots/pl/editor-generate.png)

- <b class="ui">Obszary</b> po lewej: jeden pokój dla każdego zaznaczonego obszaru. Liczba mówi, ile kafelków dostanie pokój.
  Obszary bez kafelków nie są zaznaczone.
- <b class="ui">Sekcje</b> po prawej: w jakie grupy trafią urządzenia pokoju, według rodzaju: *Oświetlenie*, *Klimat i rolety*,
  *Multimedia*, *Urządzenia*, *Bezpieczeństwo* i *Automatyzacje*, jeśli je zaznaczysz.
- <b class="ui">Kilka kafelków każdego pokoju na stronie głównej</b> umieszcza główne światła, termostat i rolety każdego pokoju
  także na stronie głównej.
- Encje ukryte, konfiguracyjne i diagnostyczne zostają pominięte. Urządzenie widoczne w dwóch integracjach (np.
  termostat w Netatmo i w HomeKit) daje jeden kafelek, nie dwa.

To, co zaznaczysz, widać w podglądzie, zanim to dodasz. **Dodaj pokoje** wstawia je do szkicu jako jeden krok, więc
jedno **Cofnij** wycofuje wszystkie. Później, gdy dodasz w Home Assistant nowy obszar, to samo okno otwiera różdżka ✨
obok *Pokoje* i proponuje tylko obszary, które nie mają jeszcze pokoju.

> Zaczęcie od pokoi z obszarów to najszybsza droga. Wszystko dalej można zmienić: przemianować pokoje, połączyć dwa
> obszary w jeden pokój, przesunąć kafelki, usunąć niepotrzebne.

## 4. Co jest na ekranie {#a-tour-of-the-screen}

![Edytor: drzewo, podgląd i formularz kafelka na stronie głównej](screenshots/pl/editor-home.png)

**Górny pasek**, od lewej:

| Element | Co robi |
|---|---|
| ☰ | otwiera menu Home Assistanta, żeby wyjść z edytora |
| *Edytor dashboardu · Home Dashboard* | który dashboard edytujesz (przy kilku: lista do wyboru) |
| *Bez zmian* / *Szkic zapisany* | czy jest szkic; zapisuje się sam chwilę po każdej zmianie |
| ↶ ↷ | Cofnij i Ponów |
| *Wyrzuć* | wyrzuca szkic i wraca do opublikowanej wersji (tylko gdy jest szkic) |
| połowa słońca | wygląd edytora: Auto, Jasny, Ciemny |
| **{} YAML** | cały dashboard jako YAML, do przeczytania albo wklejenia |
| ? | ten przewodnik na stronie dokumentacji, w nowej karcie (po polsku albo po angielsku, jak Home Assistant) |
| ⚙ | okienko z motywem (Jak HA, Jasny, Ciemny) i językiem edytora (Jak w HA, Polski, English) oraz przejściem do telefonów i tabletów podglądu (rozdział 16) |
| <b class="ui">Historia</b> | opublikowane wersje (rozdział 15) |
| <b class="ui">Opublikuj</b> | publikuje szkic (rozdział 15) |

**Drzewo** po lewej zawiera wszystko, w czterech grupach:

- <b class="ui">Strona główna</b>: *Ulubione* i *Sceny* strony głównej.
- <b class="ui">Pokoje</b>: każdy pokój z listą *Na stronie głównej*, własnymi scenami i sekcjami z kafelkami.
- <b class="ui">Bloki</b>: kafelki, które otwierają własny ekran (rozdział 9).
- <b class="ui">Ustawienia</b>: wygląd, osoby, kamery, energia, pasek statusu, menu, kolejność pokoi, encje, światła, strona główna i
  tablet, strony Muzyka, Media i Mapa, pasek stron i interkom.

Liczba obok węzła mówi, ile rzeczy jest w środku. Żółty ⚠ oznacza pokój albo kafelek z problemem, zwykle z encją,
której już nie ma. *Zwiń wszystko* i *Rozwiń wszystko* zwijają drzewo; strzałka obok grupy zwija tę grupę, a ikona po
jej prawej zwija albo rozwija wszystko w niej. **Wyszukiwarka** znajduje pokój, kafelek albo encję po nazwie lub id.

**Oko** po prawej stronie węzła (widać je po najechaniu wskaźnikiem) ukrywa daną rzecz bez kasowania: pokój, sekcję,
kafelek, blok albo liczbę, przycisk, grupę lub wiersz bloku. Podgląd i dashboard pokazują stronę tak, jakby jej nie
było, a ona zostaje w konfiguracji (`hidden: true`) ze wszystkimi ustawieniami; to samo oko, teraz przekreślone,
przywraca ją. Ukryty węzeł i wszystko w nim jest w drzewie wyszarzone. Można więc obejrzeć okno z danym elementem
i bez niego, zanim się zdecydujesz. Ulubione to same encje, więc nie mają oka — wystarczy je zdjąć z listy. Edycja
pokoju na tablecie pokazuje ukryte kafelki, żeby zapis tam ich nie zgubił.

**Formularz** po prawej edytuje to, co wybrałeś. Nad nim są przyciski dla tej rzeczy (*Duplikuj*, *W górę*, *W dół*,
*Usuń*, a dla pokoju *Dodaj sekcję*). Obok każdego pola szarym tekstem jest nazwa jego klucza w YAML, więc zawsze
łatwo go znaleźć w konfiguracji. Zakładka <b class="ui">YAML</b> pokazuje to samo jako tekst i przyjmuje wpisane tam zmiany.
Klucze, których formularz nie zna, zostają nietknięte.

**Kolumny** są tak szerokie, jak je przeciągniesz: przeciągnij paski między nimi; dwuklik przywraca pierwszą szerokość.

**Mały ?** nad drzewem, podglądem i formularzem otwiera małe okienko z opisem tego, co robi ta część, bez wychodzenia
z edytora (Esc albo kliknięcie obok je zamyka). Na jego dole *Więcej w przewodniku* otwiera rozdział o niej; nad
formularzem to rozdział o tym, co wybrałeś: pokój, kafelek, wygląd, kto co widzi… Przewodnik od razu otwiera tylko ?
w pasku górnym.

**Adres** strony zawiera to, co wybrane (`…#/layout/0/sections/1`): skopiuj go albo odśwież stronę, a edytor otworzy
się na tym samym, gdy dashboard się wczyta.

## 5. Podgląd {#the-preview}

Podgląd to nie obrazek: to prawdziwy dashboard działający w ramkach iPhone'a i iPada, od razu pokazujący szkic.

- <b class="ui">Telefon</b>, <b class="ui">Tablet</b>, <b class="ui">Oba</b>: które urządzenia pokazać.
- <b class="ui">Jak ustawiono</b>, <b class="ui">Jasny</b>, <b class="ui">Ciemny</b>: kolory dashboardu. *Jak ustawiono* idzie za ustawieniem samego dashboardu.
- **Model** telefonu i tabletu: każdy rozmiar ekranu Apple raz, z modelami tego rozmiaru (od iPhone'a SE do 17 Pro
  Max, od iPada 1–6 do iPada Pro 13″). Własne urządzenia dowolnej marki dodaje się w ustawieniach edytora
  (rozdział 16).
- **Powiększenie** każdego urządzenia: ustaw jak w aplikacji Home Assistant na tym urządzeniu (Ustawienia →
  Aplikacja towarzysząca → Ogólne → Powiększenie). iPad Air przy 85 % pokazuje dashboard jako stronę 1388 × 965 i tak
  samo robi podgląd, więc co mieści się w podglądzie, zmieści się na ścianie.
- **Jako**: dashboard innej osoby, z ukrytym tym, czego ona nie widzi (rozdział 14).

Podgląd i drzewo działają razem:

- **Wybranie węzła go pokazuje.** Wybranie pokoju przenosi ramki do tego pokoju; wybranie bloku otwiera jego okno;
  wybranie menu otwiera menu. Zwinięta część (podsumowana grupa okna) rozwija się sama.
- **Czerwona przerywana ramka** oznacza to, co wybrałeś: kafelek, sekcję, pokój, okno bloku albo pojedynczą liczbę,
  przycisk, grupę czy wiersz w nim. Podgląd przewija się do niej.
- **Dotknięcie w podglądzie wybiera** w drzewie to, czego dotknąłeś, niczego nie robiąc.
- Pod ramką edytor mówi, czy okno wybranego bloku **mieści się na tablecie bez przewijania** (*Okno mieści się bez
  przewijania ✓*) albo o ile się przewija.

## 6. Pokoje {#rooms}

![Pokój i jego formularz](screenshots/pl/editor-room.png)

- **Dodanie pokoju:** **+** obok *Pokoje*. Zaczyna pusty, z nazwą do zmiany.
- **Formularz pokoju:** *Nazwa* (widoczna wszędzie), *Id* (adres pokoju w linkach; jego zmiana później psuje linki i
  pokoje ukryte przez osoby, więc wybierz go raz) i <b class="ui">Obszary</b>: obszary Home Assistanta należące do pokoju. Pokój może
  mieć kilka obszarów (kuchnia i jadalnia razem); ich kamery, rząd statusu i interkom należą do pokoju.
  *Układ strony* daje pokojowi własny układ: jak wszystkie strony, jedna pod drugą albo sekcje obok siebie
  (zobacz przewodnik: [Sekcje obok siebie](guide.pl.md#sections-side-by-side)).
- **Sekcje:** *Dodaj sekcję* nad formularzem. Sekcja to nagłówek z kafelkami pod nim.
- **Kolejność:** *W górę* i *W dół* albo przeciągnięcie pokoju w drzewie. **Ustawienia → Pokoje: kolejność i ukryte**
  ustawia kolejność pokoi na stronie głównej i w menu oraz ukrywa pokoje przed wszystkimi.

Pokój ma w drzewie trzy rodzaje list:

| Węzeł | Co to jest | Gdzie widać |
|---|---|---|
| <b class="ui">Na stronie głównej</b> | kafelki pokoju na stronie głównej | strona główna, karta pokoju |
| <b class="ui">Sceny pokoju</b> | sceny i skrypty pokoju | strona pokoju, na górze |
| **sekcja** (*Oświetlenie*, *Klimat i rolety*…) | kafelki strony pokoju | strona pokoju |

## 7. Sekcje i kafelki {#sections-and-tiles}

### Lista sekcji {#the-list-of-a-section}

![Sekcja: jej kafelki na liście](screenshots/pl/editor-section.png)

Wybranie sekcji (albo *Na stronie głównej*, *Ulubione*, *Sceny*) pokazuje jej formularz (*Tytuł* i *Układ*: siatka
albo jeden rząd przewijany w bok) i **listę jej kafelków**: kliknięcie otwiera kafelek w jego formularzu, strzałki go
przesuwają, kosz usuwa.

### Dodawanie kafelków {#adding-tiles}

Dwa sposoby, oba nad formularzem:

- <b class="ui">Encja nowego kafelka…</b> — wpisz id encji (pole podpowiada) i <b class="ui">Dodaj</b>.
- <b class="ui">Wybierz z listy…</b> — okno ze wszystkimi encjami domu:

![Wybór encji z listy](screenshots/pl/editor-picker.png)

- **Filtry** na górze: *Ten pokój* (obszary pokoju), *Wszystkie obszary*, *Bez obszaru*; rodzaje (*Światła*,
  *Przełączniki*, *Rolety*, *Klimat*, *Media*, *Czujniki*, *Automatyzacje i sceny*, *Bezpieczeństwo*); *Ukryj już
  pokazane*; *Pokaż techniczne*.
- Każdy wiersz podaje obszar encji, a po prawej, gdzie encja **już jest** (*już w: Salon*).
- **Podpowiedzi** na niebiesko: ustawienia pasujące do encji, np. *spokojny* dla czegoś włączonego prawie zawsze.
  *Dodaj z podpowiedzianymi ustawieniami* je przyjmuje.
- Gdy dwie encje to pewnie to samo urządzenie z dwóch integracji (roleta w Somfy i w HomeKit), lista to mówi, żebyś
  dodał tylko jedną.
- Zaznacz kilka i **Dodaj (n)**. To, co zaznaczysz, najpierw widać w podglądzie.

### Formularz kafelka {#the-form-of-a-tile}

![Formularz kafelka](screenshots/pl/editor-tile.png)

| Pole | Klucz | Znaczenie |
|---|---|---|
| Encja | `entity` | co kafelek pokazuje i czym steruje |
| Blok | `shortcut` | kafelek otwiera zamiast tego blok (rozdział 9) |
| Nazwa | `name` | własna nazwa; puste = nazwa z Home Assistanta |
| Ikona | `icon` | ikona Home Assistanta: wpisz *lampa*, *tv*, *drzwi* po angielsku (*lamp*, *door*) i wybierz z listy |
| Rozmiar | `size` | *Płaski* albo *Wysoki* |
| Spokojny | `calm` | bez koloru po włączeniu, przygaszony po wyłączeniu: dla rzeczy prawie zawsze włączonych |
| Dotknięcie przełącza | `tap_toggle` | dotknięcie w dowolnym miejscu przełącza, bez okna |
| Tylko gdy działa | `active_only` | widoczny tylko, gdy działa (nie wyłączony, bezczynny, wstrzymany) |
| Tylko włączanie | `turn_on_only` | dotknięcie tylko włącza; *Wyłączanie PIN-em* (`off_pin`) pyta o PIN przy wyłączaniu |
| Usługa dotknięcia | `action` | skrypt albo usługa wywołana zamiast tego przy dotknięciu |
| Zaznacz, potem uruchom; Nazwy opcji | `confirm`, `labels` | dla listy (`select`): uruchomienie dopiero po wyborze i własne nazwy opcji |

Pod formularzem <b class="ui">Okno urządzenia</b> mówi, co otwiera dotknięcie kafelka:

- <b class="ui">Własna karta (YAML)</b>: karta Home Assistant otwiera się zamiast okna dashboardu, dla tej encji w całym
  dashboardzie (`entities.overrides.<id>.card`). Wpisz ją razem z `type`, np. `type: custom:lamp-card`; puste pole
  przywraca okno dashboardu.
- <b class="ui">Zrób blok z tego kafelka</b>: kafelek staje się na miejscu blokiem, z nazwą, ikoną i rozmiarem (rozdział 9).

Kafelek, który już jest blokiem albo go otwiera, nie ma tej części: jego blok ma własne formularze. Jak wybrać między
kafelkiem, kartą a blokiem, opisuje [Okna dla własnych urządzeń](own-devices.pl.md).

Zakładka <b class="ui">YAML</b> pokazuje kafelek jako tekst:

![Ten sam kafelek w YAML](screenshots/pl/editor-yaml.png)

**Przesuwanie kafelków:** *W górę*, *W dół* albo przeciągnięcie w drzewie, także do innej sekcji lub pokoju.
<b class="ui">Duplikuj</b> robi kopię pod spodem. <b class="ui">Usuń</b> usuwa (jedno Cofnij przywraca).

## 8. Strona główna {#the-home-page}

Strona główna to to, co telefon i tablet otwierają najpierw. Składa się z:

1. **Ulubionych** (w drzewie: *Strona główna → Ulubione*): kafelki na górze, najczęściej używane rzeczy w domu.
2. **Scen** (*Strona główna → Sceny*): sceny i skrypty w rzędzie; *Ustawienia → Strona główna i tablet* ustawia, czy
   są siatką, czy rzędem.
3. **Karty każdego pokoju** z kafelkami jego listy <b class="ui">Na stronie głównej</b>. Pokój z pustą listą nadal pokazuje swoją
   nazwę, która otwiera pokój.

Na zrzucie z rozdziału 4 wybrany jest kafelek *Lampa przy sofie* z listy *Na stronie głównej* salonu: czerwona ramka
pokazuje, gdzie jest na stronie głównej, na telefonie i na tablecie.

**Ustawienia → Strona główna i tablet** zawiera encję pogody, podsumowanie ochrony, powrót tabletu zostawionego bez
dotyku na stronę główną po kilku minutach i układ scen. Plakietki na górze strony głównej (pogoda, klimat, światła,
ochrona, media) tworzy sam dashboard.
*Układ stron* wybiera sekcje obok siebie dla wszystkich stron albo samej strony głównej oraz ile rzędów sekcja
pokazuje, zanim zacznie się przewijać.

## 9. Bloki: maszyny, urządzenia, własne ekrany {#blocks-machines-appliances-screens-of-their}

<b class="ui">Blok</b> to kafelek, który zamiast jednego urządzenia otwiera własny ekran: ekspres z liczbami i ustawieniami, pralka,
samochód, odkurzacz, serwer, plan lekcji, tramwaje. Bloki są w drzewie pod <b class="ui">Bloki</b> albo bezpośrednio w sekcji
(kafelek z `kind`).

**Nowy blok:** **+** obok **Bloki** wypisuje rodzaje (Blok, Status, Odjazdy, Aplikacja, Wiadomości, Maszyny, Strona),
te same co <b class="ui">Dodaj</b> na tablecie; nowy blok od razu jest wybrany i pojawia się wśród odznak strony głównej. **Blok w
pokoju:** <b class="ui">Zrób blok z tego kafelka</b> pod formularzem kafelka albo blok wybrany w polu <b class="ui">Blok</b> kafelka.

![Blok: jego okno w podglądzie, wybrana jedna liczba](screenshots/pl/editor-block.png)

Blok kilku encji (`kind: panel`) rozwija się w drzewie na części, każda z formularzem:

- <b class="ui">Liczby na górze</b> (`stats`): po jednej liczbie, z jednostką, miejscami po przecinku i formatem. *Czas (m:ss)* i
  *Czas (h min)* pokazują sekundy (albo jednostkę czujnika) jako czas. *Atrybut zamiast stanu* pokazuje atrybut, np.
  grę uruchomioną na konsoli.
- <b class="ui">Przyciski</b> (`actions`): encja, usługa (puste = naciśnij albo włącz), pytanie zadawane najpierw (`confirm`) i pola
  dla skryptu (`data`, w YAML). Przy więcej niż trzech przyciskach na tablecie stoją we własnym rzędzie.
- <b class="ui">Grupy</b> (`groups`) z **wierszami**: grupa to nagłówek i wiersze encji. *Układ*: *Wiersze*, *Kontrolki* (duże
  przełączniki, wybory, suwaki) albo *Podsumowanie* (jedna linia, która się rozwija i mówi „Wszystko w porządku” albo
  co wymaga uwagi). Wiersz listy (`select`) może mieć opcje ułożone, nazwane i ukryte okiem.
- **Z urządzenia, jeszcze nie w bloku**: encje urządzeń bloku, których jego okno nie pokazuje; kliknięcie dodaje
  jedną jako wiersz.
- W formularzu samego bloku: nazwa, ikona, encja i stan jego kafelka, własne nazwy stanów, kiedy kafelek jest
  „włączony” (`active`, `active_state`), karta Home Assistanta na końcu, cały ekran.
- Przycisk na kafelku, gdy urządzenie działa (`quick`, np. *Wyłącz* przy konsoli), ustawia się w YAML. Z `active`
  przycisk patrzy na tę encję, a nie na encję kafelka: konsola Xbox ma `active: binary_sensor.xbox_playing` (chmura
  i ping razem), bo jej stan z chmury potrafi zostać „włączony” po wyłączeniu. Czas poniżej zera w formacie *Czas
  (h min)* brzmi „przekroczono o 10 min”.

Wybranie bloku otwiera jego okno w podglądzie, a pod tabletem edytor mówi, czy mieści się bez przewijania. Kafelek
staje się blokiem po wybraniu bloku w jego polu <b class="ui">Blok</b>; zmiana nazwy bloku zmienia ją też w jego kafelkach, menu,
pasku statusu i zasadach dostępu.

**Inne rodzaje bloków** mają formularz z tymi samymi polami co formularz bloku na tablecie. Na przykład ekran Status
ma sekcje z pozycjami (lista włączonych świateł, alarm wody, słaba bateria, urządzenie w danym stanie, słowo stanu
jak `OB` UPS-a na baterii). Pozycja z <b class="ui">Pokazuj też jako ostrzeżenie na stronie głównej</b> (`notify`) jest też paskiem nad
kamerami na stronie głównej, jak słaba bateria; z <b class="ui">Alarm (czerwony, nie da się zamknąć na stronie głównej)</b> (`alarm`)
nie da się go zamknąć, dopóki stan trwa (wyciek wody, dym, alarm
wywołany):

![Blok Status: jego sekcje w formularzu](screenshots/pl/editor-status-block.png)

Pozostałe: odjazdy (linie z kolorami), wiadomości, host z kolumnami pasków i maszyn, rok szkolny, dodatek w ramce,
strona, telewizor z aplikacjami, waga. Listy się rozwijają, przesuwają strzałkami i usuwają koszem.

## 10. Wygląd, motywy i tła {#look-themes-and-backgrounds}

**Ustawienia → Wygląd i motywy** ma część dla każdej grupy wyglądu: cały dashboard, tła stron, kafelki (z kolorami
według rodzaju), napisy, bloki na górze, okrągłe przyciski, plakietki, okna, mapa i odtwarzacz. Długie części startują
zwinięte; kliknięcie nagłówka rozwija jedną.

![Wygląd i motywy: tła stron](screenshots/pl/editor-look.png)

**Tła stron:** po jednym tle dla strony głównej, scen, mapy, energii i każdego pokoju, z czterema polami: *Jasny*,
*Ciemny*, *Jasny, szeroki ekran* i *Ciemny, szeroki ekran* (tablet w poziomie albo laptop mocno przycina pionowe
zdjęcie, więc może mieć własne). *Część zostawiana przy przycięciu* wybiera górę, środek albo dół.

Każde pole pokazuje na końcu, co zawiera: próbkę koloru albo gradientu albo lupkę, która otwiera obrazek w dużym
oknie. Kliknięcie w pole otwiera okno:

![Kolor albo gradient tła](screenshots/pl/editor-background.png)

- **Obrazki:** wgrane do Home Assistanta i te z folderu `/config/www`, jako miniatury (kliknięcie wybiera, lupka
  powiększa), oraz <b class="ui">Wgraj obrazek z komputera</b>.
- **Kolor i gradient:** jeden kolor z palety albo gradient: jego kolory, ich miejsca w procentach, kierunek, ⇅ do
  odwrócenia, 48 gotowych gradientów i duży podgląd. CSS zostaje pod spodem do ręcznej zmiany.

<b class="ui">Utwórz tło</b> pod polami otwiera kreator tła: 16 gotowych teł, wzory, gradienty i własne zdjęcie, przezroczyste,
odbarwione albo rozmyte, z telefonem i tabletem obok. Zdjęcie można zmniejszyć i położyć w rogu, z boku albo na
środku (<b class="ui">Rozmiar i położenie</b>), przesunąć, obrócić, odbić i wygasić od najwyżej trzech krawędzi (**Wygaszanie od
krawędzi**), np. pokój w prawym górnym rogu, który z lewej i od dołu przechodzi w gradient. Tryb <b class="ui">Zabarwione tłem</b> (domyślny)
nadaje zdjęciu kolory gradientu pod nim: ciemne miejsca dostają głęboki odcień tła, jasne jego jasny odcień. <b class="ui">Użyj jako tło</b> tworzy obraz pionowy i szeroki i wpisuje je do
jasnego wyglądu, ciemnego albo obu.

**Motywy:** wygląd można zapisać na tablecie jako motyw (Menu → Wygląd → Motywy) i udostępnić jako plik. Z
dashboardem przychodzą dwa: **Home Dashboard** i **Apple Home** (zob. [przewodnik Apple Home](apple-home.pl.md)).

## 11. Pasek statusu tabletu i kalendarze {#the-status-bar-of-a-tablet}

Tablet w poziomie może pokazywać kolumnę z godziną, pogodą, dzisiejszymi wydarzeniami i tym, co się dzieje, zamiast
wąskiego paska. **Ustawienia → Pasek statusu**:

![Pasek statusu: kalendarze domu](screenshots/pl/editor-status.png)

- **Wygląd paska** (`appearance.status`): czy jest widoczny, jego części i ich kolejność, kolory, krycie, rozmycie.
- <b class="ui">Kalendarz</b> (`status_panel.calendars`): kalendarze domu. Dzisiejsze wydarzenia są pod pogodą: całodniowe miękko w
  kolorze kalendarza, pozostałe z godziną, w trakcie „teraz”, znikają po końcu; najwyżej tyle, ile *Najwięcej w pasku
  statusu*. Dotknięcie otwiera miesiąc z wydarzeniami wybranego dnia. *Kolory kalendarzy* nadają każdemu kalendarzowi
  kolor. Na telefonie te same wydarzenia są w *Wybierz obszar → Moje kalendarze*, gdzie każda osoba dodaje pod
  trybikiem własne kalendarze.
- <b class="ui">Co pokazuje pasek</b> (`status_panel`), czyli plakietki *W domu* i reszta paska:
  - <b class="ui">Drzwi (W domu)</b> i <b class="ui">Okna (W domu)</b> (`doors`, `windows`): każda lista ma swoją plakietkę, gdy coś z niej jest
    otwarte; dotknięcie na tablecie pokazuje listę otwartych z godziną otwarcia. Wpisz tylko te, które mają mówić
    (wejściowe, balkon, toaleta), nie drzwi pokoi, które zwykle są otwarte.
  - <b class="ui">Znaczniki (W domu)</b> (`flags`): plakietka, dopóki pomocnik jest włączony, np. **Poczta** z
    `input_boolean.mail_in_mailbox`, który włącza otwarcie skrzynki; dotknięcie otwiera pomocnika, żeby go wyłączyć.
  - <b class="ui">Nieliczone w W domu</b> (`ignore`): światła i urządzenia poza licznikiem, np. lampa z własnym harmonogramem. To
    jedyne miejsce tego ustawienia; tablet pokazuje je tylko osobno na liście włączonych.
  - co *Teraz* działa (pralka z programem i pozostałym czasem), pobór mocy z wykresem ostatnich godzin, tramwaje.

iPad w podglądzie od razu pokazuje pasek ze szkicu.

## 12. Menu i pasek stron {#menu-and-bar-of-pages}

![Menu: jego grupy, otwarte w podglądzie](screenshots/pl/editor-menu.png)

**Ustawienia → Menu** zawiera grupy lewego menu i ich pozycje. Pozycja otwiera **blok**, **dodatek**, **adres**
(stronę Home Assistanta, inny dashboard) albo uruchamia **akcję**; może być tylko dla administratorów, dla wybranych
osób i ukryta w trybie gościa. Wybranie *Menu* otwiera menu w podglądzie. Strzałki pozycji zmieniają jej miejsce w
grupie, a przycisk **Przenieś do innej grupy** podaje pozostałe grupy i przenosi ją na koniec wybranej, bez
przepisywania.

**Ustawienia → Pasek stron** zawiera miejsca dolnego paska telefonu i bocznego paska tabletu: od 2 do 5 z: strona
główna, Muzyka, Media, Energia, Mapa, Sceny, menu albo pokój, w kolejności, oraz wygląd paska.

## 13. Kamery, energia, interkom i pozostałe ustawienia {#cameras-energy-intercom-and-the-other}

| Węzeł | Co ustawia |
|---|---|
| <b class="ui">Kamery</b> | które kamery i w jakiej kolejności; prywatność i tryb gościa (zasady z przełącznikiem, kamery, które ukrywają, i osoby); pojedyncze kamery: kamera na żywo dla zdjęcia, rozmowa, okrągłe przyciski, obracanie, encje pod trybikiem |
| <b class="ui">Energia</b> | fazy licznika, zakres napięcia, magazyn energii (stacja zasilania na baterii) |
| <b class="ui">Interkom</b> | skrypt komunikatów, pokoje do zaznaczenia i pola wywołania |
| <b class="ui">Pokoje: kolejność i ukryte</b> | kolejność pokoi i pokoje ukryte przed wszystkimi |
| <b class="ui">Encje: dodane, pominięte, własne</b> | encje dodane do pokoju, nigdy niepokazywane same, własna nazwa, ikona, obszar albo karta encji |
| <b class="ui">Światła</b> | grupa świateł zamiast jej lamp |
| <b class="ui">Strona główna i tablet</b> | pogoda, ochrona, powrót tabletu na stronę główną, sceny, układ stron |
| <b class="ui">Strona Muzyka</b>, <b class="ui">Strona Media</b>, <b class="ui">Strona Mapa</b> | aplikacja muzyczna w ramce, grupy głośników i mediów, osoby i miejsca na mapie |

Blok otwierający stronę (np. <b class="ui">Źródła</b> z `page: media`) nie ma własnych grup: grupy i kafelki strony Media
(Głośniki, Telewizory, własne grupy) dodajesz w <b class="ui">Strona Media</b> → **sections**. Pod właściwościami takiego bloku jest
przycisk **Edytuj: Strona Media**, który tam prowadzi.

Każdy ma formularz; zakładka YAML zostaje obok dla tego, co wolisz wpisać. Klucze opisuje
[opis konfiguracji](configuration.pl.md).

Ustawienie, którego części Home Assistant nie ma, jest wyszarzone i się nie otwiera, a pod nazwą mówi, czego
wymaga: *Kamery* kamery, *Strona Media* głośnika, *Interkom* integracji Intercom albo skryptu, *Strona Muzyka*
integracji Music Assistant. Po instalacji ustawienie się otwiera. Sam dashboard działa bez nich: bez integracji
Intercom (albo skryptu, który wskazuje) żaden przycisk nie proponuje mówienia, a bez Music Assistant strona Muzyka
mówi, że nie może jej otworzyć.

## 14. Kto co widzi {#who-sees-what}

Dzieci nie potrzebują przełączników garażu, a gość kamer wewnątrz domu. **Ustawienia → Dostęp osób**:

![Dostęp osób](screenshots/pl/editor-access.png)

- Wybierz **osobę**, a potem to, czego **nie widzi**, w grupach (kamery, pokoje, sekcje, bloki na górze, światła,
  media, ochrona, sceny i skrypty, reszta), z okiem przy każdej rzeczy.
- <b class="ui">Kto widzi kafelek albo blok</b> (`visibility`): zasady dla jednej rzeczy, encji, `block:<nazwa>` albo
  `shortcut:<nazwa>`, z osobami, które ją widzą (*only*) albo nie (*except*).
- To tylko ukrywa rzeczy w dashboardzie; to nie jest uprawnienie Home Assistanta. Administratorzy widzą wszystko w
  edytorze.

Sprawdź to przez **Jako** w podglądzie: dashboard tej osoby, tak jak ona go zobaczy.

## 15. Zapisywanie, publikowanie i historia {#saving-publishing-and-history}

**Szkic** zapisuje się na serwerze chwilę po każdej zmianie (*Szkic zapisany*). Czeka też w innej przeglądarce.
*Wyrzuć* go usuwa.

<b class="ui">Opublikuj</b> otwiera podsumowanie:

![Publikowanie: co się zmienia i różnice w YAML](screenshots/pl/editor-publish.png)

- **Co się zmieni**, prostymi słowami, i **różnice w YAML**.
- **Sprawdzenie:** encje, których nie ma, i informacja, że opublikowana wersja trafi do historii.
- <b class="ui">Notatka do historii</b> (co i dlaczego, opcjonalnie).
- <b class="ui">Najpierw sprawdzi:</b> wybierz osobę i <b class="ui">Opublikuj do sprawdzenia</b>: tylko jej dashboard pokazuje tę wersję, z
  paskiem *Wersja do sprawdzenia* i przyciskiem powrotu do zwykłej. Góra edytora mówi, kto sprawdza; *Zakończ* kończy
  sprawdzanie. Dobre, żeby dużą zmianę wypróbować najpierw na jednym tablecie.
- **Opublikuj dla wszystkich:** każde urządzenie wczyta nową wersję, a ta, którą zastępuje, trafia do historii. Jeśli
  w międzyczasie dashboard zmieniono gdzie indziej (na tablecie), edytor to mówi, zamiast nadpisać tę zmianę;
  *Opublikuj mimo to* ją nadpisuje.

<b class="ui">Historia</b> przechowuje 30 ostatnich opublikowanych wersji, z tym, kto i kiedy je opublikował, oraz notatką. Wybierz
jedną, żeby zobaczyć, czym różni się od obecnej; <b class="ui">Przywróć jako szkic</b> robi z niej szkic, do obejrzenia i
opublikowania jak każdy inny.

![Historia: wersja i jej różnice](screenshots/pl/editor-history.png)

### Warianty stron {#page-variants}

Wariant to inna wersja jednej strony, głównej albo pokoju, do wypróbowania bez ruszania obowiązującej. Zawiera tylko
to, co należy do jego strony, **razem z tłem**: dla strony głównej ulubione, sceny, pasek kamer, kolejność pokoi i to,
co każdy pokazuje na stronie głównej, oraz układ strony; dla pokoju jego kartę (sekcje, status, układ). Wszystko inne
(menu, wygląd, pozostałe strony) zawsze pochodzi z obowiązującego dashboardu.

W drzewie strona główna i każdy pokój mają węzeł <b class="ui">Warianty</b>. Jego karty:

- Obowiązująca strona (<b class="ui">Obowiązuje</b>); ołówek nadaje jej nazwę, np. *Klasyczna*.
- Każdy wariant z tym, kto go widzi. Dotknięcie pokazuje go w podglądzie tak, jak zobaczą go jego urządzenia.
- <b class="ui">Nowy wariant jako kopia obowiązującej</b> (albo wybranego).

Co oferuje wybrany wariant:

- <b class="ui">Edytuj</b>: drzewo, formularze i podgląd pracują na wariancie; u góry jest *Wariant: …*, zmiany jego strony
  zapisują się w nim od razu, a <b class="ui">Opublikuj</b> czeka. Wszystko inne zmienione w tym czasie (nowy blok, menu, inny
  pokój) trafia do wersji roboczej i publikujesz to jak zawsze, więc blok zrobiony dla wariantu nie przepada.
  <b class="ui">Gotowe</b> wraca do wersji roboczej.
- <b class="ui">Udostępnij domownikom</b>: domownicy bez uprawnień administratora mogą go wybrać dla siebie na telefonie (trzy
  kropki → <b class="ui">Wariant tej strony</b> → <b class="ui">Wybierz dla siebie</b>), na wszystkich swoich urządzeniach. <b class="ui">Przestań udostępniać</b>
  przywraca im obowiązującą stronę.
- <b class="ui">Kopiuj</b>: nowy wariant z tego.
- <b class="ui">Kto widzi</b>: dla każdego urządzenia i każdej osoby, który wariant tej strony pokazuje. Urządzenie pojawia się tam,
  gdy otworzy dashboard (opisane nazwą z Browser Mod albo rodzajem i osobą; nadaj mu nazwę, np. *iPad w korytarzu*).
  Dashboard trzyma na każdym urządzeniu własny identyfikator, więc ponowne zalogowanie zostawia je tym samym
  urządzeniem, z nazwą i wariantami; nowym staje się dopiero po wyczyszczeniu danych aplikacji (albo w trybie
  prywatnym przeglądarki). Wybór dla urządzenia
  wygrywa z wyborem dla osoby; pozostali widzą obowiązującą stronę. Działa od razu.
- <b class="ui">Ustaw jako obowiązujący</b>: jego część trafia do dashboardu dla wszystkich. Zastępowana wersja idzie do historii,
  a strona, którą zastąpił, zostaje wśród wariantów, więc powrót to ten sam przycisk na jej karcie. Wersja robocza też
  dostaje nową stronę.

<b class="ui">Urządzenia</b> w ustawieniach to lista telefonów i tabletów, które otworzyły dashboard: nazwa (wpisz taką,
którą rozpoznasz), rodzaj i osoba, kiedy ostatnio otwierały dashboard i który wariant której strony pokazują.
<b class="ui">Zapomnij</b> usuwa urządzenie wylogowane albo oddane; wróci jako nowe, gdy znowu otworzy dashboard.
<b class="ui">Bateria</b> na karcie tabletu wybiera czujnik baterii aplikacji Home Assistant na nim; tablet pokazuje jej
stan na dole panelu stanu (przewodnik, *Pasek statusu na tablecie*).

Lupa obok tytułu wariantów otwiera <b class="ui">Gdzie działają warianty</b>: dla każdej strony każdy wariant z urządzeniami
(i tym, kiedy ostatnio otwierały dashboard) oraz osobami, które go widzą; *wybrał sam* oznacza tych, którzy sami wybrali
udostępniony wariant, a obowiązująca strona mówi, ile znanych urządzeń nie ma własnego wariantu.

Wariant, którego nikt nie widzi, niczego w domu nie zmienia. Warianty trzyma edytor na serwerze
(`.storage/home_dashboard.editor`), nie w konfiguracji dashboardu.

Na telefonie i tablecie administrator ma ten sam wybór pod trzema kropkami → <b class="ui">Wariant tej strony</b> (tylko na stronie,
która ma warianty): <b class="ui">Pokaż na tym urządzeniu</b>, <b class="ui">Tylko zerknij</b> (na tę wizytę, z paskiem *Oglądasz: …* i
<b class="ui">Wróć</b>) oraz <b class="ui">Wdróż dla wszystkich…</b>. Zmiany zrobione na stronie, która pokazuje wariant (edycja pokoju, jego tło),
trafiają do tego wariantu.

## 16. Ustawienia edytora: własne telefony i tablety {#editor-settings-your-own-phones-and}

⚙ na górnym pasku otwiera pod sobą małe okienko, bez wychodzenia z tego, co edytujesz:

- **Motyw**: Jak HA, Jasny albo Ciemny – ten sam wybór co połowa słońca na pasku.
- **Język**: Jak w HA (Twój profil), Polski albo English – edytor od razu rysuje się w nim od nowa i zapamiętuje go
  w tej przeglądarce. Części rysowane przez sam Home Assistant (np. jego wybór encji) zostają w języku profilu.
- <b class="ui">Urządzenia podglądu</b> otwiera ustawienia telefonów i tabletów opisane niżej.

Wybór działa od razu, a okienko zostaje otwarte; zamykają je Esc, kliknięcie obok, ponowne ⚙ albo ☰.


![Ustawienia edytora: telefony i tablety](screenshots/pl/editor-settings.png)

- Każdy wbudowany model (Apple) można **ukryć** z wyboru nad podglądem, **przemianować** albo **zmienić mu rozmiar**;
  strzałka przywraca ustawienia fabryczne.
- Pod każdą listą **dodajesz własne urządzenie** dowolnej marki: nazwę, szerokość i wysokość w punktach (pikselach
  CSS: rozdzielczość ekranu podzielona przez gęstość pikseli; np. 1280 × 800 dla Galaxy Tab S9). Telefon zawsze stoi
  pionowo, a tablet poziomo, niezależnie od kolejności wpisanych wymiarów.
- Lista jest zapisywana w tej przeglądarce. Jeden model każdego rodzaju zawsze zostaje widoczny.

## 17. Cały dashboard w dziesięciu krokach {#a-whole-dashboard-in-ten-steps}

Kolejność, która najlepiej działa dla nowego domu:

1. **Najpierw obszary.** W Home Assistant przypisz każdemu urządzeniu obszar (Ustawienia → Obszary). Ukryj to, czego
   nikt nie potrzebuje.
2. **Otwórz edytor** i **utwórz dashboard** (rozdział 3).
3. <b class="ui">Utwórz pokoje z obszarów</b>, z *Oświetleniem*, *Klimatem i roletami*, *Multimediami*, *Urządzeniami* i
   *Bezpieczeństwem* oraz kilkoma kafelkami każdego pokoju na stronie głównej.
4. **Uporządkuj pokoje:** przemianuj je, połącz obszary będące jednym pokojem, ułóż pokoje w kolejności (*Pokoje:
   kolejność i ukryte*), usuń niepotrzebne kafelki i dodaj brakujące przez *Wybierz z listy…*.
5. **Zbuduj stronę główną:** kilka **Ulubionych** (główne światła, drzwi wejściowe, ogrzewanie), <b class="ui">Sceny</b>, a w każdym
   pokoju listę <b class="ui">Na stronie głównej</b> z dwoma do czterech kafelków.
6. **Dodaj bloki** dla rzeczy z wieloma encjami: ekspres, pralka, samochód, odkurzacz, serwer, UPS. Zacznij od
   najważniejszych liczb, potem grupy; *Z urządzenia, jeszcze nie w bloku* pokazuje, co zostało.
7. **Wybierz wygląd:** motyw, tło dla strony głównej i każdego pokoju (pomoże kreator tła), kolory kafelków.
8. **Przygotuj tablet na ścianę:** pasek statusu z kalendarzami i tym, co pokazuje (drzwi i okna, które mają mówić,
   znaczniki jak poczta, lampy nieliczone), na ekranie Status ostrzeżenia na stronę główną (woda, dym, alarm, słabe
   baterie), powrót tabletu na stronę główną, pasek stron i menu.
9. **Zdecyduj, kto co widzi**, i sprawdź to przez **Jako** w podglądzie.
10. <b class="ui">Opublikuj do sprawdzenia</b> na jednym tablecie, potem **Opublikuj dla wszystkich**. Zostaw notatkę w historii.

Potem edytor jest miejscem każdej zmiany: nowe urządzenie to kafelek dodany w minutę, nowy pokój to kliknięcie ✨.

## 18. Wskazówki i problemy {#tips-and-problems}

- **Zmiana nie pojawia się na tablecie.** Pojawia się po **opublikowaniu**. Otwarty tablet trzyma starą wersję, dopóki
  nie wczyta dashboardu ponownie (przeciągnij w dół albo otwórz aplikację jeszcze raz).
- **Edytor mówi, że dashboard zmieniono gdzie indziej.** Ktoś zmienił go na tablecie (np. osoba przesunęła kafelki).
  Publikacja zastąpiłaby tę zmianę; najpierw obejrzyj różnice, potem *Opublikuj mimo to* albo wyrzuć swój szkic.
- **Edytor był otwarty w dwóch przeglądarkach.** Każda zapisuje swój szkic; wygrywa ostatnia. Przeładuj edytor, zanim
  zaczniesz pracę w drugiej.
- **Kafelek ma ⚠.** Jego encja nie istnieje (zmieniona albo usunięta w Home Assistant). Wybierz kafelek i wskaż nową
  encję albo go usuń.
- **Okno bloku przewija się na tablecie.** Edytor mówi pod podglądem, o ile. Zwiń grupę w podsumowanie, przenieś
  wiersze do mniejszej liczby grup albo ustaw blok na cały ekran.
- **W oknie tła nie ma obrazków z folderu `www`.** Pojawiają się po restarcie Home Assistanta z nową wersją
  integracji.
- **Nic w edytorze nie wywołuje usług**, więc możesz śmiało wszystko sprawdzać. Jedyne, co zmienia dashboardy domu,
  to <b class="ui">Opublikuj</b>.

Więcej odpowiedzi, z dokładnymi komunikatami, jest w [FAQ w README](../README.pl.md#faq), a każdy klucz konfiguracji
w [opisie konfiguracji](configuration.pl.md).
