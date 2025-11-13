#!/bin/bash

echo "🌱 Démarrage de BioMarket Insights avec Ollama"
echo "=============================================="
echo ""

# Vérifier si Ollama est installé
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama n'est pas installé"
    echo "📥 Installez-le avec: curl https://ollama.ai/install.sh | sh"
    exit 1
fi

# Vérifier si le modèle est disponible
if ! ollama list | grep -q "deepseek-r1:8b"; then
    echo "⚠️  Le modèle deepseek-r1:8b n'est pas installé"
    echo "📥 Installation du modèle (cela peut prendre quelques minutes)..."
    ollama pull deepseek-r1:8b
fi

# Vérifier si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances Node.js..."
    npm install
fi

# Vérifier si Ollama est lancé
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "🚀 Démarrage d'Ollama en arrière-plan..."
    nohup ollama serve > ollama.log 2>&1 &
    sleep 3
fi

# Démarrer le serveur
echo "🚀 Démarrage du serveur BioMarket Insights..."
nohup node server.js > server.log 2>&1 &
SERVER_PID=$!

sleep 2

# Vérifier que le serveur est bien démarré
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ Serveur démarré avec succès!"
    echo ""
    echo "🌐 Ouvrez votre navigateur sur:"
    echo "   http://localhost:3000/index.html"
    echo ""
    echo "📋 Commandes utiles:"
    echo "   - Voir les logs du serveur: tail -f server.log"
    echo "   - Voir les logs d'Ollama: tail -f ollama.log"
    echo "   - Arrêter le serveur: kill $SERVER_PID"
    echo ""
else
    echo "❌ Erreur: le serveur n'a pas démarré correctement"
    echo "📋 Consultez server.log pour plus de détails"
    exit 1
fi
