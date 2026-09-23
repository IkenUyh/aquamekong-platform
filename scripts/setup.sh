#!/usr/bin/env bash
# ============================================
# AquaMekong — Quick Setup Script
# ============================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🌊 AquaMekong Platform — Quick Setup"
echo "======================================"
echo ""

# 1. Create .env from template
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "📋 Creating .env from .env.example..."
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
    echo "   ✅ .env created"
else
    echo "📋 .env already exists, skipping..."
fi

# 2. Start Docker Compose
echo ""
echo "🐳 Starting Docker Compose services..."
cd "$PROJECT_ROOT"
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# 3. Check health
echo ""
echo "🔍 Checking service status..."
docker compose ps

echo ""
echo "======================================"
echo "✅ AquaMekong Platform is running!"
echo ""
echo "📍 Frontend:     http://localhost:3000"
echo "📍 Backend API:  http://localhost:8080"
echo "📍 Swagger UI:   http://localhost:8080/swagger-ui.html"
echo "📍 ML Service:   http://localhost:8000/docs"
echo "📍 PostgreSQL:   localhost:5432"
echo ""
echo "🛑 To stop: docker compose down"
echo "======================================"
