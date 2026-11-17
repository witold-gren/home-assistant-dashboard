"""The "Try it on a Mac" section of the common standard (§8b): in both READMEs (and so on the docs site), with
`make demo`, the address on the demo port of the Makefile, and the login."""

from __future__ import annotations

from pathlib import Path
import re

import pytest

ROOT = Path(__file__).parent.parent
STANDARD = Path.home() / "Home Assistant" / "standards" / "gpu-studio.md"
HEADINGS = {"README.md": "## Try it on a Mac", "README.pl.md": "## Wypróbuj na Macu"}


def demo_port() -> str:
    makefile = (ROOT / "Makefile").read_text("utf-8")
    return re.search(r"^DEMO_PORT \?= (\d+)$", makefile, re.MULTILINE).group(1)


def section(name: str) -> str:
    text = (ROOT / name).read_text("utf-8")
    start = text.index(HEADINGS[name])
    end = text.find("\n## ", start + 3)
    return text[start:end]


@pytest.mark.parametrize("name", HEADINGS)
def test_both_readmes_say_how_to_try_it_on_a_mac(name: str) -> None:
    part = section(name)
    assert "make demo" in part
    assert f"http://127.0.0.1:{demo_port()}/home-dashboard/home" in part
    assert "`dev`" in part
    assert "Docker Desktop" in part and "make demo-clean" in part
    assert all(target in part for target in ("make test`", "make test-browser", "make docs", "make setup"))
    assert len(part.strip().splitlines()) <= 15


@pytest.mark.parametrize("name", HEADINGS)
def test_the_section_is_the_first_chapter(name: str) -> None:
    text = (ROOT / name).read_text("utf-8")
    assert text.index(HEADINGS[name]) == text.index("\n## ") + 1


def test_the_demo_port_is_the_one_of_the_standard() -> None:
    if not STANDARD.exists():
        pytest.skip("the standard of the house is not on this computer")
    lines = STANDARD.read_text("utf-8").splitlines()
    row = next(line for line in lines if "`home-assistant-dashboard`" in line)
    assert f"| {demo_port()} |" in row


def test_make_demo_builds_and_runs_the_image_on_the_demo_port() -> None:
    makefile = (ROOT / "Makefile").read_text("utf-8")
    demo = makefile.split("\ndemo:", 1)[1].split("\n\n", 1)[0]
    assert "docker build -f $(DOCKERFILE) --target demo" in demo
    assert "\nDOCKERFILE := dev/docker/Dockerfile\n" in makefile
    assert "docker run --rm --init" in demo and "127.0.0.1:$(DEMO_PORT):$(DEMO_PORT)" in demo
    assert f"DEMO_PORT ?= {demo_port()}" in makefile
    assert "\ndemo-clean:" in makefile and "\ndemo-local:" in makefile
