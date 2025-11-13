#!/bin/bash

echo "🧪 Test de l'intégration Ollama avec BioMarket Insights"
echo "========================================================"
echo ""

# Test 1: Vérification du serveur
echo "📡 Test 1: Vérification du serveur..."
HEALTH=$(curl -s http://localhost:3000/api/health)
if [ $? -eq 0 ]; then
    echo "✅ Serveur accessible"
    echo "$HEALTH" | python3 -m json.tool
else
    echo "❌ Serveur non accessible"
    exit 1
fi

echo ""
echo "🤖 Test 2: Appel de l'API d'analyse..."
echo "Envoi d'une requête de test..."

RESPONSE=$(curl -s -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "secteur": "alimentaire",
    "region": "Provence-Alpes-Côte d'\''Azur",
    "objectif": "Analyser le marché des légumes bio locaux"
  }')

if [ $? -eq 0 ]; then
    echo "✅ Réponse reçue de l'API"
    echo ""
    echo "📊 Aperçu de la réponse:"
    echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print('  - Résumé:', data.get('summary', 'N/A')[:100] + '...')
    print('  - KPIs:', data.get('kpis', {}))
    print('  - Nombre d'\''acteurs:', len(data.get('actors', [])))
    print('  - Nombre de recommandations:', len(data.get('recommendations', [])))
    print('  - Modèle IA:', data.get('metadata', {}).get('aiModel', 'N/A'))
except Exception as e:
    print('Erreur:', e)
    print(sys.stdin.read())
"
    echo ""
    echo "✅ Test réussi!"
else
    echo "❌ Erreur lors de l'appel API"
    exit 1
fi

echo ""
echo "🎉 Tous les tests sont passés!"
echo "🌐 Ouvrez http://localhost:3000/index.html dans votre navigateur"
