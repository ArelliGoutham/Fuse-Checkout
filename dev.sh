#!/bin/bash
# OfferForge — Local Development Setup
# Starts MongoDB, backend API, seeds data, and dashboard

set -e

echo "🚀 OfferForge Local Development Setup"
echo "======================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker first."
  exit 1
fi

# Step 1: Start MongoDB
echo ""
echo "📦 Starting MongoDB via Docker..."
docker compose up -d
echo "✅ MongoDB running on localhost:27017"

# Step 2: Wait for MongoDB to be ready
echo ""
echo "⏳ Waiting for MongoDB to accept connections..."
for i in $(seq 1 15); do
  if docker exec offerforge-mongo mongosh --quiet --eval "db.runCommand({ping:1}).ok" 2>/dev/null | grep -q 1; then
    echo "✅ MongoDB is ready"
    break
  fi
  if [ $i -eq 15 ]; then
    echo "❌ MongoDB did not become ready in time"
    exit 1
  fi
  sleep 1
done

# Step 3: Seed database
echo ""
echo "🌱 Seeding database with demo data..."
npx tsx scripts/seed.ts
echo "✅ Database seeded (API key: demo-key-123)"

# Step 4: Kill any existing process on port 3010 and start backend API
echo ""
echo "🔧 Starting backend API server on port 3010..."
EXISTING_API_PID=$(lsof -ti:3010 2>/dev/null)
if [ -n "$EXISTING_API_PID" ]; then
  echo "⚠️  Port 3010 in use (PID: $EXISTING_API_PID), stopping it..."
  kill $EXISTING_API_PID 2>/dev/null
  sleep 2
fi

PORT=3010 npx tsx src/server.ts > /tmp/offerforge-api.log 2>&1 &
API_PID=$!
echo "✅ API server running (PID: $API_PID) at http://localhost:3010"
echo "   Logs: /tmp/offerforge-api.log"

# Step 5: Wait for API to be ready
echo ""
echo "⏳ Waiting for API to start..."
for i in $(seq 1 10); do
  if curl -s -m 2 http://localhost:3010/health 2>/dev/null | grep -q "ok"; then
    echo "✅ API is ready"
    break
  fi
  if [ $i -eq 10 ]; then
    echo "❌ API did not start in time"
    kill $API_PID 2>/dev/null
    exit 1
  fi
  sleep 2
done

# Step 6: Kill any existing process on port 3030 and start dashboard
echo ""
echo "🖥️  Starting dashboard on port 3030..."
EXISTING_DASH_PID=$(lsof -ti:3030 2>/dev/null)
if [ -n "$EXISTING_DASH_PID" ]; then
  echo "⚠️  Port 3030 in use (PID: $EXISTING_DASH_PID), stopping it..."
  kill $EXISTING_DASH_PID 2>/dev/null
  sleep 2
fi

cd dashboard && npx next dev -p 3030 > /tmp/offerforge-dashboard.log 2>&1 &
DASH_PID=$!
echo "✅ Dashboard running (PID: $DASH_PID) at http://localhost:3030"
echo "   Logs: /tmp/offerforge-dashboard.log"

# Step 7: Start Mintlify docs on port 3333
echo ""
echo "📚 Starting docs on port 3333..."
EXISTING_DOCS_PID=$(lsof -ti:3333 2>/dev/null)
if [ -n "$EXISTING_DOCS_PID" ]; then
  echo "⚠️  Port 3333 in use (PID: $EXISTING_DOCS_PID), stopping it..."
  kill $EXISTING_DOCS_PID 2>/dev/null
  sleep 2
fi

# Check if mintlify CLI is installed
if command -v mint &> /dev/null; then
  cd /Users/arelligoutham/Documents/OfferForge/docs/mintlify && mint dev -p 3333 > /tmp/offerforge-docs.log 2>&1 &
  DOCS_PID=$!
  echo "✅ Docs running (PID: $DOCS_PID) at http://localhost:3333"
  echo "   Logs: /tmp/offerforge-docs.log"
else
  echo "ℹ️  Mintlify CLI not installed (npm i -g mint). Skipping docs server."
  echo "   Docs source: docs/mintlify/"
  DOCS_PID=""
fi

cd /Users/arelligoutham/Documents/OfferForge

# Print summary
echo ""
echo "======================================"
echo "🎉 OfferForge is running!"
echo ""
echo "   🖥️  Dashboard:  http://localhost:3030"
echo "   🔧 API:        http://localhost:3010"
echo "   ❤️  Health:     http://localhost:3010/health"
if [ -n "$DOCS_PID" ]; then
echo "   📚 Docs:       http://localhost:3333"
fi
echo "   🗄️  MongoDB:    localhost:27017 (Docker)"
echo ""
echo "   🔑 Login credentials:"
echo "      Email:    owner@techstore.in"
echo "      Password: password123"
echo ""
echo "   🔌 API Key (for programmatic access):"
echo "      demo-key-123"
echo ""
echo "   📋 Logs:"
echo "      API:       /tmp/offerforge-api.log"
echo "      Dashboard: /tmp/offerforge-dashboard.log"
if [ -n "$DOCS_PID" ]; then
echo "      Docs:      /tmp/offerforge-docs.log"
fi
echo ""
echo "   Press Ctrl+C to stop all services"
echo "======================================"

# Trap Ctrl+C to kill all processes
kill_all() {
  echo ""
  echo "🛑 Shutting down..."
  kill $API_PID $DASH_PID 2>/dev/null
  if [ -n "$DOCS_PID" ]; then kill $DOCS_PID 2>/dev/null; fi
  docker compose down 2>/dev/null
  echo "✅ All services stopped"
  exit 0
}
trap kill_all INT TERM

# Wait for processes to exit
wait
