#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/home/user/app"
PORT="${PORT:-3000}"
START_TIMEOUT=120

log() {
  echo "[sandbox] $1"
}

wait_for_port() {
  log "Waiting for Next.js server on port ${PORT}..."

  local start_time
  start_time=$(date +%s)

  while true; do
    if nc -z localhost "$PORT" 2>/dev/null; then
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

log "Starting Next.js dev server..."

npm run dev -- --turbopack --port "$PORT" &
NEXT_PID=$!

wait_for_port

log "Sandbox ready 🚀"

wait "$NEXT_PID"