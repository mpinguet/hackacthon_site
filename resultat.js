// ===========================
// RÉCUPÉRATION DES PARAMÈTRES
// ===========================

function decodeParam(key) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key) ? decodeURIComponent(params.get(key)) : '';
}

const secteur = decodeParam('secteur') || 'Alimentaire Bio';
const region = decodeParam('region') || 'France';
const objectif = decodeParam('objectif') || 'Analyse de marché générale';

// Debug : afficher les paramètres reçus
console.log('🔍 Paramètres reçus:');
console.log('  - secteur:', secteur);
console.log('  - region:', region);
console.log('  - objectif:', objectif);

// ===========================
// APPEL API OLLAMA
// ===========================

// Configuration de l'API
const API_URL = 'http://localhost:3000/api/analyze';

// Variable globale pour stocker les données de l'IA
let aiData = null;

// Fonction pour appeler l'API Ollama
async function fetchAIAnalysis() {
    try {
        console.log('🚀 Appel de l\'API Ollama...');
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                secteur: secteur,
                region: region,
                objectif: objectif
            })
        });
        
        if (!response.ok) {
            throw new Error('Erreur API: ' + response.status);
        }
        
        const data = await response.json();
        console.log('✅ Données reçues de l\'IA:', data);
        return data;
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'appel API:', error);
        return null;
    }
}

// Lancement de l'analyse
(async () => {
    // Récupérer les données de l'IA
    aiData = await fetchAIAnalysis();
    
    // Masquer le banner de chargement
    document.getElementById('statusBanner').style.display = 'none';
    
    // Afficher les métadonnées
    const metadataCard = document.getElementById('metadata');
    metadataCard.style.display = 'block';
    
    // Remplir les métadonnées
    document.getElementById('secteurBadge').textContent = `📦 ${secteur}`;
    document.getElementById('regionBadge').textContent = `📍 ${region}`;
    document.getElementById('dateGeneration').textContent = new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('objectifValue').textContent = objectif;
    
    // Afficher le rapport
    document.getElementById('mainReport').style.display = 'block';
    
    // Générer le contenu avec les données de l'IA
    generateReport();
})();

// ===========================
// GÉNÉRATION DU RAPPORT
// ===========================

function generateReport() {
    // Si les données AI ne sont pas disponibles, utiliser des valeurs par défaut
    if (!aiData) {
        console.warn('⚠️ Données AI non disponibles, utilisation des valeurs par défaut');
        aiData = {
            summary: `Cette analyse approfondie du secteur "${secteur}" dans la région "${region}" révèle un marché en pleine expansion avec un potentiel de croissance significatif.`,
            kpis: {
                marche: Math.floor(Math.random() * 500 + 200) + 'M€',
                acteurs: Math.floor(Math.random() * 50 + 30),
                croissance: '+' + (Math.random() * 10 + 5).toFixed(1) + '%',
                potentiel: ['Élevé', 'Très Élevé', 'Modéré'][Math.floor(Math.random() * 3)]
            }
        };
    }
    
    // Résumé exécutif depuis l'IA
    document.getElementById('summaryText').textContent = aiData.summary;
    
    // Indicateurs clés depuis l'IA
    document.getElementById('kpiMarche').textContent = aiData.kpis.marche;
    document.getElementById('kpiActeurs').textContent = aiData.kpis.acteurs;
    document.getElementById('kpiCroissance').textContent = aiData.kpis.croissance;
    document.getElementById('kpiPotentiel').textContent = aiData.kpis.potentiel;
    
    // Tendances KPI depuis l'IA
    if (aiData.kpis.trends) {
        updateKpiTrend('kpiTrendMarche', aiData.kpis.trends.marche);
        updateKpiTrend('kpiTrendActeurs', aiData.kpis.trends.acteurs);
        updateKpiTrend('kpiTrendCroissance', aiData.kpis.trends.croissance);
        updateKpiTrend('kpiTrendPotentiel', aiData.kpis.trends.potentiel);
    }
    
    // Générer les graphiques avec les données de l'IA
    generateCharts();
    
    // Points clés depuis l'IA
    generateKeyPoints();
    
    // Acteurs du marché depuis l'IA
    generateActors();
    
    // Recommandations depuis l'IA
    generateRecommendations();
    
    // Données brutes
    document.getElementById('rawData').textContent = JSON.stringify(aiData, null, 2);
}

// ===========================
// GÉNÉRATION DES GRAPHIQUES
// ===========================

function generateCharts() {
    // Récupérer les données des graphiques depuis l'IA (ou utiliser des valeurs par défaut)
    const chartData = aiData && aiData.chartData ? aiData.chartData : {
        marketShare: [45, 20, 15, 12, 8],
        evolution: [150, 180, 220, 280, 350, 420],
        segments: [28, 22, 18, 17, 15],
        competitors: [30, 25, 20, 25]
    };
    
    // Graphique en camembert - Parts de marché
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: chartData.marketShareLabels || ['Alimentaire', 'Cosmétiques', 'Textiles', 'Bien-être', 'Autres'],
            datasets: [{
                data: chartData.marketShare,
                backgroundColor: [
                    '#7cb342',
                    '#aed581',
                    '#2d5016',
                    '#9ccc65',
                    '#c5e1a5'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Graphique linéaire - Évolution
    const lineCtx = document.getElementById('lineChart').getContext('2d');
    new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: chartData.evolutionLabels || ['2020', '2021', '2022', '2023', '2024', '2025'],
            datasets: [{
                label: 'Demande (en millions €)',
                data: chartData.evolution,
                borderColor: '#7cb342',
                backgroundColor: 'rgba(124, 179, 66, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Graphique en barres - Comparaison segments
    const barCtx = document.getElementById('barChart').getContext('2d');
    new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: chartData.segmentsLabels || ['Fruits & Légumes', 'Produits laitiers', 'Viandes', 'Céréales', 'Boissons'],
            datasets: [{
                label: 'Parts de marché (%)',
                data: chartData.segments,
                backgroundColor: [
                    '#7cb342',
                    '#aed581',
                    '#9ccc65',
                    '#c5e1a5',
                    '#dcedc8'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 30
                }
            }
        }
    });
    
    // Graphique doughnut - Parts concurrents
    const doughnutCtx = document.getElementById('doughnutChart').getContext('2d');
    new Chart(doughnutCtx, {
        type: 'doughnut',
        data: {
            labels: chartData.competitorsLabels || ['Leader A', 'Leader B', 'Leader C', 'Autres'],
            datasets: [{
                data: chartData.competitors,
                backgroundColor: [
                    '#2d5016',
                    '#7cb342',
                    '#aed581',
                    '#c5e1a5'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// ===========================
// POINTS CLÉS
// ===========================

function generateKeyPoints() {
    // Utiliser les points depuis l'IA ou des points par défaut
    const points = aiData && aiData.keyPoints ? aiData.keyPoints.map((text, idx) => ({
        icon: ['📈', '🌍', '🏪', '👥', '🔒', '💡'][idx] || '✨',
        text: text
    })) : [
        {
            icon: '📈',
            text: `Le marché bio en ${region} connaît une croissance soutenue de 8-12% par an, portée par l'évolution des comportements de consommation.`
        },
        {
            icon: '🌍',
            text: 'La demande pour les produits locaux et de saison augmente significativement, créant des opportunités pour les circuits courts.'
        },
        {
            icon: '🏪',
            text: 'La distribution se diversifie : grandes surfaces (45%), magasins spécialisés (30%), vente directe (15%), e-commerce (10%).'
        },
        {
            icon: '👥',
            text: 'Le profil consommateur évolue : 67% des acheteurs bio ont moins de 45 ans, avec un pouvoir d\'achat moyen à élevé.'
        },
        {
            icon: '🔒',
            text: 'Les certifications et labels (AB, Ecocert, Nature & Progrès) restent des critères décisifs pour 82% des consommateurs.'
        },
        {
            icon: '💡',
            text: `Le segment "${secteur}" présente des barrières à l'entrée modérées mais nécessite une expertise en traçabilité et qualité.`
        }
    ];
    
    const pointsList = document.getElementById('pointsList');
    points.forEach(point => {
        const div = document.createElement('div');
        div.className = 'point-item';
        div.innerHTML = `
            <div class="point-icon">${point.icon}</div>
            <div class="point-text">${point.text}</div>
        `;
        pointsList.appendChild(div);
    });
}

// ===========================
// ACTEURS DU MARCHÉ
// ===========================

function generateActors() {
    // Utiliser les acteurs depuis l'IA ou des acteurs par défaut
    const actors = aiData && aiData.actors ? aiData.actors.map((actor, idx) => ({
        ...actor,
        icon: ['🏪', '🌾', '🏭', '💻', '✅', '🚚'][idx] || '🏢'
    })) : [
        {
            name: 'Bio Coop France',
            type: 'Distributeur',
            icon: '🏪',
            market: '18%',
            growth: '+12%'
        },
        {
            name: 'Fermes Bio Locales',
            type: 'Producteur',
            icon: '🌾',
            market: '15%',
            growth: '+8%'
        },
        {
            name: 'NaturaBio',
            type: 'Transformateur',
            icon: '🏭',
            market: '12%',
            growth: '+15%'
        },
        {
            name: 'Marché Vert',
            type: 'Plateforme',
            icon: '💻',
            market: '8%',
            growth: '+25%'
        },
        {
            name: 'Ecocert Région',
            type: 'Certification',
            icon: '✅',
            market: 'Leader',
            growth: 'Stable'
        },
        {
            name: 'Bio Express',
            type: 'Logistique',
            icon: '🚚',
            market: '10%',
            growth: '+10%'
        }
    ];
    
    const actorsGrid = document.getElementById('actorsGrid');
    actors.forEach(actor => {
        const div = document.createElement('div');
        div.className = 'actor-card';
        div.innerHTML = `
            <div class="actor-header">
                <div class="actor-logo">${actor.icon}</div>
                <div>
                    <div class="actor-name">${actor.name}</div>
                    <div class="actor-type">${actor.type}</div>
                </div>
            </div>
            <div class="actor-info">
                <div class="actor-stat">
                    <span>Part de marché:</span>
                    <strong>${actor.market}</strong>
                </div>
                <div class="actor-stat">
                    <span>Croissance:</span>
                    <strong style="color: #4caf50;">${actor.growth}</strong>
                </div>
            </div>
        `;
        actorsGrid.appendChild(div);
    });
}

// ===========================
// RECOMMANDATIONS
// ===========================

function generateRecommendations() {
    // Utiliser les recommandations depuis l'IA ou des recommandations par défaut
    const recommendations = aiData && aiData.recommendations ? aiData.recommendations : [
        {
            title: 'Positionnement Local et Authentique',
            desc: 'Miser sur l\'origine locale des produits et la transparence de la chaîne de production pour créer une connexion émotionnelle avec les consommateurs.',
            comment: `Le marché montre un fort intérêt pour l\'origine locale ; les consommateurs privilégient les circuits courts et la traçabilité — opportunité particulièrement forte en ${region}.`
        },
        {
            title: 'Digitalisation de la Distribution',
            desc: 'Développer une présence e-commerce forte avec click & collect et livraison rapide pour capter la croissance du canal digital (+25% annuel).',
            comment: 'Le canal digital croît rapidement (~+25% annuel) ; une expérience en ligne fluide est clé pour capter les consommateurs urbains et flexibles.'
        },
        {
            title: 'Partenariats Stratégiques',
            desc: 'Établir des alliances avec des producteurs locaux et des magasins spécialisés pour sécuriser l\'approvisionnement et la distribution.',
            comment: 'Face à une offre fragmentée, les partenariats réduisent les risques d\'approvisionnement et renforcent la compétitivité face aux acteurs intégrés.'
        },
        {
            title: 'Communication sur les Certifications',
            desc: 'Mettre en avant les labels bio, certifications et démarches environnementales pour rassurer et convaincre les consommateurs exigeants.',
            comment: 'Les labels (AB, Ecocert...) restent un critère décisif pour la majorité des acheteurs ; une communication claire augmente le taux de conversion.'
        },
        {
            title: 'Innovation Produit',
            desc: `Développer des produits différenciants dans le segment "${secteur}" en répondant aux nouvelles attentes : zéro déchet, vrac, formats nomades.`,
            comment: 'La demande pour des formats pratiques et durables augmente ; l\'innovation peut permettre de capter une prime prix et fidéliser une clientèle engagée.'
        },
        {
            title: 'Analyse Continue du Marché',
            desc: 'Mettre en place une veille concurrentielle régulière avec BioMarket Insights pour ajuster la stratégie en temps réel.',
            comment: 'Le marché est dynamique et sujet à des ruptures de tendance rapides ; une veille régulière permet d\'anticiper les mouvements des concurrents et d\'adapter l\'offre.'
        }
    ];
    
    // Helper: génère un commentaire pertinent pour une recommandation en se basant sur aiData
    function buildRecoComment(reco, idx) {
        if (reco.comment) return reco.comment;

        const kpis = aiData && aiData.kpis ? aiData.kpis : {};
        const summary = aiData && aiData.summary ? aiData.summary : '';
        const growth = (kpis.croissance || '').toString();
        const marche = kpis.marche || '';

        const growthPos = growth.includes('+') || growth.toLowerCase().includes('↑');

        // Messages adaptés par index (1..6)
        switch (idx) {
            case 0:
                return `Sur la base des données, la valorisation de l\'origine locale est un levier efficace en ${region} — la traçabilité et la proximité renforcent la confiance des consommateurs.`;
            case 1:
                return growthPos ? `Le canal digital montre une forte croissance (${growth || 'tendance positive'}) — investir dans l\'e-commerce et une UX fluide permettra de capter les segments urbains.` : `Le canal digital progresse; une présence en ligne améliorée limitera le risque de perte de parts de marché.`;
            case 2:
                return `Les résultats montrent une offre fragmentée; des partenariats (producteurs, enseignes spécialisées) réduisent les risques d\'approvisionnement et sécurisent la chaîne logistique.`;
            case 3:
                return `Les certifications restent un critère d\'achat majeur : communiquer clairement sur les labels (AB, Ecocert...) augmente la crédibilité et le taux de conversion.`;
            case 4:
                return `L\'innovation produit (zéro déchet, vrac, formats nomades) est un différenciateur rentable — elle permet souvent d\'atteindre une prime prix sur le segment ${secteur}.`;
            case 5:
                return `Le marché évolue rapidement; mettre en place une veille continue (KPIs, concurrents, tendances) permettra d\'ajuster la stratégie en temps réel et d\'anticiper les ruptures.`;
            default:
                return summary || 'Commentaire marché non disponible.';
        }
    }

    const recosList = document.getElementById('recosList');
    recommendations.forEach((reco, index) => {
        // Générer ou utiliser le commentaire fourni par l'IA
        const commentText = buildRecoComment(reco, index);
        const div = document.createElement('div');
        div.className = 'reco-item';
        div.innerHTML = `
            <div class="reco-number">${index + 1}</div>
            <div class="reco-content">
                <div class="reco-title">${reco.title}</div>
                <div class="reco-desc">${reco.desc}</div>
                ${commentText ? `<div class="reco-comment">${commentText}</div>` : ''}
            </div>
        `;
        recosList.appendChild(div);
    });
}

// ===========================
// FONCTION POUR METTRE À JOUR LES TENDANCES KPI
// ===========================

function updateKpiTrend(elementId, trendText) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Déterminer l'icône et la classe CSS selon le mot
    let icon = '→';
    let cssClass = 'neutral';
    const lowerText = trendText.toLowerCase();
    
    // Tendances positives
    if (lowerText.includes('explos') || lowerText.includes('forte') || 
        lowerText.includes('élevé') || lowerText.includes('excep') || 
        lowerText.includes('croiss') || lowerText.includes('dynami')) {
        icon = '↑';
        cssClass = 'positive';
    }
    // Tendances négatives
    else if (lowerText.includes('faible') || lowerText.includes('limit') || 
             lowerText.includes('décroiss') || lowerText.includes('baisse')) {
        icon = '↓';
        cssClass = 'negative';
    }
    // Tendances neutres (stable, modéré)
    else {
        icon = '→';
        cssClass = 'neutral';
    }
    
    element.textContent = `${icon} ${trendText}`;
    element.className = `kpi-trend ${cssClass}`;
}

// ===========================
// CONSOLE LOG
// ===========================

console.log('%c🌱 BioMarket Insights - Rapport Généré par IA', 'color: #7cb342; font-size: 16px; font-weight: bold;');
console.log('Secteur:', secteur);
console.log('Région:', region);
console.log('Objectif:', objectif);
console.log('🤖 IA utilisée: Ollama deepseek-r1:8b');