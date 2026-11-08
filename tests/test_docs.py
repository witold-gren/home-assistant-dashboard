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


@pytest.mark.parametrize("name", ["apple-home", "own-devices"])
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
