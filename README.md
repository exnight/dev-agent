# dev-agent

Shared development image, configuration defaults, and Pi resources.

## Build the image

```bash
docker build --pull -t dev-agent:node26 -f image/Dockerfile image/
```

## Refresh the image

```bash
docker build --pull --no-cache -t dev-agent:node26 -f image/Dockerfile image/
```

Keep provider credentials and session history in Docker volumes.

Apply config/settings.json during machine setup.

## Local Dev

```bash
docker run --rm -it --init \
  --mount "type=bind,source=$PWD,target=/workspace" \
  dev-agent pi
```
