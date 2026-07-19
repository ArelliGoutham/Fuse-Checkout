#!/bin/bash
# OfferForge — Seed the database with demo data
# Usage: ./seed.sh

set -e

echo "🌱 Seeding OfferForge database with demo data..."
echo ""

npx tsx scripts/seed.ts

echo ""
echo "✅ Done! Demo data loaded."
echo "   API Key: demo-key-123"
echo "   Merchant: TechStore.in"
echo "   Offers: FLAT50, SAVE10, FIRST100, Auto Electronics"
echo "   Products: 5 (iPhone 15, Galaxy S24, T-Shirt, Shoes, Belt)"
echo "   Redemptions: 5 (3 paid, 1 applied, 1 abandoned)"
