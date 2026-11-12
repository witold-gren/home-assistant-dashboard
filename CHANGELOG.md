# Changelog

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
