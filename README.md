# Home Dashboard

[Polski](README.pl.md)

A touch-first dashboard strategy for Home Assistant: one dashboard for a phone and a wall tablet,
with pastel tiles, summary chips, bottom navigation on phones and a side rail on tablets. The whole
dashboard is generated from your rooms, so there are no cards to write by hand. The look is set in the dashboard
itself and kept as a theme you can share; two come with it: **Home Dashboard** and **Apple Home**.

Status: early version.

| Apple Home | Apple Home: room | Apple Home: lamp | Apple Home: energy |
|---|---|---|---|
| ![Apple Home](docs/screenshots/en/apple-home.png) | ![Apple Home: room](docs/screenshots/en/apple-room.png) | ![Apple Home: lamp](docs/screenshots/en/apple-light.png) | ![Apple Home: energy](docs/screenshots/en/apple-energy.png) |

| Home | Room | Dark mode | Tile editor |
|---|---|---|---|
| ![Home](docs/screenshots/en/home.png) | ![Room](docs/screenshots/en/room.png) | ![Dark mode](docs/screenshots/en/dark.png) | ![Tile editor](docs/screenshots/en/editor.png) |

| Light | Thermostat | Tablet |
|---|---|---|
| ![Light](docs/screenshots/en/light.png) | ![Thermostat](docs/screenshots/en/thermostat.png) | ![Tablet](docs/screenshots/en/tablet.png) |

| Weather | Player | Music | Media |
|---|---|---|---|
| ![Weather](docs/screenshots/en/weather.png) | ![Player](docs/screenshots/en/player.png) | ![Music](docs/screenshots/en/music.png) | ![Media](docs/screenshots/en/media.png) |

| Map | Menu | Choosing an area | Vacuum |
|---|---|---|---|
| ![Map](docs/screenshots/en/map.png) | ![Menu](docs/screenshots/en/menu.png) | ![Choosing an area](docs/screenshots/en/rooms.png) | ![Vacuum](docs/screenshots/en/vacuum.png) |

| Blind | Switch | Screen background | My layout |
|---|---|---|---|
| ![Blind](docs/screenshots/en/blind.png) | ![Switch](docs/screenshots/en/switch.png) | ![Screen background](docs/screenshots/en/background.png) | ![My layout](docs/screenshots/en/layout.png) |

| User access | Energy | Camera |
|---|---|---|
| ![User access](docs/screenshots/en/access.png) | ![Energy](docs/screenshots/en/energy.png) | ![Camera](docs/screenshots/en/camera.png) |

| Status | Departures | School year | Chips |
|---|---|---|---|
| ![Status](docs/screenshots/en/status.png) | ![Departures](docs/screenshots/en/departures.png) | ![School year](docs/screenshots/en/school.png) | ![Chips](docs/screenshots/en/chips.png) |

| Notifications | App in a window | Blocks | Block editor |
|---|---|---|---|
| ![Notifications](docs/screenshots/en/notifications.png) | ![App in a window](docs/screenshots/en/app.png) | ![Blocks](docs/screenshots/en/blocks.png) | ![Block editor](docs/screenshots/en/block-editor.png) |

| Menu editor | Media categories | Logbook | History |
|---|---|---|---|
| ![Menu editor](docs/screenshots/en/menu-editor.png) | ![Media categories](docs/screenshots/en/media-editor.png) | ![Logbook](docs/screenshots/en/logbook.png) | ![History](docs/screenshots/en/history.png) |

| News | My view of a room | My scenes |
|---|---|---|
| ![News](docs/screenshots/en/news.png) | ![My view of a room](docs/screenshots/en/my-view.png) | ![My scenes](docs/screenshots/en/my-scenes.png) |

**[Read the guide](docs/guide.md)** for a step-by-step setup: rooms, Home, cameras, blocks and people.

The screenshots show a made-up home from `dev/demo.js`, and the camera pictures are free CC0 photos of
other homes ([credits](dev/demo-pictures/CREDITS.md)). The backgrounds in the Apple Home pictures were made by the
author of the dashboard. Music and Map use stand-ins for your music app and the map, and Energy made-up statistics. Run `make screenshots` to make them again.

The dashboard speaks the language of the Home Assistant user. English and Polish are included; a new
language is one more block in `www/app/i18n.js`, and a test checks that it has every text.

## Installation

1. In HACS (Marketplace from Home Assistant 2026.11) open the three dots → **Custom repositories**, add
   `https://github.com/witold-gren/home-assistant-dashboard` as an **Integration**, download
   **Home Dashboard** and restart Home Assistant. Without HACS, copy `custom_components/home_dashboard`.
2. Settings → Devices & services → Add integration → **Home Dashboard**.
3. Settings → Dashboards → Add dashboard → **New dashboard from scratch**.
4. Open it, choose **Edit** → **Raw configuration editor**, and paste:

```yaml
strategy:
  type: custom:home-dashboard
```

The strategy needs no entry in `lovelace: resources`, and it works with `resource_mode: yaml`.

## What is shown

By default: lights, climate, covers and locks that have a room, without hidden, configuration and
diagnostic entities. Entities without a room stay out until you assign one. Switches, sensors and
scenes are added only by hand.

- A light group replaces its member lights. Set `lights.prefer_groups: false` to show every lamp.
- Media players that are the same speaker are merged with `media.group_patterns`.
- `media.sections` puts the media page in your own groups of tiles, which also join the Media filter on Home.
- Tapping the round icon toggles a light; tapping the tile opens its controls.
- Summary chips filter the page: climate, lights, security, media.
- The menu reaches every page and, for admins, the dashboard settings. A room opens on its own page,
  with its devices grouped by kind and its cameras.

## Configuration

Everything is optional:

```yaml
strategy:
  type: custom:home-dashboard
  favorites: [climate.living_room, lock.front_door]
  rooms:
    order: [living_room, kitchen]
    hidden: [garage]
  cameras:
    hero: image.front_door_last_screen
    tiles: [image.garden_last_screen]
    live: {image.front_door_last_screen: camera.front_door}
    battery_platforms: [eufy_sdk]
    snapshot_platforms: [frigate]
  entities:
    include:
      kitchen: [switch.dishwasher]
    exclude: [light.tablet_screen]
    overrides:
      cover.window_3: {area: bedroom, name: Blind, icon: mdi:blinds}
  media:
    group_patterns: ["^(.+)_homepod(_music)?$"]
  lights:
    prefer_groups: true
  security:
    unlock_on_tablet: false
```

### Editing on the device

Menu → settings → **Edit configuration** opens the whole configuration as YAML, for administrators.
Saving checks the syntax and the shape of rooms and tiles, and a mistake stays in the editor with the
line it is on. The version before the last save can be loaded back on the same device. Comments are
not kept, because Home Assistant stores the dashboard as JSON.

### Editing by touch

A room page has **Edit this screen** under the three dots for administrators. Use it to add, rename and remove tiles, drag them by the
handle, also between sections, and manage sections. The Home page tab edits the tiles shown for this
room on Home. Nothing reaches the server before **Save**; closing the editor drops the changes. Blocks
can be moved and removed here, and added in the YAML editor.

### Shortcuts

Administrators add and edit them in a form: three dots on Home → **Blocks**. The options are also described below and in the guide.

`shortcuts` adds buttons after the chips on Home and to the menu. Each is a block (`kind: panel`) or the
school screen (`kind: school`), a home overview (`kind: overview`, see the guide), news (`kind: news`) or departures (`kind: departures` with `entities` that keep a `list` attribute). A block can open fully with `fullscreen: true`, show its card at once
with `auto_card: true`, keep the card for administrators with `admin_card: true` (`frame` is shown to
the others), and name the card's button with `card_label` and `card_icon`. `tone` picks the icon colour (green, purple,
teal, pink); without it the colours follow the order. An action can call a service
of its entity: `{name: Start, entity: vacuum.robot, service: vacuum.start}`.

The school screen shows the important events of today and tomorrow at the top, for all children together (`important`
in the events of `sensor.rodzinnik_librus`), the lesson plan shows all the events of a day, and the calendar of a child adds them to the entries of the school.

### Weather

The first chip on Home shows the temperature and opens a screen with the current readings and the hourly
and daily forecast. It appears by itself when Home Assistant has a `weather` entity. The chip uses the first
one, and the forecast comes from the first one that has it, so a home station can work with a weather service:

```yaml
strategy:
  type: custom:home-dashboard
  weather:
    entity: weather.home_station
    forecast: weather.forecast_home
```

`weather: false` removes the chip.

### Scenes

`scenes` lists tiles under the cameras on Home. The heading opens their own page, where **Edit this screen** edits them
by touch and offers only scenes and scripts. A tile can have `name` and `icon`.

### Music page and machines

`music` adds a page in place of Media on the navigation, and Media can then be a shortcut:
`{kind: page, name: Media, icon: mdi:play-box-multiple-outline, page: media}`. Such a shortcut opens the
page in a sheet that can be pulled down. `music` takes `card`, `frame`
and `admin_card`, like a block. A shortcut with `kind: host` shows machines from `columns`, each with
`title`, `icon`, `subtitle`, `status`, `bars`, `info`, `machines` and a `graph` card. A block with
`card_open: true` shows its card without a button.

### A device's own card

`entities.overrides` takes `card`. The tile of that entity then opens the given card instead of the
dashboard's sheet, on every page and in filters, and the tile's icon opens it too instead of toggling:
`light.lamp: {card: {type: custom:skylight-lamp-card, entity: light.lamp, title: false}}`.

### A card at the end of a panel

`card_last: true` together with `card_open: true` shows the card of a block below all its groups, such as
a map.

### Layout of panel groups

A group of a `panel` block can have a `layout`. `controls` turns rows into big buttons, choices, a slider
and small cards. `summary` shows the group as one line that opens on a tap, and by itself when a door,
a window or a problem sensor reports on.

### My layout and user access

Three dots → **My layout**: everyone orders and hides cameras and areas for themselves. The layout is
kept with their Home Assistant account, so it is the same on all their devices, and it needs no
administrator. The list of cameras applies to Home, rooms and the security filter. On the Areas and Favorites tabs an
administrator ticks **For everyone** to set the shared order of areas, which are hidden, and the shared favorites.

Three dots on Home → **My layout** (everyone): the order of cameras, areas and the chips of Home, and what to hide.

Three dots → **User access** (administrators): choose a person or **Everyone but me** and hide areas, cameras, scenes, scripts,
lights, media, security and other entities from them. The Other tab also has blocks and shortcuts, such as
Frigate. It is saved in `access` as `{<user id>: {rooms: [...], hide: [...]}}`. Hiding an area hides its
cameras too. That person cannot bring these items back.

In the editor of a room or the scenes, tap a tile and set **Who sees this**: Everyone, Only chosen or All except.
It is saved in `visibility` as `{<entity>: {only: [...], except: [...]}}` and applies to the entity everywhere in the
dashboard, your own account included. In the editor an administrator always sees everything: a green tile is
seen only by chosen people, and a red one is hidden from someone, also through User access.

This hides things in the dashboard and is not a permission. Home Assistant has no permissions for single
entities, so the same person can still reach them in another dashboard or in the app.

### A camera switched off for privacy

`cameras.private` takes a camera off every page while the given switch is on:
`[{entity: switch.bedroom_privacy, hide: [camera.bedroom]}]`. Without it a camera with no power would show
as unavailable. A tile with `tap_toggle: true` toggles its entity with one tap.

### A row that scrolls sideways

The arrows button in a section's header in the room editor puts its tiles in one row that scrolls sideways
(`layout: row`). The same button in the scenes editor sets `scenes_layout: row` for Scenes on Home.

### Calm tiles

A tile with `calm: true` does not shine when on: it keeps a plain colour and fades when off. This look is for
settings that are nearly always on, such as automations.

### Group in the security filter

`security.group` shows chosen tiles together at the top of the security filter, whatever their rooms:
`{name: Guest, entities: [input_boolean.guest, input_boolean.guest_cabin]}`. The entities must be tiles
in `layout`.

### Backgrounds

Three dots → **Background of this screen** sets the background of Home or a room: a gradient, a colour or an
uploaded picture, separately for the light and the dark look and for upright (phone) and wide (tablet on its side, laptop) screens, with the part of the picture that stays when it is cropped. An administrator ticks **For everyone** next to
either, which saves it in `backgrounds`. Without it the background stays with that account and beats the shared one. The page
keeps a layer of the theme colour over it, so headings stay readable in light and dark mode; **Look → Background**
sets how strong it is. The background stays put while the page scrolls and bounces at its ends. The Scenes page, the
Map and Energy have a background of their own too.

### Look and themes

Three dots → **Look** sets the look of the whole dashboard: background strength, bounce, buttons (opacity, corners,
colour on the whole button or the icon only, a colour for each kind), the colours of writing, of the blocks at the top
and of badges, the bar at the bottom (entries, docked or floating, glass), the small player, windows (see-through and
blurred), the map and own icons of devices. An administrator sets the look for everyone, and each person may adjust
it for themselves. The **Themes** tab keeps a library of looks: **Home Dashboard** and **Apple Home** come with it,
your own look is kept as a theme, and any theme exports to a file with the pictures of its backgrounds and imports into
another home. Details and a step-by-step guide are in the [guide](docs/guide.md#look).

### Opening at start on one device

Home Assistant's default dashboard belongs to the account or the whole system. The switch in this
dashboard's settings is stored on the device: at app start, from a default page, it opens this
dashboard. Links to other pages keep working.

## Room layout

With no configuration, rooms are built from the areas. You can also describe them in `layout`: the
order of rooms, merged areas, tiles on Home and sections on the room page. Areas outside `layout` are
added at the end.

```yaml
layout:
  - id: kitchen
    name: Kitchen and dining
    areas: [kitchen, dining_room]
    home:
      - {entity: light.kitchen, name: Main}
    sections:
      - title: Lights
        tiles:
          - {entity: light.kitchen, name: Main}
```

A tile can have `action` (a script instead of a toggle), `active_only` (only while the device plays)
or `turn_on_only` (can only be turned on and opens no details dialog; meant for a guest mode that
needs a PIN to leave).

### Blocks

A block shows several entities in one wide tile and opens a screen with the details. It is plain data
in `layout`, so a new one needs no code:

```yaml
- kind: panel
  name: Coffee machine
  icon: mdi:coffee-maker-outline
  entity: sensor.coffee_status
  labels: {ready: Ready}
  active: binary_sensor.coffee_brewing
  stats:
    - {name: Today, entity: sensor.coffee_today, digits: 0}
    - {name: Water, entity: sensor.coffee_water, digits: 1, unit: l}
  actions:
    - {name: Rinse, entity: button.coffee_rinse, confirm: Start rinsing?}
  groups:
    - title: Settings
      rows:
        - {entity: select.coffee_profile, name: Profile}
        - {entity: switch.coffee_light}
```

Rows follow the entity: a list for `select`, a switch for `switch`, a slider for `number`, a button
for `button` and `script`. Anything else, a lock too, is read-only and opens the details dialog.
`card` adds a control card that starts only on a button, and `frame` opens a web page on the whole
screen. `hidden_when` hides the block while that entity is on, `compact` keeps it a regular tile.

A remote has `kind: tv` with `entity`, `on` and `off` (`{service, target}`), `shortcuts`
(`{name, icon}`, matched to the TV's source list), `source_script` (`{service, field}`, for a TV that
is off) and `sound_mode: true`.

## Room status row

Under the room name there is one row of icons that scrolls sideways: temperature, humidity, air
quality, brightness, climate, lights and switches that are on, open blinds, windows and doors,
motion, presence and alarms. Tapping an icon lists the devices in that group. The scenes and scripts of a room stand in their own **Scenes** row under the cameras, laid out like the scenes on Home.

## Intercom

```yaml
intercom:
  script: script.announce
  areas_field: areas
  text_field: text
  file_field: file
  played_field: played
  media_folder: media-source://media_source/media/messages
  areas: [living_room, bedroom]
```

Without `script` the buttons stay hidden. Without `areas` the list of rooms comes from Assist
satellites and players matching `media.group_patterns`. Home has a button for the whole house, a room
page has one in its header that speaks only in that room, and the camera screen has one for that
camera's room. Recording needs HTTPS and an administrator account; otherwise a text field opens, where
keyboard dictation works.

## Dark mode

Settings → Devices & services → Home Dashboard → **Configure** offers Automatic, Light and Dark. The
choice applies to every device at once, without a reload. Automatic follows the system, so an iPad set
to Automatic turns dark at dusk. The map picks its colours when it opens. Each person can choose differently for themselves in **Background of this screen** (System, Light, Dark), and that choice stays with their account.

## Return to Home on a tablet

A tablet left alone closes what is open and goes back to Home after 3 minutes. Change it in the
settings or with `idle: {return_after: 300}` in seconds; `0` turns it off. Phones stay where they are.
A message being written, the settings, a web page and a robot's control card are never closed.

## Cameras

Cameras sit at the top of the page in a strip that scrolls sideways, with every camera that has an
area. Each thumbnail shows the age of its picture. The strip uses two kinds of source:

- **Stored pictures** (`image.*` entities ending in `_last_screen` or `_last_snapshot`).
- **Cameras from the platforms in `cameras.snapshot_platforms`**, `frigate` by default. Their picture
  comes from a server that already has the frame, so the camera is not woken. It refreshes every
  30 seconds while the page is visible.

Other `camera.*` entities are rejected on purpose: their thumbnail is fetched from the device itself,
which drains battery cameras. A platform in `cameras.battery_platforms` never reaches the strip, even
when it is also added to `snapshot_platforms`.

The **Security** filter hides the strip and shows every camera one under another. On the camera screen
a row of thumbnails switches between cameras, and switching stops the stream of the previous one.

`cameras.guest` hides the listed cameras while guest mode is on. Without `users` it holds for every account.
With `users` it holds only for those accounts, given by name or id, such as the one on a wall tablet:

```yaml
cameras:
  guest:
    entity: input_boolean.guest
    hide: [camera.living_room, camera.bedroom]
    users: [Tablet]
```

Tapping a picture opens it full screen, still without a stream. **Watch live** starts one, found on
the same device or set in `cameras.live`. It stops after two minutes or when the screen closes.

## Locks on a wall tablet

On a tablet-sized screen a lock can only be locked, because anyone at the wall can reach it. Set
`security.unlock_on_tablet: true` to allow unlocking. On a phone the thumb must reach the far end of
the track, so a stray swipe does nothing. A lock that needs a code uses the regular dialog on a
phone and cannot be opened from a tablet.

## Development

`make help` lists the steps. `make ui` starts a throwaway Home Assistant with the real frontend and
demo entities at <http://127.0.0.1:8124/home-dashboard/home> (user `dev`, password `dev`). `make test-all`
runs everything. Add `?dashboard_debug=1` to the address to see the screen measurements.

The frontend has no build step: plain ES modules, with Lit in `www/vendor`.

`tests/fixtures/registry_snapshot.json` is an anonymised snapshot of a real installation, made with
`scripts/make_fixture.py`.

## FAQ

**The small player keeps showing a speaker that plays nothing** — some speakers, such as a HomePod after an AirPlay
stream ended, keep reporting `playing` without a title. Since this version such a speaker is not shown. Something
paused goes away after **Look → Bar → Paused stays** (10 minutes by default), and the × button closes the player until
something plays.

**The dashboard shows "Timeout waiting for strategy element"** — the integration is not set up, or
Home Assistant was not restarted after copying it.

**A light is missing** — it is probably a member of a light group, which replaces it, or it has no
room.

**A room in the menu scrolls the page instead of opening** — the device still runs an older version.
Reload the page; in the Companion app use Settings → Companion App → Debugging → Reset frontend cache.

**The area name on Home does nothing, or a room has only lights** — the page is an older version or
there is no `layout` block. Reload the page and describe the rooms in `layout`.

**The dashboard stays light at night** — check the colour mode in the integration options, the system setting, and in the Companion app its own
theme setting (App Configuration → Theme). A new look may need the frontend cache reset.

**The dashboard file** — it is a storage dashboard: `.storage/lovelace.home_dashboard`. Home Assistant
keeps it in memory, so a hand edit is lost unless it is stopped first. Use the editors in the dashboard.

**The Intercom button is missing** — the `intercom` block has no `script`. In a room it also needs a
speaker in that room.

**A web page block says it cannot open over HTTPS** — a browser refuses an `http://` page inside an
`https://` dashboard. Open the dashboard on the home network.

**A browser on a large screen goes back to Home by itself** — anything at least 900 px wide counts as a
tablet. Set `idle: {return_after: 0}`.

**Intercom: "Not sent: no speaker is available in that room"** — the script found no speaker in that
room. Check that the speaker is available.

**A camera is missing from the strip** — it needs an area and must be available. A camera without a
stored picture must come from a platform in `cameras.snapshot_platforms`.

**I want to hide the bedroom cameras on the tablet** — list the cameras in `cameras.hero` and
`cameras.tiles`. The page then shows only those.

**A blind does not react to the button, or its percentage drifts** — most blinds report their position
only when they stop, so the sheet shows progress estimated from a 35 s full run. The real position
replaces the estimate when the blind stops.

**The Stop button of a blind is greyed out** — this blind does not support stopping in Home Assistant.

**A sheet cannot be pulled down with a finger** — pull it by the handle or the header. A slider, the
thermostat dial, cards and scrolled content keep the finger for themselves.

**The background ends under the status bar and a black strip appears under the navigation** — the page
is an older version. Close and reopen the app to refresh it.

**Pulling the page down does not refresh it in the app** — the page scrolls in the dashboard's view, not
in the app's window. Close and reopen the app.

**After choosing a filter there is empty space at the end of the page** — the page is an older version.
Close and reopen the app to refresh it.

**There is no pencil for editing** — editing is in the menu under the three dots, below the list of
areas, for administrators.

**An alarm opens the Home Assistant dialog instead of the dashboard's sheet** — this alarm needs a code,
and the dashboard's sheet has no keypad.

**The security filter has an unavailable "Security mode" tile** — this is the alarm of a device the
integration no longer has. The dashboard leaves such entities out, and the device can be removed in
Home Assistant.

**An alarm is greyed out** — the entity is unavailable because the camera does not answer. Check the
camera in the Eufy app, not the dashboard settings.

**A tile has no icon** — the entity uses an icon from a set Home Assistant does not have. The dashboard
then shows the default icon, and the `icon` field of the tile sets your own.

**The sheet of a light has no device options, such as a schedule** — such a device has a card of its own.
Set it with `card` in `entities.overrides`.

**The bottom bar covers the Music Assistant player** — the bar goes away only when the page can look into
the frame, which means administrators with the add-on card. A plain frame at `:8095` is out of its reach.
On a tablet the bar is at the side and stays.

**I have two cameras of the same place** — one is usually a stored picture from another integration. Hide
it with the `cameras.hide` list, such as `hide: [image.garage_last_screen]`.

**A camera is blurred with "Camera unavailable"** — the entity is unavailable, for example Frigate gets no
picture from it. Check the camera; the picture comes back by itself.

**I cannot switch off a guest mode** — a tile with `turn_on_only` goes off only through the PIN keypad, which
needs `off_pin: {service: script.guest_unlock, field: pin}`. The server checks the PIN.

**The page still zooms with fingers** — close and reopen the app. Also check the pinch to zoom setting in
the Companion app and turn it off.

**A camera in a room is blurred with "Guest mode"** — guest mode is on. On the room's page the camera stays blurred
and cannot be opened, and it is gone from Home and the security filter.

**The keys of the remote are greyed out** — the TV is off. Start it with the power button.

**Home Assistant dialogs are dark on a light dashboard** — the page is an older version. The dashboard
switches the Home Assistant theme to light only while it is open, without saving, so your theme comes
back when you leave.

## Origin

This dashboard began as a concept for Home Assistant in the Figma project
[Future concept](https://www.figma.com/proto/ZPRTON7huEj9kyXzPNxNgK/Future-concept?node-id=263-7391&comments-enabled=1&starting-point-node-id=263%3A7391).

## License

MIT. Lit is included under the BSD-3-Clause license.
