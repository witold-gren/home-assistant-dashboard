# Home Dashboard configuration reference

Every key the dashboard reads, with its type, default and a short example, and every editing window with the keys
it writes. The [guide](guide.md) explains the features step by step; this page is for looking a key up.

[Polski](configuration.pl.md) · [Guide](guide.md) · [README](../README.md)

All entity ids, names and addresses below are made up.

## 1. Where the configuration lives

The configuration is the `strategy:` block of the dashboard. Only `type` is required:

```yaml
strategy:
  type: custom:home-dashboard
  favorites: [climate.living_room]
  layout: []
```

Everything else is optional and has a default. There are three places to change it:

| Where | Who | What |
|---|---|---|
| Menu → **Dashboard settings** → **Edit configuration** | administrators | the whole block as YAML, without `type` |
| Home Assistant's **Raw configuration editor** of the dashboard | administrators | the same, with `type` |
| the editing windows of the dashboard | see [chapter 13](#13-editing-windows) | parts of it, without YAML |

Home Assistant's editor is reached through Settings → Dashboards → the dashboard → three dots → **Edit dashboard** →
three dots → **Raw configuration editor**, since the dashboard hides Home Assistant's header.

Home Assistant keeps the dashboard as JSON, so comments in YAML are not kept after saving.

Settings live in three places:

| Kind | Kept in | Examples |
|---|---|---|
| **Shared** | the `strategy:` block | `layout`, `shortcuts`, `appearance`, `access` |
| **Per person** | the user data of the account (`home_dashboard`), on all its devices | My layout, My view, own look |
| **Per device** | the browser of the device | open at start here, columns of the camera wall |

The per person and per device settings are not part of the YAML.
[Chapter 15](#15-what-is-kept-per-person-and-per-device) lists them.

## 2. Top-level keys

| Key | Type | Default | What it sets | More |
|---|---|---|---|---|
| `layout` | list of rooms | `[]` | rooms described by hand: areas, Home tiles, sections | [3](#3-rooms) |
| `rooms` | mapping | order `[]`, hidden `[]` | order and hiding of rooms | [3](#rooms) |
| `entities` | mapping | empty | adding, leaving out and overriding entities | [3](#entities) |
| `lights` | mapping | `prefer_groups: true` | light groups instead of their lamps | [3](#lights) |
| `favorites` | list of entity ids | `[]` | tiles above the rooms on Home | [4](#favorites) |
| `scenes` | list of tiles | `[]` | the Scenes row on Home | [4](#scenes-and-scenes_layout) |
| `scenes_layout` | `row` or none | none | scenes in one row that scrolls sideways | [4](#scenes-and-scenes_layout) |
| `weather` | mapping or `false` | found by itself | the weather chip and its window | [4](#weather) |
| `security` | mapping | see section | unlocking on a tablet, group in the Security filter | [4](#security) |
| `idle` | mapping | `return_after: 180` | return to Home on a tablet | [4](#idle) |
| `cameras` | mapping | see section | which cameras show and how they work | [5](#5-cameras) |
| `shortcuts` | list of blocks | `[]` | shortcuts on Home and in the menu | [6](#6-shortcuts-and-blocks) |
| `music` | mapping | none | the Music page in place of Media | [7](#music) |
| `media` | mapping | see section | speakers that are one device, the Media page | [7](#media) |
| `map` | mapping | `track: []` | devices with a route on the Map | [7](#map) |
| `energy` | mapping | found by itself | phases of the meter, voltage range, energy stores | [7](#energy) |
| `menu` | mapping | shortcuts and basic links | the groups of the side menu | [8](#8-menu) |
| `appearance` | mapping | the plain look | the shared look | [9](#appearance) |
| `themes` | list | `[]` | the library of themes | [9](#themes-and-theme) |
| `theme` | theme id | none | the theme the look started from | [9](#themes-and-theme) |
| `backgrounds` | mapping | `{}` | shared backgrounds of pages | [9](#backgrounds-and-background) |
| `background` | text or mapping | none | an older background of Home | [9](#backgrounds-and-background) |
| `access` | mapping by user id | `{}` | what is taken away from a person | [10](#access) |
| `visibility` | mapping by key | `{}` | who sees a tile or a block | [10](#visibility) |
| `status_panel` | mapping | see section | facts of the status bar of a tablet | [11](#11-tablet-status-bar) |
| `intercom` | mapping | no script | voice and text messages to rooms | [12](#12-intercom) |
| `schema` | number | `1` | version of the format; leave it alone | |

## 3. Rooms

Without `layout` every area with something to show becomes a room. Only lights, climate, covers and locks become
tiles by themselves, grouped by kind. The first save in the room editor writes the room into `layout`. From then on it
shows exactly what is listed there. See the guide: [Rooms](guide.md#3-rooms).

### `layout`

A list of rooms. Rooms keep this order, and areas that no room covers follow them.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `id` | text | **required** | id of the room; for one area use the area id |
| `name` | text | **required** | name shown on Home and on the room page |
| `areas` | list of area ids | `[]` | areas joined into this room: their cameras, status row and intercom |
| `home` | list of [tiles](#tiles) | `[]` | tiles of this room on Home |
| `sections` | list of [sections](#sections) | `[]` | the room page |
| `scenes` | list of [tiles](#tiles) | scenes and scripts of the areas | the Scenes row under the cameras |
| `status` | list of [status groups](#room-status-row-status) | `[]` | own circles in the status row |
| `background` | text or mapping | none | older room background; use [`backgrounds`](#backgrounds-and-background) |

```yaml
layout:
  - id: kitchen
    name: Kitchen and dining
    areas: [kitchen, dining_room]
    home:
      - {entity: light.kitchen, name: Main}
    scenes:
      - {entity: scene.kitchen_dinner}
    sections:
      - title: Lights
        tiles:
          - {entity: light.kitchen, name: Main}
          - {entity: light.kitchen_counter}
```

A room is matched by `id` or by any of its `areas`, so a link to an area opens the room that holds it.

### Sections

| Key | Type | Default | Meaning |
|---|---|---|---|
| `title` | text | none | heading; it also names the section in My view and User access |
| `tiles` | list of [tiles](#tiles) | **required** | the tiles; may be empty |
| `layout` | `row` | none | one row that scrolls sideways instead of a grid |

```yaml
sections:
  - title: Automations
    layout: row
    tiles:
      - {entity: automation.blinds_at_dusk, calm: true, tap_toggle: true}
```

A section without a title is known by its place. Moving it changes what someone hid in it.

### Tiles

A tile is one entry of `home`, `sections[].tiles`, `scenes`, the room's `scenes` and `media.sections[].tiles`. It names
an entity, a [shortcut](#6-shortcuts-and-blocks) or is a whole block (`kind: panel`, `kind: scale`, `kind: tv`).

| Key | Type | Default | Meaning |
|---|---|---|---|
| `entity` | entity id | **required** without `shortcut` or a block | the entity of the tile |
| `name` | text | the entity name without the room name | own name |
| `icon` | `mdi:…` | from Home Assistant | own icon; **Look → Icons** wins over it |
| `size` | `tall` | flat | two rows high, icon on top; not for blocks, which are two tiles wide |
| `calm` | `true` | `false` | no colour when on, faded when off; for things that are nearly always on |
| `tap_toggle` | `true` | `false` | a tap anywhere toggles the entity (`homeassistant.toggle`) and opens nothing |
| `action` | `domain.service` | none | a tap calls this service, with no data, instead of the usual action |
| `active_only` | `true` | `false` | shown only while the entity is active (not off, idle, paused, standby…) |
| `turn_on_only` | `true` | `false` | a tap only turns it on; once on, nothing happens unless `off_pin` is set |
| `off_pin` | `{service, field}` | none | with `turn_on_only`: a keypad, the PIN goes to the service in `field` |
| `confirm` | `true` | `false` | a `select` or `input_select`: the window marks an option and runs it only on a button |
| `labels` | mapping option → text | none | a `select` or `input_select`: own names of its options |
| `shortcut` | name of a shortcut | none | the tile stands for that block; its other keys override the block's |
| `column` | title of a column | none | with a `kind: host` shortcut: only that machine |
| `kind` | `panel`, `scale`, `tv` | none | the tile is a block of that kind, see [chapter 6](#6-shortcuts-and-blocks) |

Only one of `turn_on_only`, `tap_toggle` and `action` takes effect, in this order. `tap_toggle` and `action` do
nothing while the entity is unavailable.

```yaml
tiles:
  - {entity: input_boolean.guest_mode, turn_on_only: true, off_pin: {service: script.guest_off, field: pin}}
  - {entity: switch.garden_pump, action: script.water_garden_10_min}
  - {entity: media_player.tv, active_only: true}
  - {entity: light.sofa, size: tall}
```

**A list with its own names and a run button.** `labels` and `confirm` work on a tile of a `select` or `input_select`
entity, in a room, on Home, in Scenes and in media categories (not in `favorites`, which are plain entity ids):

- `labels` replaces the names of the options on the tile and in its window. An option without a label keeps the name
  Home Assistant gives it.
- `confirm: true` changes the window: the heading over the options reads **Mark one, then run it**, a touch only marks
  an option, and the button **Run: …** under the options selects it. The button is grey until an option is marked and
  while the entity is unavailable. This suits a coffee machine, where a drink should not be made by brushing the screen.

```yaml
tiles:
  - entity: select.coffee_drink
    name: Coffee
    confirm: true
    labels: {espresso: Espresso, lungo: Long coffee, hot_water: Hot water}
```

**A tile that names a shortcut.** `{shortcut: Vacuum, entity: vacuum.robot}` shows the numbers of the block named
`Vacuum` and opens its window, without a second copy of the block. What the tile sets itself stands over the block. A
shortcut taken from someone in [User access](#access) is gone from rooms too. A machine of a `kind: host` shortcut
(`column`) shows the state of its `entity` on the tile (the power of its plug), or its `subtitle` without one:

```yaml
tiles:
  - {shortcut: Vacuum, entity: vacuum.robot}
  - {shortcut: Servers, column: NUC, entity: sensor.nuc_power, name: Intel NUC}
```

### Room status row (`status`)

Under a room's name the dashboard shows circles for temperature, humidity, lights on, open windows and more, found
by itself. `status` adds circles of your own. Their entities leave the automatic circles.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `name` | text | none | title of the circle |
| `entities` | list of entity ids | **required** | what it counts as on |
| `type` | `motion`, `switch` or none | none | `motion`: detected or not; `switch`: on, off, "2 of 3"; none: open |
| `icon` | `mdi:…` | by type | own icon |

```yaml
layout:
  - id: hall
    name: Hall
    areas: [hall]
    status:
      - {name: Doors, entities: [binary_sensor.front_door, binary_sensor.back_door]}
      - {name: Motion, type: motion, entities: [binary_sensor.hall_motion]}
```

### `rooms`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `order` | list of room ids | `[]` | rooms in this order first; the rest keep their usual order |
| `hidden` | list of room ids | `[]` | rooms hidden from everyone |

Written by **My layout → Areas → For everyone**. A person's own order replaces `order` for them.

### `entities`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `include` | mapping room id → entity ids | `{}` | adds entities, of any domain, to a room without `layout` |
| `exclude` | list of entity ids | `[]` | never shown on its own |
| `overrides` | mapping entity id → options | `{}` | per entity: `area`, `name`, `icon`, `card` |

`overrides` options:

| Key | Meaning |
|---|---|
| `area` | area id; the entity counts as being there |
| `name` | name everywhere in the dashboard |
| `icon` | icon everywhere in the dashboard |
| `card` | a Home Assistant card that opens instead of the dashboard's window; the round icon opens it too |

```yaml
entities:
  include:
    kitchen: [switch.dishwasher]
  exclude: [light.tablet_screen]
  overrides:
    cover.window_3: {area: bedroom, name: Blind, icon: mdi:blinds}
    light.aquarium: {card: {type: custom:lamp-card, entity: light.aquarium}}
```

### `lights`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `prefer_groups` | boolean | `true` | a light group replaces its member lamps; `false` shows every lamp |

## 4. Home

See the guide: [Home](guide.md#4-home).

### `favorites`

A list of entity ids shown above the rooms. Written by **My layout → Favorites → For everyone**. A person with own
favorites sees theirs instead.

```yaml
favorites: [climate.living_room, lock.front_door]
```

### `scenes` and `scenes_layout`

`scenes` is a list of [tiles](#tiles) under the cameras on Home and on the Scenes page. `scenes_layout: row` lays
them, and the Scenes rows of the rooms, in one row that scrolls sideways.

```yaml
scenes:
  - {entity: scene.movie_night, name: Movie}
  - {entity: script.good_night}
scenes_layout: row
```

### `weather`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `entity` | weather entity | the first one | the chip and the readings now |
| `forecast` | weather entity | the first that forecasts | the hourly and daily forecast |

`weather: false` removes the chip. See the guide: [Weather](guide.md#weather).

```yaml
weather:
  entity: weather.home_station
  forecast: weather.forecast_home
```

### `security`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `unlock_on_tablet` | boolean | `false` | allow unlocking on a tablet; a lock with a code then opens HA's window |
| `group` | `{name, entities}` | none | these tiles at the top of the Security filter; they must be tiles of rooms |

```yaml
security:
  unlock_on_tablet: false
  group: {name: Guest, entities: [input_boolean.guest_mode]}
```

### `idle`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `return_after` | seconds | `180` | a tablet left alone closes what is open and goes back to Home; `0` turns it off |

**Dashboard settings → Back to Home on a tablet after** writes it in whole minutes (0, 1, 3, 5, 10).

## 5. Cameras

See the guide: [Cameras](guide.md#5-cameras).

| Key | Type | Default | Meaning |
|---|---|---|---|
| `snapshot_platforms` | list of integrations | `[frigate]` | `camera.*` of these integrations show in the strip |
| `battery_platforms` | list of integrations | `[]` | battery cameras that do not report a battery; never in the strip |
| `hero` | entity id | none | with `tiles`: exactly this list and nothing else, this one first |
| `tiles` | list of entity ids | `[]` | with `hero`: the rest of the exact list |
| `order` | list of entity ids | `[]` | shared order of the strip |
| `hide` | list of entity ids | `[]` | hidden from everyone |
| `private` | list of `{entity, hide}` | `[]` | while `entity` is on, the cameras in `hide` are gone from every page |
| `guest` | `{entity, hide, users}` | none | while `entity` is on, `hide` leaves Home and Security, blurred in rooms |
| `live` | mapping picture → camera | `{}` | the camera that plays live for an `image.*` picture |
| `controls` | mapping camera → camera | `{}` | the same camera in another integration: turning, buttons, talking |
| `ptz` | mapping camera → setting | `{}` | how a camera turns, see below |
| `quick` | mapping camera → `{siren, light, night}` | `{}` | own entities of the round buttons, or `none` |
| `talk_with` | mapping camera → mode | `{}` | `auto`, `go2rtc`, `intercom` or `none` |
| `talk` | `intercom` or `camera` | `intercom` | talking in a camera window: the room's intercom or the camera |
| `settings` | mapping camera → list of entity ids | `{}` | own choice of entities for the gear of a camera window |
| `columns` | 2 to 5 | `3` | cameras in a row of all cameras on a tablet |
| `layout` | `grid` or `featured` | `grid` | all cameras the same size, or one big and live with the rest small |
| `recordings_folder` | media source address | the eufy folder | where recorded live views of eufy cameras are |

`guest.users` limits guest mode to these accounts, by name or id. Without it guest mode holds for everyone.

`ptz` setting of one camera:

| Key | Meaning |
|---|---|
| `mode` | `auto` (default), `eufy`, `onvif`, `manual` or `none` |
| `left`, `right`, `up`, `down` | with `manual`: a button, script or scene for each direction |
| `select`, `button` | with `manual`: the list of positions and the button that goes to the chosen one |
| `presets` | with `onvif`: tokens of saved positions |

`quick` accepts a `siren`, `switch`, `input_boolean` or `script` for `siren`; a `light`, `switch` or
`input_boolean` for `light`; a `select` or `input_select` for `night`. An entity of another domain is ignored and the
button is found by itself.

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

## 6. Shortcuts and blocks

`shortcuts` is a list of blocks. Each one is a button after the chips on Home and an entry of the side menu (unless
`menu` lists its own entries). A block of `kind: panel`, `scale` or `tv` can also stand among the tiles of a room. See
the guide: [Shortcuts and blocks](guide.md#7-shortcuts-and-blocks) and [Windows for your own devices](own-devices.md).

### Keys of every shortcut

| Key | Type | Default | Meaning |
|---|---|---|---|
| `kind` | text | **required** | one of the kinds below |
| `name` | text | **required** | name; also the key of the shortcut in `access`, `visibility`, `menu` and tiles |
| `icon` | `mdi:…` | none | icon |
| `label` | text | none | small text above the name on Home |
| `tone` | `green`, `purple`, `teal`, `pink` | by order | colour of the icon on Home |
| `hidden_when` | entity id | none | the shortcut, and a block tile, hides while this entity is `on` |

| Kind | Window | Section |
|---|---|---|
| `panel` | rows, numbers, buttons and a card of several entities | [panel](#kind-panel) |
| `tv` | a remote | [tv](#kind-tv) |
| `host` | machines: load, facts, virtual machines, plug | [host](#kind-host) |
| `scale` | a bathroom scale with BodyMiScale | [scale](#kind-scale) |
| `overview` | the Status screen | [overview](#kind-overview) |
| `departures` | trams and buses | [departures](#kind-departures) |
| `news` | articles to read | [news](#kind-news) |
| `school` | the school year | [school](#kind-school) |
| `page` | a page of the dashboard in a window | [page](#kind-page) |
| `app` | an add-on with a web interface | [app](#kind-app) |

### `kind: panel`

A block of several entities. On a tile it shows its state and its numbers, and a tap opens its window. As a tile it
needs `name`; `entity` is optional.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `entity` | entity id | none | main entity: tile state, lit tile; a block whose `entity` does not exist is not shown |
| `status` | entity id | `entity` | entity whose state the tile shows |
| `labels` | mapping state → text | none | own words for that state on the tile |
| `state_text` | text | none | fixed text on the tile instead of a state |
| `active` | entity id | `entity` | the tile is lit while this entity is in `active_state` |
| `active_state` | text | `on` | the state that lights the tile |
| `compact` | `true` | `false` | a plain tile without the numbers, one tile wide |
| `stats` | list | `[]` | numbers on the tile and at the top of the window |
| `actions` | list | `[]` | buttons |
| `groups` | list | `[]` | rows of entities |
| `details` | entity id | none | the gear in the header opens this entity's window |
| `card` | Home Assistant card | none | a card in the window, started on a button |
| `card_open` | `true` | `false` | the card shows at once, without the button |
| `card_last` | `true` | `false` | with `card_open`: the card below the groups |
| `card_label`, `card_icon` | text, `mdi:…` | "Control" | the button that starts the card |
| `admin_card` | `true` | `false` | with `auto_card`: the card for administrators only, others get `frame` or the rows |
| `auto_card` | `true` | `false` | the window is only the card |
| `frame` | address | none | a web page on the whole window instead of everything else |
| `fullscreen` | `true` | `false` | the whole screen; with `card_open` two columns on a tablet on its side |

`stats` entries: `name`, `entity`, `unit`, `digits` (decimal places), `format: duration` (seconds as m:ss) and `labels`
(state → text). A stat with `unit: "%"` gets a bar in the two columns of `fullscreen`.

`actions` entries:

| Key | Meaning |
|---|---|
| `name`, `icon` | the button |
| `entity` | **required**: a button without an existing entity is not shown |
| `service` | `domain.service` called with `entity_id` of `entity`; without it the entity is pressed or turned on |
| `confirm` | text of a question asked first |

`groups` entries:

| Key | Meaning |
|---|---|
| `title` | heading |
| `layout` | none: rows; `controls`: big switches, choices, sliders, small cards; `summary`: one line that opens |
| `rows` | list of rows |

A row is `{entity, name}` with optional `icon`, `unit`, `digits`, `format`, `labels`, `icons` (option → icon, for
choices in `controls`), `order` (the order of the options of a list) and `hide` (options of a list nobody uses, left
out unless one of them is what the device is set to now). What a row does depends on its domain:

| Domain | Row |
|---|---|
| `switch`, `input_boolean`, `light`, `fan` | switch |
| `select`, `input_select` | list (`controls`: choices) |
| `number`, `input_number` | slider |
| `button`, `input_button`, `script` | button |
| any other | the value; a tap opens its window |

A `summary` group opens by itself while a door, window or problem sensor in it is on.

```yaml
shortcuts:
  - kind: panel
    name: Washer
    icon: mdi:washing-machine
    entity: sensor.washer_state
    labels: {running: Washing}
    active: sensor.washer_state
    active_state: running
    stats:
      - {name: Left, entity: sensor.washer_time_left, format: duration}
      - {name: Water, entity: sensor.washer_water, unit: l, digits: 1}
    actions:
      - {name: Start, icon: mdi:play, entity: button.washer_start, confirm: Start washing?}
    groups:
      - title: Washing
        layout: controls
        rows:
          - {entity: select.washer_spin, name: Spin, order: ["400", "800", "1200"]}
      - title: State
        layout: summary
        rows:
          - {entity: binary_sensor.washer_door, name: Door}
    card: {type: custom:washer-card, entity: sensor.washer_state}
    card_open: true
    card_last: true
```

### `kind: tv`

A remote. As a tile it opens the remote; as a shortcut too.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `entity` | media player | **required** | the TV |
| `on`, `off` | `{service, target}` | `media_player.turn_on` / `turn_off` | own way to turn it on and off |
| `shortcuts` | list of `{name, icon}` | `[]` | sources as buttons, matched by name to the TV's list |
| `source_script` | `{service, field}` | none | a source chosen while the TV is off goes to this service in `field` |
| `sound_mode` | `true` | `false` | choices of the sound mode |

A webOS TV gets its arrows and keys by itself, and an Apple TV its remote through the remote entity of its device.

```yaml
tiles:
  - kind: tv
    entity: media_player.living_room_tv
    name: TV
    on: {service: script.tv_on}
    shortcuts:
      - {name: YouTube, icon: mdi:youtube}
      - {name: HDMI 1, icon: mdi:video-input-hdmi}
```

### `kind: host`

Machines: load bars, facts, virtual machines, a graph card and the smart plug of each one. Read-only.

| Key | Type | Meaning |
|---|---|---|
| `columns` | list | one card per machine |
| `columns[].title` | text | name of the machine; `column` of a tile picks it |
| `columns[].icon`, `subtitle` | `mdi:…`, text | header |
| `columns[].status` | entity id | a dot: on, running, home, online or true is green |
| `columns[].bars` | list of `{name, entity, unit, digits, max, warn, alert}` | load bars, see below |
| `columns[].info` | list of `{name, entity, unit, digits, type}` | facts, see below |
| `columns[].machines` | list of `{name, status, cpu, ram}` | virtual machines with CPU and RAM in % |
| `columns[].graph` | Home Assistant card | a card under the machine |
| `columns[].power` | `{entity, switch, voltage, current, energy}` | the smart plug, see below |

A bar is full at `max` (default 100), orange from `warn` % (70) and red from `alert` % (90) of it. `type` of a fact:
`since` (time since a date), `seconds` (a duration), `date` (today, yesterday, n days ago), `update` (installed →
latest version) or `state` (the raw state); without it a number with `unit` and `digits`. `power` shows the watts of
`entity`, the state of `switch` (never switched from here), `voltage`, `current`, `energy` today and in total, and a
chart of the power.

```yaml
shortcuts:
  - kind: host
    name: Servers
    icon: mdi:server
    columns:
      - title: NUC
        status: binary_sensor.nuc_online
        bars:
          - {name: CPU, entity: sensor.nuc_cpu, unit: "%"}
        info:
          - {name: Up for, entity: sensor.nuc_last_boot, type: since}
        power: {entity: sensor.nuc_power, energy: sensor.nuc_energy, switch: switch.nuc_plug}
```

### `kind: scale`

A bathroom scale with each person's body from BodyMiScale. See the guide: [The scale](guide.md#the-scale).

| Key | Type | Default | Meaning |
|---|---|---|---|
| `entity` | sensor | none | what the scale shows now |
| `people` | list | every `bodymiscale.*` | entity ids or `{entity, name, weight}`; `weight` names the weight sensor |

### `kind: overview`

The Status screen: a clock and only what is worth a look now. See the guide:
[Warnings on Home](guide.md#warnings-on-home).

| Key | Type | Meaning |
|---|---|---|
| `sections` | list | `{title, alert, bottom, items}` |
| `sections[].alert` | `true` | the items count towards the summary by the clock |
| `sections[].bottom` | `true` | the section always stands at the bottom |

An item shows only while it has something to say:

| Key | Meaning |
|---|---|
| `name`, `icon` | title and icon |
| `entities` | entity ids or `{entity, name}`; shown while in `state` (default `on`) |
| `state` | a state or a list of states |
| `below` | with `entities` or `auto`: values lower than this; `attribute` reads an attribute, `unit` names the unit |
| `auto: battery` | every battery level in %; `platforms` and `device_has` narrow it |
| `auto: alarm` | every sensor of the home that detects water, smoke, gas or carbon monoxide, while it does; `classes` narrows it (`moisture`, `smoke`, `gas`, `carbon_monoxide`, and `safety` when named) |
| `alarm` | `true`: red on Status and, with `notify`, a red card on Home that cannot be closed or muted while it lasts; on by itself for `auto: alarm` |
| `list` | `{entity, attribute, name, detail, since}`: rows of a list in an attribute |
| `entity` | with `state`: a device in one of the states; `labels` (state → text), `facts` (`{name, entity, unit}`) |
| `text` | always this text |
| `weekdays`, `months` | only on these days (1 is Monday) and months (1 to 12) |
| `notify` | `true`: also a card on Home; works for `entities`, `below`, `auto` and `list` items |

```yaml
shortcuts:
  - kind: overview
    name: Status
    icon: mdi:clipboard-pulse-outline
    sections:
      - title: Needs a look
        alert: true
        items:
          - {name: Water leak, icon: mdi:water-alert, auto: alarm, classes: [moisture], notify: true}
          - {name: Smoke or gas, icon: mdi:smoke-detector-alert, auto: alarm, classes: [smoke, gas], notify: true}
          - {name: Batteries, icon: mdi:battery-alert, auto: battery, below: 20, notify: true}
          - {name: Open windows, icon: mdi:window-open-variant, entities: [binary_sensor.kitchen_window]}
```

### `kind: departures`

| Key | Type | Meaning |
|---|---|---|
| `entities` | list of entity ids | sensors with a `list` attribute of departures |
| `colors` | mapping line → `#rrggbb` | own colours of lines |
| `news` | entity id | notices of the carrier from its `list` attribute |

A departure in `list` has `line`, `direction`, `departure`, `time_to_departure` and `delay`.

```yaml
shortcuts:
  - {kind: departures, name: Trams, icon: mdi:tram, entities: [sensor.tram_4], colors: {"4": "#ff9f0a"}}
```

### `kind: news`

| Key | Type | Meaning |
|---|---|---|
| `sections` | list of `{title, entity}` | each a sensor with a `news` attribute; see the guide: [News](guide.md#news) |

### `kind: school`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `children` | list of names | none | order of the children; others go last |
| `sources` | mapping | `sensor.rodzinnik_*` | a sensor for each part, see below |

The parts are `plan`, `grades`, `events`, `meals`, `duties`, `jobs`, `bank` and `librus`. The data each sensor must hold
is in the guide:
[The school year from your own data](guide.md#the-school-year-from-your-own-data).

### `kind: page`

| Key | Type | Meaning |
|---|---|---|
| `page` | `media`, `energy`, `map` or `music` | the page opens in a window that can be pulled down |

```yaml
shortcuts:
  - {kind: page, name: Media, icon: mdi:play-box-multiple-outline, page: media}
```

### `kind: app`

| Key | Type | Meaning |
|---|---|---|
| `addon` | add-on slug | the add-on opens in a window through ingress |
| `frame` | address | used when the add-on has no web interface or cannot be reached |
| `path` | address | the button "open in Home Assistant" when it fails; default `/<addon>` |

## 7. Pages

See the guide: [Music, Energy and Map](guide.md#8-music-energy-and-map).

### `music`

With `music` the Music page takes the place of Media on the bar; Media can then be a `kind: page` shortcut.

| Key | Type | Meaning |
|---|---|---|
| `addon` | add-on slug | the add-on, e.g. Music Assistant, through ingress; wins over the others |
| `card` | Home Assistant card | a card on the whole page |
| `admin_card` | `true` | the card for administrators only; others get `frame` |
| `frame` | address | a web page; also the fallback of `addon` |
| `fullscreen` | `true` | the bottom bar goes away for the full-screen player |

```yaml
music:
  addon: abcd1234_music_assistant
  fullscreen: true
```

### `media`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `group_patterns` | list of regular expressions | see below | players whose ids give the same first group are one |
| `sections` | list of `{title, tiles}` | `[]` | the Media page in your own groups; tiles as in a room |

The default of `group_patterns` is `["^(.+)_homepod(_muzyka)?$"]`.

Tiles of `media.sections` that also stand in a room with `areas` join the Media filter on Home.

### `map`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `track` | list of `device_tracker` ids | `[]` | devices with a route, next to the people |

### `energy`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `phases` | list of `{power, voltage, current, factor}` | found on the grid meter | phases L1, L2, L3 in order |
| `voltage_range` | `[low, high]` | `[207, 253]` | the voltage scale and its colours |
| `storage` | list | `[]` | energy stores on a battery, a card each |

`storage` entries: `block` (name of the block opened on a tap), `name` (default `block`), `icon`, `battery`
(**required**, %), `state`, `labels` (state → text), `input` and `output` (W), `remaining` (minutes). See the guide:
[An energy store](guide.md#an-energy-store).

```yaml
energy:
  voltage_range: [207, 253]
  storage:
    - block: Power station
      battery: sensor.station_battery
      state: sensor.station_state
      labels: {charging: Charging}
      input: sensor.station_in
      output: sensor.station_out
      remaining: sensor.station_time_left
```

## 8. Menu

Without `menu` the side menu lists the shortcuts and the basic links (History, Logbook, Devices, Automations, Home
Assistant). With it, the menu shows exactly its groups. See the guide: [The side menu](guide.md#the-side-menu).

| Key | Type | Meaning |
|---|---|---|
| `groups` | list | `{title, items}` |
| `groups[].title` | text | heading of the group |
| `groups[].items` | list | entries, below |

An entry has one of `shortcut`, `addon`, `action` and `path`:

| Key | Meaning |
|---|---|
| `name`, `icon` | the entry; with `shortcut` they default to the shortcut's |
| `shortcut` | name of a shortcut; opens its window |
| `addon` | an add-on in a window, as `kind: app` (also `frame` and `path`) |
| `action` | `notifications`: a window of notifications |
| `path` | a Home Assistant address; `/history` and `/logbook` open the dashboard's own windows |
| `admin` | `true`: administrators only |
| `users` | list of user ids; none means everyone |
| `hide_for_guests` | `true`: hidden while [guest mode](#5-cameras) holds for this account |

```yaml
menu:
  groups:
    - items:
        - {shortcut: Status}
        - {name: Notifications, icon: mdi:bell-outline, action: notifications}
    - title: System
      items:
        - {name: Settings, icon: mdi:cog-outline, path: /config, admin: true}
```

## 9. Look

See the guide: [Look](guide.md#look) and [Themes](guide.md#themes).

### `appearance`

The shared look. Each person may change any part of it for themselves; only what differs is kept. A wrong value is
ignored and the default stays. A colour is `#rrggbb` or `#rrggbbaa`; no value keeps the colour of the light or the dark
look.

| Key | Range | Default | Meaning |
|---|---|---|---|
| `background_strength` | 0-100 | `40` | how clearly a background shows |
| `bounce` | boolean | `true` | the page bounces at its ends |
| `page.background_light`, `page.background_dark` | colour or gradient | none | background of pages without their own |
| `tiles.opacity` | 20-100 | `100` | opacity of buttons |
| `tiles.radius` | 0-36 | `20` | rounded corners |
| `tiles.fill` | `tile`, `icon` | `tile` | colour on the whole button or only on the icon |
| `tiles.background`, `text`, `icon`, `icon_background` | colour | none | buttons that are off |
| `tiles.colours` | mapping kind → colour | `{}` | colour of a kind while on |
| `text.title`, `text.headings` | colour | none | title and headings |
| `chips.background`, `chips.text` | colour | none | blocks at the top |
| `chips.opacity`, `chips.radius` | 20-100, 0-30 | `100`, `14` | blocks at the top |
| `buttons.background`, `buttons.icon` | colour | none | round buttons (intercom, three dots) |
| `buttons.opacity` | 20-100 | `100` | round buttons |
| `badges.text`, `badges.icon` | colour | none | room status circles |
| `badges.kinds` | boolean | `true` | circles in the colours of their kinds |
| `badges.fill` | boolean | `true` | `false`: circles open inside |
| `sheets.background`, `text`, `controls`, `cards` | colour | none | windows; `cards`: background of cards in them |
| `sheets.opacity`, `blur`, `scrim` | 20-100, 0-40, 0-80 | `100`, `0`, `45` | windows and the dimming of the page |
| `map.theme` | `auto`, `light`, `dark` | `auto` | colours of the map |
| `map.hours` | 6, 24, 72, 168 | `24` | the range of routes at first |
| `player.background`, `player.text` | colour | none | the small player |
| `player.opacity`, `blur`, `radius` | 20-100, 0-30, 0-32 | `100`, `0`, `16` | the small player |
| `player.paused_minutes` | 0-120 | `10` | how long something paused stays |
| `nav.items` | 2 to 5 entries | home, media/music, energy, map | the entries of the bar, see below |
| `nav.style` | `docked`, `floating` | `docked` | the bar at the edge or floating |
| `nav.background`, `icon`, `active` | colour | none | the bar |
| `nav.opacity`, `nav.blur` | 20-100, 0-30 | `100`, `0` | the bar |
| `status.shown` | boolean | `false` | the status bar of a tablet on its side |
| `status.widgets` | list | all six | `weather`, `home`, `alerts`, `now`, `departures`, `power`, in order |
| `status.colourful` | boolean | `false` | coloured icons, lines and charts |
| `status.background`, `status.text` | colour | glass | the status bar |
| `status.opacity`, `status.blur` | 20-100, 0-30 | `100`, `30` | the status bar |
| `icons` | mapping entity id → `mdi:…` | `{}` | own icons of devices, over every other icon |

Entries of `nav.items`: `home`, `media`, `music`, `energy`, `map`, `scenes`, `menu` and `room:<id>`.

Kinds of `tiles.colours`: `light`, `switch`, `cover`, `climate`, `media_player`, `lock`, `fan`, `scene`, `script`,
`automation`, `binary_sensor`, `sensor`. `input_boolean` counts as `switch`, `alarm_control_panel` as `lock`, `button`
and `input_button` as `script`, `water_heater` as `climate`.

```yaml
appearance:
  background_strength: 70
  tiles: {opacity: 85, radius: 28, fill: icon, colours: {light: "#ffb300"}}
  nav: {items: [home, scenes, "room:living_room", menu], style: floating}
  status: {shown: true, widgets: [weather, home, alerts, now]}
  icons: {light.led_strip: mdi:led-strip-variant}
```

### `themes` and `theme`

`themes` is the library of the **Themes** tab: `{id, name, appearance, backgrounds}` each. `theme` is the id of the
theme the current look started from. The themes that come with the dashboard have the ids `home_dashboard` and
`apple_home`; an entry with the same id is this home's version of it. Both keys are written by the Themes tab; there
is little reason to edit them by hand.

### `backgrounds` and `background`

`backgrounds` holds the shared background of each page, by key: `home`, `scenes`, `map`, `energy` or a room id.

| Key | Meaning |
|---|---|
| `light`, `dark` | upright screens, in the light and the dark look |
| `light_wide`, `dark_wide` | wide screens; without them the upright one is used |
| `position` | `top` or `bottom`: the part of a picture kept when cropped; middle when missing |

A value is a colour, a gradient or the address of a picture. A plain text instead of the mapping is used for both
looks. The older `background` (Home) and `layout[].background` (a room) are read when `backgrounds` has no entry; the
background window moves them into `backgrounds` on the first save.

```yaml
backgrounds:
  home:
    light: /api/image/serve/abc123/original
    light_wide: /api/image/serve/def456/original
    dark: "#121316"
    position: top
  energy: "linear-gradient(170deg, #3b4a6e, #1b2033)"
```

## 10. People

See the guide: [People](guide.md#9-people). Both keys hide things in the dashboard only; they are not permissions.

### `access`

What an administrator took away from a person, by user id. The person cannot bring it back.

| Key | Contents |
|---|---|
| `hide` | entity ids (cameras, devices, scenes…), `chip:<chip>` and `block:<shortcut name>` |
| `rooms` | room or area ids; their cameras go too |
| `sections` | `<room id>\|title:<title>`, or `<room id>\|index:<n>` for a section without a title |

The chips are `chip:weather`, `chip:climate`, `chip:lights`, `chip:security` and `chip:media`.

```yaml
access:
  0a1b2c3d4e5f: {hide: [camera.bedroom, chip:media, "block:Servers"], rooms: [garage]}
```

### `visibility`

Who sees a tile or a block, wherever it shows, by its key: the entity id, `shortcut:<name>` for a tile that names a
shortcut, or `block:<name>` for a block.

| Key | Meaning |
|---|---|
| `only` | list of user ids that see it; everyone else does not |
| `except` | list of user ids that do not see it (used when `only` is empty) |

```yaml
visibility:
  light.shelf: {only: [0a1b2c3d4e5f]}
  switch.coffee: {except: [0a1b2c3d4e5f]}
```

## 11. Tablet status bar

`status_panel` says where the facts of the status bar come from. Whether it shows, and its parts, are in
[`appearance.status`](#appearance). See the guide: [The status bar of a tablet](guide.md#the-status-bar-of-a-tablet).

| Key | Type | Default | Meaning |
|---|---|---|---|
| `doors` | list of entity ids or `{entity, name}` | `[]` | doors and windows of **At home**; open while `on`, `open` |
| `now` | list | `[]` | items of **Now**, see below |
| `power` | list of entity ids or `{entity, name, color}` | `[]` | power now with a line of 6 hours |
| `departures` | list of entity ids or `null` | `null` | the trams; `null` takes the first departures block |

A `now` item is an entity id or a mapping: `entity` (**required**), `name`, `icon`, `detail` (added after the state),
`remaining` (on the right), `resting` (own list of states that mean nothing runs) and `block` (name of the block that
opens on a tap).

```yaml
status_panel:
  doors: [binary_sensor.front_door, {entity: binary_sensor.balcony_door, name: Balcony}]
  now:
    - {entity: sensor.washer_phase, detail: sensor.washer_program, remaining: sensor.washer_left, block: Washer}
    - vacuum.robot
  power: [sensor.nuc_power]
  departures: null
```

## 12. Intercom

See the guide: [Intercom](guide.md#11-intercom).

| Key | Type | Default | Meaning |
|---|---|---|---|
| `script` | `domain.service` | none | without it there are no intercom buttons |
| `areas` | list of area ids | speakers found by themselves | rooms to speak in |
| `areas_field` | text | `areas` | field of the areas in the call |
| `text_field` | text | `text` | field of a typed message |
| `file_field` | text | `file` | field of a recording uploaded to `media_folder` |
| `played_field` | text | none | field of the answer that lists where it played; empty means no speaker |
| `upload` | address | none | an endpoint that takes the WAV (`?areas=a,b`) and plays it; anyone signed in may record |
| `media_folder` | media source address | none | where recordings go without `upload`; administrators only |

```yaml
intercom:
  script: intercom.announce
  text_field: message
  played_field: played
  upload: /api/intercom/message
```

## 13. Editing windows

Each window below says how to open it, who sees it and what it writes. A window that writes the shared
configuration saves the whole `strategy:` block at once.

### Dashboard settings

**Open:** Menu → **Dashboard settings**. **Who:** administrators. **Saved:** with **Save** at the top.

| Field | Writes |
|---|---|
| **Back to Home on a tablet after** | `idle.return_after` |
| **Open this dashboard at start on this device** | this device only |
| **Warnings on Home** → Mute for a week / Show again | your user data |
| **Talking in a camera window** | `cameras.talk` |
| **Columns of all cameras on a tablet** | `cameras.columns` |
| **Layout of all cameras on a tablet** | `cameras.layout` |
| **The same camera in another integration** | `cameras.controls` |
| **Turning and talking of each camera** → Turning | `cameras.ptz` |
| → Siren button, Light button, Night vision button | `cameras.quick` |
| → Talking | `cameras.talk_with` |
| **Edit configuration** | opens the YAML editor |
| **Load the app afresh** | nothing; reloads the files of the dashboard |

### Edit configuration (YAML)

**Open:** Dashboard settings → **Edit configuration**. **Who:** administrators. **Writes:** everything.

Saving checks the syntax and refuses a configuration that would stop the dashboard from drawing, with the path of the
problem:

- `rooms`, `cameras`, `intercom`, `entities`, `media`, `menu`, `lights`, `security` and `idle` must be mappings;
- `favorites`, `layout`, `scenes` and `shortcuts` must be lists;
- a room needs `id` and `name`; its `areas`, `home`, `sections` and `status` must be lists;
- a section needs a `tiles` list, and a status group an `entities` list;
- a tile needs `entity`, unless it has `shortcut` or is `kind: panel` or `kind: scale` with a `name`;
- a shortcut needs `name` and `kind`.

**Load the version before the last save** brings back the configuration from before the last save, kept on this device.

### Edit this screen (the room editor)

**Open:** in a room, three dots → **Edit this screen**; for the Scenes of Home, open the **Scenes** page first.
**Who:** administrators. **Saved:** with **Save**; the cross drops the changes.

| Tab | Edits | Writes |
|---|---|---|
| **Room page** | sections: name, arrows, one row (`layout: row`), remove, **Add a section** | `layout[].sections` |
| **Scenes** | the Scenes row of the room | `layout[].scenes` |
| **Home page** | the room's tiles on Home | `layout[].home` |

Tiles are dragged by their handle, also between sections. **Add a tile** opens the tile search, a tap on a tile opens
the tile window. The first save of a room built from its area writes the whole room into `layout`. On the Scenes page
the editor has one list (`scenes`) and the arrows button sets `scenes_layout: row`. Rules of **Who sees this** are saved
together, into `visibility` and `access`.

A green tile is seen only by chosen people; a red one is hidden from someone.

### Add a tile

**Open:** **Add a tile** in the room editor. With nothing typed it lists what belongs to the room's areas and has no
tile yet; typing searches all of Home Assistant. In Scenes it offers only scenes and scripts. A pick adds
`{entity: …}` to the list.

### The tile window

**Open:** a tap on a tile in the room editor.

| Field | Writes |
|---|---|
| **Name on the tile** | `name` of the tile; empty removes it |
| **Size**: Flat, Tall (two rows) | `size: tall`; not for blocks |
| **Who sees this**: Everyone, Only chosen, All except | `visibility.<key>`; the key leaves `access.*.hide` |
| **Edit the block** (a `kind: panel` tile) | opens the [block form](#the-block-form); its result replaces the tile |
| **Remove the tile** | removes the entry |

Other keys of a tile (`calm`, `confirm`, `labels`…) are set in YAML and kept by the window.

### Summary badges

**Open:** on Home, three dots → **Summary badges**. **Who:** administrators. **Writes:** `shortcuts`, at once.

It lists the shortcuts with a pencil and arrows for their order, **Media categories**, and **New block**: Status,
Departures, App, News, Machines, Block and Page. A School block is added in YAML and then edited here. A renamed
shortcut keeps its rules in `access` and `visibility`; someone's own order and hiding of chips need setting again.

### The block form

**Open:** the pencil in Summary badges, a new block there, or **Edit the block** in the tile window.
**Who:** administrators.

| Kind | Fields |
|---|---|
| all | Name, Small text above the name (`label`), Icon, Colour (`tone`) |
| Status (`overview`) | Sections: Title, Counts as needing a look (`alert`), Always at the bottom (`bottom`), Items |
| Departures | Entities, Notices (`news`) |
| App | App (`addon`), Web page (`frame`) |
| News | Sections: Title, Entity |
| Machines (`host`) | Machines: Title, Icon, Subtitle, Status entity, Bars, Details, Machines inside, Graph card |
| Block (`panel`) | Entity, Open on the whole screen, Numbers at the top, Buttons, Groups, Card, Show the card |
| | at once, Only the card, Web page |
| Page | Page |
| School | Children, Sensors (`sources`, YAML) |

An item of Status has **Shown when**: an entity is in a state, a value is below a limit, a battery is low, a list is not
empty, a device works or always (text). Each kind brings its own fields, and every item has **Also as a warning on
Home** (`notify`), days of the week and months. Options the form does not know stay in the block untouched, and an
empty field is left out. **Remove the block** asks for a second tap.

### Media categories

**Open:** Summary badges → **Media categories**. **Who:** administrators. **Writes:** `media.sections`: sections
with a title and tiles (Name, Entity, Icon, Kind `tv` or `panel`, Turning on and off as YAML).

### Edit the menu

**Open:** at the bottom of the side menu, **Edit the menu**. **Who:** administrators. **Writes:** `menu.groups`: groups
with a title and entries (Name, Icon, App, Address, Shortcut, Action, Administrators only, Who sees it, Hide in guest
mode). Until the first save the form starts from the menu shown now.

### My layout

**Open:** on Home, three dots → **My layout**. **Who:** everyone. **Writes:** your user data, at once.

Tabs: Cameras, Areas, Chips, Scenes, Favorites (order, hiding, adding by search) and Menu (hiding). At the bottom:
**Open this dashboard at start on my devices** and **Restore the shared layout**. On Areas and Favorites an
administrator can tick **For everyone**; **Save for everyone** then writes `rooms.order`, `rooms.hidden` and
`favorites`.

### My view

**Open:** in a room, three dots → **My view**. **Who:** everyone. **Writes:** your user data: hidden sections and
tiles of this room, the Scenes row included. **Show everything in this room** brings them back.

### User access

**Open:** three dots → **User access**. **Who:** administrators. **Writes:** `access`, with **Save**.

Choose a person or **Everyone but me** (every other account that exists now). Tabs: Cameras, Areas (`rooms`), Sections
(`sections`), Chips (the weather, the chips and the shortcuts), Lights, Media, Security, Scenes and scripts, Other
(other entities and blocks). Everything except Areas and Sections goes to `hide`.

### Background of this screen

**Open:** on Home, in a room, on the Scenes page, the Map or Energy: three dots → **Background of this screen**.
**Who:** everyone. **Writes:** your user data; with **For everyone** (administrators) `backgrounds.<page>`.

A gradient, a colour or a picture for the light and the dark look, **Upright / Wide** for the shape, and **Part of the
picture** (`position`). At the top, your look: System, Light or Dark, kept in your user data.

### Look

**Open:** side menu → **Look**. **Who:** everyone. **Writes:** your user data; an administrator with **For everyone**
ticked writes `appearance` with **Save for everyone**.

| Tab | Keys of `appearance` |
|---|---|
| **Background** | `background_strength`, `bounce`, `page.*`, `map.*` |
| **Buttons** | `tiles.opacity`, `tiles.radius`, `tiles.fill`, `tiles.colours` |
| **Colours** | `text.*`, `tiles.background`, `text`, `icon`, `icon_background`, `chips.*`, `buttons.*`, `badges.*` |
| **Bar** | `nav.*`, `status.*`, `player.*` |
| **Windows** | `sheets.*` |
| **Icons** | `icons` |
| **Themes** (with For everyone) | `themes`, `theme`, and `appearance` and `backgrounds` when a theme is used |

**Back to the look for everyone** removes your own changes.

### Device settings and the pencil

The gear of a device window lists its other entities in tabs (Settings, State, Actions, Activity); nothing is
written to the configuration. A camera's gear takes its entities from `cameras.settings` when set. The pencil
(administrators) changes the name, area, labels and whether the device is enabled in Home Assistant itself. See the
guide: [Settings and editing of a device](guide.md#settings-and-editing-of-a-device).

## 14. Which window a tile opens

| Entity | A tap on the tile | The round icon |
|---|---|---|
| `light` | the lamp window: brightness, colour, white | toggles |
| `switch`, `input_boolean` | the switch window; with a power sensor on its device also a power chart | toggles |
| `automation` | the switch window with when it last ran | toggles |
| `fan` | Home Assistant's window | toggles |
| `cover` | the blind window | |
| `climate` | the thermostat window | |
| `lock` | the lock slider; on a tablet only locking, unless `security.unlock_on_tablet` | |
| `lock` with a code | Home Assistant's window on a phone; nothing on a tablet unless unlocking is allowed | |
| `alarm_control_panel` | the alarm modes; with a code Home Assistant's window | |
| `media_player` | the player window | |
| `binary_sensor` | its state, when it changed, the device battery and a strip of when it was on | |
| `select`, `input_select` | the options as buttons; `labels` and `confirm` of the tile apply | |
| `sensor` with a number and a unit or state class | the value and its chart | |
| `scene`, `script`, `button` | runs at once, the tile shows a tick; unavailable: Home Assistant's window | |
| anything else (`vacuum`, `number`, text `sensor`…) | Home Assistant's window | |

Keys of the tile change it: `tap_toggle`, `action` and `turn_on_only` run without a window,
`entities.overrides.<id>.card` opens the card, and `kind: tv`, `kind: panel`, `kind: scale` and `kind: host` open
their own windows. Every device window has the gear (settings of the device) and, for administrators, the pencil.

## 15. What is kept per person and per device

Per person, in the user data `home_dashboard` (on all devices of the account):

| What | Window |
|---|---|
| order and hiding of cameras, areas, chips, scenes; favorites; hidden menu entries | My layout |
| open the dashboard at start | My layout |
| hidden sections and tiles of a room | My view |
| own backgrounds and System / Light / Dark | Background of this screen |
| own look | Look |
| warnings muted for a week | Dashboard settings |

Per device, in the browser:

| What | Window |
|---|---|
| open the dashboard at start on this device | Dashboard settings |
| the configuration before the last save | Edit configuration |
| columns and layout of all cameras chosen on this tablet | the window of all cameras |
| warning cards closed today | the cross on a card |
| the folded status bar | the button of the status bar |
