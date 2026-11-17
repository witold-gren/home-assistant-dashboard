# Najważniejsze zmiany

Najważniejsza praca nad samym dashboardem, od pierwszej wersji (0.1.0, 6 listopada 2026) do teraz, pogrupowana według
tego, co daje. Wszystkie szczegóły są w [liście zmian](changelog.md); droga edytora do wspólnego standardu jest na
stronie [Jeden standard](standard.md).

## Szybkość i karta otwarta cały dzień {#performance}

- **Strona przyjmuje zmiany z Home Assistant najwyżej dwa razy na sekundę** (pierwszą od razu, ostatnią zawsze),
  a nie każdą z wielu zmian na sekundę od liczników energii; ukryta karta co 10 s, a najnowszą od razu po pokazaniu.
  W domu z 4600 encjami główny wątek spadł z około **30 % do 8 %** (1.0.4).
- Kamery znajdują swoją baterię, kamerę podglądu i czujniki strumienia w spisie encji każdego urządzenia, robionym
  raz, zamiast przechodzić przez wszystkie encje domu dla każdej kamery (1.0.4).
- Ukryta karta nie strumieniuje żadnej kamery, zamknięte okno zamyka swój dźwięk (1.0.4).
- Arkusz okien, 8500 linii w jednym pliku, został podzielony na moduły według rodzaju okna (0.7.0).
- Pasek stanu zachowuje linie mocy, gdy odczyt się nie uda, i próbuje ponownie po 30 s (1.0.3).

## Jeden wygląd wszędzie {#look}

- Własne okna dashboardu prawie do wszystkiego: czujniki, listy, automatyzacje, gniazdka z poborem prądu, dziennik
  i historia, strona Energia z wykresami, żeby nikt nie trafiał do zwykłych ekranów Home Assistant (0.4.0–0.6.0).
- Motywy: **Home Dashboard** i **Apple Home**, wygląd ustawiany w dashboardzie i zapisywany jako motyw do udostępnienia;
  okna w mlecznych kolorach pasujących do każdego tła, grube zaokrąglone suwaki (1.0.3); kreator tła ze zdjęć
  i gradientów (1.0.0–1.0.2).
- **Okno kamery dla automatyzacji** (`home_dashboard.show_camera`): ruch na kamerach i dzwonek otwierają własne okno
  kamery dashboardu na tablecie w korytarzu, ze zdjęciem z wykrycia albo od razu na żywo, zamykające się samo; to samo
  okno otwiera powiadomienie. Zastąpiło popupy Browser Mod wyglądające jak stary pulpit.
- **Jeden przycisk do wyłączenia**: okno przełącznika, gniazdka, przełącznika lampy albo automatyzacji ma okrągły
  przycisk zasilania jak okno lampy; test sprawdza, że widać go bez przewijania na telefonach i tabletach.
- **Esc na komputerze** zamyka otwarte okno jak jego ✕, najpierw małe okienko w środku.

## Tablet na ścianie {#tablet}

- Pasek stanu na tablet w poziomie: godzina, pogoda, kalendarze, prąd, ostrzeżenia, W domu ze światłami,
  urządzeniami, otwartymi drzwiami i oknami, flagi (0.4.0–1.0.2).
- Kamery: ściana wszystkich kamer z jedną dużą na żywo, powiększanie palcami, szybkie przyciski (syrena, światło,
  noktowizor), obracanie, mówienie przez kamerę, nagrania na dysku i na karcie kamery z osią czasu (0.2.0–0.4.0).
- Menu dashboardu wysuwa się za palcem od lewej krawędzi w aplikacji Home Assistant; menu Home Assistant chowa jego
  tryb kiosku i wraca na każdej innej stronie, nigdy zapisane jako wybór użytkownika (1.0.3).
- Bloki maszyn i urządzeń: pralka, suszarka, waga, stacja zasilania, konsola z szybkim przyciskiem, PIN rodzica do
  limitów, przyciski −/+ (0.5.0–1.0.0).

## Edycja {#editing}

- **Edytor na komputerze** (1.0.0): drzewo dashboardu, formularze do każdego ustawienia, podgląd na żywo iPhone'a
  i iPada (jako inna osoba, jasny albo ciemny), szkic, który niczego nie zmienia do publikacji, wersja do sprawdzenia
  przez jedną osobę, historia 30 wersji, cofanie i ponawianie.
- Obrazki i tła wybierane w oknie, wybór kafelków ze wszystkich encji domu, bloki dodawane z drzewa (1.0.0–1.0.1).

## Dokumentacja i wypróbowanie {#docs}

- Strona dokumentacji po polsku i angielsku na GitHub Pages (1.0.1), pełny opis konfiguracji (0.7.0), przewodnik po
  edytorze od zera do gotowego dashboardu (1.0.0), galeria zrzutów zmyślonego domu.
- **Wypróbowanie tylko z Dockerem**: `make demo` uruchamia na komputerze testowy Home Assistant z dashboardem.

## Sprawdzone na prawdziwym domu {#tests}

- Każde okno zostało otwarte na prawdziwym domu, na telefonie i tablecie, w Chrome i WebKit (Safari) (0.7.0).
- Około 2000 testów: integracja i dokumentacja (156), obraz demo (1) oraz dashboard i edytor w Chrome (1820), na
  telefonach i tabletach w pionie i w poziomie.
