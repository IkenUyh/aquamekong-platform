#!/usr/bin/env bash
# ============================================
# AquaMekong — Build All Services
# ============================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔨 Building all AquaMekong services..."
echo ""

# Backend
echo "📦 [1/3] Building Backend (Spring Boot)..."
cd "$PROJECT_ROOT/backend-springboot"
if [ -f "./mvnw" ]; then
    chmod +x mvnw
    ./mvnw clean package -DskipTests -q
else
    mvn clean package -DskipTests -q
fi
echo "   ✅ Backend built"

# Frontend
echo "📦 [2/3] Building Frontend (React + Vite)..."
cd "$PROJECT_ROOT/frontend"
npm install --silent
npm run build
echo "   ✅ Frontend built"

# ML Service (just verify)
echo "📦 [3/3] Verifying ML Service (Python)..."
cd "$PROJECT_ROOT/ml-service"
if command -v python3 &> /dev/null; then
    python3 -c "import app.main" 2>/dev/null && echo "   ✅ ML Service OK" || echo "   ⚠️ ML Service needs dependencies: pip install -r requirements.txt"
else
    echo "   ⚠️ Python3 not found"
fi

echo ""
echo "✅ All services built successfully!"
