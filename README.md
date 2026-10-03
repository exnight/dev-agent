# dev-agent

Shared development image, configuration defaults, and Pi resources.

## Build the image

```bash
docker build --pull -t dev-agent:node24 -f image/Dockerfile image/
```

## Refresh the image

```bash
docker build --pull --no-cache -t dev-agent:node24 -f image/Dockerfile image/
```

Keep provider credentials and session history in Docker volumes.

Apply config/settings.json during machine setup.
