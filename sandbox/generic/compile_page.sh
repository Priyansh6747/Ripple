#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/home/user"
PORT="${PORT:-3000}"
START_TIMEOUT=120

log() {
  echo "[sandbox] $1"
}

check_server() {
  curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}" || true
}

wait_for_server() {
  log "Waiting for Next.js server on port ${PORT}..."

  local start_time
  start_time=$(date +%s)

  while true; do
    status=$(check_server)

    if [[ "$status" == "200" ]]; then
      log "Next.js server is ready."
      break
    fi

    now=$(date +%s)
    elapsed=$((now - start_time))

    if (( elapsed > START_TIMEOUT )); then
      log "Server failed to start within ${START_TIMEOUT}s"
      exit 1
    fi

    sleep 0.2
  done
}

shutdown() {
  log "Shutting down sandbox..."
  kill -TERM "$NEXT_PID" 2>/dev/null || true
  wait "$NEXT_PID" || true
  exit 0
}

trap shutdown SIGINT SIGTERM

cd "$APP_DIR"

log "Installing dependencies (if needed)..."
npm install --silent

log "Starting Next.js dev server..."

npm run dev -- --turbopack --port "$PORT" &
NEXT_PID=$!

wait_for_server

log "Sandbox ready 🚀"

wait "$NEXT_PID"