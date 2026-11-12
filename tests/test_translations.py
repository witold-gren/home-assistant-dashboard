"""The translations of the app: a key written twice in one language silently hides the first text."""

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
