# Jeden standard

Aplikacje domu (studio słów budzących, trener Assist Routera, Piper Voice Cloner, Edytor Home Dashboard i Edytor
Assist Router) trzymają się jednego standardu: ten sam wygląd i zachowanie, ta sama dokumentacja, te same polecenia
`make` i te same zasady testów. Ta strona zbiera, co zmieniło się w **Edytorze Home Dashboard** i wokół niego, żeby
spełniał ten standard (listopad 2026). Szczegóły każdej zmiany są w [liście zmian](changelog.md).

## Wygląd i zachowanie {#look}

| Co | Jak działa teraz |
| --- | --- |
| Pasek górny | Obok nazwy edytora stoi jego ikona; **?** na pasku otwiera przewodnik na stronie dokumentacji, po polsku albo po angielsku, jak Home Assistant. |
| Pomoc części ekranu | Drzewo, podgląd i ustawienia wybranej rzeczy mają własny **?**. Otwiera on małe okienko z opisem tej części i linkiem do jej rozdziału przewodnika, zależnie od tego, co jest wybrane (pokój, kafelek, wygląd). Mają go też okna publikacji, historii i ustawień edytora. Tylko **?** na pasku otwiera przewodnik od razu. |
| Adres | Wybrana część jest w adresie (`#/layout/0/sections/1`): link albo odświeżenie otwiera edytor na niej, gdy dashboard się wczyta. Wybieranie nie dokłada kroków do historii przeglądarki. |
| Kolumny | Lewa i prawa kolumna zwijają się do wąskiego paska przyciskiem albo **Ctrl/⌘+B** (lewa) i **Ctrl/⌘+Alt+B** (prawa) i zostają zwinięte po odświeżeniu; na wąskim ekranie zwijają się same. |
| Esc | Zamyka to, co otwarte, po jednej rzeczy, od najgłębszej: okienko pomocy, obrazek pokazany w dużym rozmiarze, okno obrazków, listę kafelków do dodania, dialog (jak jego ✕: nic się nie zapisuje ani nie publikuje). |
| Menu Home Assistant | Chowa się po otwarciu edytora, jak na dashboardzie (trybem kiosku Home Assistant, nigdy nie zapisanym jako wybór użytkownika); przycisk menu w lewym górnym rogu je pokazuje i chowa, a na każdej innej stronie wraca. |
| Przeglądarka bez pamięci | Okno prywatne albo zablokowane dane strony nie blokują już otwarcia edytora; to, co zapamiętałby (zwinięte kolumny, urządzenia podglądu), po prostu się nie zapamiętuje. |

## Nigdy się nie zawiesza {#performance}

- Każde pytanie do Home Assistant ma limit czasu (60 s) i kończy się czytelnym komunikatem zamiast czekania bez końca.
- Szkic zapisuje się po jednym zapisie naraz: zmiany zrobione w tym czasie idą z następnym zapisem, a zapis, który się
  nie udał, mówi o tym zamiast zostawiać „Zapisywanie…”.
- Test przechodzi przez każdą część dużego dashboardu (30 pokoi, 1200 kafelków) i nie dopuszcza zadania strony
  dłuższego niż 500 ms; test kontrolny dowodzi, że pomiar widzi wolne zadanie.
- Razem z dashboardem (wersja 1.0.4) edytor jest lżejszy w karcie otwartej cały dzień: rysuje się od razu przy nowej
  encji, urządzeniu, obszarze albo języku, a przy samych stanach najwyżej co 5 s; przeładowana ramka podglądu nie
  zostaje w pamięci; obrys wybranej części szuka swoich elementów co sekundę, a nie w ukrytej karcie.

## Dokumentacja {#documentation}

- Dokumentacja to strona (MkDocs Material, po polsku i angielsku) na GitHub Pages i w Dokumentach domu.
- Rozdziały przewodnika po edytorze mają te same kotwice w obu językach, więc każdy **?** prowadzi w to samo miejsce
  w obu językach; test sprawdza, że każda kotwica używana przez **?** istnieje.
- Nazwy przycisków i pól w tekście (`<b class="ui">`) są sprawdzane z tekstami ekranu, więc przewodnik nigdy nie
  wymienia przycisku, którego nie ma.
- Każdy błąd, na który ktoś trafił, ma wpis w FAQ w obu językach.
- Oba README zaczynają się od **Wypróbuj na Macu**: wystarczy Docker Desktop.

## Te same polecenia {#make}

`make help` pokazuje trzy grupy, w obu językach:

| Grupa | Polecenia | Potrzebne |
| --- | --- | --- |
| 1. Start | `help`, `demo`, `demo-clean`, `docs`, `docs-serve`, `doctor` | tylko Docker Desktop |
| 2. Home Assistant | `deploy` | udział z konfiguracją Home Assistant |
| 3. Rozwój | `setup`, `setup-dev`, `demo-local`, `test`, `test-browser`, `test-docker`, `test-all`, `lint`, `format`, `docs-build`, `screenshots`, `clean` | uv (sam pobiera Pythona 3.14), Chrome do testów w przeglądarce |

- `make demo` buduje obraz testowanego Home Assistant (2026.11.0) z tą integracją, urządzeniami demo i gotowym
  dashboardem i uruchamia go pod <http://127.0.0.1:8124/home-dashboard/home> (użytkownik `dev`, hasło `dev`). Konto,
  pokoje i dashboard powstają przy budowie obrazu, więc start trwa ok. 2 sekund; ustawienia HTTP Home Assistant
  2026.11 są potwierdzane, więc nie wyskakuje pytanie o nie.
- `make docs`, `make docs-serve` (port 9124) i `make docs-build` działają w Dockerze; `.venv-docs` zniknął.
- `make doctor` sprawdza Dockera, Chrome, uv i udział Home Assistant i niczego nie instaluje.
- `make test` nigdy nie buduje obrazów; `make test-docker` buduje i uruchamia obraz demo, loguje się i sprawdza, że
  nie został żaden kontener; `make test-all` uruchamia lint, test, test-browser i test-docker.
- `make lint` sprawdza kod i jego format, `make format` je poprawia (kod Pythona został raz sformatowany).
- Jedna nazwa na jedną rzecz: stare `make ui` zniknęło (użyj `make demo`).

## Testy {#tests}

| Zestaw | Testów |
| --- | --- |
| `make test` (integracja, dokumentacja, Makefile, bez Dockera) | 156 |
| `make test-docker` (obraz demo) | 1 |
| `make test-browser` (dashboard i edytor w Chrome) | 1820 |

- Testy nigdy nie łączą się nigdzie poza 127.0.0.1: strażnik w każdym teście zatrzymuje każde inne połączenie.
- Nowe testy standardu: adres, przeglądarka bez pamięci, okienka pomocy i ich kotwice, duży dashboard bez długich
  zadań, wolny i nieudany zapis, zwijanie kolumn, Esc, polecenia `make` (grupy, oba języki, Start tylko z Dockerem,
  bez aliasów, czytelny komunikat bez Dockera albo uv), obraz demo.
