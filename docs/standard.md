# One standard

The apps of the house (the wake word studio, the Assist Router trainer, Piper Voice Cloner, the Home Dashboard editor
and the Assist Router editor) follow one standard: the same look and behaviour, the same documentation, the same
`make` commands and the same rules for tests. This page sums up what was changed in the **Home Dashboard editor** and
around it to follow it (November 2026). The details of each change are in the [changelog](changelog.md).

## Look and behaviour {#look}

| What | How it works now |
| --- | --- |
| Top bar | The icon of the editor stands next to its name; the **?** of the top bar opens the guide on the documentation site, in English or Polish as Home Assistant is. |
| Help of a part | The tree, the preview and the settings of what is chosen each have their own **?**. It opens a small window saying what this part does, with a link to its chapter of the guide, following what is chosen (a room, a tile, the look). The publish, history and editor settings windows have one too. Only the **?** of the top bar opens the guide at once. |
| Address | The chosen part is in the address (`#/layout/0/sections/1`): a link or a reload opens the editor on it once the dashboard has loaded. Choosing does not add steps to the browser's history. |
| Columns | The left and the right column fold into a narrow strip with a button or **Ctrl/⌘+B** (left) and **Ctrl/⌘+Alt+B** (right), and stay folded after a reload; on a narrow screen they fold by themselves. |
| Esc | Closes what is open, one thing at a time, the innermost first: a help window, a picture shown big, the window of pictures, the list of tiles to add, a dialog (as its ✕: nothing is saved or published). |
| Menu of Home Assistant | Hidden when the editor opens, as on the dashboard (by the kiosk mode of Home Assistant, never saved as the user's choice); the menu button at the top left shows and hides it, and it is back on any other page. |
| A browser that keeps nothing | A private window or blocked site data no longer stops the editor from opening; what it would remember (folded columns, devices of the preview) simply is not kept. |

## Never hangs {#performance}

- Every question to Home Assistant has a time limit (60 s) and ends in a clear message instead of waiting for ever.
- The draft is saved one save at a time: changes made meanwhile go with the next save, and a save that fails says so
  instead of leaving "Saving…".
- A test goes through every part of a big dashboard (30 rooms, 1200 tiles) and allows no task of the page longer
  than 500 ms; a control test proves the measure sees a slow task.
- With the dashboard (version 1.0.4) the editor got lighter on a tab open all day: it is drawn again at once for a new
  entity, device, area or language and for states alone at most every 5 s; a frame of the preview loaded again no
  longer stays in memory; the outline of the chosen part looks for its elements every second, not in a hidden tab.

## Documentation {#documentation}

- The documentation is a site (MkDocs Material, English and Polish) on GitHub Pages and in the house's documents.
- The chapters of the editor's guide have the same anchors in both languages, so each **?** leads to the same place
  in either language; a test checks that every anchor a **?** uses is there.
- Names of buttons and fields in the text (`<b class="ui">`) are checked against the texts of the screen, so the guide
  never names a button that is not there.
- Every error someone met has an entry in the FAQ, in both languages.
- Both READMEs start with **Try it on a Mac**: only Docker Desktop is needed.

## The same commands {#make}

`make help` shows three groups, in both languages:

| Group | Commands | Needs |
| --- | --- | --- |
| 1. Start | `help`, `demo`, `demo-clean`, `docs`, `docs-serve`, `doctor` | Docker Desktop only |
| 2. Home Assistant | `deploy` | the share of the Home Assistant configuration |
| 3. Development | `setup`, `setup-dev`, `demo-local`, `test`, `test-browser`, `test-docker`, `test-all`, `lint`, `format`, `docs-build`, `screenshots`, `clean` | uv (fetches Python 3.14 itself), Chrome for the browser tests |

- `make demo` builds an image of the tested Home Assistant (2026.11.0) with this integration, demo devices and a ready
  dashboard, and runs it on <http://127.0.0.1:8124/home-dashboard/home> (user `dev`, password `dev`). The owner, the
  rooms and the dashboard are made while the image is built, so a start takes about 2 seconds; the HTTP settings of
  Home Assistant 2026.11 are confirmed, so no question about them shows.
- `make docs`, `make docs-serve` (port 9124) and `make docs-build` work in Docker; `.venv-docs` is gone.
- `make doctor` checks Docker, Chrome, uv and the share of Home Assistant and installs nothing.
- `make test` never builds images; `make test-docker` builds and runs the demo image, logs in and checks that no
  container is left; `make test-all` runs lint, test, test-browser and test-docker.
- `make lint` checks the code and its format, `make format` fixes them (the Python code was formatted once).
- One name for one thing: the old `make ui` is gone (use `make demo`).

## Tests {#tests}

| Set | Tests |
| --- | --- |
| `make test` (integration, docs, Makefile, without Docker) | 156 |
| `make test-docker` (the demo image) | 1 |
| `make test-browser` (the dashboard and the editor in Chrome) | 1820 |

- Tests never connect anywhere but 127.0.0.1: a guard in every test stops any other connection.
- New tests of the standard: the address, a browser that keeps nothing, the help windows and their anchors, a big
  dashboard without long tasks, a slow and a failing save, folding the columns, Esc, the commands of `make` (groups,
  both languages, Start needing only Docker, no aliases, a clear message without Docker or uv), the demo image.
