"""The translations of the app: a key written twice in one language silently hides the first text, and a
key the code asks for that is not there shows as the key itself."""

from __future__ import annotations

from pathlib import Path
import re

I18N = Path(__file__).parent.parent / "custom_components/home_dashboard/www/app/i18n.js"


def test_no_key_is_written_twice_in_one_language():
    source = I18N.read_text(encoding="utf-8")
    parts = re.split(r"\n  (\w+): \{\n", source)
    for language, body in zip(parts[1::2], parts[2::2], strict=True):
        keys = re.findall(r"^    (\w+):", body.split("\n  },")[0], re.MULTILINE)
        repeated = sorted({key for key in keys if keys.count(key) > 1})
        assert repeated == [], f"{language}: {repeated}"


# Their own `_t` puts a prefix of theirs in front of the key.
PREFIXED = {"background-maker.js", "block-editor.js"}
USED = re.compile(r'this\._t\(\s*"([a-z][a-z0-9_]+)"|translate\([^,()]+,\s*"([a-z][a-z0-9_]+)"')


def test_every_text_the_code_asks_for_is_there_in_both_languages():
    keys: dict[str, set[str]] = {}
    language = None
    for line in I18N.read_text(encoding="utf-8").splitlines():
        if match := re.match(r"^  (\w+): \{$", line):
            language = match.group(1)
            keys.setdefault(language, set())
        elif line.startswith("};"):
            language = None
        elif language and (match := re.match(r"^    (\w+):", line)):
            keys[language].add(match.group(1))
    www = I18N.parent.parent
    used = {}
    for path in [*sorted((www / "app").glob("*.js")), *sorted((www / "editor").glob("*.js"))]:
        if path.name in PREFIXED:
            continue
        for match in USED.finditer(path.read_text(encoding="utf-8")):
            used.setdefault(match.group(1) or match.group(2), path.name)
    for language in ("en", "pl"):
        missing = {key: name for key, name in used.items() if key not in keys[language]}
        assert missing == {}, f"{language}: {missing}"
