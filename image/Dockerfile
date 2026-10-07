FROM node:26-trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash ca-certificates curl git openssh-client procps ripgrep wl-clipboard \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright

ARG PLAYWRIGHT_CLI_VERSION=0.1.22

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install -g --ignore-scripts \
        "@playwright/cli@${PLAYWRIGHT_CLI_VERSION}" \
    && node /usr/local/lib/node_modules/@playwright/cli/node_modules/playwright/cli.js \
        install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

# Bump this build argument to refresh apt tools without reinstalling Chromium.
ARG TOOLS_REFRESH=0

RUN : "${TOOLS_REFRESH}" \
    && apt-get update \
    && apt-get install -y --no-install-recommends bat eza \
    && ln -s /usr/bin/batcat /usr/local/bin/bat \
    && bat --version \
    && eza --version \
    && rm -rf /var/lib/apt/lists/*

RUN groupmod --new-name devops node \
    && usermod --login devops \
        --home /home/devops \
        --move-home node \
    && mkdir -p \
        /workspace \
        /home/devops/.pi/agent \
        /home/devops/.pi/sessions \
    && chown -R devops:devops /workspace /home/devops/.pi

ENV PI_CODING_AGENT_DIR=/home/devops/.pi/agent
ENV PI_CODING_AGENT_SESSION_DIR=/home/devops/.pi/sessions

# Required build argument, derived from package.json.
# Declare it after all layers that should survive Pi upgrades.
ARG PI_VERSION

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    : "${PI_VERSION:?Pass PI_VERSION from package.json}" \
    && npm install -g --ignore-scripts \
        "@earendil-works/pi-coding-agent@${PI_VERSION}"

USER devops
WORKDIR /workspace

CMD ["sleep", "infinity"]
