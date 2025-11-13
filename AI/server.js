const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Charger les données du marché bio depuis le JSON
const donneesBioPath = path.join(__dirname, 'data', 'donnees-bio.json');
const donneesBio = JSON.parse(fs.readFileSync(donneesBioPath, 'utf8'));

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Servir les fichiers statiques depuis le dossier parent
app.use(express.static(path.join(__dirname, '..')));

// Configuration Ollama
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'deepseek-r1:8b';

// ===========================
// ENDPOINT PRINCIPAL - ANALYSE AVEC OLLAMA
// ===========================

app.post('/api/analyze', async (req, res) => {
    try {
        const { secteur, region, objectif } = req.body;
        
        console.log('📊 Nouvelle demande d\'analyse:');
        console.log(`  - Secteur: ${secteur}`);
        console.log(`  - Région: ${region}`);
        console.log(`  - Objectif: ${objectif}`);
        
        // Récupérer les données du département et du secteur depuis le JSON
        const deptData = donneesBio.departements[region] || null;
        const secteurData = donneesBio.secteurs[secteur] || null;
        
        // Préparer un contexte de données COURT depuis le JSON
        let dataContext = `DONNÉES RÉELLES (JSON):\n`;
        
        // Données du département si disponible
        if (deptData) {
            dataContext += `${region}: Population ${deptData.population}, ${deptData.nb_operateurs_bio_total} opérateurs bio (${deptData.ventilation_acteurs.producteurs} producteurs, ${deptData.ventilation_acteurs.transformateurs} transformateurs, ${deptData.ventilation_acteurs.distributeurs} distributeurs). `;
            dataContext += `Marché: ${deptData.taille_marche}, croissance ${deptData.croissance}. `;
            dataContext += `Spécialités: ${deptData.specialites.join(', ')}. `;
            dataContext += `Risques: pollution ${deptData.risque_pollution_basol}, inondation ${deptData.risque_inondation_azi}.\n`;
        } else {
            dataContext += `${region}: Pas de données spécifiques.\n`;
        }
        
        // Données du secteur si disponible
        if (secteurData) {
            dataContext += `Secteur ${secteur}: ${secteurData.part_marche_national} du marché national, croissance ${secteurData.croissance_annuelle}.\n`;
        }
        
        // Acteurs (seulement 3)
        dataContext += `Acteurs clés: `;
        dataContext += donneesBio.acteurs_nationaux.slice(0, 3).map(a => `${a.nom} (${a.part_marche})`).join(', ');
        dataContext += `.\n`;
        
        // Prompt structuré COURT pour Ollama
        const prompt = `Expert marché bio. Données JSON:
${dataContext}

Analyse pour: ${secteur} en ${region}
Objectif: ${objectif}

Réponds en JSON pur (sans markdown):
{
  "summary": "Un résumé exécutif de 3-4 phrases sur le marché",
  "kpis": {
    "marche": "Taille du marché (ex: 250M€)",
    "acteurs": "Nombre d'acteurs (ex: 45)",
    "croissance": "Croissance annuelle (ex: +8.5%)",
    "potentiel": "Potentiel (Élevé/Modéré/Faible)"
  },
  "keyPoints": [
    "Point clé 1 sur les tendances du marché",
    "Point clé 2 sur la consommation",
    "Point clé 3 sur la distribution",
    "Point clé 4 sur les consommateurs",
    "Point clé 5 sur les certifications",
    "Point clé 6 sur les barrières à l'entrée"
  ],
  "actors": [
    {"name": "Nom acteur 1", "type": "Distributeur/Producteur/etc", "market": "15%", "growth": "+10%"},
    {"name": "Nom acteur 2", "type": "Type", "market": "12%", "growth": "+8%"},
    {"name": "Nom acteur 3", "type": "Type", "market": "10%", "growth": "+12%"},
    {"name": "Nom acteur 4", "type": "Type", "market": "8%", "growth": "+15%"},
    {"name": "Nom acteur 5", "type": "Type", "market": "Leader", "growth": "Stable"},
    {"name": "Nom acteur 6", "type": "Type", "market": "7%", "growth": "+9%"}
  ],
  "recommendations": [
    {"title": "Titre recommandation 1", "desc": "Description détaillée"},
    {"title": "Titre recommandation 2", "desc": "Description détaillée"},
    {"title": "Titre recommandation 3", "desc": "Description détaillée"},
    {"title": "Titre recommandation 4", "desc": "Description détaillée"},
    {"title": "Titre recommandation 5", "desc": "Description détaillée"},
    {"title": "Titre recommandation 6", "desc": "Description détaillée"}
  ],
  "chartData": {
    "marketShare": [45, 20, 15, 12, 8],
    "evolution": [150, 180, 220, 280, 350, 420],
    "segments": [28, 22, 18, 17, 15],
    "competitors": [30, 25, 20, 25]
  }
}`;

        console.log('🤖 Interrogation de Ollama...');
        
        // Appel à Ollama
        const ollamaResponse = await axios.post(OLLAMA_URL, {
            model: MODEL,
            prompt: prompt,
            stream: false,
            temperature: 0.3,  // Plus bas = plus rapide et déterministe
            top_p: 0.8
        }, {
            timeout: 15000 // 15 secondes timeout max
        });
        
        console.log('✅ Réponse reçue de Ollama');
        
        // Extraction et parsing de la réponse
        let aiResponse = ollamaResponse.data.response;
        
        // Nettoyer la réponse (enlever les markdown si présents)
        aiResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Parser le JSON
        let analysisData;
        try {
            analysisData = JSON.parse(aiResponse);
        } catch (parseError) {
            console.error('❌ Erreur de parsing JSON:', parseError);
            console.log('Réponse brute:', aiResponse);
            
            // Fallback avec des données par défaut
            analysisData = generateFallbackData(secteur, region, objectif);
        }
        
        // Enrichir avec metadata
        analysisData.metadata = {
            secteur,
            region,
            objectif,
            generatedAt: new Date().toISOString(),
            aiModel: MODEL,
            version: '1.0'
        };
        
        console.log('📤 Envoi des résultats au client');
        res.json(analysisData);
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        
        // En cas d'erreur, renvoyer des données de fallback
        const fallbackData = generateFallbackData(
            req.body.secteur || 'Alimentaire Bio',
            req.body.region || 'Non spécifié',
            req.body.objectif || 'Analyse générale'
        );
        
        res.json(fallbackData);
    }
});

// ===========================
// FONCTION DE FALLBACK
// ===========================

function generateFallbackData(secteur, region, objectif) {
    // Utiliser les données JSON si disponibles
    const deptData = donneesBio.departements[region];
    const secteurData = donneesBio.secteurs[secteur];
    
    // KPIs basés sur les données JSON
    const kpis = deptData ? {
        marche: deptData.taille_marche,
        acteurs: deptData.nb_operateurs_bio_total,
        croissance: deptData.croissance,
        potentiel: deptData.potentiel
    } : {
        marche: Math.floor(Math.random() * 500 + 200) + 'M€',
        acteurs: Math.floor(Math.random() * 50 + 30),
        croissance: '+' + (Math.random() * 10 + 5).toFixed(1) + '%',
        potentiel: ['Élevé', 'Très Élevé', 'Modéré'][Math.floor(Math.random() * 3)]
    };
    
    // Résumé basé sur les données
    let summary = `Cette analyse du secteur "${secteur}" dans la région "${region}" révèle un marché `;
    if (deptData) {
        summary += `de ${deptData.taille_marche} avec ${deptData.nb_operateurs_bio_total} opérateurs bio. `;
        summary += `La croissance est de ${deptData.croissance} et les spécialités locales incluent ${deptData.specialites.join(', ')}. `;
    } else {
        summary += `en pleine expansion avec un potentiel de croissance significatif. `;
    }
    summary += `Le marché présente des opportunités stratégiques importantes.`;
    
    return {
        summary: summary,
        kpis: kpis,
        keyPoints: donneesBio.tendances_marche.slice(0, 6),
        actors: donneesBio.acteurs_nationaux.slice(0, 6).map(a => ({
            name: a.nom,
            type: a.type,
            market: a.part_marche,
            growth: a.croissance
        })),
        recommendations: [
            {
                title: 'Positionnement Local et Authentique',
                desc: 'Miser sur l\'origine locale des produits et la transparence de la chaîne de production pour créer une connexion émotionnelle avec les consommateurs.'
            },
            {
                title: 'Digitalisation de la Distribution',
                desc: 'Développer une présence e-commerce forte avec click & collect et livraison rapide pour capter la croissance du canal digital (+25% annuel).'
            },
            {
                title: 'Partenariats Stratégiques',
                desc: 'Établir des alliances avec des producteurs locaux et des magasins spécialisés pour sécuriser l\'approvisionnement et la distribution.'
            },
            {
                title: 'Communication sur les Certifications',
                desc: 'Mettre en avant les labels bio, certifications et démarches environnementales pour rassurer et convaincre les consommateurs exigeants.'
            },
            {
                title: 'Innovation Produit',
                desc: `Développer des produits différenciants dans le segment "${secteur}" en répondant aux nouvelles attentes : zéro déchet, vrac, formats nomades.`
            },
            {
                title: 'Analyse Continue du Marché',
                desc: 'Mettre en place une veille concurrentielle régulière avec BioMarket Insights pour ajuster la stratégie en temps réel.'
            }
        ],
        chartData: {
            marketShare: [45, 20, 15, 12, 8],
            evolution: [150, 180, 220, 280, 350, 420],
            segments: [28, 22, 18, 17, 15],
            competitors: [30, 25, 20, 25]
        },
        metadata: {
            secteur,
            region,
            objectif,
            generatedAt: new Date().toISOString(),
            aiModel: 'Fallback (Ollama non disponible)',
            version: '1.0'
        }
    };
}

// ===========================
// HEALTH CHECK
// ===========================

app.get('/api/health', async (req, res) => {
    try {
        // Vérifier si Ollama est accessible
        const ollamaCheck = await axios.get('http://localhost:11434/api/tags', {
            timeout: 5000
        });
        
        res.json({
            status: 'ok',
            ollama: 'connected',
            model: MODEL,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({
            status: 'warning',
            ollama: 'disconnected',
            model: MODEL,
            message: 'Ollama non disponible, utilisation du mode fallback',
            timestamp: new Date().toISOString()
        });
    }
});

// ===========================
// DÉMARRAGE DU SERVEUR
// ===========================

app.listen(PORT, () => {
    console.log('🌱 BioMarket Insights - Serveur démarré');
    console.log(`📡 Serveur accessible sur: http://localhost:${PORT}`);
    console.log(`🤖 Modèle IA: ${MODEL}`);
    console.log(`🔗 API Endpoint: http://localhost:${PORT}/api/analyze`);
    console.log('\n💡 Assurez-vous que Ollama est lancé avec: ollama serve');
    console.log(`💡 Et que le modèle est installé: ollama pull ${MODEL}\n`);
});
