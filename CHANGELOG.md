# Changelog

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
