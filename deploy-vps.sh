#!/usr/bin/env bash
# Script para deploy na VPS lobojow (Oracle)
# Rode na VPS: bash deploy-vps.sh

set -e

echo "🚀 Deploy Quiosque do Coco API - VPS Oracle"

# Diretório do app na VPS (ajuste se necessário)
APP_DIR="${VPS_APP_DIR:-/home/ubuntu/quiosque-api}"

cd "$APP_DIR"

echo "📥 Atualizando código..."
git pull --ff-only

# O .env NÃO é versionado: ele vive apenas na VPS, com os valores reais
# (MongoDB Atlas, JWT_SECRET, FRONTEND_URL). O repo versiona só .env.example.
if [ ! -f .env ]; then
  echo "❌ .env não encontrado em $APP_DIR"
  echo "   Crie a partir de .env.example e preencha os segredos reais."
  exit 1
fi
if grep -qx 'JWT_SECRET=dev-secret-change-in-production' .env; then
  echo "⚠️  JWT_SECRET ainda é o valor de exemplo. Rotacione antes de expor a API."
fi

echo "🔨 Build e restart do container..."
docker compose build api
docker compose up -d --wait --wait-timeout 180

echo "🧹 Limpando imagens antigas..."
docker image prune -f

echo "✅ Status dos containers:"
docker compose ps

echo ""
echo "🌐 API disponível em: https://quiosque-api.136-248-90-172.nip.io"
echo "📚 Swagger: https://quiosque-api.136-248-90-172.nip.io/api/docs"
echo "🔗 Frontend (CORS): https://quiosquedococo.vercel.app"