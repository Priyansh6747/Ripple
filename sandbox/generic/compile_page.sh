#!/usr/bin/env bash

APP_DIR="/home/user/app"
PORT="${PORT:-3000}"
START_TIMEOUT=120

log() {
  echo "[sandbox] $1"
}

cd "$APP_DIR" || { echo "[sandbox] Failed to cd into $APP_DIR"; exit 1; }

log "Starting Next.js dev server..."
npm run dev -- --turbopack --port "$PORT" > /tmp/nextjs.log 2>&1 &
NEXT_PID=$!

log "Waiting for Next.js on port ${PORT}..."
start_time=$(date +%s)

while true; do
  if curl -s -o /dev/null -w "%{http_code}" --max-time 1 http://localhost:$PORT 2>/dev/null | grep -q "^[0-9]"; then
    log "Next.js is ready 🚀"
    break
  fi

  now=$(date +%s)
  elapsed=$((now - start_time))

  if [ "$elapsed" -gt "$START_TIMEOUT" ]; then
    log "Timed out waiting for Next.js. Last logs:"
    cat /tmp/nextjs.log
    exit 1
  fi

  # Check if the process died
  if ! kill -0 "$NEXT_PID" 2>/dev/null; then
    log "Next.js process died. Logs:"
    cat /tmp/nextjs.log
    exit 1
  fi

  sleep 0.5
done

wait "$NEXT_PID"