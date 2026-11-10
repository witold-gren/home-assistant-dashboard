"""Loading the app afresh from the dashboard settings: fresh files past every cache, then the page again."""

from __future__ import annotations

from pathlib import Path

from .test_shortcuts import mount_admin

APP = Path(__file__).resolve().parents[2] / "custom_components" / "home_dashboard" / "www" / "app"


def test_the_list_of_files_is_the_whole_app(phone):
    listed = phone.evaluate("async () => (await import('/custom_components/home_dashboard/www/app/reload.js')).APP_FILES")
    assert sorted(listed) == sorted(path.name for path in APP.glob("*.js"))


def test_reloading_empties_the_caches_fetches_every_file_afresh_and_opens_the_page_again(phone):
    result = phone.evaluate("""async () => {
        const { reloadApp, appFileUrls } = await import('/custom_components/home_dashboard/www/app/reload.js');
        const deleted = [];
        const fetched = [];
        let reloaded = false;
        await reloadApp({
            cacheStorage: { keys: async () => ['a', 'b'], delete: async (key) => deleted.push(key) },
            fetcher: async (url, options) => { fetched.push([url, options.cache]); if (url.endsWith('host.js')) throw new Error('offline'); },
            reload: () => (reloaded = true),
        });
        return { deleted, fetched, reloaded, expected: appFileUrls().length };
    }""")
    assert result["deleted"] == ["a", "b"]
    assert len(result["fetched"]) == result["expected"]
    assert {mode for _, mode in result["fetched"]} == {"reload"}
    assert any(url.endswith("/loader.js") for url, _ in result["fetched"])
    assert result["reloaded"] is True


def test_the_dashboard_settings_offer_it_and_the_look_does_not(phone):
    mount_admin(phone, {})
    phone.evaluate("() => document.querySelector('home-dashboard-chrome').open({ type: 'sheet', sheet: { kind: 'look' } })")
    phone.wait_for_selector("home-dashboard-sheet [data-tab]")
    assert phone.locator("home-dashboard-sheet [data-reload-app]").count() == 0
    phone.evaluate("() => document.querySelector('home-dashboard-chrome').open({ type: 'settings' })")
    phone.wait_for_selector("home-dashboard-settings [data-reload-app]")
    assert "od nowa" in phone.locator("home-dashboard-settings [data-reload-app] strong").inner_text()
