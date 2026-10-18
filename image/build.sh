#!/bin/sh
set -eu

case "${1-}" in
  -h|--help)
    printf 'Usage: %s [docker build options]\n' "$0"
    printf 'Build the development and shared base tags from repository configuration.\n'
    exit 0
    ;;
esac

for tool in docker jq; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$tool" >&2
    exit 1
  fi
done

ROOT="$(CDPATH= cd "$(dirname "$0")/.." && pwd -P)"

read_config() {
  jq -er "$1 | select(type == \"string\" and length > 0)" "$2"
}

DEV_IMAGE="$(read_config '.image' "$ROOT/.devcontainer/devcontainer.json")"
BASE_IMAGE="$(read_config '.baseImage' "$ROOT/image/config.json")"
PI_VERSION="$(read_config '.devDependencies["@earendil-works/pi-coding-agent"]' "$ROOT/package.json")"

printf 'Building %s and %s (Pi %s)\n' "$DEV_IMAGE" "$BASE_IMAGE" "$PI_VERSION"
exec docker build \
  --file "$ROOT/image/Dockerfile" \
  --build-arg "PI_VERSION=$PI_VERSION" \
  --tag "$DEV_IMAGE" \
  --tag "$BASE_IMAGE" \
  "$@" \
  "$ROOT"
