#!/bin/bash

echo "🛑 Arrêt de BioMarket Insights"
echo "=============================="
echo ""

# Arrêter le serveur Node.js
echo "Arrêt du serveur Node.js..."
pkill -f "node server.js"

# Note: on ne tue pas Ollama car il peut être utilisé par d'autres applications
echo "ℹ️  Ollama continue de tourner (peut être utilisé par d'autres applications)"
echo "   Pour l'arrêter manuellement: pkill ollama"

echo ""
echo "✅ Services arrêtés"
