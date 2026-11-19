# Changelog

## 1.4.0 (2026-11-19)

Lessons of the editor, step by step in the editor itself, and a block of text for the readings of the day, a page of
a book or a thought of the day, read aloud too.

- **Block of text** (`kind: text`, *Text* in the + menu of Blocks): sections of text from entities — the state the
  small line above, the attributes the text (`paragraphs`/`text`, `title`, `intro`, `refrain`, `ending`; the Polish
  names too), an entity without them its state as the text. A heading from an entity with its date, the small line
  of the badge from another (`label_entity`). Read aloud on a speaker (`tts.speak`) or through a script that needs the
  whole file first (a HomePod with a script of announcements: `script`, `script_field`, `script_data`); everything or
  a section with `read: true`. A section with nothing to say is left out, a block with none of its entities not
  shown. Lesson *A block of text*. Docs: configuration, guide (PL+EN). Tests in `test_text_block.py`.
- The tour and the lessons scroll to a framed part below or above the window (the kind of a block at the end of a
  long list) instead of waiting for a click that cannot reach it.
- **Lessons** in the editor (⚙ → Lessons): twenty-seven tasks in three parts, each a short tour of the editor
  itself that goes where the task is done (chooses the node, opens the part of the settings), frames one part at a
  time and waits for the framed button where it says so; the list marks the ones gone through and says what one needs
  first. To start with: add a device to a room, add a room, build Home, change the order, add a summary badge, lights
  in the badges, change a background, a warning on Home, the status bar of the tablet, publish and who sees what. Next
  steps: set up a tile, colours of tiles and texts, names, areas and hidden entities, variants, cameras, speakers and
  Media, Energy, menu and the bar of pages, undo and history, YAML and search. Set up once: build a block of a device,
  intercom, Map, the school block, departures, a block of text, the news block — a lesson on a block the dashboard has
  not got starts by making it. A step whose button comes only after an earlier click frames the part it belongs to
  until then. `editor/lessons.js`; the tour (`tour.js`) finds parts inside the forms. Docs: editor (PL+EN). Tests in
  `test_editor_lessons.py`.
- The **?** of a form offers the lesson of what is chosen (*Show me step by step*), found by the node of the tree.
- The school block is in the + menu of Blocks too.

## 1.3.0 (2026-11-19)

A quick start and a tour of the editor, the battery of the tablet at the foot of its status bar, a camera window that
stays up for its whole time on a tablet woken by the notification, a status bar that keeps its place after a
restart, and defaults that name nothing of one home.

- **Quick start** in the editor: a working dashboard from what is in Home Assistant in six steps (devices, rooms,
  Home, safety, look, summary). Each step starts from what was found (areas, lights, leak and smoke sensors,
  batteries, gateways and hubs, the alarm, scenes), counted beside it, and shows in the preview at once. Safety makes
  items of the Status screen (alarm or warning, a battery threshold, hubs unavailable). It all goes to the draft as one
  step; run again it only adds what is missing and keeps what was chosen. Opens for a new dashboard, from the empty
  tree and from ⚙. `editor/quick-start.js`, `quick-start-dialog.js`. Tests in `test_editor_quick_start.py`.
- **Tour of the editor:** the first time the editor opens in a browser, its parts are framed one at a time (tree,
  preview, devices and person, properties, draft and history, publish, help) with a bubble that says what each is
  and where it is set; arrows and Escape work, ⚙ opens it again. `editor/tour.js`. Tests in `test_editor_tour.py`.
- A test keeps every text the code asks for (`this._t`, `translate`) in both languages.
- The battery of the tablet itself at the foot of its status bar: one thin line with the level and a thin bar;
  the icon and the bar are green with a lightning bolt while plugged in, orange at 20% and less, red at 10% and
  less, the number keeps the colour of the text. The demo has one (`?status=1`). Its sensor (of the
  Home Assistant app on the tablet) is chosen in the editor, **Settings → Devices** → *Battery*
  (`home_dashboard/variants/battery_device`); whether it charges comes from the app's battery state sensor of the
  same device. Docs: guide, editor (PL+EN). Tests in `test_status_panel.py`, `test_editor_variants.py`,
  `test_variants.py`.
- Fixed: after a restart of Home Assistant the status bar of a tablet could cover the page, its right part cut off
  or under the bar. The app loads the page in the background (screen dark or another size) and iOS does not always
  tell the media query of a tablet that changed, so the bar stayed drawn for a tablet on its side while the page,
  laid out by CSS, kept no room for it. The bar checks the shape of the screen again at every resize, turn and
  return of the page. The menu of Home Assistant, which Home Assistant can bring back when it builds its state
  afresh, is hidden again too. FAQ row (PL+EN). Tests in `test_status_panel.py`, `test_landscape_home.py`.
- The page keeps its room for the status bar however it was lost: the bar measures the room the view of the page
  keeps (after every drawing, resize, turn and return of the screen, and every 5 s while states change) and puts it
  right on the view. The first time in a load it tells the log of Home Assistant what it saw
  (`home_dashboard/layout/report`, a warning of `custom_components.home_dashboard.websocket`), for the cause to be
  found. Tests in `test_status_panel.py`, `test_integration.py`.
- The default `media.group_patterns` is `^(.+)_homepod(_[a-z]+)?$` instead of one with a Polish word of one home
  (`_muzyka`): a HomePod and its other players with one word after it (`kitchen_homepod_music`) are one speaker.
  Docs: configuration, README (PL+EN). Test in `tests/browser/test_model.py`.
- The examples of `home_dashboard.show_camera` name a made-up `camera.garden` instead of a camera of a real home.
- Fixed: a camera window from an automation (`home_dashboard.show_camera`) counted its `close_after` from the
  moment the tablet connected, while the screen of a tablet woken by a notification was still dark, so a 15 s window
  was seen for a few seconds. The time now runs only while the page is visible, from the full time again when the
  screen goes dark before it ran out. Docs: guide (PL+EN), the field's description. Tests in
  `tests/browser/test_camera_window.py`.

## 1.2.0 (2026-11-18)

Variants of a page that a tablet, a person or the household chooses, sections side by side as a second layout, a
home without cameras, speakers or intercom that works the same, and today's events back after a restart.

- Devices keep an id of their own (in their browser): signing in to Home Assistant again keeps a phone or tablet the
  same device, with its name and variants. A Browser Mod name is its name until one is given; a device known by its
  sign-in moves to its id by itself. Without storage (private browsing) the sign-in still tells it apart.
- Fixed: after a restart of Home Assistant today's events of the status bar stayed empty until the page was
  reloaded (a calendar not ready yet was kept as empty for 5 minutes). A list that could not be read whole is not
  kept, is tried again after 15 s, and is read again when the connection comes back. FAQ row (PL+EN). Tests in
  `test_calendar.py`.
- Sections side by side: the tabs scroll only as
  far as the current one needs (Home stays when it fits), stop at the start of a tab instead of cutting one, and
  their edges fade where more tabs are. Tests in `test_sections_layout.py`.
- Variants shared with the household: *Share with the household* on a card lets anyone choose it for themselves
  (three dots → Variant of this page → Choose for me, on all their devices; `home_dashboard/variants/choose`).
  The magnifier in the editor opens *Where the variants run*: every page, its variants, the devices and people that
  see them, who chose it themselves. While a variant is edited, changes outside its page (a block, the menu, another
  room) go to the draft instead of being dropped. People who are not administrators get *Load the app afresh* in
  the side menu. Docs: editor, guide (PL+EN).
- Variants: the editor asks in its own dialogs (new name, rename, delete, make published) instead of the browser's,
  and the phone confirms *Publish for everyone* inside its window. New setting **Devices** in the editor: every
  phone and tablet that opened the dashboard, with a name to type, its kind, person, last opening, the variant of
  each page it shows, and *Forget* (`home_dashboard/variants/forget_device`). Tests in `test_editor_variants.py`,
  `test_page_variants.py`, `test_variants.py`.
- A home without some parts: the editor shows *Cameras*, *Media page*, *Intercom* and *Music page* greyed, with what
  to install (a camera, a speaker, the Intercom integration or a script, Music Assistant), and does not open them.
  The intercom buttons (Home, a room, a camera's talk) show only when the service or script the dashboard names
  exists, so removing the Intercom integration leaves no button that fails. Checked without any camera, speaker,
  Intercom or Music Assistant: every page, window and setting opens. Docs: editor (PL+EN). Tests:
  `tests/browser/test_missing_parts.py`.
- **Variants of a page**: other versions of Home or of a room, each with its own layout and background, to try out
  without touching the published page. A variant holds only its page's part of the configuration (the rest always
  comes from the published dashboard) and is kept by the editor on the server. In the editor: the node Variants of
  Home and of every room, with cards to preview, edit (changes go into the variant, the draft waits), copy, rename,
  delete, *Who sees it* (a device, as the hall tablet, or a person; a device wins over its person) and *Make it the
  published page* (the replaced version goes to the history and its page stays as a variant). On a phone or tablet
  an administrator picks under the three dots → Variant of this page: show on this device, just look (a banner with
  Back) or publish for everyone. Changes made on a page that shows a variant go into it. Server: `variants.py`
  (`home_dashboard/variants/*`); devices keep an id of their own and say what they are.
  Docs: editor (Page variants), guide, FAQ row (PL+EN). Tests: `tests/test_variants.py`,
  `tests/browser/test_page_variants.py`, `tests/browser/test_editor_variants.py`, shared slices in
  `tests/fixtures/variant_slices.json`. Needs a restart of Home Assistant (new server commands).
- **Sections side by side** (`page_layout`), a second layout of Home and the room pages: the headings over the
  background, tabs of Home and the rooms in place of the greeting (and of a room's name), and the sections in as many columns as fit (two on a tablet on its side, also with the status bar open
  at 85 % zoom; one on a phone), each going in order to the shortest column. A section longer than four rows
  (`page_layout.rows`) scrolls inside, fades at its foot and says how many tiles it has; the cameras come two at a
  time and more are swiped to; a heading opens its page (Cameras, a room, Scenes); over a background a tile that is
  on is white. Chosen for every page, for Home alone or for one room: Dashboard settings → Layout of the pages, the
  room editor → Layout of this page, and the editor on a computer (Home page and tablet → Layout of the pages, the
  room's field Layout of the page). The classic layout stays the default. Docs: guide, configuration, editor (PL+EN).
  Tests: `tests/browser/test_sections_layout.py`.
- Editor: ⚙ in the top bar opens a pop-up under it instead of the dialog of the preview's devices: the theme
  (As HA / Light / Dark, the half sun on the bar stays), the language of the editor (As in HA / Polski / English,
  kept in the browser) and a button to the preview devices. A choice works at once and the pop-up stays open; Esc, a
  click beside it, ⚙ again or ☰ close it. Tests: `tests/browser/test_editor_gear.py`.
- Household activity in a window of the dashboard: the picker of the range was see-through and the timeline showed
  through it (cards and controls of glass). It is now a plain window of the look, white in the light one and dark in
  the dark one, whatever glass the window has, with its own writing and a readable Choose button.
- Household activity: windows read by their names instead of the kinds the dashboard tells ("Side menu",
  "Dashboard settings", "Household activity" instead of menu, settings, household; a camera window reads its camera
  with "Camera" in place of "Window"), each kind with its own icon. Entries kept before read the same way.
- Household activity on a phone: the picker of the range stuck out of the left edge of the screen and the window cut
  off its month; it starts under the range, the ready ranges are chips in a few rows, and all of it fits the screen.
- Household activity: a range of its own is picked on a month of the dashboard instead of the browser's small
  calendar: the first tap starts it, the second ends it (the end before the start swaps them), the band between
  them is lit, days after today cannot be chosen; the hours of both ends below (23:59 = to the end of the day).

## 1.1.0 (2026-11-17)

Picking a moment of a recording to the second, the household's activity for the owner, the dashboard's own camera
window for automations and a doorbell, and a lighter dashboard in Safari.

- Gallery: the pictures of a recording that plays (the clip bar, held still, the line zoomed to the clip, on a tablet),
  and the editor on a computer (all 18 pictures) is made by `dev/gallery.py` too, so `make screenshots` no longer drops
  it.
- **Clip bar** in the camera window: while a recording plays, a bar above the line of the day runs from its start to
  its end, so a second inside it can be picked (on the line a clip of 50 s is about 5 px). Tap or drag shows a bubble
  (`0:36 / 0:50 · 18:02:46`) and the picture follows the finger, letting go plays from there; held still for 0.4 s
  the bar shows 30 s with a tick per second; a mouse shows the moment under it; arrow keys ±1 s, with Shift ±10 s.
  It lives in the line's own panel, so the buttons of a camera on a battery (night vision, light, siren, talk,
  recordings, the line button) do not move. Tests: `tests/browser/test_clip_bar.py`.
- **Line zoomed to the clip**, the other way of picking a moment: a tap on a recording on the line of the day plays it
  and zooms the line to it (5 s on either side; the orange badge under the time zooms and brings the day back). The
  scale stays while zoomed and the recordings around are on the line: moving onto one plays it, a gap plays nothing,
  a recording that ends stops there (only the next part of the same continuous recording plays on). Held still, the
  zoomed line shows 30 s with a tick per second and the mark follows the finger. Chosen for all cameras with `cameras.clip_picker` (`bar`, the
  default, or `zoom`) and for one camera with `cameras.clip_picker_with`, both in Dashboard settings and the YAML
  editor's form. Tests: `tests/browser/test_clip_zoom.py`.
- Notifications read their Markdown as Home Assistant does: headings, pictures (from Home Assistant or https only;
  the QR code of a HomeKit pairing on a white card), lists, italic and code, besides bold text and links. A message
  still cannot bring its own HTML or a script link.
- Safari reloaded a dashboard open for hours "because it used significant memory": the camera tiles took a picture
  in the camera's own size every 30 s (Frigate's 1920 x 1080, about 8 MB each in the browser). Tiles now ask the
  camera proxy for their size (width and height; 1280 x 720 big, 640 x 360 small, 960 x 540 in the list of all cameras,
  320 x 180 in the strip of a camera window). Pictures of image entities cannot be scaled and stay as they are.
  Measured: the JavaScript of the dashboard keeps about 8 MB over 1200 changes of states and 30 windows.
- **Household activity**, a panel in the menu of Home Assistant whose data only the owner sees, laid out as the
  History of Home Assistant (people with their colours and kinds as filters on the left, a range of time with ready
  ranges on top, one timeline day by day; changes read as Home Assistant says them, a button "pressed"; filters by kind
  of device and by room, a search; live, as the Logbook, for a range that reaches now, through the new command
  `home_dashboard/activity/subscribe`; the same view in a window of the dashboard from its side menu, only for the
  person who sees it): for a range,
  each person's pages and windows of the dashboard (now written down for 30 days, with the device; the editor's
  preview writes nothing), the devices they switched (from the history of Home Assistant, a change carries its
  person) and the phones and computers they use. New commands `home_dashboard/activity/seen` and
  `home_dashboard/activity/get`; `recorder` is an after-dependency. Two options of the integration, both on at
  first: *Show Household activity in the sidebar* (hidden, it still opens at `/home-dashboard-activity`) and *Write
  down the household activity* (off: the open dashboards hear it at once and tell nothing more; the integration
  keeps nothing either). Saving the options keeps options that are not in the window.
- Docs: two summary pages, **What changed most** (the most important work on the dashboard: speed, one look, the
  tablet, editing, docs, tests) and **One standard** (what the editor changed to follow the common standard of the
  house), in English and Polish.
- One way to run the house's apps (standards/gpu-studio.md §2, §8a): `make help` has three groups, "1. Start"
  (help, demo, demo-clean, docs, docs-serve, doctor; Docker Desktop only), "2. Home Assistant" (deploy) and
  "3. Development". The documentation is built in Docker (`docs`, `docs-build`; `docs-serve` on port 9124), so
  `.venv-docs` is gone. The developer's Python comes from uv (`PYTHON_VERSION ?= 3.14`, `uv venv`), no brew.
  `make test` never builds images (`-m "not docker"`), `make test-docker` does; `make test-all` = lint + test +
  test-browser + test-docker; `make format` (ruff check --fix + ruff format); `make lint` also checks the format;
  `make doctor` checks Docker, Chrome, uv and the Home Assistant share and installs nothing. **`make ui` is gone**:
  use `make demo`.
  The Python code is formatted with `ruff format` once (no change of behaviour).
- `make demo` needs only Docker Desktop: it builds an image of the tested Home Assistant (2026.11.0) with this
  integration, the demo devices and a ready dashboard (user `dev`/`dev`, made while the image is built, so a start
  takes seconds) and runs it on 127.0.0.1:8124; Ctrl+C removes the container, `make demo-clean` the image. The
  former demo from `.venv-dev` is `make demo-local`. Both READMEs start with "Try it on a Mac". The demo also
  confirms the HTTP settings of Home Assistant 2026.11, which otherwise asked on every page and went back to port
  8123 after five minutes. A test (marked `docker`, skipped without Docker) builds the image, logs in and checks
  that no container is left.
- An automation can open the dashboard's own camera window: the service `home_dashboard.show_camera` (a camera, the
  picture of the event, a title, close after, live at once, first before other cameras (the doorbell), devices by their Browser Mod id, people). The window
  closes by itself unless somebody touches it or starts the live view, never takes away another camera or the
  settings, and the event `home_dashboard_camera_closed` says when and why it is gone. A notification can open it
  too: `?camera=camera.x&live=1` in the address of the dashboard. It replaces popups of Browser Mod that looked
  like the old dashboard. A camera shown through another one (`cameras.controls`, the eufy camera of a room behind
  its Frigate camera) opens the window of that one.
- The window of a switch (a plug, a switch of a lamp, a helper, an automation) has the round power button of a light's
  window under its big switch: one tap turns it off, nothing to slide down. A test opens the windows of lights and
  switches on a phone, a small phone, a phone on its side and a tablet both ways, and checks that the button is seen
  without scrolling.
- Esc on a computer closes the open window, as its ✕ (or arrow back) does; a small window inside it goes first (a
  question, a menu, a list slid in, a picture shown big, the YAML of the settings), one press one thing. A window of
  Home Assistant over the dashboard is left to close itself. In the editor Esc closes its dialogs, the list of tiles
  to add and the windows of pictures the same way.
- Editor: the menu of Home Assistant is hidden when the editor opens, as on the dashboard; the menu button at the
  top left shows and hides it, and it comes back on any other page (kiosk mode, never the user's saved choice).
- Docs site: the **Gallery** badge at the top of the start page leads to the gallery (it led to a missing file):
  links written as HTML in the README now get the address of their page too.
- Editor, as the other apps of the house (one standard for their look, docs and tests):
  - the icon of the editor stands next to its name in the top bar;
  - the tree, the preview and the settings of what is chosen each have a **?** that opens a small window saying
    what the part does, with a link to its chapter of the guide (following what is chosen: a room, a tile, the
    look…); only the **?** of the top bar opens the guide at once;
  - the chosen part is in the address (`#/layout/0/sections/1`): a link or a reload opens the editor on it, once the
    dashboard has loaded;
  - a browser that keeps nothing (private window, blocked site data) no longer stops the editor from opening;
  - the publish, history and editor settings windows have their own **?** too;
  - it never hangs on a slow or silent Home Assistant: every question has a time limit (60 s) and ends in a clear
    message; the draft is saved one save at a time (changes made meanwhile go with the next one), and a save that
    fails says so instead of leaving "Saving…" for ever;
  - a test goes through every part of a big dashboard (30 rooms, 1200 tiles) and allows no task of the page over
    500 ms.
- Docs: the chapters of the editor's guide have the same anchors in English and Polish, names of buttons in the
  text are checked against the texts of the screen, `make demo`, `make docs` (build and open), `make docs-build`
  and `make docs-serve` are the common names (`make ui` still works).
- Tests never connect anywhere but 127.0.0.1.

## 1.0.4 (2026-11-16)

- A tab with the dashboard or the editor stays light when it is open all day (the browser warned that it uses a
  lot of energy or memory):
  - The page, its bar and its windows take a new state of Home Assistant at most twice a second (the first at once,
    the last always), not on every one of the many changes a second of power meters; a hidden tab every 10 s, and
    the newest as soon as it is shown again. On a home of 4600 entities the main thread went from about 30 % to 8 %.
  - The cameras find their battery, live view and stream sensors in an index of the entities of each device, made
    once per registry, instead of going through every entity of the house for each camera.
  - The editor is drawn at once for a new entity, device, area or language, and for states alone at most every 5 s.
  - A frame of the preview loaded again (colour, person, phone or tablet) no longer stays in the editor's memory
    with its listeners, which also ran on every change of the draft.
  - The outline of what is chosen looks for its elements every second instead of every 0.3 s, and not in a hidden
    tab.
  - A hidden tab streams no camera: the live view stops, and the big camera of the wall plays again when the tab is
    shown. A closed window closes its sound.

## 1.0.3 (2026-11-16)

- Windows: what is on or chosen (a source, a sound mode, OK of a remote, a switch, the fill of a slider) is milky
  instead of green: the colour of the writing of the window, 90 % opaque, with dark writing on it (white in a light
  window), so it fits a yellow, blue or purple background alike. **Colour of what is on** in *Look → Windows*
  (`appearance.sheets.accent`) sets a colour of its own. Green stays where it means something: a disarmed alarm,
  the colour of a kind of device.
- Sliders (volume of a TV or a soundbar and of the player, a number of a block, the look, the background maker, the
  sound of a recording) are a thick rounded bar filled up to a round white knob in the colour of the buttons that
  are on, instead of the thin line of the browser.
- Status bar: an item of **Power** can have a `switch` (**Only while on** in the editor) and then shows only while
  that switch is on, e.g. the plug of a tablet's charger, to see when it charges.
- The menu of the dashboard slides in and out, and in the Home Assistant app it follows the finger drawn from the
  left edge on Home: let go past a third of it, or with a flick, and it opens, else it goes back. It used to appear
  at once, only when the finger was lifted; the app's own swipe of the same finger is ignored.
- The menu of Home Assistant is hidden on the dashboard by the kiosk mode of Home Assistant, which is never saved, and
  comes back on any other page of Home Assistant (Settings, say). Changing `dockedSidebar` got saved by Home Assistant
  at every load as the user's own choice, so the menu stayed hidden everywhere; an older Home Assistant without the
  kiosk mode still gets `dockedSidebar`, given back when leaving.
- At home: the lists of lights, devices, doors and windows on or open keep the same margin around their rows as the
  list of areas, so the rows no longer touch the edges of the window.
- Status bar: the lines of power no longer vanish now and then. A failed read of their history (a tablet waking up,
  the connection coming back) emptied them until the next read, 5 minutes on; now they stay and the read is tried
  again after 30 seconds, and a sensor without numbers in a read keeps its line. Back on the page the power is read
  anew (its refresh did not start again).

## 1.0.2 (2026-11-15)

- Background maker: the photo can be made smaller (20–100 %), put in a corner, at a side or in the middle and moved
  from there, turned by 90°, mirrored sideways and upside down, and faded out from up to three of its edges (it faded
  only downwards, always covering the whole screen). A recipe from before keeps its photo where it was.
- Background maker: **Tinted by the background**, the new default way a photo mixes: it wears the colours of the
  gradient under it, deep in its darks and light in its lights, instead of lying grey over it.
- Editor: **?** in the top bar opens the guide to the editor on the documentation site in a new tab, in Polish
  or English as Home Assistant is. The integration's documentation link points at the site too.
- Dashboard settings: **Reload the app** is the first thing of the window, not the last.
- At home: windows have a badge of their own (`status_panel.windows`), and a tap on the doors or the windows lists the
  open ones by name with when they opened, as the lights do, instead of opening the Status screen. Several read as
  "2 open windows". All the badges are in the same weight (an open door was bold).
- At home: flags (`status_panel.flags`), a badge while a helper is on, e.g. mail in the mailbox; a tap opens it.
- An item of the Status screen of one entity in a state (`entity` + `state`) with `notify` is a card on Home too; it
  never was (a UPS on battery showed only on the Status screen).
- The list of lights or devices on (a tap on the count in At home) has no **Don't count** button any more: what is
  not counted is configuration, set in the editor on a computer (**Status bar → Not counted in At home**). The list
  still shows those apart and says where they are set.
- A block's `quick` button (e.g. **Turn off** on a console) follows its `active` entity when one is set, so a
  console whose cloud state is stuck on `on` shows no button once a pinging sensor says it is off.
- A time left below zero in `format: hours` reads as **over by 10 min** (PL: **przekroczono o 10 min**) instead of `–`.

## 1.0.1 (2026-11-15)

- Editor: **+** beside **Blocks** adds a block of any kind (Block, Status, Departures, App, News, Machines, Page),
  as **Add** does on the tablet.
- Editor: under a tile of a room, **Window of the device** sets a card of Home Assistant for its entity
  (`entities.overrides.<id>.card`) and **Make a block of this tile** turns the tile into a block in its place.
- Docs: [Windows for your own devices](docs/own-devices.md) says for each way where it is done, in the editor on a
  computer and on the tablet, with the steps in the editor.
- A switch that powers a lamp is a light: yellow while on, counted in the Lights chip and the status bar and shown
  by the Lights filter. A switch whose icon is a lamp is one by itself; `entities.overrides.<id>.light` (also a
  field of the editor, and **It is a light** under the pencil of a switch's window on the device) says it either way.
- Documentation site on GitHub Pages (https://witold-gren.github.io/home-assistant-dashboard/), English and Polish,
  made from `docs/`, the README and this changelog with MkDocs Material (`make docs-site` to preview it,
  `make docs-build` to build it as GitHub does).
- The checks of GitHub pass again: the integration names `lovelace` among its `after_dependencies` (hassfest), and
  ruff is clean.

## 1.0.0 (2026-11-14)

The dashboard and its editor on a computer, with a guide from zero to a finished dashboard in English and Polish
([docs/editor.md](docs/editor.md), [docs/editor.pl.md](docs/editor.pl.md)) and its pictures (`make screenshots`,
or `dev/screenshots.py editor` for those of the editor, over the made-up home in `dev/demo-editor.html`).

- Editor: a block that opens a page (Media, Music, Map, Energy) says where that page's groups are edited, with a button
  to its settings; **Home page and tablet** has an icon Home Assistant knows (`mdi:tablet-dashboard`).
- Blocks: a stepper takes its own steps for a tap and a held button (`steps: [1, 5]`); held, it goes by round numbers.
- Blocks: a row can guard a limit with a parent's code (`pin`): loosening it (a higher number, none, its switch off)
  opens the PIN keypad and goes back to the block once Home Assistant set it; making it stricter needs no code.
- Blocks: a number in a row can be buttons − and + with its value between them (`control: stepper`, also in the form
  of a row), easy to set on a phone, sent once the taps stop; a slider shows its value while it moves. Whole hours read
  "10 h".
- Calendar: the month fills the window of a tablet, own round ticks and a switch for the home's calendars (iOS drew the
  boxes black), the gear in line with the content, a tighter list.

- Blocks: `quick`, a button on the tile while the device is on (a console's Turn off, asked first in the window);
  actions pass `data` to their service (a script's fields); numbers and rows show an `attribute` (the game played);
  `format: hours` reads the sensor's unit (history_stats counts hours).
- Calendars: today's events under the weather of the status bar (`status_panel.calendars`; all-day ones softly in
  their colour, the others with their hour, "now" while they last, gone once over, at most `calendar_limit`); a tap
  opens a month on a tablet with the events of the day chosen beside it. On a phone the list of areas has My calendars:
  today and the next 14 days with places and descriptions; under its gear a person adds their own calendars and can
  leave the home's out (their own settings). Set in the editor under Status bar → Calendar.
- Status: an entry of a device can show for one word of its state (`state_words`, e.g. `OB` of a UPS on its battery,
  whatever flags follow), and its values can tell seconds as hours and minutes (`format: hours`); blocks, their rows and
  numbers have the same format "Time (h min)". Both in the forms.
- Editor settings under a gear in the top bar: the phones and tablets of the preview can be hidden, renamed, resized
  and set back, and devices of any make added with their size (kept in the browser). The switches say Phone and
  Tablet; the models are listed smallest screen first.
- Editor: bringing what is chosen into sight scrolls only its window or page, no longer the whole frame (the screen
  slid up over black).
- Editor: what is chosen in the tree has a red dashed frame in the preview (a tile, a section, a room, the window of a
  block or a part of it), so it is clear what the form edits.
- Editor: a field of a background shows a sample of its colour or a magnifier for its picture, and a click opens a
  window to choose a picture sent to Home Assistant or in `/config/www` (new command `home_dashboard/editor/pictures`,
  after a restart), send one from the computer, or set a colour or a gradient on a palette. Any text field holding a
  picture's address has a magnifier.
- Editor: a list (a room's tiles on Home, a section, the favourites, the parts of a block) shows what it holds in
  its Properties tab, a click opens a tile, arrows move it, the bin removes it, instead of a note to use YAML.
- Editor: the window of a block in the preview closes when another room is chosen; it closed by a step back in the
  frame's history, which undid the move to that room.
- The battery of a camera in its window shows again on an iPad and a phone on its side: it lay under the settings
  button of the header (and the status bar of iPadOS); now it stands in the picture's top right corner, under it.
- A dashboard editor for a computer, as a panel of Home Assistant for administrators (being built in stages):
  the tree of the dashboard with search and folding, the YAML of what is chosen, a draft kept on the server that
  changes nothing on the devices until it is published, publishing with a history of 30 versions and a warning
  when the dashboard was changed elsewhere meanwhile; a preview of the iPhone and the iPad that shows the draft at
  once, as another person, light or dark, chooses in the tree what a touch chose and never calls a service; the
  side columns take the width they are dragged to. The preview takes the zoom of the Home Assistant app on each
  device (an iPad at 85 % shows the page of 1388 × 965) and the size of the tablet.
- The editor's forms: every key of a tile (entity, block and machine, name, icon, size, calm, a touch switches, only
  while it works, only switching on with its PIN, a service of a touch, a run button and names of options for a
  list), of a section and of a room (name, id, areas); keys a form does not know are kept. Rooms, sections and tiles
  are added, duplicated, moved up and down, removed (asking when not empty) and dragged in the tree; undo and redo
  with the buttons and ⌘Z / ⇧⌘Z, letters typed in one field being one step.
- The editor's picker of tiles: every entity of the home with its area and the battery of its device, filtered by
  the room's areas, every area or none, by kind, hiding those already shown or showing technical ones; where the
  dashboard shows an entity already; a warning when a blind, thermostat or lock may be one device from two
  integrations (as Netatmo and HomeKit); suggestions (a run button for a list, calm for an automation); what is
  ticked shows in the preview at once and is added in the order it was ticked, as one step.
- The editor's blocks: a block of several entities (among the blocks or as a tile of a room) opens in the tree into
  its numbers, buttons and groups with their rows, each with a form (a block's tile and window, a number's digits and
  time format, a button's service and question, a group's layout, a row's unit, digits and names of states); the
  options of a list are ordered, named and hidden; the entities of the block's devices it does not show yet are
  added with one click; rows move between groups of their block. Choosing a block opens its window in the preview,
  following every change, and says whether it fits on the tablet without scrolling.
- The editor publishes: *Publish* says what changes in plain words and in YAML, which entities are missing, and takes
  a note; a version goes to one person to check (their dashboard shows it with a banner and a way back to the usual
  one, and the app does not save over it) or to everyone, the replaced version going to a history of 30 with who and
  why; a version of the history is compared with the one now and taken back as a draft. Docs: the guide's chapter
  12, The editor on a computer.
- A quick start: the editor makes rooms from the areas of Home Assistant (one per area, its devices in sections by
  kind, a few on Home, hidden and technical entities left out, one tile of a device seen from two integrations),
  for every area without a room or those ticked, shown in the preview before they are added as one step. Without a
  dashboard of the strategy yet, the editor creates one and opens this at once.
- Fixed: Safari could show "null is not an object (evaluating 'window.matchMedia(TABLET_MEDIA_QUERY).matches')" from a
  page whose frame was gone (a preview frame of the editor replaced); media queries now go through one helper that
  matches nothing there.
- Fields of an icon pick from the icons of Home Assistant: typing searches by name and keyword ("dashboard",
  "home") and lists them with pictures; arrows, Enter or a click take one, a name typed by hand still goes. In every
  icon field of the editor (blocks, tiles, settings, own icons of devices) and in the block form of the tablet.
- Fixed: a menu entry with a link of its own and a **Block** naming no block was left out; it shows as its link now,
  and the editor offers the blocks there are in that field.
- A background maker, on the tablet (three dots → Background of this screen → Make a background) and in the editor
  (Backgrounds of pages → Make a background): 16 ready backgrounds, 16 patterns drawn by code, 48 gradients in six
  groups, a photo with how much is seen, greyed, blur and fading, made upright and wide at once and sent to Home
  Assistant for the light look, the dark one or both; or downloaded as a file.
- Fixed: in the editor on a computer an entry of a Status screen could not become a device or a below-threshold
  entry (its empty start was dropped); a new below-threshold entry starts at 20.
- Every kind of block has a form in the editor, with the same fields as the block form of the tablet (one schema for
  both): Status screens with their sections and entries of every kind, departures, news, a host's columns, the
  school year, add-ons, pages, and now a TV and a scale, also on the tablet; `hidden_when` in every block form. A
  block renamed (in the editor or on the tablet) is renamed in its tiles, menu entries, entries of the status bar and
  rules of access and visibility. Every option of these blocks has a field now: a host's bars with unit, maximum and
  thresholds, the type of a detail, machines and power as fields; the sensors of the school year one by one with the
  default shown; the colours of tram lines; an entry of a Status screen as an alarm. Words for states are pairs, own
  ways to turn on and off are a service and an entity, patterns of speakers are lines and backgrounds have a field per
  page and look; YAML stays only for cards and the library of themes.
- Every setting of the dashboard has a form in the editor: also the order and hiding of rooms, entities added, left
  out and with their own name, icon, area or card, light groups, the weather, security, the return of a tablet left
  alone, the layout of the scenes, and the Music, Media and Map pages.
- **People access** in the editor: a person, then what they do not see in the groups of the tablet's window, with an
  eye by each; the rules of `visibility` (an entity, `block:` or `shortcut:` and the people of `only` and `except`).
- **Cameras**, **Intercom** and **Energy** have forms in the editor: the cameras shown and their order, the rules of
  privacy and guest mode, the settings of single cameras (live camera, controls, talking, round buttons, turning,
  entities under the gear); the intercom's script, rooms and fields; the meter's phases, the voltage range and energy
  storage.
- The left menu (`menu`) and the bar of pages (`appearance.nav`, with rooms as places) are nodes of the editor's tree
  with forms; choosing the menu opens it in the preview, and a block of any kind opens its window there.
- **Look and themes** in the editor: a part for each group of `appearance`, drawn from the same description of fields
  the tablet's Look window checks against (types, ranges, defaults), colours by kind of tile, own icons of devices,
  the theme, the library of themes and the page backgrounds; long forms start folded.
- The settings of the editor get forms: the **Status bar** writes its look (`appearance.status`) and what it shows
  (`status_panel`, with `ignore`) in one form; an order of parts, colours with a picker, ranges; a part emptied leaves
  the configuration.
- **At home** in the status bar of a tablet says what it counts: a tap on the count of lights or devices lists what is
  on, with its room and the time it went on, each opening its own window. An administrator leaves one out of the
  count there ("Don't count", e.g. a lamp that follows its own schedule) and counts it again; it is saved as
  `status_panel.ignore`.
- The window of a camera on a battery shows the percentage of its battery in the top right corner of the picture,
  red up to 20 %; a picture takes the battery of its live camera, and the dot of an open stream sits in the badge. The
  pages and all cameras leave it out, so many badges do not crowd the pictures.
- The preview of the editor has every size of an iPhone and an iPad screen, each once with the models of that size
  (12 phones from the iPhone SE 1 to the 17 Pro Max, 9 tablets from the iPad 1–6 to the iPad Pro 13″ M4+), the phone
  chosen as the tablet was.
- The groups of the editor's tree (Home, Rooms, Blocks, Settings) fold by an arrow, and a button of each folds or
  unfolds everything inside it; a node chosen elsewhere (a touch in the preview) opens its group.
- The editor has a light look besides the dark one: as Home Assistant by default, or chosen with a button in the top
  bar (Auto, Light, Dark), remembered by the browser.
- An option of the integration, *Show the editor in the sidebar*, takes the editor out of the sidebar at once; it
  still opens at `/home-dashboard-editor`. The options are called Settings now.
- A rule of privacy of the cameras (`cameras.private`) can be for some people only: `users` hides the cameras only
  from them, `except` from everyone but them (the parents keep seeing them while the children's devices do not).

## 0.7.0 (2026-11-13)

- Every window was opened on a real home, on a phone and a tablet, in Chrome and in WebKit (Safari), with every
  service call stopped; what it found is fixed here. A slider of a device that says nothing (offline) shows a dash
  and cannot be moved, in place of "unknown" and a knob in the middle.
- Alarms of water, smoke and gas: a Status item `auto: alarm` (narrowed by `classes`) finds every such sensor of the
  home; on Home it is a red card with a beating icon, first of all, that cannot be closed or muted while it lasts,
  and red on the Status screen too. The block form offers it. "More" on a warning opens the dashboard's own window.
- The effects of a light are named as Home Assistant translates them, and the "off" effect of a Hue lamp reads
  "None". The times a leak, smoke or other alarm sensor went off are red in its history even while it is dry now.
- Zoom comes back to the rest of Home Assistant after the dashboard: when Home Assistant built a new view of the
  dashboard before it took the old one away, the second lock of zoom kept the locked viewport as the one to give
  back, so every page (and iOS zooming into a text field) stayed without zoom until the app was reloaded.
- A tile of a list (`select`, `input_select`) takes `confirm: true`: a touch only marks an option, and a button
  under the list runs it, so a drink of a coffee machine is not made by brushing the screen. `labels` give the
  options names of your own, on the tile and in the window.
- A row of a list in a block takes `hide`: options nobody uses stay out of the window, unless the device is set to
  one of them.
- A machine tile (`{shortcut: Host, column: …}`) works without `entity` too and shows the machine's subtitle; a lock
  in `status_panel.doors` counts as open while it is not locked.
- Docs: a full reference of the configuration (`docs/configuration.md`, Polish too) with every key, every editing
  window and which window each kind of entity opens.
- The sheet (`sheet.js`, 8500 lines) is split into modules by kind of window (entities, camera, recordings,
  settings, look, blocks, media), shared constants and four files of styles in the order of the cascade; nothing
  changes in what it does.
- The demo home has a leak sensor, a coffee machine with a list of drinks and a plug that measures it, and a home
  server; the gallery shows their windows. `dev/gallery.py` writes the gallery and `make screenshots` runs it.

## 0.6.0 (2026-11-12)

- Sensors and lists open the dashboard's own windows instead of Home Assistant's: something on or off (a leak, smoke,
  a door) shows its state, when it changed, its device's battery and a strip of the day or week with each time it
  was on; a list (a coffee machine's drink) shows every option as a button, its raw "none" said in words; a number
  shows its value and its line. The cog still opens Home Assistant's window.
- A switch whose device measures its power (a smart plug) shows under the switch the power now, the energy in total
  and a line of the power over 6 hours, a day or a week.
- A machine of the window of servers shows its smart plug (`power`): what it draws now, voltage, current, energy
  today and in total, whether the plug is on (never switched from here) and a chart of the power. A room tile
  `{shortcut: Host, column: <title>}` opens that one machine: two columns on a tablet, the power first on a phone.
- An automation opens the dashboard's own window: a big switch to turn it on or off and when it last ran; the cog
  opens Home Assistant's window with its settings.
- The window of a status icon for blinds lists them again (a blind's row had the look of the window's backdrop and
  was hidden).
- The humidity icon of a room is named in full ("Humidity", not "humidity %"): a key of the translations was written
  twice; a test now keeps every key single.

## 0.5.0 (2026-11-12)

- A tile `{shortcut: <name>}` without an entity passes the YAML editor and has a key of its own, as does a scale
  tile; a shortcut taken from someone stays away in a room too. An Apple TV asleep wakes for an app. Closing the
  intercom while it records drops the message at once. A tablet keeps at least two columns of tiles for blocks two
  wide; an iPad with a trackpad keeps its camera window as without one.
- The gallery has the scale, the washer, the dryer and a power station in a room and in their windows, the energy
  store on the Energy page and an Apple TV with its remote.
- The chart of the Energy page reads its values: two levels with their kWh behind the bars, and a finger or the mouse
  on a bar shows its hour (or day) with what was used then and in the period before, the bar lit up.
- An energy store that is not connected says so instead of zeros and an empty bar of the wrong colour.
- A recorded intercom message keeps its end: after Done the recording goes on for 0.7 s, while the window says it is
  sending, so the audio buffers and the last syllable said at the tap reach the file (1.2 s of voice gave a file of
  1.0 s before). Closing the window meanwhile sends nothing.
- An Apple TV in the window of a TV (`kind: tv`): its remote by itself through the remote entity of its device
  (arrows, OK, back, home, main menu, play or pause, 10 seconds back and forward), what plays now with its picture and
  a button to play or pause, apps as shortcuts and the whole list of them; without `on` and `off` it wakes and sleeps
  itself. The volume slider shows only for a player that reports its volume.
- The dot of an open stream is quieter: smaller, without the glow, blinking slower.
- A camera window in a wide window of a computer (a Mac's browser) takes the whole screen as on a tablet on its side,
  with every button on the picture and the other cameras and the line of time brought out by buttons. A band is kept
  for the header above the picture and one below it, and the age of the picture stands in its corner. A tablet and a
  phone are as they were.
- An energy store on the Energy page (`energy.storage`): a card per power station on a battery (e.g. EcoFlow) with its
  charge as a bar, what it does, the power in and out and how long it lasts; a tap opens the window of its block.
- A tap on a washer or a dryer in Now of the status bar opens the window of its block, found by its entities among
  the blocks of the shortcuts and the rooms (or named with `block` in `status_panel.now`).
- The room status circles can be open inside, keeping the colour of their kind on the ring and the icon: Look →
  Colours → Filled room status circles (`appearance.badges.fill`). The Apple Home theme that comes with the dashboard
  uses it instead of white circles.
- On a tablet a block of two or more groups without a card of its own (a washer, a dryer) opens in a wider window:
  its numbers beside its buttons and its groups in columns, with lower switches and choices four in a row, so it fits
  without scrolling. A phone keeps one column that scrolls.
- `order` on a row of a block sets the order of its list or choices, for a device that sends them in no useful order.
- A scale (`kind: scale`) with each person's body from BodyMiScale: its tile in a room says who weighed last and when,
  with their weight, BMI, body fat and muscle; its window lets one choose a person and shows the weight against the
  ideal one, BMI on its bands, what the body is made of and the weight over 30 days, 90 days or a year. Two columns
  on a tablet, one on a phone.
- A room's tile can name a shortcut (`{shortcut: Vacuum, entity: vacuum.robot}`): it shows that block's numbers and
  opens the same window, without a second copy of the block in the room; what the tile sets stands over the
  shortcut's.
- On a tablet a block with numbers (a robot, a machine) is two tiles wide in a room, not the whole row, and stands
  below the ordinary tiles of its section, so its height does not stretch them; two such blocks stand side by side.
- A device's own card in a block's window (e.g. the Vector control card) takes the colours of the window: its buttons,
  writing and chosen options follow the look instead of Home Assistant's theme, so a light theme no longer gives white
  buttons in a dark window.
- A camera in the strip of a room or Home is no longer cut in Safari (iPad, Mac): the strip was fitted to the size of
  the picture, so an unavailable camera with a small last frame (320 px) showed only part of its tile, which could be
  moved sideways inside it. The columns have a width of their own now, and the rounded corners also clip a blurred
  picture.
- Talking through a camera's speaker says why it does not start. Over plain http:// the browser gives no microphone,
  so its button shows a crossed-out microphone and a tap only explains that talking needs HTTPS, without trying to
  connect. A tap before the live view moves says that the live view is needed. The note shows for a few seconds,
  also on a phone or a tablet on its side, over the picture. The intercom stays as it was: without HTTPS it opens a
  field for typing.

## 0.4.0 (2026-11-12)

- The Apple Home theme that comes with the dashboard draws the circles of a room's status row open, with a white
  ring and icon, as in the Home app: the look has a new choice, Colours of kinds in the room status circles
  (`appearance.badges.kinds`, on by default).
- The clock of the status bar keeps the time on one line on a 12-hour clock, with AM or PM small beside it.
- The screenshots of a tablet are taken as a touch screen, as on an iPad, and the gallery has Apple Home on a tablet
  with the status bar and the vacuum, the departures, the status and the news on a tablet.
- The README shows four pictures (a phone and a tablet with the status bar, in the plain and the Apple Home look) and a Gallery button;
  the gallery (`docs/gallery.md`) holds every screenshot by subject, with new ones of the status bar, the Energy page
  on a tablet and a chart of a phase, all cameras in a grid and with one big camera, the camera window on a tablet,
  the weather on a tablet, the intercom and the connections of a camera on a battery. The guide shows them in their
  chapters, and the README describes the status bar, the phases of the meter and the newer camera options.
- The intercom can send a recording to the Intercom integration (`intercom.upload`, e.g. `/api/intercom/message`), which
  plays it itself: the WAV as the body, the areas in the address. With it anyone signed in may record, not only an
  administrator; an answer that played nowhere says there is no speaker.
- A red, blinking dot on a camera on a battery while a stream of it is open (Home, all cameras, the camera window), and a
  Connections tab in its settings: how many times and how long it was awake in the last 24 hours or 7 days, each
  connection with its times, the ones over 5 minutes in red.
- A recording asked for from a camera's card that the camera turned down no longer turns for ever: once nothing is
  being copied it comes back as one to bring down, and the window says the camera may have been busy.
- The Energy page opens charts of its own instead of the details window of Home Assistant: a phase its power and its
  voltage with the band of the range, a device or Used its energy as bars, Now the power of each phase, with ranges, a
  finger showing the value at a moment, and the lowest, average and highest. On a tablet the chart beside the phases
  is as tall as they are.
- The Energy page on a tablet on its side: the periods beside the dates, the numbers in one row, the chart beside the
  phases and the devices as tiles four in a row. A meter with phases gives the power now, each phase with its current,
  power factor and voltage on the range of 207–253 V (green, orange near its ends, red out of it), found by themselves
  on the meter's device or listed in `energy.phases`. Used is weighed against the period before (by this time for the
  current one), which the chart shows faintly behind. The share measured by devices, and the rest as its own entry.
- A tram leaving now says "now" in the status bar instead of "-1 min".
- The age of the picture stands in its top left corner on a tablet on its side, where the header is above the picture;
  on a phone on its side it stays under the header that lies over the picture.
- A camera window has a big play button in the middle of its picture while it is not live: a tap starts the live view,
  with the same loading ring as LIVE, which stays. It fades on an enlarged picture and two fingers on it still zoom.
- A camera window of a camera that is away keeps its place on a tablet or a phone on its side: the dark space of its
  picture is as large as the picture would be, so the header and the buttons stay where they always are, and the
  window says that the camera is unavailable.
- The recordings on disk show a picture of each file: a frame from its first second, taken in the browser two files
  at a time and kept on the device, so the next look has them at once.
- Recorded clips older than two weeks show again: the days, the line of time and the recordings on disk offer every
  day in the folder, so clips brought down from a camera's card from weeks ago can be found.
- A status bar for a tablet on its side, in place of the narrow bar: the time and date, the weather (today's low and
  high, the next rain or snow), what is on and open at home, the warnings of Home, what runs now (a washer, mass on
  Sunday, a vacuum), the departures and the power of chosen devices with a line of 6 hours. A part with nothing to say
  is left out. The look turns it on and chooses its parts, their order and colours (`appearance.status`), its facts
  come from `status_panel`. Its button folds it to the narrow bar on each tablet, and a hold on it opens the menu,
  with a filling ring and a hint the first times; the assistant sits under it. It is as wide as the menu, glass as the tiles
  with white icons (coloured ones are an option of the look) unless the look chooses a colour. A tap on a part opens its window: the weather, the Status screen,
  the timetable or the Energy page. The menu has a back arrow and the name of Home Assistant at its top.
- The Bank of the school screen: each child's card has the face from the duties (no coloured bar), the
  allowance with how often and the next payment day, and the last five operations (money in green, a
  reversed one crossed out).
- A camera window on a phone on its side: the header runs across the whole screen, close in the far left corner and
  the settings in the far right one (over the dark bands beside a narrower picture), the camera's own buttons set a
  little apart from the settings. What works the camera stays on the picture.
- An unavailable camera opens on a tap, to its window that says so under its name, so it is known which one went
  away.
- A camera window on a tablet on its side (a touch screen) takes the whole screen, like a phone on its side: the
  picture at the full width, the live view the same size, every button on it, the ring that turns the camera halfway
  down it and the header in the band above it. The other cameras come up from the bottom with the camera button in
  the header and a drag down puts them away. A computer with a mouse keeps its window.
- All cameras on a tablet fill the whole screen on black, 2 to 5 in a row: a button in the header chooses on this
  device, `cameras.columns` (Dashboard settings → Columns of all cameras on a tablet) for every tablet. The name
  stands at the top of each picture.
- All cameras on a tablet can show one big camera, live by itself, with the rest small: a tap puts a small one in the
  big place and lets the other go, the corner button opens a camera's window (`cameras.layout: featured`, or the
  button in the header on this device).
- A camera window on a tablet on its side can no longer be scrolled off its header (the put-away line of time showed
  at the bottom).
- A block on the whole screen with its card open (a vacuum with its map) stands in two columns on a tablet on its
  side: its rows, its numbers as tiles with a bar for a share and its buttons on the left, the card beside them.
- On a tablet the school year, the news and the status use the whole screen: jobs and accounts as tiles four in a
  row, the whole week of lessons side by side (a column a day), the news in two columns, and what the status lists
  side by side.
- Recordings on a camera's own card: a camera that offers them (`sd_recordings`, e.g. Neolink) gets a card button in
  its window, which lists them by day with small pictures; a tap brings one down to the disk, and one already there
  opens the line of time at it, and a button by each day brings down the whole day. Nothing on the card is removed.
- The Security filter lists four cameras in a row on a tablet on its side (two upright).
- Recordings on the disk: a film button in a camera window lists the recordings of its line of time by day, newest
  first, reading more days as it is scrolled; a tap goes back to the camera at that recording, its day chosen and the
  line moved to it.
- The intercom opens as a card of its own over a blurred page, on every page and room: "To: <where>", the voice as a
  live wave, one big button to send ("Done") and a close button to cancel; typing stays where there is no microphone.
- Warnings on Home: a Status item with `notify: true` shows as a card under the chips while it has something to
  say, listing what it names; with one device "More information" opens it. Closed, it stays away until tomorrow unless
  another device joins; Dashboard settings mute all of them for a week. Battery items can keep some integrations
  (`platforms`), devices with a camera (`device_has: camera`), and leave a battery's wear out.
- The weather on a tablet on its side takes the whole screen: now with today's high and low, sunrise and sunset and
  the facts on the left; the next 24 hours as a temperature chart over the precipitation of each hour, coloured by
  rain, snow or both, with the day's total; and the next days as columns on one scale of temperature, with their
  precipitation.
- A vacuum map card beside its panel on a tablet on its side: the rooms its room mode offers stand as buttons in the
  left column, with the times over and "Clean the chosen"; the card's own buttons are put away and the map stands
  alone, centred, on a clear background, narrowed when it would run past the screen.
- A recording can be deleted from the disk of Home Assistant with the bin on it, after asking: in the recordings on
  the disk, and for the copy of a recording from the camera's card (the card itself is not touched). Administrators
  only, as Home Assistant requires.
- A page opened in a window (Sources) lies on the window's background like every other window, without a background of
  its own.
- The departures on a tablet on its side take the whole screen: the next one large with whether it is on time, every
  departure of all lines in one order, the next hour (up to two) as a line of time a row per line, and a card per
  line with every time the timetable gives. Each line keeps a colour of its own (`colors: {"8": "#ff9f0a"}` chooses).
  `news` names an entity whose `list` holds the timetable's notices (diversions, disruptions): a warm card shows them
  above the departures while there are any.
- The guide shows a camera on its side with every button, its positions and its line of time; the made-up home's
  driveway camera turns and has saved positions.

## 0.3.0 (2026-11-11)

- Pinch to zoom into the picture of a camera window, upright and on its side: up to 4×, one finger moves a zoomed
  picture, a double tap zooms in or back out, ctrl with the wheel on a computer; a badge shows the zoom and takes it
  back to the whole picture. The picture, the live view and a recording zoom alike; what lies over them stays.
  A zoomed picture keeps to where it lay (on a phone on its side it does not spill over the bands), a finger that
  stays after a pinch only moves it, and a drag down on a zoomed picture moves it instead of closing the window.
- A tile can be tall: two rows, the icon at the top and the name and state at the bottom, the flat tiles filling the
  room beside it (`size: tall`, or the tile → Size in the editor of a room).
- The siren, light and night vision buttons of a camera can be chosen by hand from any entity, or left out, in
  Dashboard settings → Turning and talking of each camera (`cameras.quick`), so any camera gets them; the guide
  explains how they are found by themselves.
- Quick buttons in a camera window for what the camera has: siren (asks first, glows red, a tap stops it), light
  and night vision (a list: off, infrared, full colour), and the positions as a button with a list instead of a select.
  Upright they stand over the line of time from the right; on a phone on its side in a column in the bottom left
  corner, from the bottom. Found by the siren domain, a light or a `…_light` switch and a list offering infrared, also
  through a linked camera.
- A long list of quick options (many positions) no longer runs off the screen: it scrolls, upright above its button
  and on a phone on its side from the bottom of the column up to under the header.
- On a phone on its side the right column mirrors the left one: the button of the line of time and the talk button
  from the bottom, 48 px and 12 px apart, as far from the edge; the ring over them stays wholly on the picture, off
  the bands beside it.
- The heading Cameras opens all cameras one under another (two side by side on a tablet), big, with their name and
  the age of the picture, in the order and with the hiding of Home; a camera opened from there goes back to the list.
- Colours in Look show as round samples on a checkerboard with their code (a see-through one with its percent), and
  no colour as a dashed ring saying Default, instead of the stretched colour fields of the system.

## 0.2.0 (2026-11-10)

- Tapping LIVE no longer moves the window by a few pixels: the time over the line hides but keeps its room.
- Recorded live views of Reolink cameras through Neolink show on the days and the line of time like eufy ones: a
  "record live" switch may name its folder in the media folder (`recordings_path`).
- The live view has sound again: the card of Home Assistant starts its player muted, and a muted WebRTC player
  drops the stream's sound for good, so the sound button found nothing to play whenever WebRTC won over HLS.
- Play only plays recordings: past the last one it plays that one, and the window goes back to the last picture
  when it ends; only LIVE wakes a camera. The age of the picture moved to the top left, the camera positions to the
  bottom left, and a recording puts the controls of turning away. On a phone on its side the ring, the intercom and
  the button of the line of time stand in one column.
- **Dashboard settings → Load the app afresh** empties the caches, fetches fresh files of the dashboard and opens the
  page again, for an app that shows an old version away from home.
- **Look** moved from the three dots to the side menu, above Dashboard settings, since it is for the whole dashboard.
  The three dots go User access, Background of this screen, My layout and Summary badges (formerly Blocks) on Home,
  and User access, Background of this screen, My view and Edit this screen in a room.
- Talking through the camera's own speaker (eufy-sdk) as a choice in Dashboard settings, instead of the intercom.
- After LIVE the last picture stays until the video moves, instead of a black player while the camera wakes; a quiet
  ring turns in its middle meanwhile, and the LIVE pill stays grey until the video moves.
- The battery hint of a camera stays upright through the live view (faint while a recording plays), so the window
  does not jump; the sound and turning buttons are greyed while nothing plays; "No recording" under the time keeps
  its room, so moving the line no longer moves the window.
- The volume slider turns the sound smoothly on iPhone and iPad too: the sound goes through a Web Audio gain.
- Turning and talking of each camera in Dashboard settings: turning automatic, the ready-made eufy set (found by
  translation keys, so Polish entity ids work), ONVIF (`onvif.ptz`, positions as tokens), entities chosen by hand
  or none (`cameras.ptz`); talking automatic, through go2rtc (a WebRTC connection with the microphone only, for
  cameras with two-way audio), the room's intercom or none (`cameras.talk_with`).
- Any integration can offer a camera's speaker with a `talk_path` attribute on an entity of the camera's device
  (Neolink does); the sound button is lit only when what plays has sound.
- Talking through a camera's speaker waits for the live view to move (nobody is talked to before they can be seen),
  shows "Connecting…" while the camera's side connects (`{"state": ...}` from its integration), and ends with the
  live view.
- LIVE becomes DISCONNECT once the video moves, and ends the live view without closing the window; moving the line
  of time lets the camera go at once.
- A camera that goes away keeps its window: the last picture, dimmed, says the camera is unavailable, LIVE is off,
  and all comes back by itself; a picture that does not load is asked for again every 5 seconds.
- On a phone on its side the line of time has buttons to jump to the previous and next recording around play; LIVE
  no longer carries a red dot, the REC pill on the picture says it records.
- `cameras.controls` lends a camera the buttons for turning and the speaker of another camera, e.g. a Frigate
  picture turned and talked through with the eufy camera; **Dashboard settings → The same camera in another
  integration** links any camera of the dashboard to a camera of another integration, without YAML.
- Recorded live views of eufy battery cameras (the bridge's opt-in "Record live view") show on the days and the
  line of time for 14 days, read from the media folder; the pill on the picture says REC while they record.
- On a phone on its side the windows of devices (thermostat, blind, lamp, alarm) scroll instead of laying their
  controls over the header and the state.
- The menu of Home Assistant is hidden while the dashboard is open (not saved; it comes back on other pages), so
  the dashboard takes the whole screen. A phone on its side keeps the phone layout with three tiles in a row.
- The bottom bar no longer stays narrow at the right edge after the phone was turned while the app was away: it
  measures the page again on every turn and when the app comes back.
- On a phone on its side the camera fills the screen; the days and the line of time hide at the top and bottom
  edges and come out with a calendar button in the header and a line button in the corner (a swipe or a tap on the picture puts them away),
  and LIVE stays in the header by the sound button. The live view fills the height of the screen there too.
- The gear of every device window opens the settings of the device in tabs (settings, state, buttons and its
  activity, from its other entities; members first for a group), with the window of Home Assistant one tap further;
  cameras use the same window. Lights and fans in rows of blocks get a switch.
- A pencil next to the gear lets administrators change the name, area and labels of a device and enable or disable
  it, without leaving the app.
- In the Home Assistant app the swipe from the left edge opens the menu of the dashboard on Home instead of the menu
  of Home Assistant; elsewhere it goes back (a window closes, a page returns to Home). The rooms come right after the
  pages in that menu.
- The side menu ends with Profile and the name of the signed-in person, opening the profile of Home Assistant.
- A camera is known to be on a battery by the battery sensor of its device, for any brand; `battery_platforms` is
  empty by default and needed only for cameras that do not report a battery.
- The intercom button lies on the picture of the camera, so it fits a picture of any shape.
- A camera that can turn gets a button in the header that lays a ring of arrows and a list of its saved
  positions over the picture (buttons of the device such as `pan_left`, `tilt_up`, `go_to_preset`), so its window
  looks like that of any other camera.
- The gear in a camera window opens the settings and state of the camera, gathered from the entities of its device,
  instead of the window of Home Assistant; `cameras.settings` chooses the entities by hand.
- A Frigate camera shows its recordings: a week of days at the top and a line of the day's time at the bottom, moved
  sideways to choose a moment, with play, pause and LIVE. The picture, the live view and a recording take each
  other's place, and going to a recording ends the live view. Every camera window has the same layout: without
  recordings the days are greyed and the line is empty, and the Watch live button is gone in favour of LIVE.
- Holding the line of time shows the whole day on it, and moving the finger then puts the mark under it, for a fast
  move to another hour; the time over the line is left out while the view is live; a swipe over the days turns
  the week.
- A sound button next to the gear of a camera window turns the sound on and off; holding it shows a volume slider.

## 0.1.6 (2026-11-08)

The look of the dashboard is set in the dashboard itself, kept as themes and shared between homes. Two themes come
with it: Home Dashboard, the look so far, and Apple Home.

Look (three dots → Look, on every page). An administrator sets it for everyone, and each person adjusts it for
themselves on top; only what differs from the shared look is kept.

- Background: how strongly a background shows (the default 40% is the look so far, 100% has no veil), bounce at the
  ends, a colour or gradient for pages without a background of their own, and the colours and starting range of the
  map.
- Buttons: opacity, rounded corners, colour on the whole button or only on the icon, and a colour for each kind
  (lights, switches, blinds, thermostats, speakers, locks, fans, scenes, scripts, automations, sensors), with a
  preview.
- Colours: the title and headings, buttons that are off (background, writing, icon, its circle), the blocks at the top
  (background, writing, opacity, corners), the round buttons (intercom, three dots) and the badges in rooms. A colour
  left at Default keeps the colour of the light or dark look; a colour may be see-through (`#rrggbbaa`).
- Bar: 2 to 5 entries (pages, Scenes, the menu, rooms) in any order, at the edge or floating as a rounded pill, with
  its own background, icon colour, mark of the open page, opacity and blur. A tablet keeps its side bar.
- Player: background, writing, opacity, blur, corners, and how long something paused stays (0 hides it at once).
- Windows: background, writing, buttons and fields, Home Assistant cards (a vacuum map can lose its background),
  opacity, blur and the dimming of the page. It reaches every window: device controls, the player, menus, Weather,
  Status, Host, School year, departures, News and Media. The Look sheet shows it before saving.
- Icons: an own icon for any device, picked from the icons of Home Assistant by search.

Themes (Look → Themes, administrators):

- A library of looks, each with the backgrounds of its pages. Use one, change it, save the changes into it, go back
  to it, keep the current look as a new theme, or go back to the plain look. A look not yet in the library is kept
  there before switching. Using a theme changes the backgrounds only of the pages it has.
- Home Dashboard and Apple Home come with the dashboard and cannot be deleted; a home keeps its own version of them
  and can go back to the one that came. Apple Home is neutral glass: black and white that let the background
  through, so buttons and windows take the colour of the room they are in, with white writing, a floating glass bar
  and a dark map.
- A theme exports to one file with the pictures of its backgrounds and imports from another home, choosing where each
  background goes or leaving it out; own icons come along for devices of the same id only.

Pages:

- Energy is a page of the dashboard itself instead of the cards of Home Assistant: day, week or month, used energy,
  cost, sun, export, gas and water when set up, an hourly or daily chart and the devices, in the look of the theme.
- The Map draws the routes of people and chosen devices (`map.track`) over 6 h, 24 h, 3 days or 7 days, chosen with
  buttons over the map and remembered on each device. The list over the map takes the look of windows. It no longer
  follows the map dashboard of Home Assistant.
- The Scenes page, the Map and Energy have a background of their own in Background of this screen (keys `scenes`,
  `map`, `energy`).
- The page bounces at its top and bottom over a background that stays still, short pages too; the background now lies
  on the view itself.

Fixes:

- The small player no longer shows a speaker that says it plays with nothing to play (a HomePod after an AirPlay
  stream), nor something paused for longer than 10 minutes; a × closes it until something plays. It stays off the
  Map and Energy pages, as it does on Music.
- Going back to a page shows its own background again, not the one of the room seen last.

## 0.1.5 (2026-11-08)

Each person arranges the shared dashboard for themselves:

- My layout has Scenes (order and hide), Favorites (their own list, starting from the shared one, added by search)
  and Menu (hide an entry). "Open this dashboard at start on my devices" is kept with the account, and a device learns
  it once it connects.
- My view in a room hides a section or a tile for oneself, on the room page and on Home, and shows everything again.
- Background of this screen lets each person choose a system, light or dark look for themselves.
- Background of this screen has a picture for upright screens (phones, a tablet held upright) and one for wide ones
  (a tablet on its side, laptops), and the part of a picture that stays when the screen crops it: top, middle or
  bottom. A shape without its own picture uses the other one, and turning a tablet switches at once.
- An administrator ticks For everyone on the Areas and Favorites tabs of My layout to arrange them for everyone. Rooms
  and favorites left Dashboard settings, so there is one place for them, and its room list shows the rooms of the
  dashboard, not every area of Home Assistant. Adding a switch or a scene to the room of its area from there is gone:
  the room editor does that.
- User access has a Sections tab, so an administrator can take a section of a room away from someone. What an
  administrator took away stays away: nobody adds it back for themselves.

Rooms:

- The scenes and scripts of a room stand in their own Scenes row under its cameras, not as icons of its status row.
  The room editor has a Scenes tab to choose and order them; until then the room shows those of its areas.

Fixes:

- A mode without its own background shows the plain page of that mode, as Background of this screen says, instead of
  the background of the other mode.
- The scenes editor of Home shows every scene to an administrator, also those they hid for themselves.

## 0.1.4 (2026-11-07)

New screens:

- Map: the map fills the page, with a list of people, devices and zones that shows them on the map when tapped. On a
  phone it is a panel you drag between a thin bar, half the screen and the whole screen, and on a tablet it floats.
- History and logbook: they open in windows of the dashboard, also for people who are not administrators. The logbook
  reads like the one of Home Assistant and shows the devices of the dashboard, and each person keeps their own entities
  in the history.
- News: `kind: news` is a screen for reading articles from sensors that keep them in a `news` attribute.

Music:

- `music.addon` opens the music page through the window of apps, also for people who are not administrators.
- `music.fullscreen` hides the bottom bar and fills the screen from top to bottom, with the bars of the add-on below the
  clock of a phone. The Home Assistant button in the menu of the add-on goes back to Home.

Menu:

- Each entry can be for chosen people: Who sees it in Edit the menu, `users` in the configuration.
- The side menu no longer runs under the clock of a phone, has no empty section for those who cannot open the dashboard
  settings, and groups in its editor are named after their entries.

Fixes:

- The side bar follows the sidebar of Home Assistant to the end of its animation.
- The greeting on Home fits one line on a phone.

## 0.1.3 (2026-11-07)

Editing without YAML:

- Blocks (three dots on Home, administrators): add, edit, order and remove shortcuts and blocks in a form. Status,
  departures, machines, blocks, pages and the school year all have one, with their sections, rows and buttons. A block
  in a room opens from its tile in the room editor. Options the form does not know stay in the block untouched.
- A new name of a block reaches its rules in User access and Who sees this.
- Edit the menu (bottom of the side menu, administrators): `menu` arranges the side menu in groups of pages of Home
  Assistant, shortcuts, apps and the notifications. An entry can be for administrators only or hide itself in guest mode.
- Media categories in Blocks: `media.sections` puts the media page in your own groups, with televisions, soundbars and
  blocks beside the speakers. What they list also shows in the Media filter of Home, in its room.

New windows:

- Apps: an add-on with a web interface opens in a window of the dashboard, from the menu or as a shortcut (`kind: app`).
  It keeps its own session, says when the add-on is off, and `frame` gives a fallback address.
- Notifications open in a window of the dashboard, follow the server live and can be dismissed there.

Smaller changes:

- A shortcut can have a `label`, a small text above its name, like the chips before it.
- The school screen knows weekends by the date, and English day names work too. The guide describes every sensor it
  reads, so anyone can feed it from their own integration.

## 0.1.2 (2026-11-07)

- The school screen shows the important events of today and tomorrow at the top, for all children, and the plan shows the events of each day. The calendar of a child adds them to the entries of the school.
- `kind: overview`: a shortcut with the time, the date and only what needs a look right now, by rules set in its `sections`; `bottom: true` keeps a section at the very bottom.
- My layout has a Chips tab: everyone orders and hides the chips of Home for themselves. It opens from Home only.
- User access has a Chips tab, and "Everyone but me" hides something from all the others at once.
- `kind: departures`: a shortcut with the next tram or bus large and the coming times of every line.
- The volume changes while the slider moves, not when it is let go, in the player and on the remote.
- Tiles in a row have the size of ordinary tiles, and a name on two lines no longer makes a tile taller.
- `cameras.guest.users` limits guest mode to chosen accounts, by name or id.
- Weather: the first chip on Home shows the temperature and opens a screen with the current readings and
  the hourly and daily forecast. `weather.entity` and `weather.forecast` choose the entities, `weather: false`
  turns it off.

## 0.1.1 (2026-11-06)

- A step-by-step guide in English and Polish, with screenshots of every screen.
- The repository is public and installs through HACS.

## 0.1.0 (2026-11-06)

- Dashboard strategy `custom:home-dashboard` with Home, Media, Energy and Map views.
- Home page: greeting, summary chips, scrolling camera strip, favorites, rooms.
- Bottom navigation on phones, side rail on tablets.
- Every sheet rises from the bottom over the whole phone screen and can be pulled down to close; on a
  tablet control sheets stay a window in the middle; the back button closes them.
- A shortcut to a page opens it in a sheet, and what opens from there goes back to it.
- Own sheets for lights, switches and alarms in the look of the other sheets; an alarm with a code
  stays with Home Assistant.
- Groups of panels can use `layout: controls`: big buttons, choices, a wide slider and facts.
- The remote shows short lists of sources and sound modes as choices.
- The three dots hold the rooms and, for administrators, the editing of the screen.
- The intercom has a sound wave icon, and rooms a larger gap under the title.
- `security.group` keeps chosen tiles together at the top of the security filter.
- The list of areas starts with Home; alarms of devices that are gone stay out of the security filter.
- An icon from a set that is not installed falls back to the default icon of the tile.
- A webOS TV gets a real remote: arrows, OK, back, home, menu, channels and playback.
- Panel groups with `layout: summary` read as one line and open by themselves on a problem; facts are
  small cards with icons.
- A long room name gets smaller instead of pushing the icons to the next line.
- `card` in `entities.overrides` opens a device's own card from its tile, everywhere.
- `card_last` puts the card of a panel below its groups.
- On a phone the bottom bar goes away while Music Assistant shows its full-screen player.
- `cameras.private` takes a camera off every page while a switch is on; `tap_toggle` makes a tile toggle on a tap.
- In guest mode a blocked camera stays on its room's page, blurred and marked, and is gone from Home and security.
- An unavailable camera stays visible, blurred and marked, in the small pictures at the end of the strip.
- `cameras.hide` leaves chosen cameras out of the strip, the rooms and the security filter.
- `off_pin` opens a keypad on a `turn_on_only` tile; the server checks the PIN.
- Backgrounds have a light and a dark look, each for everyone (administrators) or for one account.
- User access has tabs for lights, media, security and other, with blocks and shortcuts in other.
- Each tile can be seen by everyone, only chosen people or all except chosen people. The editor always shows
  everything to an administrator, in green or red.
- My layout: each person orders and hides cameras and areas for themselves, kept with their account.
- User access: an administrator hides areas, cameras, scenes and scripts from chosen people.
- Pinch and double tap no longer zoom the dashboard.
- Everything that can be tapped answers with a press animation, and a tile that starts something turns green
  with a tick for a moment.
- Energy shows the cards of Home Assistant's own panel that the household has data for; Map follows the map
  dashboard of Home Assistant.
- Tiles with `calm: true` keep a plain colour when on and fade when off.
- A section, and the scenes on Home, can be one row that scrolls sideways.
- Blinds show estimated progress at once, since most report their position only when they stop.
- Filters fold the page: the old content fades while the new one rises into place.
- The view scrolls instead of the document, so on iOS nothing slides under the status bar and the
  navigation stays at the bottom; backgrounds stay put.
- The iOS app colours the area above the page to match it, black around a camera.
- Dialogs of Home Assistant follow a light page for as long as the dashboard is open, without saving
  anything; the page ends right above the navigation when nothing plays.
- Two cameras in a column of the strip are each half of a single one, so pictures keep their shape.
- The mini player is hidden on the music page, where Music Assistant has its own.
- Chips filter the page; menu with pages, rooms and links; settings saved to the strategy block.
- Room pages, opened from the menu, with devices grouped by kind and the room's cameras.
- Rooms and tiles can follow an imported overview dashboard, with merged areas and more tile kinds.
- Room status row, one line of icons that opens the devices of a group.
- Intercom: voice or dictated message to the whole house, one room from its page, or a camera's room.
- A room icon on every page lists the rooms and opens the chosen one.
- Blocks of several entities with their own screen, confirmations and control cards; web pages.
- Remote for TVs and soundbars: power, volume, shortcuts, sources, sound modes.
- A tablet left alone returns to Home.
- Shortcuts on Home and in the menu, a school screen, full-screen cards, service actions.
- Scenes section on Home, edited by touch.
- Backgrounds for Home and each room; opening at start per device.
- Tiles and sections edited by touch on the room page.
- YAML editor for the whole configuration, with checks and the previous version.
- Dark colours: automatic, light or dark, chosen in the integration options and applied at once.
- Security filter lists every camera, in two columns on a tablet; the camera screen has a thumbnail strip.
- Guest mode hides chosen cameras on every device.
- Mini player, Media page with speakers and sources, Energy from the energy dashboard, Map with people.
