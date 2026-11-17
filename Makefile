# home-assistant-dashboard - a touch-first dashboard strategy for phones and wall tablets.
#
#   make help    the steps in order (Polish or English, from $LANG; HELP_LANG=en|pl)
#
# "1. Start" needs only Docker Desktop. "3. Development" makes its Python environment with uv (uv fetches the
# Python of PYTHON_VERSION itself), so any target there can be the first one.

PYTHON_VERSION ?= 3.14
HA_CONFIG ?= /Volumes/config
HA_URL ?= http://homeassistant.local:8123
TESTED_HA ?= 2026.11.0
DEMO_IMAGE ?= home-dashboard-demo
DEMO_PORT ?= 8124
DOCS_IMAGE ?= home-dashboard-docs
DOCS_PORT ?= 9124
DOCKERFILE := dev/docker/Dockerfile

VENV := .venv
VENV_DEV := .venv-dev
HELP_LANG ?= $(if $(filter pl%,$(LANG)),pl,en)

.DEFAULT_GOAL := help
.PHONY: help demo demo-clean docs docs-serve doctor deploy setup setup-dev demo-local test test-browser test-docker \
	test-all lint format docs-build screenshots clean docker-check uv-check

##@ 1. Start | 1. Start

help: ## This list | Ta lista
	@awk -v lang=$(HELP_LANG) 'BEGIN { FS = ":.*## " } \
	  /^##@ / { split(substr($$0, 5), t, " \\| "); printf "\n\033[1m%s\033[0m\n", (lang == "pl" && t[2] != "") ? t[2] : t[1]; next } \
	  /^[a-zA-Z0-9_-]+:.*## / { split($$2, d, " \\| "); printf "  \033[36m%-14s\033[0m %s\n", $$1, (lang == "pl" && d[2] != "") ? d[2] : d[1] }' \
	  $(MAKEFILE_LIST)
	@echo

demo: docker-check ## Try it: a test Home Assistant in Docker, user dev/dev (http://127.0.0.1:8124/home-dashboard/home) | Wypróbuj: testowy Home Assistant w Dockerze, dev/dev (http://127.0.0.1:8124/home-dashboard/home)
	@echo "==> Building the demo image (the first time a few minutes) | Budowa obrazu demo (pierwszy raz kilka minut)"
	docker build -f $(DOCKERFILE) --target demo --build-arg HA_VERSION=$(TESTED_HA) -t $(DEMO_IMAGE) .
	docker run --rm --init $$( [ -t 0 ] && echo -it ) -p 127.0.0.1:$(DEMO_PORT):$(DEMO_PORT) $(DEMO_IMAGE)

demo-clean: ## Remove the demo and documentation images of Docker | Usuń obrazy demo i dokumentacji z Dockera
	@docker image rm -f $(DEMO_IMAGE) $(DOCS_IMAGE) >/dev/null 2>&1 || true
	@echo "==> removed | usunięte: $(DEMO_IMAGE) $(DOCS_IMAGE)"

docs: docs-build ## Build the documentation in Docker and open it | Zbuduj dokumentację w Dockerze i ją otwórz
	@open site/$(if $(filter pl,$(HELP_LANG)),pl/,)index.html 2>/dev/null || xdg-open site/index.html

docs-serve: docker-check ## Live preview of the documentation in Docker (http://127.0.0.1:9124/home-assistant-dashboard/) | Podgląd dokumentacji na żywo w Dockerze (http://127.0.0.1:9124/home-assistant-dashboard/)
	docker build -q -f $(DOCKERFILE) --target docs-tools -t $(DOCS_IMAGE) .
	docker run --rm --init $$( [ -t 0 ] && echo -it ) -p 127.0.0.1:$(DOCS_PORT):$(DOCS_PORT) -v "$(CURDIR)":/src $(DOCS_IMAGE) \
	  mkdocs serve --dev-addr 0.0.0.0:$(DOCS_PORT)

doctor: ## Check Docker, Chrome, uv and the Home Assistant share (installs nothing) | Sprawdź Dockera, Chrome, uv i udział Home Assistant (nic nie instaluje)
	@if docker info >/dev/null 2>&1; then echo "ok       Docker"; \
	  else echo "MISSING  Docker Desktop (installed and running) - needed by demo and docs | Docker Desktop - potrzebny do demo i dokumentacji"; fi
	@if [ -d "/Applications/Google Chrome.app" ] || command -v google-chrome >/dev/null; then echo "ok       Google Chrome"; \
	  else echo "MISSING  Google Chrome - only for test-browser and screenshots | tylko do test-browser i screenshots"; fi
	@if command -v uv >/dev/null 2>&1; then echo "ok       uv $$(uv --version | cut -d' ' -f2)"; \
	  else echo "MISSING  uv - only for development: curl -LsSf https://astral.sh/uv/install.sh | sh"; fi
	@if [ -f "$(HA_CONFIG)/.HA_VERSION" ]; then \
	  version=$$(cat "$(HA_CONFIG)/.HA_VERSION"); \
	  if [ "$$version" = "$(TESTED_HA)" ]; then echo "ok       Home Assistant $$version ($(HA_CONFIG))"; \
	  else echo "WARNING  Home Assistant $$version, tested on $(TESTED_HA) - check the header and navigation (chrome.js)"; fi; \
	else echo "MISSING  $(HA_CONFIG) - Home Assistant config share not mounted (only for deploy)"; fi

##@ 2. Home Assistant | 2. Home Assistant

deploy: ## Copy to HA, tells if a restart is needed (never restarts) | Skopiuj do HA, powie czy trzeba restartu (sam nie restartuje)
	@CONFIG="$(HA_CONFIG)" ./deploy.sh

##@ 3. Development | 3. Rozwój

$(VENV)/bin/pytest: requirements_test.txt | uv-check
	@echo "==> Python $(PYTHON_VERSION) environment in $(VENV) (uv)"
	@test -x $(VENV)/bin/python || uv venv -q --python $(PYTHON_VERSION) $(VENV)
	@uv pip install -q --python $(VENV)/bin/python -r requirements_test.txt
	@touch $@

$(VENV_DEV)/bin/hass: requirements_dev.txt | uv-check
	@echo "==> Test Home Assistant in $(VENV_DEV), Python $(PYTHON_VERSION) (uv)"
	@test -x $(VENV_DEV)/bin/python || uv venv -q --python $(PYTHON_VERSION) $(VENV_DEV)
	@uv pip install -q --python $(VENV_DEV)/bin/python -r requirements_dev.txt
	@touch $@

setup: $(VENV)/bin/pytest ## Create the test environment (.venv, uv) | Utwórz środowisko testów (.venv, uv)

setup-dev: $(VENV_DEV)/bin/hass ## Create the test Home Assistant for demo-local (.venv-dev, uv) | Utwórz testowy Home Assistant dla demo-local (.venv-dev, uv)

demo-local: setup setup-dev ## The demo from .venv-dev, without Docker (for tests and screenshots) | Demo z .venv-dev, bez Dockera (do testów i zrzutów)
	./dev/start.sh

test: setup ## Tests of the integration, no Docker images | Testy integracji, bez obrazów Dockera
	$(VENV)/bin/python -m pytest tests --ignore=tests/browser -m "not docker" -q -p no:cacheprovider

test-browser: setup ## Frontend tests in Google Chrome | Testy frontendu w Google Chrome
	$(VENV)/bin/python -m pytest tests/browser -q -p no:homeassistant -p no:cacheprovider

test-docker: setup docker-check ## Build and run the demo image: HTTP, login, no container left | Zbuduj i uruchom obraz demo: HTTP, logowanie, żaden kontener nie zostaje
	$(VENV)/bin/python -m pytest tests --ignore=tests/browser -m docker -q -p no:cacheprovider

test-all: lint test test-browser test-docker ## lint + test + test-browser + test-docker | lint + test + test-browser + test-docker

lint: setup ## Check the Python code and its format | Sprawdź kod Pythona i jego format
	$(VENV)/bin/ruff check custom_components tests dev scripts
	$(VENV)/bin/ruff format --check custom_components tests dev scripts

format: setup ## Fix what ruff can and format the Python code | Popraw, co ruff umie, i sformatuj kod Pythona
	$(VENV)/bin/ruff check --fix custom_components tests dev scripts
	$(VENV)/bin/ruff format custom_components tests dev scripts

docs-build: docker-check ## Build the documentation site into site/ in Docker (GitHub Pages, docs-hub) | Zbuduj stronę dokumentacji do site/ w Dockerze (GitHub Pages, docs-hub)
	@rm -rf site
	docker build -q -f $(DOCKERFILE) --target docs-site --output type=local,dest=site .
	@# Docker writes the folder for its owner only; the web server of docs-hub must read it.
	@chmod -R u+rwX,go+rX site

screenshots: setup ## Screenshots for the README and the documentation (PL and EN) | Zrzuty do README i dokumentacji (PL i EN)
	$(VENV)/bin/python dev/screenshots.py
	$(VENV)/bin/python dev/gallery.py

clean: ## Remove the environments, site/, caches and the test instance | Usuń środowiska, site/, pamięci podręczne i testową instancję
	find . -name __pycache__ -type d -prune -not -path "./.venv*" -exec rm -rf {} +
	rm -rf .venv .venv-dev .venv-docs .pytest_cache .ruff_cache .dev-config tests/browser/output site

# Helpers (not in the list) -----------------------------------------------------------------------------------------

docker-check:
	@command -v docker >/dev/null 2>&1 || { echo "Docker not found - install and start Docker Desktop: https://www.docker.com/products/docker-desktop/ | Brak Dockera - zainstaluj i uruchom Docker Desktop"; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "Docker is not running - start Docker Desktop and try again | Docker nie działa - uruchom Docker Desktop i spróbuj ponownie"; exit 1; }

uv-check:
	@command -v uv >/dev/null 2>&1 || { echo "uv not found - install it: curl -LsSf https://astral.sh/uv/install.sh | sh | Brak uv - zainstaluj: curl -LsSf https://astral.sh/uv/install.sh | sh"; exit 1; }
