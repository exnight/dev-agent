FROM node:26-bookworm-slim

ARG PI_VERSION=1.0.2
ARG PLAYWRIGHT_CLI_VERSION=0.1.22

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash ca-certificates curl git openssh-client procps ripgrep wl-clipboard \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright

RUN npm install -g --ignore-scripts \
        "@earendil-works/pi-coding-agent@${PI_VERSION}" \
        "@playwright/cli@${PLAYWRIGHT_CLI_VERSION}" \
    && node /usr/local/lib/node_modules/@playwright/cli/node_modules/playwright/cli.js \
        install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* \
    && npm cache clean --force

RUN groupmod --new-name devops node \
    && usermod --login devops \
        --home /home/devops \
        --move-home node

RUN mkdir -p \
        /workspace \
        /home/devops/.pi/agent \
        /home/devops/.pi/sessions \
    && chown -R devops:devops /workspace /home/devops/.pi

ENV PI_CODING_AGENT_DIR=/home/devops/.pi/agent
ENV PI_CODING_AGENT_SESSION_DIR=/home/devops/.pi/sessions

USER devops
WORKDIR /workspace

CMD ["sleep", "infinity"]
