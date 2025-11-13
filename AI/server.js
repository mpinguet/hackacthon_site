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
        
        // Prompt structuré : utilise vraies données JSON si disponibles, sinon génération probabiliste
        const useDeptData = deptData !== null && deptData !== undefined;
        const prompt = useDeptData ? 
        `Tu es un expert en analyse de marché bio. IMPORTANT: Tu dois utiliser UNIQUEMENT les données réelles fournies ci-dessous.

DONNÉES RÉELLES À UTILISER OBLIGATOIREMENT:
${dataContext}

Mission: Analyser "${secteur}" en "${region}"
Objectif: ${objectif}

⚠️ RÈGLES STRICTES:
1. COPIE EXACTEMENT les valeurs du JSON (taille_marche, croissance, nb_operateurs_bio_total, potentiel)
2. NE PAS inventer ou modifier les chiffres
3. Si croissance est NÉGATIVE (ex: -2.3%), garde-la NÉGATIVE dans ta réponse
4. Si potentiel est "Limité", utilise "Limité" (pas "Élevé")
5. Si le marché est petit (< 50M€), NE PAS dire "en pleine expansion"

Réponds en JSON pur (sans markdown):
{
  "summary": "Résumé réaliste basé sur les VRAIES données (si croissance négative, le mentionner !)",
  "kpis": {
    "marche": "${deptData.taille_marche}",
    "acteurs": ${deptData.nb_operateurs_bio_total},
    "croissance": "${deptData.croissance}",
    "potentiel": "${deptData.potentiel}",
    "trends": {
      "marche": "Détermine selon croissance réelle: Décroissante si négatif, Faible si <3%, Modérée si <8%, Forte si >=8%",
      "acteurs": "Détermine selon nombre: Limité si <50, Stable si <150, Dynamique si <300, Croissant si >=300",
      "croissance": "Idem que marche",
      "potentiel": "COPIE EXACTEMENT: ${deptData.potentiel}"
    }
  },
  "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5", "Point 6"],
  "actors": [{"name": "Acteur", "type": "Type", "market": "X%", "growth": "+Y%"}, {"name": "Acteur", "type": "Type", "market": "X%", "growth": "+Y%"}, {"name": "Acteur", "type": "Type", "market": "X%", "growth": "+Y%"}, {"name": "Acteur", "type": "Type", "market": "X%", "growth": "+Y%"}, {"name": "Acteur", "type": "Type", "market": "X%", "growth": "+Y%"}, {"name": "Acteur", "type": "Type", "market": "X%", "growth": "+Y%"}],
  "recommendations": [{"title": "Reco 1", "desc": "Desc", "comment": "Commentaire"}, {"title": "Reco 2", "desc": "Desc", "comment": "Commentaire"}, {"title": "Reco 3", "desc": "Desc", "comment": "Commentaire"}, {"title": "Reco 4", "desc": "Desc", "comment": "Commentaire"}, {"title": "Reco 5", "desc": "Desc", "comment": "Commentaire"}, {"title": "Reco 6", "desc": "Desc", "comment": "Commentaire"}],
  "chartData": {"marketShare": [45, 20, 15, 12, 8], "marketShareLabels": ["Alimentaire", "Cosmétiques", "Textiles", "Bien-être", "Autres"], "evolution": "Calcule avec croissance ${deptData.croissance}", "evolutionLabels": ["2020", "2021", "2022", "2023", "2024", "2025"], "segments": [28, 22, 18, 17, 15], "segmentsLabels": ["Fruits & Légumes", "Produits laitiers", "Viandes", "Céréales", "Boissons"], "competitors": [30, 25, 20, 25], "competitorsLabels": ["Leader A", "Leader B", "Leader C", "Autres"]}
}
⚠️ RAPPEL: UTILISE LES VRAIES VALEURS DU JSON !` 
        : 
        `Tu es un expert en analyse de marché bio. La région "${region}" n'a pas de données dans notre base. Génère une estimation probabiliste réaliste.

Mission: Analyser "${secteur}" en "${region}"
Objectif: ${objectif}

⚠️ RÈGLES PROBABILISTES:
- 70% chance: marché favorable (croissance +3% à +15%, potentiel Élevé/Très Élevé)
- 30% chance: marché défavorable (croissance -5% à +3%, potentiel Modéré/Limité)
- Cohérence: si croissance < 0%, alors potentiel ne peut PAS être "Très Élevé"

Réponds en JSON pur (sans markdown) avec estimation réaliste.`;

        console.log('🤖 Interrogation de Ollama...');
        console.log(`📊 ${useDeptData ? `Vraies données: Marché=${deptData.taille_marche}, Croissance=${deptData.croissance}` : 'Génération probabiliste pour région inconnue'}`);
        
        // Appel à Ollama
        const ollamaResponse = await axios.post(OLLAMA_URL, {
            model: MODEL,
            prompt: prompt,
            stream: false,
            temperature: useDeptData ? 0.1 : 0.7,  // Plus élevé pour génération créative si pas de données
            top_p: useDeptData ? 0.5 : 0.9
        }, {
            timeout: 15000 // 15 secondes timeout
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

// Fonction pour générer les données de graphiques basées sur le JSON
function generateChartDataFromJson(secteur, region, deptData) {
    const secteurs = donneesBio.secteurs;
    
    // 1. PARTS DE MARCHÉ PAR SECTEUR
    const secteursKeys = Object.keys(secteurs);
    const marketShareLabels = secteursKeys.map(key => secteurs[key]?.nom || key);
    const marketShare = secteursKeys.map((key, index) => {
        // Si c'est le secteur sélectionné, donner une part plus importante
        const nomSecteur = secteurs[key]?.nom || '';
        if (nomSecteur.toLowerCase().includes(secteur.toLowerCase())) {
            return 35 + Math.random() * 15; // 35-50%
        }
        return 10 + Math.random() * 20; // 10-30%
    });
    
    // 2. ÉVOLUTION TEMPORELLE (2020-2025)
    const evolutionLabels = ["2020", "2021", "2022", "2023", "2024", "2025"];
    // Base value varie selon la taille du marché du département
    let baseValue = 100;
    if (deptData && deptData.taille_marche) {
        const tailleMatch = deptData.taille_marche.match(/(\d+)/);
        if (tailleMatch) {
            baseValue = parseInt(tailleMatch[0]) * 0.7; // 70% de la taille actuelle en 2020
        }
    }
    const croissanceRate = deptData ? parseFloat(deptData.croissance) / 100 : 0.12;
    const evolution = evolutionLabels.map((year, index) => {
        const value = baseValue * Math.pow(1 + croissanceRate, index);
        return Math.round(value);
    });
    
    // 3. SEGMENTS DU SECTEUR SÉLECTIONNÉ
    let segmentsLabels = ["Fruits & Légumes", "Produits laitiers", "Viandes", "Céréales", "Boissons"];
    let segments = [28, 22, 18, 17, 15];
    
    // Adapter les segments selon le secteur
    if (secteur.toLowerCase().includes('cosmétique')) {
        segmentsLabels = ["Soins visage", "Soins corps", "Maquillage", "Parfums", "Cheveux"];
        segments = [30, 25, 20, 15, 10];
    } else if (secteur.toLowerCase().includes('textile')) {
        segmentsLabels = ["Vêtements", "Accessoires", "Chaussures", "Linge maison", "Sport"];
        segments = [35, 20, 18, 15, 12];
    } else if (secteur.toLowerCase().includes('bien-être')) {
        segmentsLabels = ["Compléments", "Thés & Infusions", "Huiles essentielles", "Aromathérapie", "Autres"];
        segments = [28, 24, 20, 18, 10];
    } else if (secteur.toLowerCase().includes('alimentaire') && deptData && deptData.specialites) {
        // Utiliser les spécialités du département pour l'alimentaire
        const specialites = deptData.specialites.slice(0, 4);
        segmentsLabels = [...specialites, "Autres produits"];
        // Donner plus de poids aux spécialités locales
        segments = [32, 26, 20, 14, 8];
    }
    
    // 4. CONCURRENTS PRINCIPAUX
    const topActeurs = donneesBio.acteurs_nationaux.slice(0, 3);
    const competitorsLabels = [...topActeurs.map(a => a.nom), "Autres"];
    const competitors = [
        ...topActeurs.map(a => parseFloat(a.part_marche)),
        100 - topActeurs.reduce((sum, a) => sum + parseFloat(a.part_marche), 0)
    ];
    
    return {
        marketShare,
        marketShareLabels,
        evolution,
        evolutionLabels,
        segments,
        segmentsLabels,
        competitors,
        competitorsLabels
    };
}

// Fonction pour déterminer la tendance en 1 mot basée sur les données
function determineTrend(value, type) {
    if (type === 'croissance') {
        const num = parseFloat(value);
        if (num >= 15) return 'Explosive';
        if (num >= 10) return 'Forte';
        if (num >= 5) return 'Modérée';
        if (num >= 0) return 'Faible';
        return 'Décroissante'; // Gère les valeurs négatives
    } else if (type === 'acteurs') {
        if (value > 300) return 'Croissant';
        if (value > 150) return 'Dynamique';
        if (value > 50) return 'Stable';
        return 'Limité'; // Gère les faibles nombres
    } else if (type === 'potentiel') {
        const lower = value.toLowerCase();
        if (lower.includes('très') || lower.includes('excep')) return 'Exceptionnel';
        if (lower.includes('élevé')) return 'Élevé';
        if (lower.includes('modéré')) return 'Modéré';
        return 'Limité'; // Gère les cas défavorables
    }
    return 'Modérée';
}

function generateFallbackData(secteur, region, objectif) {
    // Utiliser les données JSON si disponibles
    const deptData = donneesBio.departements[region];
    const secteurData = donneesBio.secteurs[secteur];
    
    // KPIs basés sur les vraies données JSON ou générés de façon probabiliste
    const kpis = deptData ? {
        marche: deptData.taille_marche,
        acteurs: deptData.nb_operateurs_bio_total,
        croissance: deptData.croissance,
        potentiel: deptData.potentiel,
        trends: {
            marche: determineTrend(deptData.croissance, 'croissance'),
            acteurs: determineTrend(deptData.nb_operateurs_bio_total, 'acteurs'),
            croissance: determineTrend(deptData.croissance, 'croissance'),
            potentiel: determineTrend(deptData.potentiel, 'potentiel')
        }
    } : {
        // Générer des valeurs probabilistes pour région inconnue (70% positif, 30% négatif/faible)
        marche: Math.floor(Math.random() * 400 + 50) + 'M€',
        acteurs: Math.floor(Math.random() * 200 + 20),
        croissance: Math.random() > 0.3 ? '+' + (Math.random() * 12 + 3).toFixed(1) + '%' : (Math.random() > 0.5 ? '+' + (Math.random() * 3).toFixed(1) + '%' : '-' + (Math.random() * 5).toFixed(1) + '%'),
        potentiel: Math.random() > 0.3 ? (Math.random() > 0.5 ? 'Élevé' : 'Très Élevé') : (Math.random() > 0.5 ? 'Modéré' : 'Limité'),
        trends: {
            marche: 'Estimé',
            acteurs: 'Estimé',
            croissance: 'Estimé',
            potentiel: 'Estimé'
        }
    };
    
    // Résumé basé sur les données
    let summary = `Cette analyse du secteur "${secteur}" dans la région "${region}" révèle `;
    if (deptData) {
        const croissanceNum = parseFloat(deptData.croissance);
        const isNegative = croissanceNum < 0;
        const isWeak = croissanceNum < 3 && croissanceNum >= 0;
        
        summary += `un marché de ${deptData.taille_marche} avec ${deptData.nb_operateurs_bio_total} opérateurs bio. `;
        
        if (isNegative) {
            summary += `⚠️ Le marché connaît une décroissance de ${deptData.croissance}, avec un potentiel ${deptData.potentiel.toLowerCase()}. `;
        } else if (isWeak) {
            summary += `La croissance est faible (${deptData.croissance}) avec un potentiel ${deptData.potentiel.toLowerCase()}. `;
        } else {
            summary += `La croissance est de ${deptData.croissance} avec un potentiel ${deptData.potentiel.toLowerCase()}. `;
        }
        
        summary += `Les spécialités locales incluent ${deptData.specialites.join(', ')}. `;
        
        // Ajouter les risques s'ils sont élevés
        if (deptData.risque_pollution_basol === 'Élevé' || deptData.risque_inondation_azi.includes('risque')) {
            summary += `⚠️ Attention aux risques environnementaux (pollution: ${deptData.risque_pollution_basol}, inondations: ${deptData.risque_inondation_azi}). `;
        }
    } else {
        summary += `un marché en pleine expansion avec un potentiel de croissance significatif. `;
    }
    
    // Adapter la conclusion selon le potentiel
    if (deptData && (deptData.potentiel === 'Limité' || parseFloat(deptData.croissance) < 0)) {
        summary += `Le marché présente des défis importants nécessitant une stratégie adaptée.`;
    } else {
        summary += `Le marché présente des opportunités stratégiques importantes.`;
    }
    
    // Générer des points clés adaptés au contexte
    let keyPoints = [];
    if (deptData) {
        const croissanceNum = parseFloat(deptData.croissance);
        const isNegative = croissanceNum < 0;
        const isWeak = croissanceNum < 3 && croissanceNum >= 0;
        const hasHighRisks = deptData.risque_pollution_basol === 'Élevé' || deptData.risque_inondation_azi.includes('risque');
        
        if (isNegative || deptData.potentiel === 'Limité') {
            // Points clés pour marché défavorable
            keyPoints = [
                `⚠️ Le marché ${region} connaît une ${isNegative ? 'décroissance' : 'croissance faible'} de ${deptData.croissance}, nécessitant une approche prudente et ciblée.`,
                `Avec seulement ${deptData.nb_operateurs_bio_total} opérateurs bio, le marché est peu développé mais présente des opportunités de niche pour les acteurs innovants.`,
                `Les spécialités locales (${deptData.specialites.join(', ')}) peuvent servir de différenciateur face aux marchés plus matures.`,
                hasHighRisks ? `⚠️ Risques environnementaux identifiés : pollution ${deptData.risque_pollution_basol}, inondations ${deptData.risque_inondation_azi}. Un plan de gestion des risques est essentiel.` : `La zone présente des risques environnementaux modérés nécessitant une surveillance.`,
                `Le potentiel ${deptData.potentiel.toLowerCase()} suggère de privilégier une stratégie conservatrice avec des investissements progressifs.`,
                `Focus recommandé sur les segments à forte valeur ajoutée et les circuits courts pour maximiser la rentabilité malgré la taille réduite du marché.`
            ];
        } else {
            // Points clés pour marché favorable (utiliser les tendances du JSON)
            keyPoints = donneesBio.tendances_marche.slice(0, 6);
        }
    } else {
        keyPoints = donneesBio.tendances_marche.slice(0, 6);
    }
    
    return {
        summary: summary,
        kpis: kpis,
        keyPoints: keyPoints,
        actors: donneesBio.acteurs_nationaux.slice(0, 6).map(a => ({
            name: a.nom,
            type: a.type,
            market: a.part_marche,
            growth: a.croissance
        })),
        recommendations: deptData && (parseFloat(deptData.croissance) < 0 || deptData.potentiel === 'Limité') ? [
            // Recommandations pour marché défavorable
            {
                title: 'Approche Conservatrice et Ciblée',
                desc: `Privilégier une stratégie d'entrée progressive avec des investissements limités et un focus sur les niches rentables.`,
                comment: `Avec une croissance de ${deptData.croissance} et un potentiel ${deptData.potentiel.toLowerCase()}, une approche prudente minimise les risques financiers.`
            },
            {
                title: 'Différenciation par la Qualité',
                desc: 'Se concentrer sur des produits premium à forte valeur ajoutée plutôt que sur le volume, en capitalisant sur les spécialités locales.',
                comment: `Les spécialités locales (${deptData.specialites.join(', ')}) offrent un angle de différenciation dans un marché restreint de ${deptData.taille_marche}.`
            },
            {
                title: 'Circuits Courts Obligatoires',
                desc: 'Établir des partenariats directs avec les producteurs locaux pour réduire les coûts et améliorer les marges.',
                comment: `Avec seulement ${deptData.nb_operateurs_bio_total} opérateurs, les circuits courts sont plus viables que les canaux de distribution traditionnels.`
            },
            {
                title: 'Gestion des Risques Environnementaux',
                desc: 'Mettre en place un plan de prévention et surveillance des risques identifiés (pollution, inondations).',
                comment: `Risques identifiés : pollution ${deptData.risque_pollution_basol}, inondations ${deptData.risque_inondation_azi}. La conformité et l'assurance sont critiques.`
            },
            {
                title: 'Test & Learn Avant Scale-Up',
                desc: `Tester le marché avec une offre limitée avant tout déploiement massif sur le secteur "${secteur}".`,
                comment: `Le contexte défavorable nécessite une validation du marché par étapes pour éviter les investissements non rentables.`
            },
            {
                title: 'Veille et Pivot Rapide',
                desc: 'Surveiller étroitement les évolutions du marché et être prêt à pivoter ou sortir si les indicateurs se dégradent.',
                comment: 'Dans un marché en difficulté, la capacité d\'adaptation rapide est plus importante que la persistance.'
            }
        ] : [
            // Recommandations pour marché favorable (version originale)
            {
                title: 'Positionnement Local et Authentique',
                desc: 'Miser sur l\'origine locale des produits et la transparence de la chaîne de production pour créer une connexion émotionnelle avec les consommateurs.',
                comment: deptData ? `Dans ${region}, les spécialités locales (${deptData.specialites.join(', ')}) renforcent l\'intérêt des consommateurs pour l\'origine locale — c\'est un levier d\'acquisition et de différenciation.` : 'Valoriser l\'origine locale et la traçabilité pour renforcer la confiance des consommateurs.'
            },
            {
                title: 'Digitalisation de la Distribution',
                desc: 'Développer une présence e-commerce forte avec click & collect et livraison rapide pour capter la croissance du canal digital (+25% annuel).',
                comment: deptData ? `Le canal digital croît dans la région; une plateforme e-commerce optimisée permettra de capter les consommateurs urbains et d\'augmenter la fréquence d\'achat.` : 'Le canal digital progresse rapidement; investir dans une expérience en ligne est stratégique.'
            },
            {
                title: 'Partenariats Stratégiques',
                desc: 'Établir des alliances avec des producteurs locaux et des magasins spécialisés pour sécuriser l\'approvisionnement et la distribution.',
                comment: 'Des partenariats avec producteurs locaux et détaillants spécialisés réduisent les risques d\'approvisionnement et augmentent la résilience face aux acteurs intégrés.'
            },
            {
                title: 'Communication sur les Certifications',
                desc: 'Mettre en avant les labels bio, certifications et démarches environnementales pour rassurer et convaincre les consommateurs exigeants.',
                comment: 'Les labels (AB, Ecocert...) restent un critère clé : une communication claire sur ces certifications augmente la crédibilité et la conversion.'
            },
            {
                title: 'Innovation Produit',
                desc: `Développer des produits différenciants dans le segment "${secteur}" en répondant aux nouvelles attentes : zéro déchet, vrac, formats nomades.`,
                comment: `L\'innovation (zéro déchet, vrac, formats nomades) permet souvent d\'obtenir une prime prix et de fidéliser une clientèle engagée sur le segment ${secteur}.`
            },
            {
                title: 'Analyse Continue du Marché',
                desc: 'Mettre en place une veille concurrentielle régulière avec BioMarket Insights pour ajuster la stratégie en temps réel.',
                comment: 'Le marché est dynamique; une veille régulière (KPIs, concurrents, tendances) permet d\'anticiper les ruptures et d\'adapter l\'offre rapidement.'
            }
        ],
        chartData: generateChartDataFromJson(secteur, region, deptData),
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
