// Publishing a draft: what it changes in plain words and in YAML, what may be wrong with it, a note for the history,
// and the two ways out: to one person who checks it on their own devices, or to everyone. And the history of what
// was published, each version to compare and to take back as a draft.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "../app/i18n.js";
import { describeChanges, diffHunks, diffLines, missingEntities } from "./changes.js";
import { DOCS_ANCHORS } from "./docs-anchors.js";
import "./help.js";
import { callWS } from "./ws.js";

const PUBLISH_TAG = "home-dashboard-editor-publish";
const HISTORY_TAG = "home-dashboard-editor-history";
const KIND_ICONS = { added: "mdi:plus-circle", removed: "mdi:minus-circle", changed: "mdi:pencil-circle", moved: "mdi:swap-vertical-circle" };

export const dialogStyles = css`
  :host {
    position: fixed;
    inset: 0;
    z-index: 30;
    --mdc-icon-size: 18px;
    color: var(--text);
    font: 14px/1.4 -apple-system, "SF Pro Text", Roboto, system-ui, sans-serif;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim);
  }
  .dialog {
    position: absolute;
    top: 5vh;
    left: 50%;
    display: flex;
    flex-direction: column;
    width: min(1040px, calc(100vw - 48px));
    max-height: 90vh;
    transform: translateX(-50%);
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--panel);
    box-shadow: 0 30px 80px var(--shadow);
  }
  header,
  footer {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    padding: 14px 18px;
  }
  header {
    border-bottom: 1px solid var(--line);
  }
  footer {
    border-top: 1px solid var(--line);
  }
  h2 {
    margin: 0;
    font-size: 16px;
  }
  h3 {
    margin: 12px 0 6px;
    font-size: 13px;
  }
  .grow {
    flex: 1;
  }
  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 18px;
    min-height: 0;
    padding: 6px 18px 14px;
    overflow: auto;
  }
  button,
  select,
  input {
    font: inherit;
    color: inherit;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border: 0;
    border-radius: 9px;
    cursor: pointer;
    background: var(--panel2);
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  button.primary {
    color: #fff;
    font-weight: 600;
    background: var(--accent);
  }
  button.ghost {
    color: var(--muted);
    background: transparent;
  }
  select,
  input {
    padding: 7px 10px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--panel2);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    gap: 8px;
    padding: 4px 0;
  }
  .added ha-icon {
    color: #34c759;
  }
  .removed ha-icon {
    color: var(--red);
  }
  .changed ha-icon {
    color: var(--amber);
  }
  .moved ha-icon {
    color: var(--accent);
  }
  .check {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--line);
  }
  .ok {
    color: #34c759;
  }
  .warn {
    color: var(--amber);
  }
  .diff {
    margin: 0;
    padding: 8px 0;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--field);
    font: 12px/1.6 ui-monospace, Menlo, monospace;
    white-space: pre;
  }
  .diff span {
    display: block;
    padding: 0 10px;
  }
  .diff .added {
    color: var(--added);
    background: rgba(46, 160, 67, 0.12);
  }
  .diff .removed {
    color: var(--removed);
    background: rgba(248, 81, 73, 0.12);
  }
  .diff .skip {
    color: var(--faint);
  }
  .hint {
    font-size: 12px;
    color: var(--muted);
  }
  .versions button {
    justify-content: space-between;
    width: 100%;
    margin-bottom: 4px;
    text-align: left;
  }
  .versions button.on {
    background: rgba(79, 140, 255, 0.25);
  }
`;

/** The lines of YAML that differ between two strategies, with a little around them. */
export function yamlDiff(yaml, before, after) {
  const dump = (value) => yaml.dump(value ?? {}, { lineWidth: 120, noRefs: true });
  return diffHunks(diffLines(dump(before), dump(after)));
}

function renderDiff(lines, t) {
  if (!lines.length) return html`<p class="hint">${t("editor_no_differences")}</p>`;
  return html`<pre class="diff" data-diff>${lines.map((line) =>
    line.kind === "skip"
      ? html`<span class="skip">⋯ ${t("editor_lines_skipped", { count: line.count })}</span>`
      : html`<span class=${line.kind}>${line.kind === "added" ? "+ " : line.kind === "removed" ? "- " : "  "}${line.text}</span>`,
  )}</pre>`;
}

export class HomeDashboardEditorPublish extends LitElement {
  static properties = {
    hass: { attribute: false },
    yaml: { attribute: false },
    live: { attribute: false },
    draft: { attribute: false },
    users: { attribute: false },
    review: { attribute: false },
    busy: { type: Boolean },
    _note: { state: true },
    _reviewer: { state: true },
  };

  constructor() {
    super();
    this._note = "";
    this._reviewer = "";
  }

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  render() {
    if (!this.hass) return nothing;
    const changes = describeChanges(this.live ?? {}, this.draft ?? {}, this.hass, this.hass.language);
    const missing = missingEntities(this.draft ?? {}, this.hass);
    const reviewer = this._reviewer || this.review?.user_id || "";
    return html`
      <div class="scrim" @click=${() => this._emit("dialog-close")}></div>
      <section class="dialog" role="dialog" aria-label=${this._t("editor_publish_title")} data-publish-dialog>
        <header>
          <h2>${this._t("editor_publish_title")}</h2>
          <span class="grow"></span>
          <home-dashboard-editor-help part="publish" .anchor=${DOCS_ANCHORS.saving} .language=${this.hass?.language}></home-dashboard-editor-help>
          <button class="ghost" data-dialog-close aria-label=${this._t("close")} @click=${() => this._emit("dialog-close")}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </header>
        <div class="body">
          <div>
            <h3>${this._t("editor_changes_title", { count: changes.length })}</h3>
            ${changes.length
              ? html`<ul data-changes>
                  ${changes.map(
                    (change) => html`<li class=${change.kind} data-change=${change.kind}>
                      <ha-icon .icon=${KIND_ICONS[change.kind]}></ha-icon><span>${change.text}</span>
                    </li>`,
                  )}
                </ul>`
              : html`<p class="hint" data-no-changes>${this._t("editor_no_differences")}</p>`}
            <h3>${this._t("editor_checks_title")}</h3>
            <div class="check" data-check="entities">
              <span>${this._t("editor_check_entities")}</span>
              ${missing.length
                ? html`<span class="warn" data-missing>${this._t("editor_check_missing", { list: missing.join(", ") })}</span>`
                : html`<ha-icon class="ok" icon="mdi:check-circle"></ha-icon>`}
            </div>
            <div class="check">
              <span>${this._t("editor_check_backup")}</span><span class="hint">${this._t("editor_check_backup_auto")}</span>
            </div>
            <h3>${this._t("editor_note_title")}</h3>
            <input data-note style="width: 100%; box-sizing: border-box" .value=${this._note} placeholder=${this._t("editor_note_placeholder")}
              @input=${(event) => (this._note = event.target.value)} />
          </div>
          <div>
            <h3>${this._t("editor_yaml_diff")}</h3>
            ${this.yaml ? renderDiff(yamlDiff(this.yaml, this.live, this.draft), (key, values) => this._t(key, values)) : nothing}
          </div>
        </div>
        <footer>
          <label class="hint">${this._t("editor_reviewer")}</label>
          <select data-reviewer @change=${(event) => (this._reviewer = event.target.value)}>
            <option value="" ?selected=${!reviewer}>${this._t("editor_reviewer_choose")}</option>
            ${(this.users ?? []).map((user) => html`<option value=${user.id} ?selected=${user.id === reviewer}>${user.name}</option>`)}
          </select>
          <button data-publish-review ?disabled=${!reviewer || this.busy || !changes.length}
            @click=${() => this._emit("publish-review", { user_id: reviewer })}>
            <ha-icon icon="mdi:account-eye"></ha-icon>${this._t("editor_publish_review")}
          </button>
          <span class="grow"></span>
          <button class="ghost" @click=${() => this._emit("dialog-close")}>${this._t("editor_picker_cancel")}</button>
          <button class="primary" data-publish-all ?disabled=${this.busy || !changes.length}
            @click=${() => this._emit("publish-all", { note: this._note.trim() })}>
            <ha-icon icon="mdi:cloud-upload"></ha-icon>${this._t("editor_publish_all", { count: changes.length })}
          </button>
        </footer>
      </section>
    `;
  }

  static styles = dialogStyles;
}

export class HomeDashboardEditorHistory extends LitElement {
  static properties = {
    hass: { attribute: false },
    yaml: { attribute: false },
    urlPath: { attribute: false },
    history: { attribute: false },
    current: { attribute: false },
    users: { attribute: false },
    _chosen: { state: true },
    _config: { state: true },
  };

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  async _open(version) {
    this._chosen = version.id;
    this._config = null;
    const found = await callWS(this.hass, { type: "home_dashboard/editor/history_get", url_path: this.urlPath, version: version.id });
    if (this._chosen === version.id) this._config = found.config;
  }

  _who(id) {
    return (this.users ?? []).find((user) => user.id === id)?.name ?? id ?? "–";
  }

  render() {
    if (!this.hass) return nothing;
    const when = new Intl.DateTimeFormat(this.hass.language, { dateStyle: "medium", timeStyle: "short" });
    return html`
      <div class="scrim" @click=${() => this._emit("dialog-close")}></div>
      <section class="dialog" role="dialog" aria-label=${this._t("editor_history_title")} data-history-dialog>
        <header>
          <h2>${this._t("editor_history_title")}</h2>
          <span class="grow"></span>
          <home-dashboard-editor-help part="history" .anchor=${DOCS_ANCHORS.saving} .language=${this.hass?.language}></home-dashboard-editor-help>
          <button class="ghost" data-dialog-close aria-label=${this._t("close")} @click=${() => this._emit("dialog-close")}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </header>
        <div class="body">
          <div class="versions" data-versions>
            ${(this.history ?? []).length
              ? this.history.map(
                  (version) => html`<button class=${this._chosen === version.id ? "on" : ""} data-version=${version.id} @click=${() => this._open(version)}>
                    <span>${when.format(new Date(version.at))} · ${this._who(version.by)}${version.note ? html` · <i>${version.note}</i>` : nothing}</span>
                    <ha-icon icon="mdi:chevron-right"></ha-icon>
                  </button>`,
                )
              : html`<p class="hint" data-no-history>${this._t("editor_history_none")}</p>`}
          </div>
          <div>
            ${this._config
              ? html`<h3>${this._t("editor_history_compare")}</h3>
                  ${renderDiff(yamlDiff(this.yaml, this.current, this._config.strategy ?? {}), (key, values) => this._t(key, values))}
                  <p>
                    <button class="primary" data-restore @click=${() => this._emit("history-restore", { version: this._chosen })}>
                      <ha-icon icon="mdi:history"></ha-icon>${this._t("editor_history_restore")}
                    </button>
                  </p>
                  <p class="hint">${this._t("editor_history_restore_help")}</p>`
              : html`<p class="hint">${this._t(this._chosen ? "chart_loading" : "editor_history_choose")}</p>`}
          </div>
        </div>
      </section>
    `;
  }

  static styles = dialogStyles;
}

if (!customElements.get(PUBLISH_TAG)) customElements.define(PUBLISH_TAG, HomeDashboardEditorPublish);
if (!customElements.get(HISTORY_TAG)) customElements.define(HISTORY_TAG, HomeDashboardEditorHistory);
