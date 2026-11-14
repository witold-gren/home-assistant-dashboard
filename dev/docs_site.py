"""MkDocs hook of the documentation site (mkdocs.yml).

The README and the changelog live at the top of the repository, where GitHub shows them; the site needs them
in docs/. Before each build they are copied there (only when they changed, so `mkdocs serve` does not rebuild
in a loop) with their links made to work from docs/, and links of the pages to files outside docs/ point to
GitHub.
"""

from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
BLOB = "https://github.com/witold-gren/home-assistant-dashboard/blob/main/"
SITE = "/home-assistant-dashboard/"
RAW = "https://raw.githubusercontent.com/witold-gren/home-assistant-dashboard/main/"
ICON = ROOT / "custom_components/home_dashboard/brand/icon@2x.png"

# The files made on each build: kept out of git (.gitignore).
GENERATED = {
    "index.md": "README.md",
    "index.pl.md": "README.pl.md",
    "changelog.md": "CHANGELOG.md",
}

LINK = re.compile(r'(\]\(|src=")([^)"\s#]+)')
PICTURE = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg")


def outside(path: str) -> str:
    """A file the site does not hold, from the top of the repository: its page or its picture on GitHub."""
    return (RAW if path.lower().endswith(PICTURE) else BLOB) + path


def from_top(target: str) -> str:
    """A link of the README or the changelog, written from the top of the repository, as seen from docs/."""
    if "://" in target or target.startswith(("mailto:", "/")):
        return target
    if target == "README.md":
        return "index.md"
    if target == "README.pl.md":
        return "index.pl.md"
    if target == "CHANGELOG.md":
        return "changelog.md"
    if target.startswith("docs/"):
        return target.removeprefix("docs/")
    return outside(target)


def from_docs(target: str) -> str:
    """A link of a page in docs/: one going up out of it goes to the start page or to GitHub."""
    if not target.startswith("../"):
        return target
    return from_top(target.removeprefix("../"))


def page_url(name: str, language: str) -> str:
    """The address of a page of the site in a language: index.md -> /…/pl/, guide.md#x -> /…/guide/#x."""
    path, _, anchor = name.partition("#")
    stem = path.removesuffix(".md")
    prefix = SITE + ("pl/" if language == "pl" else "")
    return prefix + ("" if stem == "index" else stem + "/") + (f"#{anchor}" if anchor else "")


def other_language(target: str, language: str) -> str:
    """A link to the same document in the other language: the site has each language apart, so its address."""
    path = target.partition("#")[0]
    if "/" in path or "://" in target or not path.endswith(".md"):
        return target
    if language == "en" and path.endswith(".pl.md"):
        return page_url(target.replace(".pl.md", ".md", 1), "pl")
    if language == "pl" and not path.endswith(".pl.md") and has_polish(path):
        return page_url(target, "en")
    return target


def html_pictures(markdown: str, url: str) -> str:
    """Pictures written as HTML (<img src="screenshots/…">): MkDocs leaves them as they are, so from a page
    deeper than the top of the site (a Polish one in pl/, any but the start page) they go up to the files."""
    up = "../" * url.count("/")
    if not up:
        return markdown
    relative = re.compile(r'(<img[^>]*?\ssrc=")(?![a-z]+:|/|#)([^"]+)')
    return relative.sub(lambda match: match.group(1) + up + match.group(2), markdown)


def has_polish(name: str) -> bool:
    """A document with a Polish one beside it; the made ones count by their sources, before they are made."""
    polish = name.replace(".md", ".pl.md")
    if name in GENERATED:
        return polish in GENERATED
    return (DOCS / polish).exists()


def language_of(page) -> str:
    source = page.file.src_uri
    return "pl" if source.endswith(".pl.md") or source.startswith("pl/") else "en"


def rewrite(text: str, convert) -> str:
    return LINK.sub(lambda match: match.group(1) + convert(match.group(2)), text)


def write_if_changed(path: Path, content: bytes) -> None:
    if not path.exists() or path.read_bytes() != content:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def generate() -> None:
    for target, source in GENERATED.items():
        write_if_changed(
            DOCS / target, rewrite((ROOT / source).read_text(encoding="utf-8"), from_top).encode()
        )
    write_if_changed(DOCS / "assets/icon.png", ICON.read_bytes())


def on_pre_build(config, **kwargs) -> None:
    generate()


def on_page_markdown(markdown: str, page, config, files) -> str:
    language = language_of(page)
    link = re.compile(r'(\]\(|src=")([^)"\s]+)')
    markdown = link.sub(
        lambda match: match.group(1) + other_language(from_docs(match.group(2)), language), markdown
    )
    return html_pictures(markdown, page.url)


if __name__ == "__main__":
    generate()
    print("docs/index.md, docs/index.pl.md, docs/changelog.md, docs/assets/icon.png\n".strip())
