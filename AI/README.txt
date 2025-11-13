╔══════════════════════════════════════════════════════════════╗
║         BioMarket Insights - Intégration IA Ollama          ║
╚══════════════════════════════════════════════════════════════╝

📁 CONTENU DU DOSSIER AI
------------------------
Ce dossier contient tous les fichiers nécessaires pour l'intégration
de l'IA Ollama (deepseek-r1:8b) avec le projet BioMarket Insights.

📄 FICHIERS
-----------
• server.js              - Serveur backend Express
• package.json           - Configuration Node.js
• package-lock.json      - Dépendances verrouillées
• node_modules/          - Modules Node.js installés
• start.sh              - Script de démarrage
• stop.sh               - Script d'arrêt
• test-integration.sh   - Script de test
• server.log            - Logs du serveur

🚀 DÉMARRAGE RAPIDE
-------------------
1. Assurez-vous qu'Ollama est installé et le modèle téléchargé:
   ollama pull deepseek-r1:8b

2. Démarrez le serveur depuis CE dossier (AI):
   cd AI
   ./start.sh

3. Ouvrez dans le navigateur:
   http://localhost:3000/../index.html

🛑 ARRÊT
--------
   cd AI
   ./stop.sh

⚙️ INSTALLATION MANUELLE
-------------------------
Si start.sh ne fonctionne pas:

1. Installer les dépendances:
   cd AI
   npm install

2. Démarrer Ollama (terminal 1):
   ollama serve

3. Démarrer le serveur (terminal 2):
   cd AI
   node server.js

4. Ouvrir http://localhost:3000/../index.html

📊 FONCTIONNEMENT
-----------------
Le fichier resultat.js (dans le dossier parent) appelle l'API:
POST http://localhost:3000/api/analyze

Le serveur (server.js) interroge Ollama et retourne les données
générées par l'IA au format JSON.

🔍 DÉPANNAGE
------------
• Vérifier qu'Ollama tourne: curl http://localhost:11434/api/tags
• Vérifier le serveur: curl http://localhost:3000/api/health
• Consulter les logs: tail -f server.log

═══════════════════════════════════════════════════════════════
Code4Sud 2025 - Groupe 11
