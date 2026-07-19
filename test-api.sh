#!/bin/bash
# OfferForge — Test API endpoints against local server
# Run this after ./dev.sh to verify everything works

BASE_URL="http://localhost:3010"
API_KEY="demo-key-123"

echo "🧪 OfferForge API Tests"
echo "========================"
echo ""

# Check if API is running
if ! curl -s -m 3 "$BASE_URL/health" | grep -q "ok" 2>/dev/null; then
  echo "❌ API is not running on port 3010. Run ./dev.sh first."
  exit 1
fi

PASS=0
FAIL=0

test_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  local data="$4"
  local expected_status="$5"
  local headers="$6"

  local curl_cmd="curl -s -o /dev/null -w '%{http_code}' -X $method"
  curl_cmd="$curl_cmd -H 'Content-Type: application/json'"
  
  if [ -n "$headers" ]; then
    curl_cmd="$curl_cmd -H '$headers'"
  fi
  
  if [ -n "$data" ]; then
    curl_cmd="$curl_cmd -d '$data'"
  fi
  
  curl_cmd="$curl_cmd $BASE_URL$path"

  local status=$(eval $curl_cmd 2>/dev/null)

  if [ "$status" = "$expected_status" ]; then
    echo "✅ $name → $status"
    PASS=$((PASS + 1))
  else
    echo "❌ $name → got $status, expected $expected_status"
    FAIL=$((FAIL + 1))
  fi
}

# Health
test_endpoint "Health check" "GET" "/health" "" "200"

# Auth — Signup
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@offerforge.dev","password":"testpass123","name":"Test User","store_name":"Test Store"}' 2>/dev/null)

if echo "$SIGNUP_RESPONSE" | grep -q "token"; then
  echo "✅ Auth signup → 201"
  PASS=$((PASS + 1))
  JWT_TOKEN=$(echo "$SIGNUP_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
  # User might already exist — try login
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@offerforge.dev","password":"testpass123"}' 2>/dev/null)
  
  if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo "✅ Auth login (existing user) → 200"
    PASS=$((PASS + 1))
    JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  else
    echo "❌ Auth signup/login failed"
    FAIL=$((FAIL + 1))
    JWT_TOKEN=""
  fi
fi

# Auth — Me (with JWT)
if [ -n "$JWT_TOKEN" ]; then
  test_endpoint "Auth /me (JWT)" "GET" "/api/auth/me" "" "200" "Authorization: Bearer $JWT_TOKEN"
fi

# Offers — List (with API key)
test_endpoint "Offers list (API key)" "GET" "/api/offers" "" "200" "x-api-key: $API_KEY"

# Offers — Create (with API key)
test_endpoint "Offers create" "POST" "/api/offers" \
  '{"code":"TEST10","type":"coupon","title":"Test 10 off","discount":{"type":"flat","value":10,"max_discount":null},"validity":{"starts_at":"2026-01-01T00:00:00.000Z","ends_at":"2026-12-31T23:59:59.000Z"},"usage_limits":{"total":null,"per_customer":null},"rules":[]}' \
  "201" "x-api-key: $API_KEY"

# Checkout — Validate
test_endpoint "Checkout validate" "POST" "/api/offers/validate" \
  '{"code":"FLAT50","cart":{"amount":5000,"items":[{"sku_id":"SKU-1","price":5000,"qty":1}]},"customer":{"customer_id":"c1","segments":["new"],"total_orders":0,"per_customer_used":0}}' \
  "200" "x-api-key: $API_KEY"

# Checkout — Available
test_endpoint "Checkout available" "POST" "/api/offers/available" \
  '{"cart":{"amount":5000,"items":[{"sku_id":"SKU-1","price":5000,"qty":1}]},"customer":{"customer_id":"c1","segments":["new"],"total_orders":0,"per_customer_used":0}}' \
  "200" "x-api-key: $API_KEY"

# Checkout — Apply
test_endpoint "Checkout apply" "POST" "/api/offers/apply" \
  '{"code":"FLAT50","cart":{"amount":5000,"items":[{"sku_id":"SKU-1","price":5000,"qty":1}]},"customer":{"customer_id":"c1","segments":["new"],"total_orders":0,"per_customer_used":0},"session_id":"test_session"}' \
  "200" "x-api-key: $API_KEY"

# Products — List
test_endpoint "Products list" "GET" "/api/products" "" "200" "x-api-key: $API_KEY"

# Products — Create
test_endpoint "Products create" "POST" "/api/products" \
  '{"sku_id":"SKU-TEST","name":"Test Product","category":"Test"}' \
  "201" "x-api-key: $API_KEY"

# Analytics — Overview
test_endpoint "Analytics overview" "GET" "/api/analytics/overview" "" "200" "x-api-key: $API_KEY"

# Analytics — Offers
test_endpoint "Analytics offers" "GET" "/api/analytics/offers" "" "200" "x-api-key: $API_KEY"

# Team — Invite (with JWT)
if [ -n "$JWT_TOKEN" ]; then
  test_endpoint "Team invite" "POST" "/api/team/invite" \
    '{"email":"team@offerforge.dev","role":"offer_manager"}' \
    "201" "Authorization: Bearer $JWT_TOKEN"

  # Team — List invites
  test_endpoint "Team invites list" "GET" "/api/team/invites" "" "200" "Authorization: Bearer $JWT_TOKEN"

  # API Keys — Create
  test_endpoint "API key create" "POST" "/api/api-keys" \
    '{"label":"Test Key","scopes":["offers:read","checkout"]}' \
    "201" "Authorization: Bearer $JWT_TOKEN"

  # API Keys — List
  test_endpoint "API keys list" "GET" "/api/api-keys" "" "200" "Authorization: Bearer $JWT_TOKEN"
fi

# Auth — No auth returns 401
test_endpoint "No auth returns 401" "GET" "/api/offers" "" "401"

# Summary
echo ""
echo "========================"
echo "📊 Results: $PASS passed, $FAIL failed"
if [ $FAIL -eq 0 ]; then
  echo "🎉 All tests passed!"
else
  echo "⚠️  Some tests failed. Check the output above."
fi
echo "========================"
