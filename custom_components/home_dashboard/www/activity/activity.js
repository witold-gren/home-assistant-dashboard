// The panel "Household activity" (administrators; its data only for the owner of Home Assistant or the people
// chosen in the integration's options), laid out as the History and Logbook of Home Assistant: the filters on the
// left (people, kinds), a range of time on top, and one timeline of everybody chosen, day by day.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";

const TAG = "home-dashboard-activity";
const DOCS = "https://witold-gren.github.io/home-assistant-dashboard/";
const STORED_PEOPLE = "home-dashboard-activity-people";
const STORED_KINDS = "home-dashboard-activity-kinds";
const STORED_GROUPS = "home-dashboard-activity-groups";
const STORED_ROOMS = "home-dashboard-activity-rooms";
const STORED_FOLDED = "home-dashboard-activity-folded";
// The kinds of devices to filter by, from the domain of an entity; anything else is "other".
const GROUPS = {
  lights: ["light"],
  switches: ["switch", "input_boolean"],
  covers: ["cover"],
  buttons: ["button", "input_button", "scene"],
  cameras: ["camera", "image"],
  climate: ["climate", "fan", "humidifier", "water_heater"],
  security: ["lock", "alarm_control_panel"],
  media: ["media_player", "remote"],
  automations: ["automation", "script"],
};
const GROUP_ICONS = {
  lights: "mdi:lightbulb-outline",
  switches: "mdi:toggle-switch-outline",
  covers: "mdi:blinds",
  buttons: "mdi:gesture-tap-button",
  cameras: "mdi:cctv",
  climate: "mdi:thermostat",
  security: "mdi:lock-outline",
  media: "mdi:television",
  automations: "mdi:robot-outline",
  other: "mdi:shape-outline",
};
const NO_ROOM = "-";
const HOUR = 3600 * 1000;
const COLOURS = ["#039be5", "#e64a19", "#43a047", "#8e24aa", "#fbc02d", "#00897b", "#d81b60", "#5e35b1", "#6d4c41"];
const KINDS = ["page", "window", "change"];
// Entities whose state is the moment they were used: the change is "pressed" or "run", not a date.
const MOMENT_DOMAINS = new Set(["button", "input_button", "scene", "event"]);
const PAGE_NAMES = { home: "page_home", room: "page_room", media: "page_media", music: "page_music", energy: "page_energy", map: "page_map" };

// The windows of the dashboard by the kind it tells (usage.js windowName): an icon and a name a person reads.
const WINDOWS = {
  menu: ["mdi:menu", "Side menu", "Menu boczne"],
  settings: ["mdi:cog-outline", "Dashboard settings", "Ustawienia dashboardu"],
  household: ["mdi:account-clock-outline", "Household activity", "Aktywność domowników"],
  notifications: ["mdi:bell-outline", "Notifications", "Powiadomienia"],
  rooms: ["mdi:floor-plan", "Rooms", "Wybór pokoju"],
  cameras: ["mdi:cctv", "All cameras", "Wszystkie kamery"],
  camera: ["mdi:cctv", "Camera", "Kamera"],
  sd: ["mdi:sd", "Recordings on the camera's card", "Nagrania z karty kamery"],
  disk: ["mdi:harddisk", "Recordings on the disk", "Nagrania z dysku"],
  intercom: ["mdi:account-voice", "Intercom", "Interkom"],
  light: ["mdi:lightbulb-outline", "Light", "Światło"],
  switch: ["mdi:toggle-switch-outline", "Switch", "Przełącznik"],
  cover: ["mdi:blinds", "Blind", "Roleta"],
  climate: ["mdi:thermostat", "Heating and cooling", "Ogrzewanie i klimatyzacja"],
  lock: ["mdi:lock-outline", "Lock", "Zamek"],
  alarm: ["mdi:shield-home-outline", "Alarm", "Alarm"],
  player: ["mdi:play-circle-outline", "Player", "Odtwarzacz"],
  tv: ["mdi:television", "TV", "Telewizor"],
  binary: ["mdi:checkbox-blank-circle-outline", "Sensor", "Czujnik"],
  sensor: ["mdi:gauge", "Sensor", "Czujnik"],
  select: ["mdi:form-select", "Choice", "Wybór"],
  group: ["mdi:group", "Group", "Grupa"],
  chart: ["mdi:chart-line", "Chart", "Wykres"],
  panel: ["mdi:view-grid-outline", "Panel", "Panel"],
  pin: ["mdi:dialpad", "PIN code", "Kod PIN"],
  scale: ["mdi:scale-bathroom", "Scale", "Waga"],
  school: ["mdi:school-outline", "School", "Szkoła"],
  weather: ["mdi:weather-partly-cloudy", "Weather", "Pogoda"],
  departures: ["mdi:bus-clock", "Departures", "Odjazdy"],
  news: ["mdi:newspaper-variant-outline", "News", "Wiadomości"],
  calendar: ["mdi:calendar", "Calendar", "Kalendarz"],
  app: ["mdi:application-outline", "App", "Aplikacja"],
  page: ["mdi:web", "Page", "Strona"],
  overview: ["mdi:view-dashboard-outline", "Overview", "Podsumowanie"],
  host: ["mdi:server", "Server", "Serwer"],
  history: ["mdi:chart-timeline-variant", "History", "Historia"],
  logbook: ["mdi:format-list-bulleted", "Logbook", "Dziennik"],
  blocks: ["mdi:shape-outline", "Summary badges", "Odznaki podsumowania"],
  "status-on": ["mdi:power", "On now", "Włączone teraz"],
  personal: ["mdi:account-cog-outline", "My layout", "Mój układ"],
  "room-view": ["mdi:account-cog-outline", "My view", "Mój widok"],
  variants: ["mdi:layers-triple-outline", "Variant of the page", "Wariant strony"],
  look: ["mdi:palette-outline", "Look", "Wygląd"],
  background: ["mdi:image-outline", "Background of the screen", "Tło ekranu"],
  access: ["mdi:account-key-outline", "User access", "Dostęp użytkowników"],
  "device-edit": ["mdi:pencil-outline", "Editing a device", "Edycja urządzenia"],
  "tile-edit": ["mdi:pencil-outline", "Editing a tile", "Edycja kafelka"],
  "tile-picker": ["mdi:plus-box-outline", "Adding a tile", "Dodawanie kafelka"],
  "block-edit": ["mdi:pencil-outline", "Editing a block", "Edycja bloku"],
};

const TEXTS = {
  en: {
    title: "Household activity",
    help: "Guide",
    people: "People",
    live: "Live",
    search: "Search a device, a window, a person…",
    devices_filter: "Devices",
    rooms: "Rooms",
    no_room: "No room",
    all: "All",
    none: "None",
    lights: "Lights",
    switches: "Switches",
    covers: "Blinds and covers",
    buttons: "Buttons and scenes",
    cameras: "Cameras",
    climate: "Climate",
    security: "Locks and alarm",
    media: "Media",
    automations: "Automations and scripts",
    other: "Other",
    kinds: "Kind",
    page: "Pages",
    window: "Windows",
    change: "Changes",
    filters: "Filters",
    everybody: "Everybody",
    nobody: "Nobody",
    loading: "Loading…",
    nothing: "Nothing in this time for the people chosen.",
    choose: "Choose a person on the left.",
    not_allowed: "Only the owner of Home Assistant sees the activity of the household (or the people chosen in the options of Home Dashboard).",
    failed: "Could not read the activity: {error}",
    today: "Today",
    yesterday: "Yesterday",
    last_hour: "Last hour",
    last_12: "Last 12 hours",
    last_24: "Last 24 hours",
    last_7: "Last 7 days",
    last_30: "Last 30 days",
    from: "From",
    to: "To",
    cancel: "Cancel",
    pick: "Choose",
    earlier: "Earlier",
    later: "Later",
    opened_page: "Page",
    opened_window: "Window",
    switched: "Changed",
    pressed: "pressed",
    last_used: "last used {when}",
    no_device: "no device",
    ios_app: "iOS app",
    android_app: "Android app",
    browser: "browser {host}",
    page_home: "Home",
    page_room: "Room {name}",
    page_media: "Media",
    page_music: "Music",
    page_energy: "Energy",
    page_map: "Map",
    kept: "Pages and windows are kept for {days} days, changes as long as the history of Home Assistant.",
  },
  pl: {
    title: "Aktywność domowników",
    help: "Przewodnik",
    people: "Osoby",
    live: "Na żywo",
    search: "Szukaj urządzenia, okna, osoby…",
    devices_filter: "Urządzenia",
    rooms: "Pokoje",
    no_room: "Bez pokoju",
    all: "Wszystkie",
    none: "Żadne",
    lights: "Oświetlenie",
    switches: "Przełączniki",
    covers: "Rolety i osłony",
    buttons: "Przyciski i sceny",
    cameras: "Kamery",
    climate: "Klimat",
    security: "Zamki i alarm",
    media: "Multimedia",
    automations: "Automatyzacje i skrypty",
    other: "Inne",
    kinds: "Typ",
    page: "Strony",
    window: "Okna",
    change: "Zmiany",
    filters: "Filtry",
    everybody: "Wszyscy",
    nobody: "Nikt",
    loading: "Wczytywanie…",
    nothing: "W tym czasie wybrane osoby nic nie robiły.",
    choose: "Wybierz osobę po lewej.",
    not_allowed: "Aktywność domowników widzi tylko właściciel Home Assistant (albo osoby wybrane w opcjach Home Dashboard).",
    failed: "Nie udało się odczytać aktywności: {error}",
    today: "Dziś",
    yesterday: "Wczoraj",
    last_hour: "Poprzednia godzina",
    last_12: "Poprzednie 12 godzin",
    last_24: "Poprzednie 24 godziny",
    last_7: "Poprzednie 7 dni",
    last_30: "Poprzednie 30 dni",
    from: "Od",
    to: "Do",
    cancel: "Anuluj",
    pick: "Wybierz",
    earlier: "Wcześniej",
    later: "Później",
    opened_page: "Strona",
    opened_window: "Okno",
    switched: "Zmiana",
    pressed: "naciśnięto",
    last_used: "ostatnio {when}",
    no_device: "bez urządzenia",
    ios_app: "aplikacja iOS",
    android_app: "aplikacja Android",
    browser: "przeglądarka {host}",
    page_home: "Strona główna",
    page_room: "Pokój {name}",
    page_media: "Media",
    page_music: "Muzyka",
    page_energy: "Energia",
    page_map: "Mapa",
    kept: "Strony i okna są przechowywane {days} dni, zmiany tak długo jak historia Home Assistant.",
  },
};

const fill = (text, values) => Object.entries(values).reduce((out, [name, value]) => out.replace(`{${name}}`, value), text);

function readStored(key) {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // A browser that keeps nothing: the choice lasts until the page is closed.
  }
}

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** The ranges offered at once, as Home Assistant's History offers them: [start, end) of the computer's time. */
export function presetRange(name, now = new Date()) {
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 24 * HOUR);
  switch (name) {
    case "today":
      return [today, tomorrow];
    case "yesterday":
      return [new Date(today.getTime() - 24 * HOUR), today];
    case "last_hour":
      return [new Date(now.getTime() - HOUR), now];
    case "last_12":
      return [new Date(now.getTime() - 12 * HOUR), now];
    case "last_24":
      return [new Date(now.getTime() - 24 * HOUR), now];
    case "last_7":
      return [new Date(now.getTime() - 7 * 24 * HOUR), now];
    case "last_30":
      return [new Date(now.getTime() - 30 * 24 * HOUR), now];
    default:
      return [today, tomorrow];
  }
}

/** The kind of device of an entity (a key of GROUPS, or "other"); null without an entity. */
export function groupOf(entityId) {
  if (!entityId) return null;
  const domain = String(entityId).split(".")[0];
  return Object.entries(GROUPS).find(([, domains]) => domains.includes(domain))?.[0] ?? "other";
}

/** The room (area) of an entity: its own, or its device's; NO_ROOM without one, null without an entity. */
export function roomOf(hass, entityId) {
  if (!entityId) return null;
  const entry = hass?.entities?.[entityId];
  return entry?.area_id ?? hass?.devices?.[entry?.device_id]?.area_id ?? NO_ROOM;
}

/** A name written twice by Home Assistant ("Pokój Adama Roleta Pokój Adama Roleta") once. */
export function onceName(name) {
  const text = String(name ?? "").trim();
  const words = text.split(/\s+/);
  if (words.length % 2 === 0) {
    const half = words.length / 2;
    if (words.slice(0, half).join(" ") === words.slice(half).join(" ")) return words.slice(0, half).join(" ");
  }
  return text;
}

/** A device of a person in a few words: the Home Assistant app, or a browser with its address. */
export function deviceName(name, texts) {
  const text = String(name ?? "");
  if (/home-assistant\.io\/iOS/i.test(text)) return texts.ios_app;
  if (/home-assistant\.io\/android/i.test(text)) return texts.android_app;
  const host = /^https?:\/\/([^/]+)/.exec(text)?.[1];
  return host ? fill(texts.browser, { host }) : text || texts.no_device;
}

/** A day heading: Today · 17 November 2026. */
function dayHeading(day, now, texts, locale) {
  const date = day.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const today = startOfDay(now).getTime();
  if (day.getTime() === today) return `${texts.today} · ${date}`;
  if (day.getTime() === today - 24 * HOUR) return `${texts.yesterday} · ${date}`;
  return day.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const pad2 = (number) => String(number).padStart(2, "0");
// A day as 2026-11-17 and a time as 09:05, in the browser's own time.
function dayKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function clock(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

class HomeDashboardActivity extends LitElement {
  static properties = {
    hass: { attribute: false },
    narrow: { type: Boolean },
    embedded: { type: Boolean, reflect: true },
    panel: { attribute: false },
    _start: { state: true },
    _end: { state: true },
    _data: { state: true },
    _problem: { state: true },
    _busy: { state: true },
    _chosen: { state: true },
    _kinds: { state: true },
    _groups: { state: true },
    _rooms: { state: true },
    _query: { state: true },
    _folded: { state: true },
    _isLive: { state: true },
    _picking: { state: true },
    _filtersOpen: { state: true },
  };

  constructor() {
    super();
    [this._start, this._end] = presetRange("today");
    this._data = null;
    this._problem = null;
    this._busy = false;
    this._chosen = readStored(STORED_PEOPLE);
    this._kinds = readStored(STORED_KINDS) ?? [...KINDS];
    // null: everything (also kinds and rooms that show up later); a list: only those.
    this._groups = readStored(STORED_GROUPS);
    this._rooms = readStored(STORED_ROOMS);
    this._query = "";
    this._folded = readStored(STORED_FOLDED) ?? [];
    this._isLive = false;
    this._picking = null;
    this._filtersOpen = false;
  }

  get _language() {
    return this.hass?.language?.startsWith("pl") ? "pl" : "en";
  }

  get _texts() {
    return TEXTS[this._language];
  }

  get _locale() {
    return this.hass?.locale?.language ?? this._language;
  }

  _t(key, values = {}) {
    return fill(this._texts[key] ?? TEXTS.en[key] ?? key, values);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopLive();
  }

  // Live: a range that reaches now takes each new page, window and change as it happens, as the Logbook does.
  _watchLive() {
    this._stopLive();
    const reachesNow = this._end.getTime() >= Date.now() - 60 * 1000;
    if (!reachesNow || !this.hass?.connection?.subscribeMessage) return;
    const from = this._start.getTime();
    this._liveWatch = this.hass.connection
      .subscribeMessage(
        (entry) => {
          // Also past the end of a range like "last hour", which ends at the moment it was chosen.
          if (!this._data || new Date(entry.at).getTime() < from) return;
          this._data = { ...this._data, entries: [...(this._data.entries ?? []), entry] };
        },
        { type: "home_dashboard/activity/subscribe" },
      )
      .then((unsubscribe) => {
        // Home Assistant took it: only now is the page live (an integration not restarted yet does not know it).
        if (this._liveWatch === watch) this._isLive = true;
        return unsubscribe;
      })
      .catch(() => {
        if (this._liveWatch === watch) this._isLive = false;
        return null;
      });
    const watch = this._liveWatch;
  }

  _stopLive() {
    this._liveWatch?.then((unsubscribe) => unsubscribe?.());
    this._liveWatch = null;
    this._isLive = false;
  }

  updated(changed) {
    if (changed.has("hass") && this.hass && !this._asked) {
      this._asked = true;
      this._load();
    }
  }

  async _load() {
    if (!this.hass) return;
    this._busy = true;
    this._problem = null;
    try {
      this._stopLive();
      this._data = await this.hass.callWS({
        type: "home_dashboard/activity/get",
        start: this._start.toISOString(),
        end: this._end.toISOString(),
      });
      this._watchLive();
    } catch (error) {
      this._data = null;
      this._problem = error?.code === "not_allowed" ? this._t("not_allowed") : this._t("failed", { error: error?.message ?? error });
    }
    this._busy = false;
  }

  _setRange(start, end) {
    this._start = start;
    this._end = end;
    this._picking = null;
    this._load();
  }

  _shift(direction) {
    const length = this._end.getTime() - this._start.getTime();
    this._setRange(new Date(this._start.getTime() + direction * length), new Date(this._end.getTime() + direction * length));
  }

  // People ---------------------------------------------------------------------------------------

  /** Everybody with something in the range, then the rest, each with a colour of their own. */
  get _people() {
    const people = (this._data?.people ?? []).map((person, index) => ({ ...person, colour: COLOURS[index % COLOURS.length] }));
    const counts = new Map();
    for (const entry of this._data?.entries ?? []) counts.set(entry.user_id ?? "", (counts.get(entry.user_id ?? "") ?? 0) + 1);
    return people
      .map((person) => ({ ...person, count: counts.get(person.id) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  /** The ids of the people shown: the ones chosen, or everybody before anything was chosen. */
  get _shownPeople() {
    const ids = this._people.map((person) => person.id);
    return this._chosen ? ids.filter((id) => this._chosen.includes(id)) : ids;
  }

  _togglePerson(id) {
    const shown = this._shownPeople;
    const next = shown.includes(id) ? shown.filter((one) => one !== id) : [...shown, id];
    this._chosen = next;
    writeStored(STORED_PEOPLE, next);
  }

  _everybody(on) {
    this._chosen = on ? this._people.map((person) => person.id) : [];
    writeStored(STORED_PEOPLE, this._chosen);
  }

  /** Tick or untick one of a list kept as null (everything) or the ids chosen. */
  _toggleIn(name, stored, id, all) {
    const current = this[name] ?? all;
    const next = current.includes(id) ? current.filter((one) => one !== id) : [...current, id];
    this[name] = next.length === all.length && all.every((one) => next.includes(one)) ? null : next;
    writeStored(stored, this[name]);
  }

  _setAll(name, stored, on) {
    this[name] = on ? null : [];
    writeStored(stored, this[name]);
  }

  _fold(section) {
    this._folded = this._folded.includes(section) ? this._folded.filter((one) => one !== section) : [...this._folded, section];
    writeStored(STORED_FOLDED, this._folded);
  }

  _roomName(id) {
    if (id === NO_ROOM) return this._t("no_room");
    return this.hass?.areas?.[id]?.name ?? id;
  }

  /** Whether an entry passes the filters other than the people (the kinds of devices, rooms and the search). */
  _matches(entry) {
    if (!this._kinds.includes(entry.kind)) return false;
    const group = groupOf(entry.entity_id);
    const room = roomOf(this.hass, entry.entity_id);
    // An entry without a device (a page, the menu) is left out once devices or rooms are narrowed.
    if (this._groups && !(group && this._groups.includes(group))) return false;
    if (this._rooms && !(room && this._rooms.includes(room))) return false;
    const query = this._query.trim().toLowerCase();
    if (!query) return true;
    const person = (this._data?.people ?? []).find((one) => one.id === entry.user_id)?.name ?? "";
    const [, what] = this._describe(entry);
    return [what, person, entry.entity_id ?? "", entry.name ?? "", room ? this._roomName(room) : ""]
      .join(" ")
      .toLowerCase()
      .includes(query);
  }

  _toggleKind(kind) {
    this._kinds = this._kinds.includes(kind) ? this._kinds.filter((one) => one !== kind) : [...this._kinds, kind];
    writeStored(STORED_KINDS, this._kinds);
  }

  // What an entry says -----------------------------------------------------------------------------

  _pageName(name) {
    const [page, ...rest] = String(name ?? "").split("/");
    const key = PAGE_NAMES[page];
    if (!key) return name;
    return this._t(key, { name: decodeURIComponent(rest.join("/")) || "" }).trim();
  }

  _entityName(entityId) {
    const state = this.hass?.states?.[entityId];
    return onceName(state?.attributes?.friendly_name ?? entityId);
  }

  _stateText(entry) {
    const domain = String(entry.entity_id ?? "").split(".")[0];
    if (MOMENT_DOMAINS.has(domain)) return this._t("pressed");
    const current = this.hass?.states?.[entry.entity_id];
    if (current && this.hass.formatEntityState) {
      try {
        return this.hass.formatEntityState({ ...current, state: entry.state }, entry.state);
      } catch {
        // An older Home Assistant: the raw state below.
      }
    }
    return entry.state;
  }

  /** A window: "camera: Iwiny Słup" reads "Iwiny Słup" as a Camera, "menu" reads "Side menu" as a Window. */
  _describeWindow(name) {
    const [kind, title] = String(name ?? "").split(/:\s(.+)/);
    const known = WINDOWS[kind];
    const kindName = known ? known[this._language === "pl" ? 2 : 1] : null;
    const icon = known?.[0] ?? "mdi:card-text-outline";
    if (title) return [kindName ?? this._t("opened_window"), onceName(title), icon];
    return [this._t("opened_window"), kindName ?? kind, icon];
  }

  /** The line of an entry: [kind label, what, icon]. */
  _describe(entry) {
    if (entry.kind === "page") return [this._t("opened_page"), this._pageName(entry.name), "mdi:view-dashboard-outline"];
    if (entry.kind === "window") return this._describeWindow(entry.name);
    const icon = this.hass?.states?.[entry.entity_id]?.attributes?.icon ?? "mdi:toggle-switch-outline";
    return [this._t("switched"), `${this._entityName(entry.entity_id)} → ${this._stateText(entry)}`, icon];
  }

  // Drawing ---------------------------------------------------------------------------------------

  _time(date, withSeconds = false) {
    return date.toLocaleTimeString(this._locale, { hour: "2-digit", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}) });
  }

  _rangeText() {
    const format = (date) => date.toLocaleString(this._locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    // A range up to midnight ends on the day before, as Home Assistant shows it (17 Nov 0:00 – 17 Nov 23:59).
    const midnight = this._end.getHours() === 0 && this._end.getMinutes() === 0;
    const end = midnight ? new Date(this._end.getTime() - 60 * 1000) : this._end;
    return `${format(this._start)} – ${format(end)}`;
  }

  _renderRange() {
    return html`<div class="range">
      <button class="arrow" aria-label=${this._t("earlier")} data-earlier @click=${() => this._shift(-1)}>
        <ha-icon icon="mdi:chevron-left"></ha-icon>
      </button>
      <button class="when" data-range @click=${() => this._openPicker()}>
        <ha-icon icon="mdi:calendar"></ha-icon><span>${this._rangeText()}</span>
      </button>
      <button class="arrow" aria-label=${this._t("later")} data-later @click=${() => this._shift(1)}>
        <ha-icon icon="mdi:chevron-right"></ha-icon>
      </button>
      ${this._picking ? this._renderPicker() : nothing}
    </div>`;
  }

  // The picker of the range: ready ranges on the left, a month on the right. The first tap on a day starts the range,
  // the second ends it (a whole day by default), and the hours fine-tune both ends.
  _openPicker() {
    if (this._picking) {
      this._picking = null;
      return;
    }
    const midnight = this._end.getHours() === 0 && this._end.getMinutes() === 0;
    const last = midnight ? new Date(this._end.getTime() - 60 * 1000) : this._end;
    this._picking = {
      fromDay: dayKey(this._start),
      toDay: dayKey(last),
      fromTime: clock(this._start),
      toTime: midnight ? "23:59" : clock(this._end),
      month: dayKey(new Date(this._start.getFullYear(), this._start.getMonth(), 1)),
      second: false,
    };
  }

  _pickedRange() {
    const { fromDay, toDay, fromTime, toTime } = this._picking;
    const start = new Date(`${fromDay}T${fromTime || "00:00"}`);
    const end = new Date(`${toDay}T${toTime || "23:59"}`);
    // 23:59 means to the end of that day.
    if ((toTime || "23:59") === "23:59") end.setMinutes(end.getMinutes() + 1);
    return { start, end };
  }

  _tapDay(key) {
    const picking = this._picking;
    if (!picking.second) {
      this._picking = { ...picking, fromDay: key, toDay: key, second: true };
      return;
    }
    const [fromDay, toDay] = key < picking.fromDay ? [key, picking.fromDay] : [picking.fromDay, key];
    this._picking = { ...picking, fromDay, toDay, second: false };
  }

  _shiftMonth(step) {
    const month = new Date(`${this._picking.month}T00:00`);
    month.setMonth(month.getMonth() + step);
    this._picking = { ...this._picking, month: dayKey(month) };
  }

  _renderMonth() {
    const { fromDay, toDay, month } = this._picking;
    const first = new Date(`${month}T00:00`);
    // Weeks start on Monday.
    const lead = (first.getDay() + 6) % 7;
    const days = Array.from({ length: 42 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), 1 - lead + index));
    const weeks = days[35].getMonth() === first.getMonth() ? 6 : 5;
    const today = dayKey(new Date());
    const names = Array.from({ length: 7 }, (_, index) =>
      new Date(2026, 10, 16 + index).toLocaleDateString(this._locale, { weekday: "narrow" }),
    );
    const title = first.toLocaleDateString(this._locale, { month: "long", year: "numeric" });
    const thisMonth = dayKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    return html`<div class="month" data-month=${month}>
      <div class="month-head">
        <button class="round" aria-label=${this._t("earlier")} data-month-prev @click=${() => this._shiftMonth(-1)}>
          <ha-icon icon="mdi:chevron-left"></ha-icon>
        </button>
        <strong>${title}</strong>
        <button class="round" aria-label=${this._t("later")} data-month-next ?disabled=${month >= thisMonth}
          @click=${() => this._shiftMonth(1)}>
          <ha-icon icon="mdi:chevron-right"></ha-icon>
        </button>
      </div>
      <div class="days">
        ${names.map((name) => html`<span class="weekday">${name}</span>`)}
        ${days.slice(0, weeks * 7).map((date) => {
          const key = dayKey(date);
          const classes = [
            date.getMonth() === first.getMonth() ? "" : "other",
            key > fromDay && key < toDay ? "in" : "",
            key === fromDay ? "from" : "",
            key === toDay ? "to" : "",
            key === today ? "today" : "",
          ].join(" ");
          return html`<button class="day-cell ${classes}" data-day=${key} ?disabled=${key > today} @click=${() => this._tapDay(key)}>
            <span>${date.getDate()}</span>
          </button>`;
        })}
      </div>
    </div>`;
  }

  _renderPicker() {
    const presets = ["today", "yesterday", "last_hour", "last_12", "last_24", "last_7", "last_30"];
    const time = (key) => (event) => (this._picking = { ...this._picking, [key]: event.target.value });
    const { start, end } = this._pickedRange();
    return html`<div class="shade" @click=${() => (this._picking = null)}></div>
      <div class="picker" role="dialog" data-picker>
        <ul class="presets">
          ${presets.map(
            (name) => html`<li><button data-preset=${name} @click=${() => this._setRange(...presetRange(name))}>${this._t(name)}</button></li>`,
          )}
        </ul>
        <div class="custom">
          ${this._renderMonth()}
          <div class="times">
            <label>${this._t("from")}<input type="time" data-from-time .value=${this._picking.fromTime} @change=${time("fromTime")} /></label>
            <label>${this._t("to")}<input type="time" data-to-time .value=${this._picking.toTime} @change=${time("toTime")} /></label>
          </div>
          <div class="buttons">
            <button class="text" @click=${() => (this._picking = null)}>${this._t("cancel")}</button>
            <button class="filled" data-pick ?disabled=${!(end > start)} @click=${() => this._setRange(start, end)}>${this._t("pick")}</button>
          </div>
        </div>
      </div>`;
  }

  _section(name, title, body) {
    const folded = this._folded.includes(name);
    return html`<section data-section=${name}>
      <h3><button class="fold" data-fold=${name} aria-expanded=${folded ? "false" : "true"} @click=${() => this._fold(name)}>
        <ha-icon icon=${folded ? "mdi:chevron-right" : "mdi:chevron-down"}></ha-icon>${title}
      </button></h3>
      ${folded ? nothing : body}
    </section>`;
  }

  _renderChoices(name, stored, choices) {
    const chosen = this[name];
    return html`<div class="all">
        <button class="text" data-all=${name} @click=${() => this._setAll(name, stored, true)}>${this._t("all")}</button>
        <button class="text" data-none=${name} @click=${() => this._setAll(name, stored, false)}>${this._t("none")}</button>
      </div>
      <ul>
        ${choices.map(
          ([id, label, count, icon]) => html`<li><label data-choice=${`${name}:${id}`}>
            <input type="checkbox" .checked=${!chosen || chosen.includes(id)}
              @change=${() => this._toggleIn(name, stored, id, choices.map(([one]) => one))} />
            ${icon ? html`<ha-icon class="choice-icon" .icon=${icon}></ha-icon>` : nothing}
            <span class="who"><b>${label}</b></span>
            <span class="count">${count}</span>
          </label></li>`,
        )}
      </ul>`;
  }

  /** The kinds of devices and the rooms of the entries in the range, with how many each has. */
  _devicesAndRooms() {
    const groups = new Map();
    const rooms = new Map();
    for (const entry of this._data?.entries ?? []) {
      const group = groupOf(entry.entity_id);
      if (!group) continue;
      groups.set(group, (groups.get(group) ?? 0) + 1);
      const room = roomOf(this.hass, entry.entity_id);
      rooms.set(room, (rooms.get(room) ?? 0) + 1);
    }
    const order = [...Object.keys(GROUPS), "other"];
    const groupChoices = order.filter((group) => groups.has(group)).map((group) => [group, this._t(group), groups.get(group), GROUP_ICONS[group]]);
    const roomChoices = [...rooms.entries()]
      .map(([room, count]) => [room, this._roomName(room), count, null])
      .sort((a, b) => (a[0] === NO_ROOM) - (b[0] === NO_ROOM) || a[1].localeCompare(b[1]));
    return [groupChoices, roomChoices];
  }

  _renderFilters(people) {
    const shown = this._shownPeople;
    const [groups, rooms] = this._devicesAndRooms();
    return html`<aside class="filters ${this._filtersOpen ? "open" : ""}">
      ${this._section("people", this._t("people"), html`
        <div class="all">
          <button class="text" data-everybody @click=${() => this._everybody(true)}>${this._t("everybody")}</button>
          <button class="text" data-nobody @click=${() => this._everybody(false)}>${this._t("nobody")}</button>
        </div>
        <ul>
          ${people.map((person) => {
            const latest = [...(person.devices ?? [])].sort((a, b) => String(b.last_used_at).localeCompare(String(a.last_used_at)))[0];
            return html`<li>
              <label data-person=${person.id}>
                <input type="checkbox" class="person-box" style="--tick:${person.colour}" .checked=${shown.includes(person.id)}
                  @change=${() => this._togglePerson(person.id)} />
                <span class="who"><b>${person.name}</b>
                  <small>${latest ? `${deviceName(latest.name, this._texts)} · ${this._t("last_used", { when: latest.last_used_at ? new Date(latest.last_used_at).toLocaleString(this._locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–" })}` : this._t("no_device")}</small>
                </span>
                <span class="count" data-count>${person.count}</span>
              </label>
            </li>`;
          })}
        </ul>`)}
      ${this._section("kinds", this._t("kinds"), html`
        <ul>
          ${KINDS.map(
            (kind) => html`<li><label data-kind=${kind}>
              <input type="checkbox" .checked=${this._kinds.includes(kind)} @change=${() => this._toggleKind(kind)} />
              <span class="who"><b>${this._t(kind)}</b></span>
            </label></li>`,
          )}
        </ul>`)}
      ${groups.length ? this._section("devices", this._t("devices_filter"), this._renderChoices("_groups", STORED_GROUPS, groups)) : nothing}
      ${rooms.length ? this._section("rooms", this._t("rooms"), this._renderChoices("_rooms", STORED_ROOMS, rooms)) : nothing}
      ${this._data ? html`<p class="hint">${this._t("kept", { days: this._data.retention_days })}</p>` : nothing}
    </aside>`;
  }

  _renderTimeline(people) {
    const colour = new Map(people.map((person) => [person.id, person]));
    const shown = new Set(this._shownPeople);
    const entries = (this._data?.entries ?? [])
      .filter((entry) => shown.has(entry.user_id ?? "") && this._matches(entry))
      .map((entry) => ({ ...entry, date: new Date(entry.at) }))
      .sort((a, b) => b.date - a.date);
    if (!shown.size) return html`<p class="hint empty" data-choose>${this._t("choose")}</p>`;
    if (!entries.length) return html`<p class="hint empty" data-nothing>${this._t("nothing")}</p>`;
    const now = new Date();
    const days = [];
    for (const entry of entries) {
      const day = startOfDay(entry.date).getTime();
      if (days.at(-1)?.day !== day) days.push({ day, entries: [] });
      days.at(-1).entries.push(entry);
    }
    return days.map(
      (group) => html`<h2 class="day">${dayHeading(new Date(group.day), now, this._texts, this._locale)}</h2>
        <ol class="timeline">
          ${group.entries.map((entry) => {
            const person = colour.get(entry.user_id ?? "");
            const [label, what, icon] = this._describe(entry);
            return html`<li data-entry=${entry.kind} data-who=${entry.user_id ?? ""}>
              <time>${this._time(entry.date, true)}</time>
              <span class="badge" style="--person:${person?.colour ?? "#9e9e9e"}"><ha-icon .icon=${icon}></ha-icon></span>
              <span class="line">
                <b>${what}</b>
                <small>${person?.name ?? "?"} · ${label}${entry.device ? html` · ${deviceName(entry.device, this._texts)}` : nothing}</small>
              </span>
            </li>`;
          })}
        </ol>`,
    );
  }

  render() {
    const people = this._people;
    const docs = `${DOCS}${this._language === "pl" ? "pl/" : ""}guide/#household-activity`;
    return html`
      <div class="bar">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <h1>${this._t("title")}</h1>
        <a class="help" href=${docs} target="_blank" rel="noopener" title=${this._t("help")} data-docs>?</a>
      </div>
      <div class="layout">
        ${this._renderFilters(people)}
        <main>
          <div class="top">
            <button class="filters-button" data-filters @click=${() => (this._filtersOpen = !this._filtersOpen)}>
              <ha-icon icon="mdi:tune-variant"></ha-icon>${this._t("filters")}
            </button>
            ${this._renderRange()}
            ${this._isLive ? html`<span class="live" data-live>${this._t("live")}</span>` : nothing}
            <label class="search">
              <ha-icon icon="mdi:magnify"></ha-icon>
              <input type="search" data-search placeholder=${this._t("search")} .value=${this._query}
                @input=${(event) => (this._query = event.target.value)} />
            </label>
          </div>
          ${this._problem ? html`<p class="problem" data-problem>${this._problem}</p>` : nothing}
          ${this._busy && !this._data ? html`<p class="hint">${this._t("loading")}</p>` : nothing}
          ${this._data ? this._renderTimeline(people) : nothing}
        </main>
      </div>
    `;
  }

  static styles = css`
    :host {
      --act-text: var(--primary-text-color);
      --act-muted: var(--secondary-text-color);
      --act-bg: var(--primary-background-color);
      --act-card: var(--card-background-color);
      --act-soft: var(--secondary-background-color);
      --act-side: var(--sidebar-background-color, var(--card-background-color));
      --act-accent: var(--primary-color);
      --act-accent-ink: var(--text-primary-color, #fff);
      --act-check: var(--primary-color, #3b82f6);
      display: block;
      height: 100vh;
      color: var(--act-text);
      background: var(--act-bg);
      font-family: var(--ha-font-family-body, system-ui, sans-serif);
      --line: var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    /* In a window of Home Dashboard: its colours, its header, and the window scrolls. */
    :host([embedded]) {
      --act-text: var(--hd-text);
      --act-muted: var(--hd-text-muted);
      --act-bg: transparent;
      --act-card: transparent;
      --act-soft: var(--hd-off);
      --act-side: transparent;
      --act-accent: var(--hd-accent);
      --act-accent-ink: var(--hd-accent-ink);
      --act-check: #3b82f6;
      --line: var(--hd-outline);
      height: auto;
      background: none;
    }
    :host([embedded]) .bar {
      display: none;
    }
    /* The cards are see-through in the window, the picker of the range lies over the timeline: it stays solid, white in
       the light look and dark in the dark one, whatever glass the window has. */
    :host([embedded]) .picker {
      --act-text: var(--hd-plain-text, #e4e4ea);
      --act-muted: var(--hd-plain-muted, #a3a6ae);
      --act-soft: var(--hd-plain-off, #2b2d33);
      --act-accent: var(--hd-plain-text, #e4e4ea);
      --act-accent-ink: var(--hd-plain-surface, #1e1f24);
      --line: var(--hd-plain-outline, #3a3c43);
      color: var(--act-text);
      color-scheme: var(--hd-plain-scheme, dark);
      background: var(--hd-plain-surface, #1e1f24);
    }
    :host([embedded]) .layout {
      height: auto;
      min-height: 60vh;
    }
    :host([embedded]) .filters,
    :host([embedded]) main {
      overflow: visible;
    }
    /* The window scrolls everything: the filters push the rest down instead of lying over it, and the bar of the range
       stays in its place (sticky, it lay over the filters and the timeline). */
    :host([embedded]) .top {
      position: static;
      background: none;
    }
    :host([embedded]) .filters.open {
      max-height: none;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 56px;
      padding: 0 12px;
      border-bottom: 1px solid var(--line);
      background: var(--app-header-background-color, var(--act-bg));
      color: var(--app-header-text-color, var(--act-text));
      box-sizing: border-box;
    }
    h1 {
      flex: 1;
      margin: 0 0 0 8px;
      font-size: 20px;
      font-weight: 400;
    }
    .help {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      color: inherit;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid currentColor;
    }
    .layout {
      display: grid;
      grid-template-columns: 320px 1fr;
      height: calc(100vh - 56px);
    }
    .filters {
      overflow: auto;
      border-right: 1px solid var(--line);
      background: var(--act-side, var(--act-card));
    }
    .filters section {
      padding: 12px 16px;
      border-bottom: 1px solid var(--line);
    }
    h3 {
      margin: 4px 0 8px;
      font-size: 15px;
      font-weight: 500;
    }
    ul,
    ol {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .filters label {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 8px 4px;
      border-radius: 10px;
      cursor: pointer;
    }
    .filters label:hover {
      background: var(--act-soft);
    }
    .filters [data-kind],
    .filters [data-choice] {
      grid-template-columns: auto 1fr auto;
    }
    .fold {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      padding: 0;
      font-size: 15px;
      font-weight: 500;
      text-align: left;
    }
    .choice-icon {
      --mdc-icon-size: 20px;
      color: var(--act-muted);
    }
    .filters label:has(.choice-icon) {
      grid-template-columns: auto auto 1fr auto;
    }
    .live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 14px;
      font-size: 14px;
      color: var(--success-color, #43a047);
      background: color-mix(in srgb, var(--success-color, #43a047) 12%, transparent);
    }
    .live::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      animation: blink 1.6s ease-in-out infinite;
    }
    @keyframes blink {
      50% {
        opacity: 0.3;
      }
    }
    .search {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 8px;
      min-width: 220px;
      max-width: 520px;
      padding: 0 14px;
      border: 1px solid var(--line);
      border-radius: 14px;
      color: var(--act-muted);
    }
    .search input {
      flex: 1;
      min-width: 0;
      padding: 12px 0;
      font: inherit;
      color: var(--act-text);
      background: none;
      border: none;
      outline: none;
    }
    .who {
      display: grid;
      min-width: 0;
    }
    .who small {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .count {
      font-variant-numeric: tabular-nums;
      color: var(--act-muted);
    }
    .all {
      display: flex;
      gap: 4px;
      margin-bottom: 4px;
    }
    /* Own boxes, round: a see-through circle with a light ring, filled with a white tick when chosen (blue, or the
       colour of a person). */
    input[type="checkbox"] {
      --tick: var(--act-check);
      appearance: none;
      -webkit-appearance: none;
      display: grid;
      place-content: center;
      flex: none;
      width: 26px;
      height: 26px;
      margin: 0;
      border: 2.5px solid color-mix(in srgb, var(--act-text) 45%, transparent);
      border-radius: 50%;
      background: color-mix(in srgb, var(--act-text) 10%, transparent);
      cursor: pointer;
      transition:
        background 0.18s ease,
        border-color 0.18s ease,
        transform 0.12s ease;
    }
    input[type="checkbox"]::after {
      content: "";
      width: 6px;
      height: 12px;
      margin-top: -3px;
      border: solid #fff;
      border-width: 0 2.5px 2.5px 0;
      border-radius: 1px;
      transform: rotate(45deg) scale(0);
      transition: transform 0.18s ease;
    }
    input[type="checkbox"]:checked {
      border-color: transparent;
      background: var(--tick);
    }
    input[type="checkbox"]:checked::after {
      transform: rotate(45deg) scale(1);
    }
    input[type="checkbox"]:active {
      transform: scale(0.92);
    }
    input[type="checkbox"]:focus-visible {
      outline: 2px solid var(--tick);
      outline-offset: 2px;
    }
    @media (hover: hover) {
      .filters label:hover input[type="checkbox"]:not(:checked) {
        background: color-mix(in srgb, var(--act-text) 18%, transparent);
      }
    }
    small,
    .hint {
      color: var(--act-muted);
    }
    .hint {
      padding: 0 16px;
      font-size: 13px;
    }
    .empty {
      padding: 32px 24px;
      font-size: 15px;
    }
    main {
      overflow: auto;
    }
    .top {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--line);
      background: var(--act-bg);
    }
    button {
      font: inherit;
      color: inherit;
      background: none;
      border: none;
      cursor: pointer;
    }
    .range {
      position: relative;
      display: inline-flex;
      align-items: stretch;
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: visible;
    }
    .range .arrow {
      display: grid;
      place-items: center;
      width: 44px;
    }
    .range .when {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      border-left: 1px solid var(--line);
      border-right: 1px solid var(--line);
    }
    .shade {
      position: fixed;
      inset: 0;
      z-index: 3;
    }
    .picker {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      z-index: 4;
      display: grid;
      grid-template-columns: 200px 320px;
      border-radius: 24px;
      background: var(--act-card);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }
    .presets {
      padding: 8px 0;
      border-right: 1px solid var(--line);
    }
    .presets button {
      width: 100%;
      padding: 12px 20px;
      text-align: left;
    }
    .presets button:hover {
      background: var(--act-soft);
    }
    .custom {
      display: grid;
      align-content: start;
      gap: 14px;
      padding: 20px;
    }
    .custom label {
      display: grid;
      gap: 6px;
      font-size: 13px;
      color: var(--act-muted);
    }
    /* The month: round days, the range as one band, its ends filled. */
    .month-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
      text-transform: capitalize;
    }
    .month-head strong {
      font-size: 16px;
      font-weight: 500;
    }
    .round {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
    }
    .round:hover {
      background: var(--act-soft);
    }
    .round:disabled {
      opacity: 0.3;
      cursor: default;
    }
    .days {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      row-gap: 2px;
    }
    .weekday {
      padding: 4px 0 8px;
      font-size: 12px;
      text-align: center;
      text-transform: uppercase;
      color: var(--act-muted);
    }
    .day-cell {
      position: relative;
      display: grid;
      place-items: center;
      height: 38px;
      padding: 0;
    }
    .day-cell span {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 14px;
    }
    .day-cell:hover span {
      background: var(--act-soft);
    }
    .day-cell.other {
      color: var(--act-muted);
    }
    .day-cell:disabled {
      opacity: 0.3;
      cursor: default;
    }
    .day-cell.today span {
      box-shadow: inset 0 0 0 1px var(--act-accent);
    }
    .day-cell.in::before,
    .day-cell.from:not(.to)::before,
    .day-cell.to:not(.from)::before {
      content: "";
      position: absolute;
      inset: 2px 0;
      background: color-mix(in srgb, var(--act-accent) 22%, transparent);
    }
    .day-cell.from:not(.to)::before {
      left: 50%;
    }
    .day-cell.to:not(.from)::before {
      right: 50%;
    }
    .day-cell:is(.from, .to) span {
      color: var(--act-accent-ink, var(--text-primary-color, #fff));
      background: var(--act-accent);
    }
    .times {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .custom input {
      font: inherit;
      padding: 10px;
      border: none;
      border-bottom: 1px solid var(--act-muted);
      border-radius: 6px 6px 0 0;
      color: var(--act-text);
      background: var(--act-soft);
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .text {
      padding: 8px 12px;
      border-radius: 18px;
      color: var(--act-accent);
    }
    .filled {
      padding: 10px 20px;
      border-radius: 20px;
      color: var(--act-accent-ink, var(--text-primary-color, #fff));
      background: var(--act-accent);
    }
    .filled:disabled {
      opacity: 0.5;
    }
    .filters-button {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 14px;
      background: var(--act-soft);
    }
    .day {
      margin: 0;
      padding: 14px 24px;
      font-size: 17px;
      font-weight: 500;
      background: var(--act-card);
      border-bottom: 1px solid var(--line);
    }
    .timeline li {
      display: grid;
      grid-template-columns: 84px 40px 1fr;
      align-items: center;
      gap: 16px;
      padding: 10px 24px;
      border-bottom: 1px solid var(--line);
    }
    time {
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: var(--act-muted);
    }
    .badge {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      color: var(--person);
      background: color-mix(in srgb, var(--person) 16%, transparent);
      --mdc-icon-size: 22px;
    }
    .line {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .line b {
      font-weight: 500;
    }
    .problem {
      padding: 16px 24px;
      color: var(--error-color, #c62828);
    }
    @media (max-width: 870px) {
      /* One column: the bar (Filters, range, search) first, the filters under it, then the timeline. */
      .layout {
        display: flex;
        flex-direction: column;
        overflow: auto;
      }
      main {
        display: contents;
      }
      .top {
        order: 0;
      }
      .filters {
        order: 1;
      }
      main > :not(.top) {
        order: 2;
      }
      .filters {
        display: none;
        border-right: none;
        border-bottom: 1px solid var(--line);
      }
      .filters.open {
        display: block;
        max-height: 50vh;
      }
      .filters-button {
        display: inline-flex;
      }
      .top {
        flex-wrap: wrap;
        padding: 12px 16px;
      }
      /* Under the left end of the range, inside the screen; the ready ranges are chips, so the month and the
         buttons fit under them on a phone. */
      .picker {
        grid-template-columns: 1fr;
        left: 0;
        width: min(calc(100vw - 32px), 360px);
      }
      .presets {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 12px 12px 10px;
        border-right: none;
        border-bottom: 1px solid var(--line);
      }
      .presets button {
        width: auto;
        padding: 7px 12px;
        border: 1px solid var(--line);
        border-radius: 16px;
        font-size: 13px;
      }
      .custom {
        gap: 10px;
        padding: 12px 16px 16px;
      }
      .day-cell {
        height: 36px;
      }
      .day-cell span {
        width: 34px;
        height: 34px;
      }
      /* In the window nothing cuts the picker off: the window scrolls. */
      :host([embedded]) .layout {
        overflow: visible;
      }
      .timeline li {
        grid-template-columns: 64px 36px 1fr;
        gap: 10px;
        padding: 10px 16px;
      }
    }
  `;
}

if (!customElements.get(TAG)) customElements.define(TAG, HomeDashboardActivity);
