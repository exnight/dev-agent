FROM node:26-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash ca-certificates curl git openssh-client procps ripgrep \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g --ignore-scripts \
        @earendil-works/pi-coding-agent@1.0.0 \
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
