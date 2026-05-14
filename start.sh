#!/bin/sh

# Start Node.js API in background (don't let it kill the container)
cd /app && node server.js &
API_PID=$!

# Give it 3 seconds to start
sleep 3

# Check if it's still running
if kill -0 $API_PID 2>/dev/null; then
  echo "[START] API running (PID $API_PID)"
else
  echo "[START] WARNING: API failed to start, nginx will still serve static files"
fi

# Start nginx in foreground (keeps container alive)
nginx -g 'daemon off;'
