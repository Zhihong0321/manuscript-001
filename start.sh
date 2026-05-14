#!/bin/sh

# Start the Node.js API in background
cd /app && node server.js &

# Start nginx in foreground
nginx -g 'daemon off;'
