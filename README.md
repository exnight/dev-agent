# dev-agent

## Purpose

This project provides a common development environment for coding agents, first supporting Pi.

The container consolidates development tools to reduce setup work. The repository keeps shared agent settings, prompts, and skills in one
location for use in different projects.

## Contents

- **Development image:** Debian 13, Node.js 26, Pi, Playwright, `bat`, and `eza`.
- **Local development config:** A devcontainer configuration.
- **Agent resources:** shared settings, prompts, and skills.

## Local Dev

The host requires Docker, `jq`, and a POSIX shell.

Run the following commands in a host terminal, not in the container.

1. Start Docker on the host.
2. Change to the repository root.
3. Read the Pi version from `package.json`:
   ```bash
   PI_VERSION="$(jq -er '.devDependencies["@earendil-works/pi-coding-agent"]' package.json)"
   ```
4. Build the development image:
   ```bash
   docker build -f image/Dockerfile --build-arg PI_VERSION="$PI_VERSION" -t dev-agent-dev:node26 .
   ```
5. Use a code editor and open in the container.
