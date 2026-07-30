#!/bin/bash
# OfferForge — Stop all services (API, dashboard, MongoDB)

echo "🛑 Stopping OfferForge services..."

# Kill API server (port 3010)
API_PID=$(lsof -ti:3010 2>/dev/null)
if [ -n "$API_PID" ]; then
  kill $API_PID 2>/dev/null
  echo "✅ API server stopped"
else
  echo "ℹ️  API server was not running"
fi

# Kill dashboard (port 3030)
DASH_PID=$(lsof -ti:3030 2>/dev/null)
if [ -n "$DASH_PID" ]; then
  kill $DASH_PID 2>/dev/null
  echo "✅ Dashboard stopped"
else
  echo "ℹ️  Dashboard was not running"
fi

# Kill marketing website (port 8080) and playground (port 8081)
WEB_PID=$(lsof -ti:8080 2>/dev/null)
if [ -n "$WEB_PID" ]; then
  kill $WEB_PID 2>/dev/null
  echo "✅ Marketing website stopped"
else
  echo "ℹ️  Marketing website was not running"
fi

PLAY_PID=$(lsof -ti:8081 2>/dev/null)
if [ -n "$PLAY_PID" ]; then
  kill $PLAY_PID 2>/dev/null
  echo "✅ Playground stopped"
else
  echo "ℹ️  Playground was not running"
fi

CHECKOUT_PID=$(lsof -ti:8082 2>/dev/null)
if [ -n "$CHECKOUT_PID" ]; then
  kill $CHECKOUT_PID 2>/dev/null
  echo "✅ Checkout page stopped"
else
  echo "ℹ️  Checkout page was not running"
fi

# Kill docs server (port 3000)
DOCS_PID=$(lsof -ti:3000 2>/dev/null)
if [ -n "$DOCS_PID" ]; then
  kill $DOCS_PID 2>/dev/null
  echo "✅ Docs stopped"
else
  echo "ℹ️  Docs were not running"
fi

# Stop Docker MongoDB
if docker ps -q --filter name=fuse-mongo | grep -q .; then
  docker compose down 2>/dev/null
  echo "✅ MongoDB stopped"
else
  echo "ℹ️  MongoDB was not running"
fi

echo "✅ All services stopped"
