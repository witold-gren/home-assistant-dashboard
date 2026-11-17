# The images of the Makefile, so that trying the dashboard and its documentation needs only Docker:
#   docs-tools  MkDocs with its plugins (make docs-serve mounts the repository into it)
#   docs-site   the built documentation site (make docs-build: docker build --target docs-site --output site)
#   demo        a throwaway Home Assistant with demo devices, this integration and a ready dashboard (make demo);
#               the owner (dev/dev), the rooms and the dashboard are made while the image is built, so a start
#               takes seconds. The version is the one the tests and `make demo-local` use.
# The demo is the last stage, so a plain `docker build` makes it.
ARG HA_VERSION=2026.11.0

FROM python:3.14-slim AS docs-tools
COPY requirements_docs.txt /tmp/requirements_docs.txt
RUN pip install --no-cache-dir -r /tmp/requirements_docs.txt
ENV NO_MKDOCS_2_WARNING=1
WORKDIR /src

FROM docs-tools AS docs
COPY mkdocs.yml README.md README.pl.md CHANGELOG.md ./
COPY docs docs
COPY dev/docs_site.py dev/docs_site.py
COPY custom_components/home_dashboard/brand custom_components/home_dashboard/brand
RUN mkdocs build --strict --site-dir /site

FROM scratch AS docs-site
COPY --from=docs /site /

FROM ghcr.io/home-assistant/home-assistant:${HA_VERSION} AS demo
COPY dev/configuration.yaml /demo/configuration.yaml
COPY dev/bootstrap.py dev/docker/prepare.sh dev/docker/run.sh /demo/
COPY custom_components/home_dashboard /config/custom_components/home_dashboard
RUN sh /demo/prepare.sh

EXPOSE 8124
ENTRYPOINT ["sh", "/demo/run.sh"]
