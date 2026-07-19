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

# Step 4: Start backend API
echo ""
echo "🔧 Starting backend API server on port 3010..."
PORT=3010 npx tsx src/server.ts &
API_PID=$!
echo "✅ API server running (PID: $API_PID) at http://localhost:3010"

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

# Step 6: Start dashboard
echo ""
echo "🖥️  Starting dashboard on port 3030..."
cd dashboard && npx next dev -p 3030 &
DASH_PID=$!
echo "✅ Dashboard running (PID: $DASH_PID) at http://localhost:3030"

# Print summary
echo ""
echo "======================================"
echo "🎉 OfferForge is running!"
echo ""
echo "   Dashboard:  http://localhost:3030"
echo "   API:        http://localhost:3010"
echo "   API Health: http://localhost:3010/health"
echo ""
echo "   Test credentials:"
echo "     Email:    owner@store.in (not seeded — signup first)"
echo "     API Key:  demo-key-123 (for programmatic access)"
echo ""
echo "   Press Ctrl+C to stop all services"
echo "======================================"

# Trap Ctrl+C to kill all processes
trap "echo ''; echo '🛑 Shutting down...'; kill $API_PID $DASH_PID 2>/dev/null; docker compose down 2>/dev/null; echo '✅ Stopped'; exit 0" INT TERM

# Wait for processes to exit
wait
