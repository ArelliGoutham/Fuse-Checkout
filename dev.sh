#!/bin/bash
# Fuse — Local Development Setup
# Starts MongoDB, backend API, seeds data, and dashboard

# Don't use set -e — background processes may return non-zero

echo "🚀 Fuse Local Development Setup"
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
  if docker exec fuse-mongo mongosh --quiet --eval "db.runCommand({ping:1}).ok" 2>/dev/null | grep -q 1; then
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
cd /Users/arelligoutham/Documents/OfferForge
EXISTING_API_PID=$(lsof -ti:3010 2>/dev/null)
if [ -n "$EXISTING_API_PID" ]; then
  echo "⚠️  Port 3010 in use (PID: $EXISTING_API_PID), stopping it..."
  kill $EXISTING_API_PID 2>/dev/null
  sleep 2
fi

PORT=3010 npx tsx src/server.ts > /tmp/offerforge-api.log 2>&1 &
API_PID=$!
echo "✅ API server running (PID: $API_PID) at http://localhost:3010"
echo "   Logs: tail -f /tmp/offerforge-api.log"

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

cd /Users/arelligoutham/Documents/OfferForge/dashboard && npx next dev -p 3030 > /tmp/offerforge-dashboard.log 2>&1 &
DASH_PID=$!
cd /Users/arelligoutham/Documents/OfferForge
echo "✅ Dashboard running (PID: $DASH_PID) at http://localhost:3030"
echo "   Logs: /tmp/offerforge-dashboard.log"

# Step 7: Start Mintlify docs on port 3000 (mintlify default, can't be changed)
echo ""
echo "📚 Starting docs server..."
EXISTING_DOCS_PID=$(lsof -ti:3000 2>/dev/null)
if [ -n "$EXISTING_DOCS_PID" ]; then
  echo "⚠️  Port 3000 in use (PID: $EXISTING_DOCS_PID), stopping it..."
  kill $EXISTING_DOCS_PID 2>/dev/null
  sleep 2
fi

# Check if mintlify CLI is installed
if command -v mint &> /dev/null; then
  cd /Users/arelligoutham/Documents/OfferForge/docs/mintlify && mint dev --no-open > /tmp/offerforge-docs.log 2>&1 &
  DOCS_PID=$!
  echo "✅ Docs running (PID: $DOCS_PID) at http://localhost:3000"
  echo "   Logs: tail -f /tmp/offerforge-docs.log"
  DOCS_PORT=3000
else
  echo "ℹ️  Mintlify CLI not installed (npm i -g mint). Skipping docs server."
  echo "   Docs source: docs/mintlify/"
  DOCS_PID=""
  DOCS_PORT=""
fi

cd /Users/arelligoutham/Documents/OfferForge

# Step 8: Start marketing website (port 8080) and playground (port 8081)
echo ""
echo "🌐 Starting marketing website on port 8080..."
for port in 8080 8081; do
  EXISTING=$(lsof -ti:$port 2>/dev/null)
  if [ -n "$EXISTING" ]; then
    echo "⚠️  Port $port in use (PID: $EXISTING), stopping it..."
    kill $EXISTING 2>/dev/null
    sleep 1
  fi
done

cd /Users/arelligoutham/Documents/OfferForge/website
if command -v python3 &> /dev/null; then
  python3 -m http.server 8080 > /tmp/offerforge-website.log 2>&1 &
  WEB_PID=$!
  echo "✅ Marketing site running at http://localhost:8080"
else
  echo "ℹ️  python3 not found. Open website/index.html in browser."
  WEB_PID=""
fi

cd /Users/arelligoutham/Documents/OfferForge/playground
if command -v python3 &> /dev/null; then
  python3 -m http.server 8081 > /tmp/offerforge-playground.log 2>&1 &
  PLAY_PID=$!
  echo "✅ Playground running at http://localhost:8081"
else
  PLAY_PID=""
fi

cd /Users/arelligoutham/Documents/OfferForge/checkout
if command -v npx &> /dev/null; then
  npx next dev -p 8082 > /tmp/offerforge-checkout.log 2>&1 &
  CHECKOUT_PID=$!
  echo "✅ Checkout (Next.js) running at http://localhost:8082"
else
  CHECKOUT_PID=""
fi

cd /Users/arelligoutham/Documents/OfferForge

# Print summary
echo ""
echo "======================================"
echo "🎉 OfferForge is running!"
echo ""
echo "   🌐 Marketing:  http://localhost:8080"
echo "   🎮 Playground: http://localhost:8081"
echo "   🛒 Checkout:   http://localhost:8082"
echo "   🖥️  Dashboard:  http://localhost:3030"
echo "   🔧 API:        http://localhost:3010"
echo "   ❤️  Health:     http://localhost:3010/health"
if [ -n "$DOCS_PID" ]; then
echo "   📚 Docs:       http://localhost:3000"
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
echo "      API:       tail -f /tmp/offerforge-api.log"
echo "      Dashboard: tail -f /tmp/offerforge-dashboard.log"
if [ -n "$DOCS_PID" ]; then
echo "      Docs:      tail -f /tmp/offerforge-docs.log"
fi
if [ -n "$WEB_PID" ]; then
echo "      Website:   tail -f /tmp/offerforge-website.log"
fi
if [ -n "$PLAY_PID" ]; then
echo "      Playground: tail -f /tmp/offerforge-playground.log"
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
  if [ -n "$WEB_PID" ]; then kill $WEB_PID 2>/dev/null; fi
  if [ -n "$PLAY_PID" ]; then kill $PLAY_PID 2>/dev/null; fi
  if [ -n "$CHECKOUT_PID" ]; then kill $CHECKOUT_PID 2>/dev/null; fi
  lsof -ti:8080 2>/dev/null | xargs kill 2>/dev/null || true
  lsof -ti:8081 2>/dev/null | xargs kill 2>/dev/null || true
  lsof -ti:8082 2>/dev/null | xargs kill 2>/dev/null || true
  docker compose down 2>/dev/null
  echo "✅ All services stopped"
  exit 0
}
trap kill_all INT TERM

# Wait for processes to exit
wait
