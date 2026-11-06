"""The documentation points at things that exist, in both languages."""

from __future__ import annotations

from pathlib import Path
import re

import pytest

ROOT = Path(__file__).resolve().parent.parent
DOCS = ["README.md", "README.pl.md", "docs/guide.md", "docs/guide.pl.md"]
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


def test_every_language_has_the_same_screenshots() -> None:
    def pictures(language: str) -> set[str]:
        return {path.name for path in (ROOT / "docs/screenshots" / language).glob("*.png")}

    assert pictures("en") == pictures("pl")
