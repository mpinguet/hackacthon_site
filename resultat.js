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

// ===========================
// SIMULATION DE CHARGEMENT
// ===========================

setTimeout(() => {
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
    
    // Générer le contenu
    generateReport();
}, 2000);

// ===========================
// GÉNÉRATION DU RAPPORT
// ===========================

function generateReport() {
    // Résumé exécutif
    document.getElementById('summaryText').textContent = 
        `Cette analyse approfondie du secteur "${secteur}" dans la région "${region}" révèle un marché en pleine expansion avec un potentiel de croissance significatif. Les tendances actuelles montrent une forte demande pour les produits bio locaux, portée par une prise de conscience environnementale croissante des consommateurs. Le marché présente des opportunités stratégiques pour les nouveaux entrants et les acteurs existants souhaitant renforcer leur position.`;
    
    // Indicateurs clés
    const kpis = {
        marche: Math.floor(Math.random() * 500 + 200) + 'M€',
        acteurs: Math.floor(Math.random() * 50 + 30),
        croissance: '+' + (Math.random() * 10 + 5).toFixed(1) + '%',
        potentiel: ['Élevé', 'Très Élevé', 'Modéré'][Math.floor(Math.random() * 3)]
    };
    
    document.getElementById('kpiMarche').textContent = kpis.marche;
    document.getElementById('kpiActeurs').textContent = kpis.acteurs;
    document.getElementById('kpiCroissance').textContent = kpis.croissance;
    document.getElementById('kpiPotentiel').textContent = kpis.potentiel;
    
    // Générer les graphiques
    generateCharts();
    
    // Points clés
    generateKeyPoints();
    
    // Acteurs du marché
    generateActors();
    
    // Recommandations
    generateRecommendations();
    
    // Données brutes
    document.getElementById('rawData').textContent = JSON.stringify({
        secteur: secteur,
        region: region,
        objectif: objectif,
        generatedAt: new Date().toISOString(),
        kpis: kpis,
        metadata: {
            version: '1.0',
            aiModel: 'BioMarket AI v4.5',
            confidenceScore: 0.94
        }
    }, null, 2);
}

// ===========================
// GÉNÉRATION DES GRAPHIQUES
// ===========================

function generateCharts() {
    // Graphique en camembert - Répartition du marché
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: ['Alimentaire', 'Cosmétiques', 'Textiles', 'Bien-être', 'Autres'],
            datasets: [{
                data: [45, 20, 15, 12, 8],
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
            labels: ['2020', '2021', '2022', '2023', '2024', '2025'],
            datasets: [{
                label: 'Demande (en millions €)',
                data: [150, 180, 220, 280, 350, 420],
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
            labels: ['Fruits & Légumes', 'Produits laitiers', 'Viandes', 'Céréales', 'Boissons'],
            datasets: [{
                label: 'Parts de marché (%)',
                data: [28, 22, 18, 17, 15],
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
            labels: ['Leader A', 'Leader B', 'Leader C', 'Autres'],
            datasets: [{
                data: [30, 25, 20, 25],
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
    const points = [
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
    const actors = [
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
    const recommendations = [
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
    ];
    
    const recosList = document.getElementById('recosList');
    recommendations.forEach((reco, index) => {
        const div = document.createElement('div');
        div.className = 'reco-item';
        div.innerHTML = `
            <div class="reco-number">${index + 1}</div>
            <div class="reco-content">
                <div class="reco-title">${reco.title}</div>
                <div class="reco-desc">${reco.desc}</div>
            </div>
        `;
        recosList.appendChild(div);
    });
}

// ===========================
// CONSOLE LOG
// ===========================

console.log('%c🌱 BioMarket Insights - Rapport Généré', 'color: #7cb342; font-size: 16px; font-weight: bold;');
console.log('Secteur:', secteur);
console.log('Région:', region);
console.log('Objectif:', objectif);