"""The texts of the screen (www/app/i18n.js) as Python sets, per language.

A name of a button in the documentation (<b class="ui">…</b>, standard §8) must be one of them."""

from __future__ import annotations

from functools import cache
from pathlib import Path
import re

I18N = (
    Path(__file__).resolve().parent.parent
    / "custom_components"
    / "home_dashboard"
    / "www"
    / "app"
    / "i18n.js"
)
LANGUAGE = re.compile(r"^  (\w+): \{$")
TEXT = re.compile(r'^    \w+: (["`])(.*)\1,?$')


@cache
def screen_texts() -> dict[str, frozenset[str]]:
    """{"en": {...}, "pl": {...}}: every one-line text, unescaped; parts around {placeholders} count too."""
    texts: dict[str, set[str]] = {}
    language = None
    for line in I18N.read_text(encoding="utf-8").splitlines():
        if match := LANGUAGE.match(line):
            language = match.group(1)
            texts.setdefault(language, set())
        elif language and (match := TEXT.match(line)):
            text = match.group(2).replace('\\"', '"').replace("\\'", "'")
            texts[language].add(text)
            texts[language].update(
                part.strip(" :…") for part in re.split(r"\{\w+\}", text) if part.strip(" :…")
            )
    return {language: frozenset(values) for language, values in texts.items()}
