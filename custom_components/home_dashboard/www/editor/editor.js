// The editor of a dashboard on a computer: a panel of Home Assistant for administrators. Its parts come in stages;
// this one loads the dashboards that use the strategy and shows the three columns.

const TAG = "home-dashboard-editor";

class HomeDashboardEditorPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this._started) {
      this._started = true;
      import("./editor-app.js").then(({ mountEditor }) => mountEditor(this, hass, this.panel));
    }
    this._app?.updateHass?.(hass);
  }

  get hass() {
    return this._hass;
  }
}

if (!customElements.get(TAG)) customElements.define(TAG, HomeDashboardEditorPanel);
