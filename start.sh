#!/bin/sh

# Default environment variables for 9router (can be overridden by Render)
export DATA_DIR=${DATA_DIR:-$(pwd)/data}
export INITIAL_PASSWORD=${INITIAL_PASSWORD:-admin123}
export JWT_SECRET=${JWT_SECRET:-9router-secret-key-12345}
export BASE_URL=${BASE_URL:-http://127.0.0.1:20128}
export CLOUD_URL=https://9router.com
export NODE_ENV=production

# Ensure data directory exists
mkdir -p "$DATA_DIR"

echo "Starting 9Router on internal port 20128..."
PORT=20128 npx 9router --no-browser --skip-update --log &

# Give 9Router a moment to start up
sleep 3

echo "Starting Bebaa Vision Web Client..."
# Use PORT from environment if available (like on Render), otherwise default to 3001
if [ -z "$PORT" ]; then
  PORT=3001
fi
export PORT
node server.js
