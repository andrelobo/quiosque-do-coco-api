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

echo "📋 Copiando .env.production para .env..."
cp .env.production .env

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