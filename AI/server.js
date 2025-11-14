const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { collectContexte } = require('../api');

const donneesBioPath = path.join(__dirname, 'data', 'donnees-bio.json');
const operateursLocalPath = path.join(__dirname, 'data', 'operateurs-locaux.json');
const donneesBio = JSON.parse(fs.readFileSync(donneesBioPath, 'utf8'));
const operateursLocaux = loadOperateursLocaux();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'mistral-nemo:latest';
const ALLOWED_MODELS = Array.from(new Set(
    (process.env.OLLAMA_ALLOWED_MODELS || 'deepseek-r1:8b,mistral-nemo:latest,llama3.1:8b')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
        .concat(DEFAULT_MODEL)
));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.get('/api/operateurs', (req, res) => {
    const { ville, segment, limit } = req.query;
    if (!ville) {
        return res.status(400).json({ error: 'ville_requise', message: 'Le paramètre ville est obligatoire' });
    }
    const base = findLocalOperators(ville);
    if (!base.length) {
        return res.status(404).json({ error: 'ville_non_supportee', message: `Aucun opérateur référencé pour ${ville}` });
    }
    const filtered = filterOperatorsBySegment(base, segment);
    const limitValue = limit ? Number(limit) : null;
    const operateurs = limitValue && limitValue > 0 ? filtered.slice(0, limitValue) : filtered;
    const payload = { ville, segment: segment || null, total: filtered.length, limite: limitValue, operateurs };
    persistMarketData('operateurs', { endpoint: '/api/operateurs', query: req.query, response: payload });
    res.json(payload);
});

app.post('/api/contexte', async (req, res) => {
    const { nom_ville, segment_analyse = '' } = req.body || {};
    if (!nom_ville) {
        return res.status(400).json({ error: 'nom_ville_requis', message: 'Le champ nom_ville est obligatoire' });
    }
    try {
        const contexte = await collectContexte(nom_ville, segment_analyse);
        persistMarketData('contexte', { endpoint: '/api/contexte', request: req.body, response: contexte });
        res.json(contexte);
    } catch (error) {
        console.error('❌ Collecteur contexte:', error);
        res.status(502).json({ error: 'collecte_contexte_impossible', message: error.message || 'Erreur inconnue pendant la collecte' });
    }
});

app.post('/api/analyze', async (req, res) => {
    const { secteur, region, objectif, ville, model } = req.body || {};
    const targetVille = (ville || '').trim() || (region || '').trim();
    if (!secteur || !objectif || !targetVille) {
        return res.status(400).json({
            error: 'parametres_requis',
            message: 'Les champs secteur, ville et objectif sont obligatoires'
        });
    }

    try {
        const requestedModel = resolveModelName(model);
        const contexte = await collectContexte(targetVille, secteur);
        const operatorsRaw = findLocalOperators(targetVille);
        const filteredOperatorsFull = filterOperatorsBySegment(operatorsRaw, secteur).map(formatLocalOperator);
        const limitedOperators = filteredOperatorsFull.slice(0, 25);
        const operateursPayload = {
            total: filteredOperatorsFull.length,
            list: limitedOperators
        };
        const facts = buildFactsPayload({
            secteur,
            region,
            objectif,
            ville: targetVille,
            contexte,
            operateurs: limitedOperators
        });

        let aiStudy = null;
        try {
            aiStudy = await runAISynthesis(facts, requestedModel);
        } catch (aiError) {
            console.warn('⚠️ Synthèse IA impossible:', aiError.message);
        }

        const study = sanitizeStudyPayload(aiStudy) || buildFallbackStudy(facts);

        const responsePayload = {
            ...study,
            context: contexte,
            operateurs: operateursPayload,
            metadata: {
                secteur,
                ville: targetVille,
                region,
                objectif,
                generatedAt: new Date().toISOString(),
                aiModel: aiStudy?.aiModel || requestedModel || 'fallback'
            }
        };

        persistMarketData('analyse', { endpoint: '/api/analyze', request: req.body, response: responsePayload });
        res.json(responsePayload);
    } catch (error) {
        console.error('❌ Analyse impossible:', error);
        res.status(502).json({ error: 'analyse_impossible', message: error.message || 'Erreur inconnue pendant la génération' });
    }
});

app.get('/api/health', async (_req, res) => {
    try {
        await axios.get(`${OLLAMA_URL.replace('/generate','')}/api/tags`, { timeout: 2000 });
        res.json({ status: 'ok', ollama: 'connected', model: DEFAULT_MODEL, timestamp: new Date().toISOString() });
    } catch (error) {
        res.json({ status: 'warning', ollama: 'disconnected', model: DEFAULT_MODEL, message: error.message, timestamp: new Date().toISOString() });
    }
});

app.listen(PORT, () => {
    console.log('🚀 BioMarket Insights API prête sur http://localhost:' + PORT);
});

// ---------- Helpers ----------
function loadOperateursLocaux() {
    try {
        const raw = JSON.parse(fs.readFileSync(operateursLocalPath, 'utf8'));
        return Object.entries(raw).reduce((acc, [key, value]) => {
            acc[normalizeCityName(key)] = value;
            acc[normalizeCityName(key.replace(/-/g, ' '))] = value;
            return acc;
        }, {});
    } catch (error) {
        console.warn('Impossible de charger operateurs-locaux.json:', error.message);
        return {};
    }
}

function normalizeCityName(value) {
    if (!value) return '';
    return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function formatLocalOperator(entry = {}) {
    const activites = entry.activites || entry.segments || (entry.activite ? [entry.activite] : []);
    const categories = entry.categories || (entry.categorie ? [entry.categorie] : []);
    return {
        id: entry.id || entry.nom,
        nom: entry.nom || 'Opérateur local',
        activite: entry.activite || activites[0] || 'Non renseigné',
        categorie: entry.categorie || categories[0] || 'Non renseigné',
        segments: entry.segments || activites,
        activites,
        categories,
        ville: entry.ville || '',
        quartier: entry.quartier || null,
        code_postal: entry.code_postal || null,
        adresse: entry.adresse || null,
        latitude: typeof entry.latitude === 'number' ? entry.latitude : entry.lat || entry.latitude_deg || null,
        longitude: typeof entry.longitude === 'number' ? entry.longitude : entry.lon || entry.lng || entry.longitude_deg || null,
        departement: entry.departement || entry.departement_nom || null,
        labels: entry.labels || [],
        site: entry.site || null,
        contact: entry.contact || null,
        date_mise_a_jour: entry.date_mise_a_jour || null
    };
}

function findLocalOperators(ville) {
    const normalized = normalizeCityName(ville);
    if (!normalized) return [];
    return operateursLocaux[normalized] || operateursLocaux[normalized.replace(/\s+/g, '')] || operateursLocaux[ville?.toLowerCase?.()] || [];
}

function filterOperatorsBySegment(operators, segment) {
    if (!segment) return operators;
    const needle = segment.toLowerCase();
    const filtered = operators.filter(op =>
        (op.segments || []).some(seg => seg.toLowerCase().includes(needle)) ||
        (op.activite || '').toLowerCase().includes(needle)
    );
    return filtered.length ? filtered : operators;
}

function persistMarketData(prefix, payload) {
    try {
        const id = randomUUID();
        const filename = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}-${id}.json`;
        const filePath = path.join(__dirname, 'data', filename);
        fs.writeFileSync(filePath, JSON.stringify({ id, prefix, generated_at: new Date().toISOString(), payload }, null, 2), 'utf8');
    } catch (err) {
        console.warn(`Impossible d'enregistrer ${prefix}:`, err.message);
    }
}

function resolveModelName(value) {
    const candidate = (value || '').trim();
    if (!candidate) return DEFAULT_MODEL;
    const match = ALLOWED_MODELS.find(model => model.toLowerCase() === candidate.toLowerCase());
    if (!match && candidate) {
        console.warn(`Mod�le ${candidate} non autoris�, utilisation de ${DEFAULT_MODEL}.`);
    }
    return match || DEFAULT_MODEL;
}

function buildFactsPayload({ secteur, region, objectif, ville, contexte, operateurs }) {
    const leanProductionRegion = limitArray(contexte?.production_locale_region_5ans, 5);
    const leanProductionNational = limitArray(contexte?.production_nationale_5ans, 5);
    const ventes = limitArray(contexte?.tendance_ventes_pct_5ans?.details, 5);
    const commerce = limitArray(contexte?.tendance_commerce_5ans?.details, 5);
    const competition = summarizeCompetition(contexte?.concurrence_locale_api);
    const leanOperators = buildLeanOperators(operateurs, 12);
    return {
        secteur,
        region,
        ville,
        objectif,
        geo: contexte?.geo || {},
        risques: summarizeRisks(contexte?.risques_locaux_api),
        production: {
            region: leanProductionRegion,
            national: leanProductionNational
        },
        ventes,
        commerce,
        competition,
        operateurs: leanOperators
    };
}

function limitArray(value, max = 5) {
    if (!Array.isArray(value)) return [];
    if (value.length <= max) return value;
    return value.slice(value.length - max);
}

function summarizeCompetition(competition = null) {
    if (!competition) return null;
    const ventilationEntries = Object.entries(competition.ventilation_activites || {});
    const limitedVentilation = ventilationEntries
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {});

    const topOperators = Array.isArray(competition.detail_operateurs)
        ? competition.detail_operateurs.slice(0, 6).map(op => ({
              nom: op.nom,
              activite: op.activite,
              categorie: op.categorie,
              ville: op.ville,
              labels: Array.isArray(op.labels) ? op.labels.slice(0, 2) : [],
              site: op.site || null
          }))
        : [];

    return {
        nb_operateurs_bio_total: competition.nb_operateurs_bio_total,
        nb_concurrents_directs: competition.nb_concurrents_directs,
        ventilation_activites: limitedVentilation,
        echantillon_operateurs: topOperators
    };
}

function summarizeRisks(risques = {}) {
    const keys = ['basol', 'azi', 'catnat'];
    const summary = {
        code_commune: risques?.code_commune || null
    };
    keys.forEach(key => {
        const bloc = risques?.[key];
        if (!bloc) return;
        const total = typeof bloc.total === 'number' ? bloc.total : (Array.isArray(bloc.items) ? bloc.items.length : 0);
        summary[key] = {
            total,
            niveau_risque: bloc.niveau_risque || null,
            resume: bloc.resume || null,
            source: bloc.source || null
        };
        if (key === 'catnat' && Array.isArray(bloc.items)) {
            summary[key].derniers_evenements = bloc.items.slice(0, 3).map(item => ({
                risque: item.libelle_risque_jo,
                debut: item.date_debut_evt,
                fin: item.date_fin_evt
            }));
        }
    });
    return summary;
}

function buildLeanOperators(list = [], limit = 10) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, limit).map(op => ({
        nom: op.nom,
        activite: op.activite,
        categorie: op.categorie,
        ville: op.ville,
        latitude: typeof op.latitude === 'number' ? op.latitude : null,
        longitude: typeof op.longitude === 'number' ? op.longitude : null,
        departement: op.departement || op.departement_nom || null,
        labels: Array.isArray(op.labels) ? op.labels.slice(0, 2) : [],
        site: op.site || null
    }));
}

async function runAISynthesis(facts, modelName = DEFAULT_MODEL) {
    const prompt = buildAIPrompt(facts);
    try {
        const { data } = await axios.post(OLLAMA_URL, {
            model: modelName,
            prompt,
            stream: false,
            options: { temperature: 0.3 }
        }, { timeout: 60000 });
        const raw = data?.response || '';
        const jsonText = extractJsonObject(raw);
        const parsed = JSON.parse(jsonText);
        parsed.aiModel = data?.model || modelName || DEFAULT_MODEL;
        return parsed;
    } catch (error) {
        const status = error.response?.status;
        const reason = status ? `${status} ${error.response?.statusText || 'Erreur'}` : error.message;
        throw new Error(`Synthèse IA échouée: ${reason}`);
    }
}

function buildAIPrompt(facts) {
    const schema = `{
  "summary": "...",
  "kpis": {
    "marche": "...",
    "acteurs": "...",
    "croissance": "...",
    "potentiel": "...",
    "trends": {
      "marche": "...",
      "acteurs": "...",
      "croissance": "...",
      "potentiel": "..."
    }
  },
  "keyPoints": ["..."],
  "actors": [{"name":"","type":"","market":"","growth":"","site":""}],
  "recommendations": [{"title":"","desc":""}],
  "chartData": {
    "marketShare": [],
    "marketShareLabels": [],
    "evolution": [],
    "evolutionLabels": [],
    "segments": [],
    "segmentsLabels": [],
    "competitors": [],
    "competitorsLabels": []
  }
}`;
    const serializedFacts = JSON.stringify(facts);
    return [
        'Tu es un analyste de marche bio pour PME. Analyse les donnees structurees ci-dessous et produit une etude exploitable.',
        'Donnees :',
        serializedFacts,
        '',
        'Contraintes :',
        '- Reponds UNIQUEMENT avec un JSON valide (sans markdown).',
        '- Le JSON doit respecter strictement la structure suivante:',
        schema,
        '- Utilise les chiffres disponibles dans facts. N indique "Non disponible" que si l information est absente.',
        '- Le champ "kpis.acteurs" doit refleter le volume reel d operateurs identifies (facts.competition.nb_operateurs_bio_total ou facts.operateurs.length).',
        '- Le bloc "actors" doit lister jusqu a 5 operateurs issus de facts.operateurs ou facts.competition.echantillon_operateurs avec name/type/market/growth/site renseignes (utilise "Non disponible" uniquement si aucune info existe).',
        '- Chaque jeu de donnees "chartData" doit provenir des chiffres fournis (ventes, commerce, competition). En l absence de donnees, renvoie [].',
        '- N ajoute aucun commentaire hors JSON.'
    ].join('\n');
}
function extractJsonObject(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('Réponse IA non JSON');
    }
    return text.slice(start, end + 1);
}

function sanitizeStudyPayload(study) {
    if (!study || typeof study !== 'object') return null;
    const requiredKeys = ['summary','kpis','keyPoints','actors','recommendations','chartData'];
    for (const key of requiredKeys) {
        if (!(key in study)) return null;
    }
    study.keyPoints = Array.isArray(study.keyPoints) ? study.keyPoints : [];
    study.actors = Array.isArray(study.actors) ? study.actors : [];
    study.recommendations = Array.isArray(study.recommendations) ? study.recommendations : [];
    return study;
}

function buildFallbackStudy(facts) {
    const kpis = buildFallbackKpis(facts);
    const keyPoints = buildKeyPointsFromFacts(facts, kpis);
    const recommendations = buildRecommendationsFromFacts(facts, kpis);
    const chartData = buildChartDataFromFacts(facts);
    const actors = facts.operateurs.map(op => ({
        name: op.nom || op.name,
        type: op.categorie || op.activite || 'Non renseigné',
        market: '-',
        growth: '-',
        site: op.site || null
    }));
    const summary = buildFallbackSummary(facts, kpis);
    return { summary, kpis, keyPoints, actors, recommendations, chartData };
}

function buildFallbackSummary(facts, kpis) {
    const geo = facts.geo || {};
    const population = geo.population ? `${formatNumber(geo.population)} habitants` : 'population non communiquée';
    const acteurs = kpis.acteurs || 'un nombre limité d\'opérateurs';
    const croissance = kpis.croissance || 'une tendance non communiquée';
    const territoire = geo.nom_commune || facts.ville || geo.nom_region || facts.region || 'le territoire ciblé';
    return `Le territoire ${territoire} (${population}) affiche ${croissance} sur le segment ${facts.secteur}. ` +
           `Nous avons référencé ${acteurs} et identifié des dynamiques locales utiles pour l'objectif "${facts.objectif}".`;
}

function buildFallbackKpis(facts) {
    const ventes = facts.ventes || [];
    const venteAvg = ventes.length ? averageNumbers(ventes.map(v => Number(v.evolution_pct_moyenne))) : null;
    const commerce = facts.commerce || [];
    const latestCommerce = commerce.length ? commerce[commerce.length - 1].total_valeur_M_eur : null;
    const actorsCount = facts.operateurs.length || (facts.competition?.nb_operateurs_bio_total) || '-';
    const potentiel = derivePotentialWord(venteAvg);
    return {
        marche: latestCommerce ? `${formatNumber(latestCommerce)} M€ (flux commerce)` : 'Non disponible',
        acteurs: actorsCount,
        croissance: venteAvg != null ? formatPercent(venteAvg) : 'Non disponible',
        potentiel,
        trends: {
            marche: venteAvg != null ? (venteAvg >= 4 ? 'Forte' : 'Modérée') : 'Non disponible',
            acteurs: actorsCount && actorsCount !== '-' ? (actorsCount > 20 ? 'Croissant' : 'Stable') : 'Non disponible',
            croissance: venteAvg != null ? derivePotentialWord(venteAvg) : 'Non disponible',
            potentiel: potentiel
        }
    };
}

function buildChartDataFromFacts(facts) {
    const competition = facts.competition?.ventilation_activites || buildCountsFromOperators(facts.operateurs, 'activite');
    const marketShareLabels = Object.keys(competition || {});
    const marketShare = marketShareLabels.map(label => competition[label]);

    const segmentsCounts = buildCountsFromOperators(facts.operateurs, 'categorie');
    const segmentsLabels = Object.keys(segmentsCounts);
    const segments = segmentsLabels.map(label => segmentsCounts[label]);

    const evolutionLabels = facts.ventes.map(v => v.annee);
    const evolution = facts.ventes.map(v => Number(v.evolution_pct_moyenne)).filter(v => Number.isFinite(v));

    const competitorsLabels = (facts.operateurs || []).slice(0, 6).map(op => op.nom || op.name);
    const competitors = competitorsLabels.map(() => 1);

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

function buildCountsFromOperators(operators, field) {
    return operators.reduce((acc, op) => {
        const key = (op[field] || op[field === 'activite' ? 'categorie' : 'activite'] || 'Autre').toString();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

function buildKeyPointsFromFacts(facts, kpis) {
    const points = [];
    const geo = facts.geo || {};
    if (geo.nom_commune || geo.nom_region) {
        points.push(`Le territoire ${geo.nom_commune || geo.nom_region} compte ${formatNumber(geo.population) || 'n/a'} habitants et constitue la base de prospection.`);
    }
    if (facts.operateurs.length) {
        points.push(`${facts.operateurs.length} opérateurs locaux ont été identifiés sur le segment ${facts.secteur}.`);
    }
    const ventes = facts.ventes || [];
    if (ventes.length) {
        const avg = averageNumbers(ventes.map(v => Number(v.evolution_pct_moyenne))).toFixed(2);
        points.push(`Les ventes bio affichent une évolution moyenne de ${avg}% sur 5 ans.`);
    }
    const productionRegion = facts.production.region || [];
    if (productionRegion.length) {
        const latest = productionRegion[productionRegion.length - 1];
        points.push(`La surface bio régionale atteint ${formatNumber(latest.surface_totale_ha)} ha pour ${formatNumber(latest.nb_fermes)} fermes.`);
    }
    const risks = facts.risques || {};
    const basolTotal = risks.basol?.total || (risks.basol?.items?.length || 0);
    if (basolTotal) {
        points.push(`Surveillance environnementale: ${basolTotal} sites BASOL référencés.`);
    }
    if (!points.length) {
        points.push('Les données collectées ne mettent pas en évidence de tendances significatives supplémentaires.');
    }
    return points;
}

function buildRecommendationsFromFacts(facts, kpis) {
    const recommandations = [];
    recommandations.push({
        title: 'Structurer l’offre locale',
        desc: `Capitaliser sur les ${facts.operateurs.length} opérateurs identifiés pour bâtir des partenariats exclusifs et sécuriser l’approvisionnement.`
    });
    if (kpis.croissance && kpis.croissance !== 'Non disponible') {
        recommandations.push({
            title: 'Accélérer sur les canaux en croissance',
            desc: `La croissance moyenne des ventes (${kpis.croissance}) justifie un plan d’investissement marketing ciblé (drive, circuits courts).`
        });
    }
    recommandations.push({
        title: 'Maîtriser les risques locaux',
        desc: 'Documenter les risques BASOL / AZI pour rassurer les distributeurs et renforcer la traçabilité environnementale.'
    });
    return recommandations;
}

function derivePotentialWord(growth) {
    if (growth == null || Number.isNaN(growth)) return 'Non disponible';
    const value = Number(growth);
    if (value >= 8) return 'Très élevé';
    if (value >= 4) return 'Élevé';
    if (value >= 1) return 'Modéré';
    return 'Sous tension';
}

function averageNumbers(values) {
    const nums = values.filter(v => Number.isFinite(v));
    if (!nums.length) return 0;
    return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function formatNumber(value) {
    if (value == null || value === '') return null;
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(num);
}

function formatPercent(value) {
    if (value == null || value === '') return '-';
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return `${num.toFixed(2)}%`;
}

