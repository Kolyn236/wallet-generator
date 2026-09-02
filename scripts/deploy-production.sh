#!/bin/sh
set -eu

RELEASE_SHA="${1:-}"
IMAGE_PREFIX="${2:-}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yaml}"
RUNTIME_ENV_FILE="${RUNTIME_ENV_FILE:-/etc/wallet-generator/runtime.env}"
STATE_DIR="${DEPLOY_STATE_DIR:-/var/lib/wallet-generator}"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-wallet-generator}"

if [ -z "$RELEASE_SHA" ] || [ -z "$IMAGE_PREFIX" ]; then
    echo "Usage: $0 <release-sha> <ghcr-image-prefix>" >&2
    exit 2
fi

if [ ! -f "$RUNTIME_ENV_FILE" ]; then
    echo "Production runtime env not found: $RUNTIME_ENV_FILE" >&2
    exit 1
fi

if ! mkdir -p "$STATE_DIR" 2>/dev/null; then
    echo "Deployment state directory is not writable: $STATE_DIR" >&2
    exit 1
fi

CURRENT_RELEASE_FILE="$STATE_DIR/current-release"
PREVIOUS_RELEASE=""
if [ -f "$CURRENT_RELEASE_FILE" ]; then
    PREVIOUS_RELEASE=$(cat "$CURRENT_RELEASE_FILE")
fi

set_release_images() {
    PHP_IMAGE="${IMAGE_PREFIX}-php:$1"
    NGINX_IMAGE="${IMAGE_PREFIX}-nginx:$1"
    export PHP_IMAGE NGINX_IMAGE
}

compose() {
    docker compose \
        --env-file "$RUNTIME_ENV_FILE" \
        --project-name "$PROJECT_NAME" \
        -f "$COMPOSE_FILE" \
        "$@"
}

wait_for_healthy_stack() {
    attempt=1
    while [ "$attempt" -le 30 ]; do
        container_id=$(compose ps -q nginx 2>/dev/null || true)
        if [ -n "$container_id" ]; then
            status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)
            if [ "$status" = "healthy" ]; then
                return 0
            fi
        fi

        sleep 2
        attempt=$((attempt + 1))
    done

    return 1
}

rollback() {
    if [ -z "$PREVIOUS_RELEASE" ] || [ "$PREVIOUS_RELEASE" = "$RELEASE_SHA" ]; then
        return 1
    fi

    echo "Rolling back to $PREVIOUS_RELEASE"
    set_release_images "$PREVIOUS_RELEASE"

    if ! compose pull; then
        echo "Rollback pull failed for $PREVIOUS_RELEASE" >&2
        return 1
    fi

    if ! compose up -d --remove-orphans; then
        echo "Rollback compose up failed for $PREVIOUS_RELEASE" >&2
        return 1
    fi

    if ! wait_for_healthy_stack; then
        echo "Rollback release did not become healthy: $PREVIOUS_RELEASE" >&2
        compose logs --tail=200 || true
        return 1
    fi

    echo "Rollback completed: $PREVIOUS_RELEASE"
    return 0
}

set_release_images "$RELEASE_SHA"

echo "Validating production compose for release $RELEASE_SHA"
compose config --quiet

echo "Pulling immutable release images"
compose pull

echo "Starting release $RELEASE_SHA"
if compose up -d --remove-orphans && wait_for_healthy_stack; then
    tmp_release_file="$CURRENT_RELEASE_FILE.tmp.$$"
    printf '%s\n' "$RELEASE_SHA" > "$tmp_release_file"
    mv "$tmp_release_file" "$CURRENT_RELEASE_FILE"
    echo "Deployment healthy: $RELEASE_SHA"
    compose ps
    exit 0
fi

echo "Release failed health checks: $RELEASE_SHA" >&2
compose ps || true
compose logs --tail=200 || true

if rollback; then
    echo "Deployment failed and the previous release was restored." >&2
else
    echo "Automatic rollback was unavailable or failed." >&2
    if [ -z "$PREVIOUS_RELEASE" ]; then
        echo "This was the first recorded release; stopping the failed stack." >&2
        set_release_images "$RELEASE_SHA"
        compose down || true
    fi
fi

exit 1
