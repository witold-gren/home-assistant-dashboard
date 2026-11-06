# Home Dashboard guide

From a fresh installation to a finished dashboard. No scripts are needed: everything here is done in
Home Assistant's settings, in the dashboard itself, or in its YAML editor.

[Polski](guide.pl.md) · [README](../README.md)

| Home | Room | Menu | Choosing an area |
|---|---|---|---|
| ![Home](screenshots/en/home.png) | ![Room](screenshots/en/room.png) | ![Menu](screenshots/en/menu.png) | ![Areas](screenshots/en/rooms.png) |

## 1. Install

You need Home Assistant 2026.10 or newer. On a phone or tablet use the Companion app.

1. In HACS (Marketplace from Home Assistant 2026.11) open the three dots → **Custom repositories**, add
   `https://github.com/witold-gren/home-assistant-dashboard` as an **Integration**, download
   **Home Dashboard** and restart Home Assistant. Without HACS, copy `custom_components/home_dashboard` into
   the `custom_components` folder of your configuration and restart.
2. Go to **Settings → Devices & services → Add integration** and add **Home Dashboard**.
3. Go to **Settings → Dashboards → Add dashboard → New dashboard from scratch**, and give it a name.
4. Open it, choose **Edit**, then the three dots → **Raw configuration editor**, replace everything with
   the lines below and save:

```yaml
strategy:
  type: custom:home-dashboard
```

The dashboard appears at once, built from your areas. It hides Home Assistant's own header, so from now
on its configuration is under **Menu → Dashboard settings → Edit configuration**.

**Colours:** Settings → Devices & services → Home Dashboard → **Configure** offers Automatic, Light and Dark.

## 2. What Home Assistant decides

The dashboard has no list of devices of its own. Most of what it shows comes from these settings, so
this is the first place to look when something is missing.

| In Home Assistant | Effect on the dashboard |
|---|---|
| **Areas** (Settings → Areas) | Every area with something to show becomes a room, with its name. An entity with no area stays out. |
| **Area of a device** | Its entities follow it. An entity can also have its own area, which wins. |
| **Entity name** | The tile's name. The name of the area is dropped from it, so "Kitchen Lamp" in Kitchen reads "Lamp". |
| **Hidden, configuration and diagnostic entities** | Never shown on their own. |
| **Light groups** | A group replaces its member lights, so one tile controls them. `lights.prefer_groups: false` shows each lamp. |
| **Users** | Administrators can edit. Everyone else can only use the dashboard and arrange it for themselves. |
| **Persons and zones** | The Map page lists people and how far they are from home. |
| **Energy dashboard** (Settings → Dashboards → Energy) | Decides what the Energy page shows. |
| **Dashboard with the address `map`** | Its map card is used on the Map page. Without it the map shows everything. |
| **Language of the user** | The language of the interface. English and Polish are included. |

By default only lights, climate, covers and locks become tiles. Anything else is added by you, see
[Rooms](#3-rooms).

## 3. Rooms

### Adding a room

Create the area in Home Assistant and assign devices to it. The room appears by itself.

### Choosing what a room shows

Open the room, then three dots → **Edit this screen**.

![Tile editor](screenshots/en/editor.png)

- **Room page** edits the sections shown on the room's own page. **Home page** edits the tiles of this room
  on Home.
- **Add a tile** searches all of Home Assistant, so a switch, a sensor, a scene or an automation can be added.
- Drag a tile by its handle, also to another section. Tap a tile to rename it, remove it, or choose who sees it.
- Each section has a name, arrows to move it, and a button with arrows that makes it one row scrolling
  sideways, which suits scenes and automations.
- Nothing reaches the server before **Save**.

The first edit writes the room down in `layout`. From then on the room shows what is listed there, and a new
device in the area needs adding by hand.

### Rooms made of several areas, and their order

Menu → Dashboard settings → **Edit configuration** opens all the configuration as YAML:

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

Rooms appear in the order of `layout`, and the areas it does not cover come after them. `rooms.order` and
`rooms.hidden` change the order and hide a room without describing it.

### Tile options

| Option | What it does |
|---|---|
| `name`, `icon` | Own name and icon. |
| `tap_toggle: true` | One tap anywhere on the tile toggles it. Good for automations, which would otherwise open a dialog. |
| `calm: true` | No colour when on, faded when off. For things that are nearly always on. |
| `action: script.x` | Runs the script instead of toggling. |
| `active_only: true` | Shown only while the device plays. |
| `turn_on_only: true` | Can only be turned on. With `off_pin: {service: script.x, field: pin}` a keypad turns it off, and the script checks the PIN. |

## 4. Home

From the top: the greeting, the weather, the chips, your shortcuts, cameras, scenes, favorites and rooms.

- **Chips** count what is on and filter the page: climate, lights, security and media.
- **Rooms** show the tiles from the Home page tab of each room. Set a short list there: the room's own page
  has the rest.
- **Favorites** go above the rooms: `favorites: [climate.living_room, lock.front_door]`.
- **Shortcuts** sit in the row of chips, see [Shortcuts and blocks](#7-shortcuts-and-blocks).

### Weather

The first chip shows the temperature and opens a screen with the current readings and the forecast for
the next hours and days. It appears by itself when Home Assistant has a `weather` entity. Add a service such
as **Met.no** under **Settings → Devices & services** if there is none.

By default the chip uses the first weather entity, and the forecast comes from the first one that has it. A home
station usually has no forecast, so the two can differ. Missing readings, such as wind, come from the forecast
entity too.

```yaml
weather:
  entity: weather.home_station
  forecast: weather.forecast_home
```

`weather: false` removes the chip. **User access** hides it from one person, under **Other**.

![Weather](screenshots/en/weather.png)

## 5. Cameras

### Which cameras appear

The strip does not show every camera, on purpose: a thumbnail fetched from a battery camera wakes it and
drains it. It shows:

- **Stored pictures:** `image.*` entities ending in `_last_screen` or `_last_snapshot`.
- **Cameras of safe platforms:** `camera.*` from `cameras.snapshot_platforms`, by default `frigate`.

A camera also needs an area. To add another platform that keeps its own frame:

```yaml
cameras:
  snapshot_platforms: [frigate, generic]
  battery_platforms: [eufy_sdk]
```

A platform in `battery_platforms` never appears, even when it is in both lists.

### Order and hiding

| Goal | How |
|---|---|
| Your own order, or hide one for yourself | Three dots → **My layout** |
| The same order for everyone | `cameras.order: [camera.a, camera.b]` |
| Hide from everyone | `cameras.hide: [image.garage_last_screen]` |
| Hide from one person | Three dots → **User access** |
| Exactly this list and nothing else | `cameras.hero` and `cameras.tiles` |

In the strip a single picture alternates with two smaller ones. A camera that stops working stays visible
in a small picture, blurred and marked as unavailable. The Security chip lists all cameras one under another.

### Live view

Tapping a picture opens it without a stream. **Watch live** starts one, from a camera on the same device or
from `cameras.live: {image.door_last_screen: camera.door}`.

### Guest mode and privacy

```yaml
cameras:
  guest:
    entity: input_boolean.guest
    hide: [camera.living_room, camera.bedroom]
  private:
    - {entity: switch.bedroom_privacy, hide: [camera.bedroom]}
```

While `guest` is on, these cameras leave Home and Security, and stay on their room's page blurred. While a
`private` switch is on, the camera is gone from every page.

## 6. Scenes

`scenes` is the section under the cameras. Tap its heading, then three dots → **Edit this screen**: the list
offers scenes and scripts. The arrows button lays them out in one row that scrolls sideways.

## 7. Shortcuts and blocks

A block is several entities on one screen. It is plain data, so it needs no code.

| Vacuum | Media | Blind | Switch |
|---|---|---|---|
| ![Vacuum](screenshots/en/vacuum.png) | ![Media](screenshots/en/media.png) | ![Blind](screenshots/en/blind.png) | ![Switch](screenshots/en/switch.png) |

A vacuum as a shortcut:

```yaml
shortcuts:
  - kind: panel
    name: Vacuum
    icon: mdi:robot-vacuum
    entity: vacuum.robot
    stats:
      - {name: Filter, entity: sensor.vacuum_filter, unit: "%", digits: 0}
    actions:
      - {name: Start, icon: mdi:play, entity: vacuum.robot, service: vacuum.start}
      - {name: Dock, icon: mdi:home-import-outline, entity: vacuum.robot, service: vacuum.return_to_base}
    card: {type: custom:xiaomi-vacuum-map-card, entity: vacuum.robot}
    card_open: true
    groups:
      - layout: controls
        rows:
          - {entity: select.vacuum_power, name: Power, labels: {quiet: Quiet, turbo: Turbo}}
```

The same block can stand in a room: put it among the tiles in `layout`.

| Part | What it does |
|---|---|
| `stats` | Numbers across the top. |
| `actions` | Buttons. `confirm: Text` asks first, `service` calls a service of the entity. |
| `groups` | Rows of entities. A `select` becomes a list, a `switch` a switch, a `number` a slider. |
| `groups[].layout: controls` | Big buttons, choices, a wide slider and small cards instead of rows. |
| `groups[].layout: summary` | One line that opens on a tap, and by itself when a door, window or problem sensor is on. |
| `card`, `card_open`, `card_last` | A Home Assistant card in the block: on a button, at once, or below the groups. |
| `frame` | A web page on the whole screen. |
| `tone` | Icon colour of a shortcut: green, purple, teal or pink. |

Other shortcuts: `{kind: page, name: Media, icon: mdi:play, page: media}` opens a page in a sheet, and
`kind: host` shows machines with `columns`. A TV has `kind: tv`, with `entity`, `on`, `off` and `shortcuts`,
and a webOS TV gets arrows and keys by itself.

A device with a card of its own opens it instead of the dashboard's sheet:

```yaml
entities:
  overrides:
    light.aquarium:
      card: {type: custom:lamp-card, entity: light.aquarium}
```

The rest of `entities`:

```yaml
entities:
  include:
    kitchen: [switch.dishwasher]     # adds an entity to a room
  exclude: [light.tablet_screen]     # leaves one out
  overrides:
    cover.window_3: {area: bedroom, name: Blind, icon: mdi:blinds}
```

## 8. Music, Energy and Map

| Music | Energy | Map | Player |
|---|---|---|---|
| ![Music](screenshots/en/music.png) | ![Energy](screenshots/en/energy.png) | ![Map](screenshots/en/map.png) | ![Player](screenshots/en/player.png) |

The music picture stands in for your music app, and the Energy and Map pictures for Home Assistant's cards,
with made-up numbers.

**Music** takes the place of Media on the navigation bar. Add a card or a web page:

```yaml
music:
  frame: http://homeassistant.local:8095
```

A page served over HTTP cannot open from a dashboard on HTTPS. On phones the bottom bar goes away for
Music Assistant's full-screen player only when the frame comes from the same address as Home Assistant.
When something plays a mini player shows above the bar on the other pages. Speakers that are the same device
are merged with `media.group_patterns`.

**Energy** shows the cards of Home Assistant's own panel, as far as there is data. Set it up in
**Settings → Dashboards → Energy**. Add your meter as the grid source and devices under
**Individual devices**. If one device is plugged into another that is measured, set it as a child there, or it
counts twice.

**Map** uses the map card of a dashboard with the address `map`, and lists people below it.

## 9. People

| Background | My layout | User access |
|---|---|---|
| ![Background](screenshots/en/background.png) | ![My layout](screenshots/en/layout.png) | ![User access](screenshots/en/access.png) |

**My layout** (three dots, for everyone): the order of cameras and areas, and what to hide. It is kept with
the account, so it follows the person to all their devices.

**Background of this screen** (three dots, for everyone): a gradient, a colour or a picture for Home or a room,
separately for the light and dark look. **For everyone** appears for administrators and makes it the default.
Without it the background stays with that account. A person's own background beats the default.

**User access** (three dots, administrators): choose a person and hide areas, cameras, lights, media, security,
scenes, scripts, other entities and blocks.

**Who sees this** (a tile in the editor): Everyone, Only chosen or All except. It applies to the entity
everywhere, your own account included. In the editor an administrator still sees everything: a green tile is
seen only by chosen people, and a red one is hidden from someone.

All of this hides things in the dashboard. It is not a permission: Home Assistant has none for single entities,
so the same person can reach them in another dashboard. Hide those dashboards too if it matters.

## 10. Phones and tablets

- Below 900 px of width the navigation is at the bottom, from 900 px at the side.
- A tablet left alone returns to Home after 3 minutes: `idle: {return_after: 300}` in seconds, `0` turns it off.
- A lock can only be locked on a tablet, because anyone can reach a wall: `security.unlock_on_tablet: true`
  changes it.
- **Dashboard settings → open at start** makes this device start on the dashboard, whatever the account's
  default is.
- After an update close and reopen the Companion app. If the old look stays, use
  **Settings → Companion App → Debugging → Reset frontend cache**.
- If the page zooms with fingers, turn off pinch to zoom in the Companion app's settings.

## 11. Intercom

With a script that speaks in chosen areas, the dashboard adds buttons to Home, rooms and the camera screen:

```yaml
intercom:
  script: script.announce
  areas_field: areas
  text_field: text
  areas: [living_room, bedroom]
```

The script gets the areas and the text in these fields. Recording a voice message needs HTTPS.

## 12. When something is wrong

| Symptom | Look at |
|---|---|
| A device is missing | Its area, whether it is hidden, and whether its domain is shown by default. |
| A light is missing | It may be a member of a light group. |
| A camera is missing | Its area, and the rules in [Cameras](#5-cameras). |
| A room is missing | The area needs at least one thing to show. |
| I cannot edit | Editing needs an administrator account. |
| A new device does not appear in a room | The room is in `layout`: add it with **Add a tile**. |

The [FAQ in the README](../README.md#faq) has more, with exact messages.
