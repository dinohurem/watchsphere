#!/bin/bash

# WatchSphere Development Startup Script
# Runs backend, web, and mobile (iOS) simultaneously

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   WatchSphere Development Launcher    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down all services...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check if MongoDB is running
echo -e "${YELLOW}Checking MongoDB...${NC}"
if ! pgrep -x "mongod" > /dev/null; then
    echo -e "${YELLOW}Starting MongoDB...${NC}"
    brew services start mongodb-community 2>/dev/null || mongod --fork --logpath /tmp/mongod.log 2>/dev/null || {
        echo -e "${RED}MongoDB is not running. Please start it manually.${NC}"
        echo -e "${YELLOW}Try: brew services start mongodb-community${NC}"
    }
else
    echo -e "${GREEN}MongoDB is already running${NC}"
fi

echo ""

# Start Backend
echo -e "${GREEN}Starting Backend (FastAPI)...${NC}"
(
    cd "$PROJECT_ROOT/apps/backend"
    source venv/bin/activate 2>/dev/null || python3 -m venv venv && source venv/bin/activate
    pip install -r requirements.txt -q 2>/dev/null
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8787
) &
BACKEND_PID=$!
echo -e "${GREEN}Backend started (PID: $BACKEND_PID)${NC}"

sleep 2

# Start Web
echo -e "${GREEN}Starting Web (Vite)...${NC}"
(
    cd "$PROJECT_ROOT/apps/web"
    npm run dev
) &
WEB_PID=$!
echo -e "${GREEN}Web started (PID: $WEB_PID)${NC}"

sleep 2

# Start Mobile (iOS)
echo -e "${GREEN}Starting Mobile (Expo iOS)...${NC}"
(
    cd "$PROJECT_ROOT/apps/mobile"
    npx expo start --ios
) &
MOBILE_PID=$!
echo -e "${GREEN}Mobile started (PID: $MOBILE_PID)${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}All services are starting!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "  ${YELLOW}Backend:${NC}  http://localhost:8787"
echo -e "  ${YELLOW}API Docs:${NC} http://localhost:8787/docs"
echo -e "  ${YELLOW}Web:${NC}      http://localhost:5177"
echo -e "  ${YELLOW}Mobile:${NC}   iOS Simulator"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all background processes
wait
