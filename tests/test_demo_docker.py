"""`make demo` in Docker (§8b of the common standard): the image builds, Home Assistant answers, dev/dev logs
in, and nothing is left behind once it stops. Skipped on a computer without a running Docker."""

from __future__ import annotations

import json
from pathlib import Path
import shutil
import socket
import subprocess
import time
import urllib.request
import uuid

import pytest

ROOT = Path(__file__).parent.parent
IMAGE = "home-dashboard-demo-test"


def docker_runs() -> bool:
    if not shutil.which("docker"):
        return False
    return subprocess.run(["docker", "info"], capture_output=True, check=False).returncode == 0


pytestmark = [pytest.mark.docker, pytest.mark.skipif(not docker_runs(), reason="Docker is not running here")]


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def post(url: str, payload: dict) -> dict:
    request = urllib.request.Request(
        url, json.dumps(payload).encode(), {"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read())


def wait_for(url: str, seconds: int = 90) -> None:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as response:
                if response.status == 200:
                    return
        except OSError:
            pass
        time.sleep(1)
    raise AssertionError(f"{url} did not answer")


def test_the_demo_image_runs_logs_in_and_leaves_nothing(socket_enabled) -> None:
    build = subprocess.run(
        ["docker", "build", "-q", "-f", "dev/docker/Dockerfile", "-t", IMAGE, "."],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=1800,
        check=False,
    )
    assert build.returncode == 0, build.stderr[-2000:]
    name = f"home-dashboard-demo-test-{uuid.uuid4().hex[:8]}"
    port = free_port()
    subprocess.run(
        ["docker", "run", "--rm", "--init", "-d", "--name", name, "-p", f"127.0.0.1:{port}:8124", IMAGE],
        check=True,
        capture_output=True,
    )
    try:
        base = f"http://127.0.0.1:{port}"
        wait_for(f"{base}/manifest.json")
        client = f"{base}/"
        flow = post(
            f"{base}/auth/login_flow",
            {"client_id": client, "handler": ["homeassistant", None], "redirect_uri": client},
        )
        login = post(
            f"{base}/auth/login_flow/{flow['flow_id']}",
            {"client_id": client, "username": "dev", "password": "dev"},
        )
        assert login["type"] == "create_entry"
        with urllib.request.urlopen(f"{base}/home-dashboard/home", timeout=10) as page:
            assert page.status == 200
    finally:
        subprocess.run(["docker", "stop", "-t", "20", name], capture_output=True, check=False)
    assert gone(name), f"{name} is still there"


def gone(name: str, seconds: int = 30) -> bool:
    """A container started with --rm is removed a moment after it stops."""
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        left = subprocess.run(
            ["docker", "ps", "-aq", "--filter", f"name={name}"], capture_output=True, text=True, check=True
        )
        if not left.stdout.strip():
            return True
        time.sleep(1)
    return False
