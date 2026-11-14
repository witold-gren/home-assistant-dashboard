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

const failure = (code, message) => Object.assign(new Error(message), { code });

export function createEditorServer({ live, dashboards = [{ url_path: "home-dashboard", title: "Dom" }], users = [] }) {
  const state = { live: structuredClone(live), draft: null, review: null, history: [], sent: [] };
  let clock = 0;
  const stamp = () => new Date(Date.UTC(2026, 10, 13, 10, 0, clock++)).toISOString();
  const handle = async (message) => {
    state.sent.push(message);
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
      default:
        return null;
    }
  };
  return { state, handle };
}
