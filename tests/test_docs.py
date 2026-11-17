"""The documentation points at things that exist, in both languages."""

from __future__ import annotations

from pathlib import Path
import re

import pytest

ROOT = Path(__file__).resolve().parent.parent
DOCS = [
    "README.md",
    "README.pl.md",
    "docs/guide.md",
    "docs/guide.pl.md",
    "docs/apple-home.md",
    "docs/apple-home.pl.md",
    "docs/own-devices.md",
    "docs/own-devices.pl.md",
    "docs/gallery.md",
    "docs/gallery.pl.md",
    "docs/editor.md",
    "docs/editor.pl.md",
]
LINK = re.compile(r"\]\(([^)#\s]+)(?:#[^)]*)?\)")


@pytest.mark.parametrize("name", DOCS)
def test_every_local_link_and_picture_exists(name: str) -> None:
    document = ROOT / name
    links = [link for link in LINK.findall(document.read_text()) if "://" not in link]
    assert links
    missing = [link for link in links if not (document.parent / link).exists()]
    assert missing == []


def test_both_languages_of_the_guide_have_the_same_sections() -> None:
    def headings(name: str) -> list[int]:
        lines = (ROOT / name).read_text().splitlines()
        return [len(line.split()[0]) for line in lines if line.startswith("##")]

    assert headings("docs/guide.md") == headings("docs/guide.pl.md")


@pytest.mark.parametrize("name", ["apple-home", "own-devices", "editor"])
def test_both_languages_of_a_guide_have_the_same_sections(name: str) -> None:
    # The level of each heading and the number of a chapter, which both languages share.
    def sections(name: str) -> list[str]:
        lines = (ROOT / name).read_text().splitlines()
        return [
            line.split()[0] + (line.split()[1] if line.split()[1][0].isdigit() else "")
            for line in lines
            if line.startswith("##")
        ]

    assert sections(f"docs/{name}.md") == sections(f"docs/{name}.pl.md")


def test_every_language_has_the_same_screenshots() -> None:
    def pictures(language: str) -> set[str]:
        return {path.name for path in (ROOT / "docs/screenshots" / language).glob("*.png")}

    assert pictures("en") == pictures("pl")


# The common standard of the apps of the house (~/Home Assistant/standards/gpu-studio.md, section 8)

from .i18n_texts import screen_texts  # noqa: E402

ANCHOR = re.compile(r"^#{2,6} .+? \{#([\w-]+)\}\s*$", re.M)
UI_NAME = re.compile(r'<b class="ui">([^<]+)</b>')
EDITOR_ANCHORS = ROOT / "custom_components" / "home_dashboard" / "www" / "editor" / "docs-anchors.js"


def _anchors(name: str) -> list[str]:
    return ANCHOR.findall((ROOT / "docs" / name).read_text(encoding="utf-8"))


def test_every_chapter_of_the_editor_guide_has_the_same_anchor_in_both_languages() -> None:
    english, polish = _anchors("editor.md"), _anchors("editor.pl.md")
    headings = re.findall(r"^#{2,6} ", (ROOT / "docs" / "editor.md").read_text(encoding="utf-8"), re.M)
    assert len(english) == len(headings)
    assert english == polish
    assert len(set(english)) == len(english)


def test_every_question_mark_of_the_editor_opens_a_chapter_that_is_there() -> None:
    table = re.search(r"DOCS_ANCHORS = \{(.+?)\};", EDITOR_ANCHORS.read_text(encoding="utf-8"), re.S).group(1)
    wanted = set(re.findall(r'^\s+\w+: "([\w-]+)",$', table, re.M))
    assert wanted
    assert wanted <= set(_anchors("editor.md"))
    assert wanted <= set(_anchors("editor.pl.md"))


@pytest.mark.parametrize("path", sorted((ROOT / "docs").glob("*.md")), ids=lambda path: path.name)
def test_every_name_of_the_screen_in_the_text_is_on_the_screen(path: Path) -> None:
    language = "pl" if path.name.endswith(".pl.md") else "en"
    names = UI_NAME.findall(path.read_text(encoding="utf-8"))
    missing = sorted({name for name in names if name not in screen_texts()[language]})
    assert not missing, f"{path.name}: not in i18n.js ({language}): {missing}"


def test_the_left_out_folders_of_the_site_are_anchored() -> None:
    config = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")
    block = re.search(r"^exclude_docs: \|\n((?:  .*\n)+)", config, re.M).group(1)
    patterns = [
        line.strip() for line in block.splitlines() if line.strip() and not line.strip().startswith("#")
    ]
    assert patterns and all(pattern.startswith("/") for pattern in patterns)


def test_no_name_of_the_screen_is_left_as_a_span() -> None:
    """Names are <b class="ui">: bold on GitHub too, which drops the class of a <span>."""
    pages = (ROOT / "docs").rglob("*.md")
    leftovers = [page.name for page in pages if '<span class="ui">' in page.read_text(encoding="utf-8")]
    assert not leftovers
