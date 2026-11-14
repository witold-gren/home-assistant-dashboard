"""The documentation site (mkdocs.yml, dev/docs_site.py): every document is in its menu, and the links the
README, the changelog and the pages write for GitHub still lead somewhere on the site."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
SITE = "/home-assistant-dashboard/"


def load_hook():
    spec = importlib.util.spec_from_file_location("docs_site", ROOT / "dev/docs_site.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


hook = load_hook()


class Loader(yaml.SafeLoader):
    """mkdocs.yml has !!python tags (the anchors' slugify): read as plain data."""


Loader.add_multi_constructor("tag:yaml.org,2002:python/", lambda loader, suffix, node: None)


@pytest.fixture(scope="module")
def config() -> dict:
    return yaml.load((ROOT / "mkdocs.yml").read_text(encoding="utf-8"), Loader=Loader)


def page(source: str, url: str):
    return SimpleNamespace(file=SimpleNamespace(src_uri=source), url=url)


def test_every_document_is_in_the_menu(config) -> None:
    listed = {next(iter(entry.values())) for entry in config["nav"]}
    documents = {path.name for path in DOCS.glob("*.md") if not path.name.endswith(".pl.md")}
    assert documents - set(hook.GENERATED) <= listed
    assert set(hook.GENERATED) - {"index.pl.md"} <= listed


def test_every_menu_entry_has_its_polish_name(config) -> None:
    polish = next(
        language for language in config["plugins"][1]["i18n"]["languages"] if language["locale"] == "pl"
    )
    assert {next(iter(entry)) for entry in config["nav"]} == set(polish["nav_translations"])


def test_every_english_document_has_a_polish_one() -> None:
    for path in DOCS.glob("*.md"):
        if path.name.endswith(".pl.md") or path.name in hook.GENERATED:
            continue
        assert path.with_name(path.stem + ".pl.md").exists(), path.name


def test_the_drafts_and_the_figma_pictures_stay_off_the_site(config) -> None:
    assert {"design/", "reference/"} <= set(config["exclude_docs"].split())


def test_the_readme_links_from_the_top_of_the_repository_work_from_docs() -> None:
    text = '[Guide](docs/guide.md#look) [Polski](README.pl.md) <img src="docs/screenshots/en/home.png">'
    expected = '[Guide](guide.md#look) [Polski](index.pl.md) <img src="screenshots/en/home.png">'
    assert hook.rewrite(text, hook.from_top) == expected
    assert hook.rewrite("[CHANGELOG](CHANGELOG.md)", hook.from_top) == "[CHANGELOG](changelog.md)"


def test_files_outside_docs_go_to_github() -> None:
    assert hook.from_top("dev/demo-pictures/CREDITS.md") == hook.BLOB + "dev/demo-pictures/CREDITS.md"
    assert (
        hook.from_docs("../dev/demo-pictures/backgrounds/a.jpg")
        == hook.RAW + "dev/demo-pictures/backgrounds/a.jpg"
    )
    assert hook.from_docs("../README.md") == "index.md"
    assert hook.from_top("https://example.com/x.md") == "https://example.com/x.md"


def test_a_link_to_the_other_language_becomes_the_address_of_that_page() -> None:
    english = hook.on_page_markdown(
        "[Polski](guide.pl.md) [Konfiguracja](configuration.pl.md#a)", page("guide.md", "guide/"), None, None
    )
    assert english == f"[Polski]({SITE}pl/guide/) [Konfiguracja]({SITE}pl/configuration/#a)"
    polish = hook.on_page_markdown(
        "[English](guide.md) [Dalej](editor.pl.md)", page("guide.pl.md", "pl/guide/"), None, None
    )
    assert polish == f"[English]({SITE}guide/) [Dalej](editor.pl.md)"
    start = hook.on_page_markdown("[English](../README.md)", page("index.pl.md", "pl/"), None, None)
    assert start == f"[English]({SITE})"


def test_html_pictures_climb_to_the_files_from_a_deeper_page() -> None:
    text = '<img src="screenshots/pl/home.png" alt="x"> <img src="https://img.shields.io/a.svg">'
    assert hook.html_pictures(text, "") == text
    assert (
        hook.html_pictures(text, "pl/")
        == '<img src="../screenshots/pl/home.png" alt="x"> <img src="https://img.shields.io/a.svg">'
    )


def test_generated_files_are_kept_out_of_git() -> None:
    ignored = (ROOT / ".gitignore").read_text(encoding="utf-8").split()
    assert {f"docs/{name}" for name in hook.GENERATED} <= set(ignored)
    assert "docs/assets/" in ignored and "site/" in ignored


def test_the_icon_of_the_site_is_the_brand_icon() -> None:
    assert hook.ICON.exists()


def test_pictures_of_an_upright_phone_are_kept_low(config) -> None:
    assert "stylesheets/extra.css" in config["extra_css"]
    css = (DOCS / "stylesheets/extra.css").read_text(encoding="utf-8")
    assert "max-height: 600px" in css and "width: auto" in css
