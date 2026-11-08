#!/usr/bin/env bash
# Build and run the SeaweedFS object storage for the comic app with plain Docker (no Compose).
#
#   cp .env.example .env      # set strong AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (same as backend/.env)
#   sudo bash init.sh
#
# Safe to re-run: it rebuilds the image, recreates the container and keeps the data in $DATA_DIR.
# Override defaults with environment variables, e.g. `sudo DATA_DIR=/mnt/disk2/seaweedfs bash init.sh`.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

IMAGE="${IMAGE:-comic-app-seaweedfs:4.52}"
CONTAINER="${CONTAINER:-comic-app-seaweedfs}"
DATA_DIR="${DATA_DIR:-/var/lib/seaweedfs}"
BUCKET="${BUCKET:-comic-images}"
# 127.0.0.1 = only the local Nginx and backend can reach SeaweedFS. Do not expose these ports publicly.
BIND_ADDRESS="${BIND_ADDRESS:-127.0.0.1}"
MASTER_PORT="${MASTER_PORT:-9333}"
FILER_PORT="${FILER_PORT:-8888}"
S3_PORT="${S3_PORT:-8333}"
READY_TIMEOUT="${READY_TIMEOUT:-120}"

if [[ ! -f .env ]]; then
    echo "Missing $SCRIPT_DIR/.env. Create it first: cp .env.example .env (then set the credentials)." >&2
    exit 1
fi
if grep -q 'replace-this-local-secret' .env; then
    echo "WARNING: .env still uses the example secret. Change AWS_SECRET_ACCESS_KEY (and backend/.env)." >&2
fi

echo "==> Preparing data directory $DATA_DIR"
mkdir -p "$DATA_DIR"

echo "==> Building image $IMAGE"
docker build -t "$IMAGE" .

if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
    echo "==> Removing existing container $CONTAINER (data in $DATA_DIR is kept)"
    docker rm -f "$CONTAINER" >/dev/null
fi

echo "==> Starting container $CONTAINER"
docker run -d \
    --name "$CONTAINER" \
    --restart unless-stopped \
    --env-file .env \
    -e S3_BUCKET="$BUCKET" \
    -p "$BIND_ADDRESS:$MASTER_PORT:9333" \
    -p "$BIND_ADDRESS:$FILER_PORT:8888" \
    -p "$BIND_ADDRESS:$S3_PORT:8333" \
    -v "$DATA_DIR:/data" \
    --log-driver local --log-opt max-size=10m --log-opt max-file=5 \
    "$IMAGE" >/dev/null

echo "==> Waiting for SeaweedFS (timeout ${READY_TIMEOUT}s)"
check_url() { docker exec "$CONTAINER" wget -q -O /dev/null "$1" 2>/dev/null; }
elapsed=0
until check_url "http://127.0.0.1:9333/cluster/status" && check_url "http://127.0.0.1:8888/"; do
    if (( elapsed >= READY_TIMEOUT )); then
        echo "SeaweedFS did not become ready. Check: docker logs $CONTAINER" >&2
        exit 1
    fi
    sleep 2
    elapsed=$((elapsed + 2))
done
echo "SeaweedFS is ready."

weed_shell() {
    printf '%s\n' "$1" | docker exec -i "$CONTAINER" weed shell -master=127.0.0.1:9333
}

echo "==> Ensuring bucket $BUCKET exists"
if ! weed_shell "s3.bucket.list" | grep -qw "$BUCKET"; then
    weed_shell "s3.bucket.create -name $BUCKET"
fi

echo "==> Configuring public read-only access on $BUCKET"
weed_shell "s3.bucket.access -name $BUCKET -user anonymous -access Read"

echo
echo "SeaweedFS initialization completed."
echo "  S3 API : http://$BIND_ADDRESS:$S3_PORT  (backend STORAGE_ENDPOINT)"
echo "  Data   : $DATA_DIR"
echo "  Logs   : docker logs -f $CONTAINER"
