# Dev Agent

A shared, container-based dev setup for my Windows desktop and MacBook, with tools and resources for agent-assisted coding.

## Design

I use one container per project, but I don't want to re-login and set up providers per container, especially upon container updates.

I adopt a **shared, machine-local mounted volume** for agent states. Stored credentials then can be reused across projects and containers.

I choose [Pi](https://pi.dev) for its simplicity and customization. The [`package.json`](package.json) defines the Pi package resources and the Pi version used by the image.

## Get Started

### 1. Prepare the Host

1. Install and start Docker Desktop.
2. Install an editor with devcontainer support.
3. Install Git and `jq`. Use a POSIX shell.

On Windows, use a WSL terminal. On macOS, use the host terminal. You do not need Node.js on the host.

### 2. Get the Repository

Replace `<repository-url>` with this repository's URL. Run:

```bash
git clone --recurse-submodules <repository-url> dev-agent
cd dev-agent
```

### 3. Build the Image

Run these commands from the repository root in the host terminal:

```bash
PI_VERSION="$(jq -er '.devDependencies["@earendil-works/pi-coding-agent"]' package.json)"
docker build \
  -f image/Dockerfile \
  --build-arg PI_VERSION="$PI_VERSION" \
  -t dev-agent-dev:node26 \
  .
```

Build the image on each machine. The devcontainer configuration does not build it automatically.

### 4. Open the Container

Open the repository in your editor. In VS Code, select **Dev Containers: Reopen in Container**.

Install dependencies inside the container:

```bash
npm ci
```

Pi is installed in the image. Set up provider authentication before use. Do not commit credentials.

## Data Storage

| Container path              | Storage                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `/workspace`                | Writable host repository mount.                                |
| `/opt/dev-agent`            | Read-only mount of the same repository.                        |
| `/home/devops/.pi/agent`    | Volume `dev-agent-home`: local agent settings and credentials. |
| `/home/devops/.pi/sessions` | Volume `dev-agent-dev-agent-sessions`: session history.        |

Volumes retain data when you replace a container. They are local to each Docker engine. Containers that share a volume can access its data.

Git does not transfer credentials or sessions. Deleting a volume deletes its data.

The mounts do not register the Pi package or copy `config/settings.json` into Pi's local settings.

## Pi Theme and Extensions

After the package is loaded in Pi, run `/reload`. In `/settings`, select **Theme**, then `github-dark-default`.

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
