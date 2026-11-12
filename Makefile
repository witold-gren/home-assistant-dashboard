# home-assistant-dashboard - a touch-first dashboard strategy for phones and wall tablets.
#
#   make help    the steps in order (Polish or English, from $LANG; HELP_LANG=en|pl)
#
# Targets that need the Python environment create it first, so any target can be the first one.

PYTHON ?= python3.14
HA_CONFIG ?= /Volumes/config
HA_URL ?= http://homeassistant.local:8123
TESTED_HA ?= 2026.11.0

VENV := .venv
VENV_DEV := .venv-dev
HELP_LANG ?= $(if $(filter pl%,$(LANG)),pl,en)

.DEFAULT_GOAL := help
.PHONY: screenshots help setup setup-dev doctor ui test test-browser test-all lint deploy docs clean

##@ Start | Start

help: ## This list | Ta lista
	@awk -v lang=$(HELP_LANG) 'BEGIN { FS = ":.*## " } \
	  /^##@ / { split(substr($$0, 5), t, " \\| "); printf "\n\033[1m%s\033[0m\n", (lang == "pl" && t[2] != "") ? t[2] : t[1]; next } \
	  /^[a-zA-Z0-9_-]+:.*## / { split($$2, d, " \\| "); printf "  \033[36m%-14s\033[0m %s\n", $$1, (lang == "pl" && d[2] != "") ? d[2] : d[1] }' \
	  $(MAKEFILE_LIST)
	@echo
	@if [ "$(HELP_LANG)" = "pl" ]; then \
	  echo "Środowisko: $(VENV) $$(test -x $(VENV)/bin/pytest && echo '- gotowe' || echo '- powstanie przy pierwszym poleceniu')"; \
	else \
	  echo "Environment: $(VENV) $$(test -x $(VENV)/bin/pytest && echo '- ready' || echo '- created by the first command')"; \
	fi

##@ 1. Setup | 1. Instalacja

$(VENV)/bin/pytest: requirements_test.txt
	@echo "==> Python environment in $(VENV) ($(PYTHON))"
	@command -v $(PYTHON) >/dev/null || { echo "$(PYTHON) not found - macOS: brew install python@3.14"; exit 1; }
	@test -d $(VENV) || $(PYTHON) -m venv $(VENV)
	@$(VENV)/bin/pip install -q --upgrade pip
	@$(VENV)/bin/pip install -q -r requirements_test.txt
	@touch $@

$(VENV_DEV)/bin/hass: requirements_dev.txt
	@echo "==> Test Home Assistant in $(VENV_DEV) ($(PYTHON))"
	@test -d $(VENV_DEV) || $(PYTHON) -m venv $(VENV_DEV)
	@$(VENV_DEV)/bin/pip install -q --upgrade pip
	@$(VENV_DEV)/bin/pip install -q -r requirements_dev.txt
	@touch $@

setup: $(VENV)/bin/pytest ## Create the test environment (.venv) | Utwórz środowisko testów (.venv)

setup-dev: $(VENV_DEV)/bin/hass ## Create the test Home Assistant (.venv-dev) | Utwórz testowy Home Assistant (.venv-dev)

doctor: setup ## Check Chrome and the Home Assistant version | Sprawdź Chrome i wersję Home Assistant
	@if [ -d "/Applications/Google Chrome.app" ] || command -v google-chrome >/dev/null; then echo "ok       Google Chrome"; \
	  else echo "MISSING  Google Chrome - browser tests are skipped"; fi
	@if [ -f "$(HA_CONFIG)/.HA_VERSION" ]; then \
	  version=$$(cat "$(HA_CONFIG)/.HA_VERSION"); \
	  if [ "$$version" = "$(TESTED_HA)" ]; then echo "ok       Home Assistant $$version"; \
	  else echo "WARNING  Home Assistant $$version, tested on $(TESTED_HA) - check the header and navigation (chrome.js)"; fi; \
	else echo "MISSING  $(HA_CONFIG) - config share not mounted"; fi

##@ 2. Try it | 2. Wypróbuj

ui: setup setup-dev ## Throwaway Home Assistant with the real frontend (http://127.0.0.1:8124/home-dashboard/home) | Testowy Home Assistant z prawdziwym frontendem (http://127.0.0.1:8124/home-dashboard/home)
	./dev/start.sh

##@ 3. Home Assistant | 3. Home Assistant

deploy: ## Copy to HA, tells if a restart is needed (never restarts) | Skopiuj do HA, powie czy trzeba restartu (sam nie restartuje)
	@CONFIG="$(HA_CONFIG)" ./deploy.sh

##@ 4. Development | 4. Rozwój

test: setup ## Tests of the integration | Testy integracji
	$(VENV)/bin/python -m pytest tests --ignore=tests/browser -q -p no:cacheprovider

test-browser: setup ## Frontend tests in Google Chrome | Testy frontendu w Google Chrome
	$(VENV)/bin/python -m pytest tests/browser -q -p no:homeassistant -p no:cacheprovider

screenshots: setup ## Make the README screenshots | Utwórz zrzuty do README
	$(VENV)/bin/python dev/screenshots.py
	$(VENV)/bin/python dev/gallery.py

test-all: test test-browser lint ## All tests and the linter | Wszystkie testy i linter

lint: setup ## Check the Python code | Sprawdź kod Pythona
	$(VENV)/bin/ruff check custom_components tests dev scripts

docs: ## Open the README | Otwórz README
	@open README$(if $(filter pl,$(HELP_LANG)),.pl,).md 2>/dev/null || xdg-open README.md

clean: ## Remove caches and the test instance (keeps the environment) | Usuń pliki tymczasowe i testową instancję (środowisko zostaje)
	find . -name __pycache__ -type d -prune -not -path "./.venv*" -exec rm -rf {} +
	rm -rf .pytest_cache .ruff_cache .dev-config tests/browser/output
