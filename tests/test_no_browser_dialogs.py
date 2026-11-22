"""Questions and messages are windows of the editor and of the dashboard (editor/ask-dialog.js and
app/message.js), never window.confirm / alert / prompt."""

from __future__ import annotations

from pathlib import Path
import re

WWW = Path(__file__).resolve().parents[1] / "custom_components" / "home_dashboard" / "www"
NATIVE = re.compile(r"\b(?:window\.)?(confirm|alert|prompt)\s*\(")
HINT = "use askInEditor() (editor/ask-dialog.js) or showMessage() (app/message.js):\n"


def code_of(line: str) -> str:
    """The line without its comment: `// ...` at the end, or a line of a /** ... */ block."""
    stripped = line.strip()
    if stripped.startswith(("*", "/*")):
        return ""
    return line.split("//", 1)[0]


def test_no_native_browser_dialogs():
    found = []
    for path in sorted(WWW.rglob("*.js")):
        if "vendor" in path.relative_to(WWW).parts:
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if NATIVE.search(code_of(line)):
                found.append(f"{path.relative_to(WWW)}:{number}: {line.strip()}")
    assert found == [], HINT + "\n".join(found)


def test_the_check_finds_a_native_dialog():
    assert NATIVE.search(code_of("    if (!window.confirm(text)) return;"))
    assert NATIVE.search(code_of("alert (text)"))
    assert not NATIVE.search(code_of("this._confirmAction()"))
    assert not NATIVE.search(code_of("   * confirm (the label of the button)"))
