# What changed most

The most important work on the dashboard itself, from the first version (0.1.0, 6 November 2026) to now, grouped by
what it gives. Every detail is in the [changelog](changelog.md); the editor's way to the common standard is on
[One standard](standard.md).

## Speed and a tab open all day {#performance}

- **The page takes the changes of Home Assistant at most twice a second** (the first at once, the last always), not
  on each of the many changes a second of power meters; a hidden tab every 10 s and the newest as soon as it is shown.
  On a home of 4600 entities the main thread went from about **30 % to 8 %** (1.0.4).
- The cameras find their battery, live view and stream sensors in an index of the entities of each device, made once,
  instead of going through every entity of the house for each camera (1.0.4).
- A hidden tab streams no camera, a closed window closes its sound (1.0.4).
- The sheet, 8500 lines in one file, was split into modules by kind of window (0.7.0).
- The status bar keeps its lines of power when a read fails and tries again after 30 s (1.0.3).

## One look everywhere {#look}

- The dashboard's own windows for nearly everything: sensors, lists, automations, plugs with their power, the
  logbook and history, the Energy page with its charts, so nobody lands in the plain screens of Home Assistant
  (0.4.0–0.6.0).
- Themes: **Home Dashboard** and **Apple Home**, the look set in the dashboard and kept as a theme to share; windows
  in milky colours that fit any background, thick rounded sliders (1.0.3); a background maker for photos and
  gradients (1.0.0–1.0.2).
- **A camera window for automations** (`home_dashboard.show_camera`): motion on the cameras and the doorbell open the
  dashboard's own camera window on the tablet in the hall, with the picture of the event or live at once, closing by
  itself; a notification opens the same window. It replaced the popups of Browser Mod that looked like the old
  dashboard.
- **One button to turn off**: the window of a switch, a plug, a switch of a lamp or an automation has the round power
  button of a light's window; a test checks it is seen without scrolling on phones and tablets.
- **Esc on a computer** closes the open window as its ✕ does, a small window inside it first.

## A tablet on the wall {#tablet}

- A status bar for a tablet on its side: the time, the weather, calendars, power, warnings, At home with lights,
  devices, open doors and windows, flags (0.4.0–1.0.2).
- Cameras: a wall of all cameras with one big live camera, pinch to zoom, quick buttons (siren, light, night vision),
  turning, talking through the camera, recordings on the disk and on the camera's card with a line of time (0.2.0–0.4.0).
- The menu of the dashboard slides with the finger from the left edge in the Home Assistant app; the menu of Home
  Assistant is hidden by its kiosk mode and comes back on every other page, never saved as the user's choice (1.0.3).
- Blocks for machines and devices: a washer, a dryer, a scale, a power station, a console with its quick button, PIN
  for a parent's limits, steppers (0.5.0–1.0.0).

## Editing {#editing}

- **The editor on a computer** (1.0.0): the tree of the dashboard, forms for every setting, a live preview of an
  iPhone and an iPad (as another person, light or dark), a draft that changes nothing until it is published, a
  version for one person to check, a history of 30 versions, undo and redo.
- Pictures and backgrounds chosen in a window, a picker of tiles from every entity of the home, blocks added from the
  tree (1.0.0–1.0.1).

## Documentation and trying it {#docs}

- A documentation site in English and Polish on GitHub Pages (1.0.1), a full reference of the configuration (0.7.0),
  a guide to the editor from zero to a finished dashboard (1.0.0), a gallery of screenshots of a made-up home.
- **Try it with Docker only**: `make demo` runs a test Home Assistant with the dashboard on the computer.

## Checked on a real home {#tests}

- Every window was opened on a real home, on a phone and a tablet, in Chrome and WebKit (Safari) (0.7.0).
- About 2000 tests: the integration and the documentation (156), the demo image (1) and the dashboard and the editor
  in Chrome (1820), on phones and tablets upright and on their side.
