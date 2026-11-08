#!/usr/bin/env bash
# Prepare data directories and start the monitoring server (Prometheus + Loki + Grafana).
#
#   cp .env.example .env
#   cp grafana/.env.example grafana/.env      # set a strong GF_SECURITY_ADMIN_PASSWORD
#   edit prometheus/prometheus.yml            # replace APP_SERVER_IP
#   sudo bash init.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

[[ -f .env ]] || { echo "Missing .env: cp .env.example .env" >&2; exit 1; }
[[ -f grafana/.env ]] || { echo "Missing grafana/.env: cp grafana/.env.example grafana/.env" >&2; exit 1; }

set -a
# shellcheck disable=SC1091
source ./.env
set +a
DATA_DIR="${MONITORING_DATA_DIR:-/var/lib/comic-monitoring}"

if grep -q 'change-this-to-a-long-random-password' grafana/.env; then
    echo "grafana/.env still has the example admin password. Set GF_SECURITY_ADMIN_PASSWORD first." >&2
    exit 1
fi
if grep -q 'APP_SERVER_IP' prometheus/prometheus.yml; then
    echo "WARNING: prometheus/prometheus.yml still targets APP_SERVER_IP; backend metrics will be down." >&2
fi

echo "==> Preparing data directories in $DATA_DIR"
mkdir -p "$DATA_DIR/prometheus" "$DATA_DIR/loki" "$DATA_DIR/grafana"
# Each image runs as a fixed non-root user.
chown -R 65534:65534 "$DATA_DIR/prometheus"
chown -R 10001:10001 "$DATA_DIR/loki"
chown -R 472:0 "$DATA_DIR/grafana"

echo "==> Starting monitoring stack"
docker compose up -d

echo
docker compose ps
echo
echo "Grafana : http://<this-server>:${GRAFANA_PORT:-3017}"
echo "Loki    : http://<this-server>:${LOKI_PORT:-3100}  (set as LOKI_URL in agent/.env on the app server)"
