// The editor's server in memory, as the integration answers: a draft, publishing with a history and the conflict
// when the dashboard changed elsewhere. Every message is recorded, so tests can see what the editor sent.

const sorted = (value) =>
  Array.isArray(value)
    ? value.map(sorted)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]))
      : value;

export const configHash = (config) => {
  const text = JSON.stringify(sorted(config));
  let hash = 0;
  for (const char of text) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return `h${(hash >>> 0).toString(16)}`;
};

import { sliceOf, withSlice } from "../../custom_components/home_dashboard/www/app/variants.js";
import { ttsAnswer } from "./mock-hass.js";

const failure = (code, message) => Object.assign(new Error(message), { code });

export function createEditorServer({ live, dashboards = [{ url_path: "home-dashboard", title: "Dom" }], users = [] }) {
  // Variants as variants.py keeps them: page → { live_name, items, devices, people }; the devices that opened a page.
  const state = { live: structuredClone(live), draft: null, review: null, history: [], sent: [], variants: {}, devices: [] };
  let variantCount = 0;
  const page = (key) => (state.variants[key] ??= { live_name: null, items: [], devices: {}, people: {} });
  const summary = (entry, item) => {
    const people = Object.keys(entry.people).filter((id) => entry.people[id] === item.id);
    return {
      ...structuredClone(item),
      shared: Boolean(item.shared),
      devices: Object.keys(entry.devices).filter((id) => entry.devices[id] === item.id),
      people,
      chosen: people.filter((id) => (entry.self ?? []).includes(id)),
    };
  };
  const forget = (entry, id) => {
    for (const map of [entry.devices, entry.people]) for (const key of Object.keys(map)) if (map[key] === id) delete map[key];
  };
  let clock = 0;
  const stamp = () => new Date(Date.UTC(2026, 10, 13, 10, 0, clock++)).toISOString();
  const handle = async (message) => {
    state.sent.push(message);
    const tts = ttsAnswer(message);
    if (tts) return tts;
    switch (message.type) {
      case "home_dashboard/editor/dashboards":
        return { dashboards };
      // Pictures sent to Home Assistant and in its www folder, as a test sets them (`state.images`, `state.pictures`);
      // without `state.pictures` the integration is the one before a restart, which does not know the command.
      case "image/list":
        return state.images ?? [];
      case "home_dashboard/editor/pictures":
        if (!state.pictures) throw failure("unknown_command", "Unknown command.");
        return { pictures: state.pictures };
      case "config/auth/list":
        return users;
      case "lovelace/dashboards/list":
        return dashboards.map((item) => ({ ...item, mode: "storage" }));
      case "lovelace/dashboards/create":
        dashboards.push({ url_path: message.url_path, title: message.title });
        return { url_path: message.url_path };
      case "lovelace/config/save":
        state.live = structuredClone(message.config);
        return null;
      case "home_dashboard/editor/load":
        if (!dashboards.some((item) => item.url_path === message.url_path)) throw failure("not_found", "No such dashboard");
        return {
          live: structuredClone(state.live),
          live_hash: configHash(state.live),
          draft: state.draft && structuredClone(state.draft),
          review: state.review && { user_id: state.review.user_id, published_at: state.review.published_at },
          history: state.history.map(({ id, at, by, note }) => ({ id, at, by, note })),
        };
      case "home_dashboard/editor/save_draft":
        state.draft = { config: structuredClone(message.config), base: state.draft?.base ?? message.base, updated_at: stamp() };
        return { updated_at: state.draft.updated_at, base: state.draft.base };
      case "home_dashboard/editor/discard":
        state.draft = null;
        return null;
      case "home_dashboard/editor/publish": {
        if (!state.draft) throw failure("no_draft", "There is no draft");
        if (configHash(state.live) !== message.base && !message.force) throw failure("conflict", "Changed elsewhere");
        state.history.unshift({ id: `v${state.history.length + 1}`, config: state.live, at: stamp(), by: "admin", note: message.note ?? "" });
        state.live = state.draft.config;
        state.draft = null;
        state.review = null;
        return { live_hash: configHash(state.live) };
      }
      case "home_dashboard/editor/publish_review":
        if (!state.draft) throw failure("no_draft", "There is no draft");
        state.review = { config: structuredClone(state.draft.config), user_id: message.user_id, published_at: stamp() };
        return { published_at: state.review.published_at };
      case "home_dashboard/editor/end_review":
        state.review = null;
        return null;
      case "home_dashboard/editor/history_get": {
        const found = state.history.find((item) => item.id === message.version);
        if (!found) throw failure("not_found", "No such version");
        return { config: structuredClone(found.config), at: found.at, by: found.by };
      }
      case "home_dashboard/editor/restore": {
        const found = state.history.find((item) => item.id === message.version);
        if (!found) throw failure("not_found", "No such version");
        state.draft = { config: structuredClone(found.config), base: configHash(state.live), updated_at: stamp() };
        return { draft: structuredClone(state.draft) };
      }
      case "home_dashboard/variants/list":
        return {
          pages: Object.fromEntries(
            Object.entries(state.variants).map(([key, entry]) => [key, { live_name: entry.live_name, items: entry.items.map((item) => summary(entry, item)) }]),
          ),
          devices: structuredClone(state.devices),
          people: users.map(({ id, name }) => ({ id, name })),
        };
      case "home_dashboard/variants/create": {
        const entry = page(message.page);
        const from = message.from ? entry.items.find((item) => item.id === message.from) : null;
        const part = from ? structuredClone(from.slice) : sliceOf(state.live.strategy ?? {}, message.page);
        if (!part) throw failure("not_found", "No such room");
        const item = { id: `variant${++variantCount}`, name: message.name, slice: part, created_at: stamp(), updated_at: stamp(), by: "admin" };
        entry.items.push(item);
        return { variant: summary(entry, item) };
      }
      case "home_dashboard/variants/update": {
        const item = page(message.page).items.find((one) => one.id === message.variant);
        if (!item) throw failure("not_found", "No such variant");
        if ("name" in message) item.name = message.name;
        if ("slice" in message) item.slice = structuredClone(message.slice);
        if ("shared" in message) item.shared = message.shared;
        item.updated_at = stamp();
        return { updated_at: item.updated_at };
      }
      case "home_dashboard/variants/delete": {
        const entry = page(message.page);
        entry.items = entry.items.filter((item) => item.id !== message.variant);
        forget(entry, message.variant);
        return null;
      }
      case "home_dashboard/variants/name_live":
        page(message.page).live_name = message.name || null;
        return null;
      case "home_dashboard/variants/name_device": {
        const device = state.devices.find((one) => one.id === message.device);
        if (!device) throw failure("not_found", "No such device");
        device.name = message.name || null;
        return null;
      }
      case "home_dashboard/variants/battery_device": {
        const device = state.devices.find((one) => one.id === message.device);
        if (!device) throw failure("not_found", "No such device");
        device.battery = message.battery || null;
        return null;
      }
      case "home_dashboard/variants/forget_device": {
        const index = state.devices.findIndex((one) => one.id === message.device);
        if (index < 0) throw failure("not_found", "No such device");
        state.devices.splice(index, 1);
        for (const entry of Object.values(state.variants)) delete entry.devices[message.device];
        return null;
      }
      case "home_dashboard/variants/assign": {
        const entry = page(message.page);
        for (const [kind, map] of [["devices", entry.devices], ["people", entry.people]]) {
          for (const [target, chosen] of Object.entries(message[kind] ?? {})) {
            if (chosen) map[target] = chosen;
            else delete map[target];
          }
        }
        return { devices: { ...entry.devices }, people: { ...entry.people } };
      }
      case "home_dashboard/variants/deploy": {
        const entry = page(message.page);
        const item = entry.items.find((one) => one.id === message.variant);
        if (!item) throw failure("not_found", "No such variant");
        const strategy = state.live.strategy ?? {};
        const previous = sliceOf(strategy, message.page);
        state.history.unshift({ id: `v${state.history.length + 1}`, config: state.live, at: stamp(), by: "admin", note: item.name });
        state.live = { ...state.live, strategy: withSlice(strategy, message.page, item.slice) };
        const replaced = { id: `variant${++variantCount}`, name: entry.live_name ?? "", slice: previous, created_at: stamp(), updated_at: stamp(), by: "admin" };
        entry.items = entry.items.map((one) => (one.id === item.id ? replaced : one));
        entry.live_name = item.name;
        forget(entry, item.id);
        return { live_hash: configHash(state.live), replaced: summary(entry, replaced) };
      }
      default:
        return null;
    }
  };
  return { state, handle };
}
