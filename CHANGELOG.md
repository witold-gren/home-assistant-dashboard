# Changelog

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
