# Dev Agent

A shared, container-based dev setup for my Windows desktop and MacBook, with tools and resources for agent-assisted coding.

## Design

I use one container per project, but I don't want to set up the shared workflow and tooling multiple times.

Set up the host machine once, then reuse stored credentials and tooling across projects and containers.

## Get Started

### 1. Prepare the Host

1. Prepare a Docker-compatible environment for Linux containers.
  - Windows and MacOS: Docker Desktop is recommended.
  - Linux: Docker engine with Docker Compose is recommended.
1. Install Git and `jq`.
1. Run `git clone --recurse-submodules <repository-url> dev-agent && cd dev-agent`

Other Docker-compatible environments may work but are not yet tested.

### 2. Build the Image

Build the image with two tags:

- **Dev:** Use it to develop this repository.
- **Shared base:** Use it as the base for other projects.

Run from this repository's root in a host terminal: `./image/build.sh`. On Windows, use WSL.

### 3. Open the Container

Open the repository in your editor. In VS Code, select **Dev Containers: Reopen in Container**.

Install dependencies inside the container: `npm ci`

## Data Storage

| Container path                   | Storage                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `/workspace`                     | Writable host repository mount.                                    |
| `/opt/dev-agent`                 | Read-only mount of the same repository.                            |
| `/var/lib/dev-agent/pi/agent`    | Volume `dev-agent-pi-agent`: shared Pi settings and credentials.   |
| `/var/lib/dev-agent/pi/sessions` | Volume `dev-agent-pi-sessions`: this repository's session history. |

## Pi Theme and Extensions

Register the mounted package in `$PI_CODING_AGENT_DIR/settings.json`:

```json
"packages": ["/opt/dev-agent"]
```

Keep other package entries. Use the absolute path: relative paths resolve from the settings directory and can break after migration.

Run `/reload`. In `/settings`, select **Theme**, then `github-dark-default`.

Set the terminal background to `#0d1117` to match the theme. Run `npm ci` to install the local schema for theme validation.

- **[Footer](extensions/footer/README.md):** Shows cache hit rate, estimated cost, and context use with a 128k threshold.
- **[`/usage`](extensions/usage/README.md):** Shows recorded session cost by provider and model.

## Checks

After `npm ci`, run these commands inside the container:

```bash
npm test
npm run typecheck
```

## License

[MIT](LICENSE).
