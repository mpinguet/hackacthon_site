/**
 * Collecteur de donnees multi-sources pour la construction du contexte JSON.
 * Toutes les etapes suivent le workflow decrit (requete Geo bloquante, puis collectes paralleles).
 */

'use strict';

const path = require('path');
const fs = require('fs');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const GEO_API_URL = 'https://geo.api.gouv.fr/communes';
const GEORISQUES_ENDPOINTS = {
  basol: 'https://www.georisques.gouv.fr/api/v1/ssp/instructions',
  azi: 'https://www.georisques.gouv.fr/api/v1/gaspar/azi',
  catnat: 'https://www.georisques.gouv.fr/api/v1/gaspar/catnat'
};
const WORLD_BANK_COUNTRY = 'FRA';
const WORLD_BANK_INDICATORS = {
  population: 'SP.POP.TOTL',
  gdp_growth: 'NY.GDP.MKTP.KD.ZG',
  agri_land_pct: 'AG.LND.AGRI.ZS'
};

const DB_PATH = path.join(__dirname, 'votre_base_de_donnees.db');
const DONNEES_BIO_PATH = path.join(__dirname, 'AI', 'data', 'donnees-bio.json');
const OPERATEURS_DATA_PATH = path.join(__dirname, 'AI', 'data', 'operateurs-locaux.json');

let donneesBio = null;
try {
  if (fs.existsSync(DONNEES_BIO_PATH)) {
    donneesBio = JSON.parse(fs.readFileSync(DONNEES_BIO_PATH, 'utf8'));
  }
} catch (error) {
  console.warn('Impossible de charger donnees-bio.json:', error.message);
}

let operateursLocauxData = {};
try {
  if (fs.existsSync(OPERATEURS_DATA_PATH)) {
    const rawOperateurs = JSON.parse(fs.readFileSync(OPERATEURS_DATA_PATH, 'utf8'));
    operateursLocauxData = Object.entries(rawOperateurs).reduce((acc, [key, value]) => {
      acc[normalizeText(key)] = value;
      return acc;
    }, {});
  }
} catch (error) {
  console.warn('Impossible de charger operateurs-locaux.json:', error.message);
}

const httpClient = axios.create({
  timeout: 15000,
  headers: { 'User-Agent': 'BioCollector/1.0' }
});

/**
 * Point d'entree principal.
 * @param {string} nom_ville
 * @param {string} segment_analyse
 * @returns {Promise<object>} contexte_data
 */
async function collectContexte(nom_ville, segment_analyse) {
  if (!nom_ville) {
    throw new Error('nom_ville est requis');
  }

  const geo = await fetchGeoData(nom_ville);
  const { code_commune, nom_region } = geo;

  let db;
  try {
    db = await openDatabase(DB_PATH);

    const [concurrence_locale_api, risques_locaux_api, productionData, marcheData, macroFrance] = await Promise.all([
      fetchAgenceBio(nom_ville, segment_analyse, geo),
      fetchGeoRisques(geo),
      fetchProductionData(db, nom_region),
      fetchMarcheData(db),
      fetchMacroTrends()
    ]);

    const contexte_data = {
      meta: {
        ville_recherchee: nom_ville,
        segment_analyse,
        generated_at: new Date().toISOString()
      },
      geo,
      concurrence_locale_api,
      risques_locaux_api,
      production_locale_region_5ans: productionData.production_locale_region_5ans,
      production_nationale_5ans: productionData.production_nationale_5ans,
      tendance_ventes_pct_5ans: marcheData.tendance_ventes_pct_5ans,
      tendance_commerce_5ans: marcheData.tendance_commerce_5ans,
      macro_france: macroFrance
    };

    return contexte_data;
  } finally {
    if (db) {
      await closeDatabase(db);
    }
  }
}

async function fetchGeoData(nomVille) {
  try {
    const response = await httpClient.get(GEO_API_URL, {
      params: {
        nom: nomVille,
        fields: 'code,population,codeDepartement,codeRegion,region'
      }
    });

    const payload = Array.isArray(response.data) ? response.data : [];
    if (!payload.length) {
      throw new Error(`Aucune commune trouvee pour ${nomVille}`);
    }

    const commune = selectBestCommuneMatch(nomVille, payload);
    return {
      nom_commune: commune.nom || nomVille,
      code_commune: commune.code,
      population: commune.population ?? null,
      code_departement: commune.codeDepartement ?? null,
      code_region: commune.codeRegion ?? null,
      nom_region: commune.region?.nom || commune.region || null
    };
  } catch (error) {
    throw new Error(`Echec de l'appel a l'API Geo: ${error.message}`);
  }
}

async function fetchAgenceBio(nomVille, segmentAnalyse = '', geoInfo = {}) {
  const targetVille = geoInfo?.nom_commune || nomVille || '';
  const targetCodeCommune = geoInfo?.code_commune || null;
  const normalizedSegment = (segmentAnalyse || '').toLowerCase();

  const localOperators = getLocalOperatorsFromDataset(targetVille, normalizedSegment);
  return buildConcurrencePayload(localOperators, normalizedSegment);
}

async function fetchGeoRisques(geoInfo) {
  const codeCommune = geoInfo.code_commune;
  const codeDepartement = geoInfo.code_departement;

  const entries = Object.entries(GEORISQUES_ENDPOINTS);
  const requests = entries.map(([, url]) =>
    httpClient.get(url, { params: { code_insee: codeCommune } })
  );

  const results = await Promise.allSettled(requests);

  const payload = results.reduce((acc, result, index) => {
    const key = entries[index][0];
    if (result.status === 'fulfilled') {
      const data = result.value.data;
      const items = extractArray(data);
      acc[key] = {
        total: typeof data?.total === 'number' ? data.total : items.length,
        items,
        source: 'georisques_api'
      };
    } else {
      console.warn(
        `Avertissement GeoRisques (${key}) pour ${codeCommune}: ${result.reason?.message || 'erreur inconnue'}`
      );
      acc[key] = {
        total: 0,
        items: [],
        error: normalizeGeoRiskError(result.reason),
        source: 'georisques_api'
      };
    }
    return acc;
  }, {});

  const fallback = lookupDepartementFallback(codeDepartement);

  if (fallback) {
    if ((!payload.basol || payload.basol.total === 0) && fallback.risque_pollution_basol) {
      payload.basol = {
        total: fallback.basol_total ?? 0,
        items: [],
        niveau_risque: fallback.risque_pollution_basol,
        source: 'donnees_bio_json'
      };
    }
    if ((!payload.azi || payload.azi.total === 0) && fallback.risque_inondation_azi) {
      payload.azi = {
        total: fallback.azi_total ?? 0,
        items: [],
        niveau_risque: fallback.risque_inondation_azi,
        source: 'donnees_bio_json'
      };
    }
    if ((!payload.catnat || payload.catnat.total === 0) && fallback.hist_catnat) {
      payload.catnat = {
        total:
          (fallback.hist_catnat.secheresse || 0) +
          (fallback.hist_catnat.inondation || 0),
        items: [],
        resume: fallback.hist_catnat,
        source: 'donnees_bio_json'
      };
    }
  }

  return {
    code_commune: codeCommune,
    basol: payload.basol || { total: 0, items: [] },
    azi: payload.azi || { total: 0, items: [] },
    catnat: payload.catnat || { total: 0, items: [] }
  };
}

async function fetchProductionData(db, nomRegion) {
  const sql = `
    SELECT annee,
           SUM(CAST(surface_totale_ha AS REAL)) AS surface_totale_ha,
           SUM(nb_fermes) AS nb_fermes
    FROM production_db
    WHERE territoire LIKE ? COLLATE NOCASE
    GROUP BY annee
    ORDER BY annee DESC
    LIMIT 5
  `;

  const regionRows = await runQuery(db, sql, [nomRegion || '%']);
  const nationalRows = await runQuery(db, sql, ['National']);

  return {
    production_locale_region_5ans: formatProductionRows(regionRows),
    production_nationale_5ans: formatProductionRows(nationalRows)
  };
}

async function fetchMarcheData(db) {
  const ventesRows = await runQuery(
    db,
    'SELECT circuit, annee, taux_evolution_pct FROM ventes_db'
  );
  const commerceRows = await runQuery(
    db,
    'SELECT famille_produit, flux_type, origine_dest, annee, valeur_M_eur FROM commerce_db'
  );

  return {
    tendance_ventes_pct_5ans: summarizeVentes(ventesRows),
    tendance_commerce_5ans: summarizeCommerce(commerceRows)
  };
}

function summarizeVentes(rows) {
  const cleaned = rows
    .map(row => ({
      circuit: row.circuit,
      annee: normalizeYear(row.annee),
      taux: Number(row.taux_evolution_pct)
    }))
    .filter(item => item.annee && Number.isFinite(item.taux));

  if (!cleaned.length) {
    return { periode: null, resume: 'Pas de donnees ventes' };
  }

  const years = Array.from(new Set(cleaned.map(item => item.annee)))
    .sort((a, b) => b - a)
    .slice(0, 5)
    .sort((a, b) => a - b);

  const details = years.map(year => {
    const yearRows = cleaned.filter(item => item.annee === year);
    return {
      annee: year,
      evolution_pct_moyenne: round(average(yearRows.map(item => item.taux)) * 100, 2)
    };
  });

  const evolution_moyenne_pct = round(
    average(details.map(item => item.evolution_pct_moyenne)),
    2
  );

  return {
    periode: { debut: years[0], fin: years[years.length - 1] },
    evolution_moyenne_pct,
    details
  };
}

function summarizeCommerce(rows) {
  const cleaned = rows
    .map(row => ({
      flux_type: row.flux_type,
      origine_dest: row.origine_dest,
      annee: normalizeYear(row.annee),
      valeur_M_eur: Number(row.valeur_M_eur)
    }))
    .filter(item => item.annee && Number.isFinite(item.valeur_M_eur));

  if (!cleaned.length) {
    return {
      periode: null,
      resume: 'Donnees commerce indisponibles pour les 5 dernieres annees'
    };
  }

  const years = Array.from(new Set(cleaned.map(item => item.annee)))
    .sort((a, b) => b - a)
    .slice(0, 5)
    .sort((a, b) => a - b);

  const aggregates = years.map(year => {
    const yearRows = cleaned.filter(item => item.annee === year);
    const total = yearRows.reduce((sum, item) => sum + item.valeur_M_eur, 0);
    return { annee: year, total_valeur_M_eur: round(total, 2) };
  });

  return {
    periode: { debut: years[0], fin: years[years.length - 1] },
    details: aggregates
  };
}

function formatProductionRows(rows) {
  return rows
    .map(row => ({
      annee: row.annee,
      surface_totale_ha: round(Number(row.surface_totale_ha) || 0, 2),
      nb_fermes: Number(row.nb_fermes) || 0
    }))
    .sort((a, b) => a.annee - b.annee);
}

function normalizeYear(value) {
  if (value == null) return null;
  const asString = String(value);
  const match = asString.match(/\d{4}/);
  if (match) {
    return Number(match[0]);
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 1900 ? Math.round(numeric) : null;
}

function normalizeAgenceBioEntry(entry = {}, fallbackVille = null) {
  const activites = toArray(
    entry.activites ||
      entry.activities ||
      entry.activite ||
      entry.activite_principale ||
      entry.secteur ||
      entry.libelleActivites ||
      entry.libelle_activite
  );
  const categories = toArray(
    entry.categories ||
      entry.categorie ||
      entry.type ||
      entry.type_activite ||
      entry.famille ||
      entry.libelleCategorieActivite
  );

  const ville =
    firstNonEmpty([
      entry.commune,
      entry.ville,
      entry.adresse?.commune,
      entry.adresse?.ville,
      entry.adresse?.libelle_commune,
      entry.localisation?.commune,
      entry.commune_etablissement
    ]) ||
    fallbackVille ||
    null;

  const labelSources = [
    entry.labels,
    entry.label,
    entry.certifications,
    entry.mentions,
    entry.labelAB,
    entry.labelBio
  ].filter(Boolean);
  const labels = uniqueStrings([
    ...toArray(labelSources),
    ...collectValuesByKeyPattern(entry, /(label|certif|mention)/i)
  ]);

  const siteCandidates = [
    entry.site,
    entry.site_web,
    entry.siteWeb,
    entry.url,
    entry.url_site,
    entry.urlSite,
    entry.siteInternet,
    entry.site_internet,
    entry.siteinternet,
    entry.website,
    entry.web,
    entry.lien,
    entry.page_facebook,
    entry.pageFacebook,
    entry.facebook,
    entry.instagram,
    entry.linkedin
  ];

  const siteUrl = firstNonEmpty(siteCandidates) || findFirstUrl(entry);

  return {
    id: entry.id || entry.numero || entry.siret || null,
    nom:
      stringifyValue(entry.nom) ||
      stringifyValue(entry.raison_sociale) ||
      stringifyValue(entry.raisonSociale) ||
      'Inconnu',
    activite: activites[0] || categories[0] || 'Non renseigne',
    categorie: categories[0] || activites[0] || 'Non renseigne',
    ville,
    labels,
    activites,
    categories,
    site: siteUrl || null
  };
}

function matchesSegment(operator, normalizedSegment) {
  if (!normalizedSegment) return true;
  const haystack = [
    operator.activite,
    operator.categorie,
    operator.nom,
    operator.ville,
    ...(operator.segments || [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const tokens = normalizedSegment
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 4);

  if (!tokens.length) {
    return haystack.includes(normalizedSegment);
  }

  return tokens.some(token => haystack.includes(token));
}

function extractArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function toArray(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .map(item => stringifyValue(item))
    .flatMap(str => str.split(/[;,]/))
    .map(str => str.trim())
    .filter(Boolean);
}

function stringifyValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map(item => stringifyValue(item)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    const preferredKeys = [
      'libelle',
      'libelleLong',
      'nom',
      'intitule',
      'label',
      'description',
      'value',
      'texte'
    ];
    for (const key of preferredKeys) {
      if (value[key]) {
        return stringifyValue(value[key]);
      }
    }
    return Object.values(value)
      .map(item => stringifyValue(item))
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

function firstNonEmpty(values) {
  for (const value of values) {
    const str = stringifyValue(value).trim();
    if (str) return str;
  }
  return '';
}

function collectValuesByKeyPattern(node, pattern, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    node.forEach(item => collectValuesByKeyPattern(item, pattern, acc));
    return acc;
  }
  if (typeof node === 'object') {
    Object.entries(node).forEach(([key, value]) => {
      if (pattern.test(key)) {
        const str = stringifyValue(value).trim();
        if (str) acc.push(str);
      }
      collectValuesByKeyPattern(value, pattern, acc);
    });
  }
  return acc;
}

function findFirstUrl(node) {
  if (!node) return '';
  const checkString = str => {
    if (!str) return '';
    const match = str.match(/https?:\/\/[^\s'"<>]+/i);
    return match ? match[0] : '';
  };

  if (typeof node === 'string') {
    return checkString(node);
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirstUrl(item);
      if (found) return found;
    }
    return '';
  }

  if (typeof node === 'object') {
    for (const value of Object.values(node)) {
      const found = findFirstUrl(value);
      if (found) return found;
    }
  }

  return '';
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function roughMatchVille(entry, targetVille) {
  if (!targetVille) return false;
  const target = normalizeText(targetVille);
  if (!target) return false;
  const candidates = extractValuesByPattern(entry, /(ville|commune|localite|adresse)/i);
  return candidates.some(candidate => cityMatchesTarget(candidate, target));
}

function matchesVilleCandidate(entry, targetVille) {
  const normalizedTarget = normalizeText(targetVille);
  if (!normalizedTarget) return false;
  const candidates = extractValuesByPattern(entry, /(ville|commune|localite)/i);
  return candidates.some(candidate => cityMatchesTarget(candidate, normalizedTarget));
}

function matchesCommuneCode(entry, targetCode) {
  if (!targetCode) return false;
  const normalizedTarget = targetCode.toString();
  const candidates = extractValuesByPattern(entry, /(code[_-]?insee|code[_-]?commune|insee)/i);
  return candidates.some(candidate => candidate.replace(/\s/g, '') === normalizedTarget);
}

function matchesDepartement(entry, targetDepartement) {
  if (!targetDepartement) return false;
  const normalizedTarget = targetDepartement.toString().padStart(2, '0');
  const candidates = extractValuesByPattern(entry, /(departement|code[_-]?dep|depcode|depart)/i);
  return candidates.some(candidate =>
    candidate.replace(/\D/g, '').padStart(2, '0').endsWith(normalizedTarget)
  );
}

function extractValuesByPattern(entry, pattern) {
  return uniqueStrings(collectValuesByKeyPattern(entry, pattern));
}

function normalizeText(value) {
  const str = stringifyValue(value);
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function cityMatchesTarget(candidate, normalizedTarget) {
  if (!candidate || !normalizedTarget) return false;
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedCandidate) return false;
  if (normalizedCandidate === normalizedTarget) return true;

  const delimiter = /[\s'’\-_,]/;
  const candidateTokens = normalizedCandidate.split(delimiter).filter(Boolean);
  const targetTokens = normalizedTarget.split(delimiter).filter(Boolean);

  if (candidateTokens.includes(normalizedTarget)) return true;
  if (targetTokens.includes(normalizedCandidate)) return true;

  // Allow matches like "paris 15" where first token equals target
  if (candidateTokens.length > 1 && candidateTokens[0] === normalizedTarget) return true;
  if (targetTokens.length > 1 && targetTokens[0] === normalizedCandidate) return true;

  return false;
}

function getLocalOperatorsFromDataset(targetVille, normalizedSegment = '') {
  if (!operateursLocauxData || !targetVille) return [];
  const normalizedCity = normalizeText(targetVille);
  if (!normalizedCity) return [];

  const datasetEntry =
    operateursLocauxData[normalizedCity] ||
    operateursLocauxData[normalizedCity.replace(/\s+/g, '')] ||
    operateursLocauxData[targetVille.toLowerCase()];

  if (!Array.isArray(datasetEntry) || !datasetEntry.length) {
    return [];
  }

  const formatted = datasetEntry.map(formatLocalOperatorEntry);
  if (!normalizedSegment) return formatted;

  const filtered = formatted.filter(op =>
    (op.segments || []).some(seg => seg.toLowerCase().includes(normalizedSegment)) ||
    (op.activite || '').toLowerCase().includes(normalizedSegment)
  );

  return filtered.length ? filtered : formatted;
}

function formatLocalOperatorEntry(entry = {}) {
  const activites = entry.activites || entry.segments || (entry.activite ? [entry.activite] : []);
  const categories = entry.categories || (entry.categorie ? [entry.categorie] : []);
  return {
    id: entry.id || entry.nom,
    nom: entry.nom || 'Operateur local',
    activite: entry.activite || activites[0] || 'Non renseigne',
    categorie: entry.categorie || categories[0] || 'Non renseigne',
    ville: entry.ville || '',
    labels: entry.labels || [],
    activites: activites,
    categories: categories,
    segments: entry.segments || activites,
    site: entry.site || null,
    quartier: entry.quartier || null,
    code_postal: entry.code_postal || null,
    adresse: entry.adresse || null,
    contact: entry.contact || null,
    date_mise_a_jour: entry.date_mise_a_jour || null
  };
}

function buildConcurrencePayload(operators, normalizedSegment) {
  const concurrents = normalizedSegment
    ? operators.filter(op => matchesSegment(op, normalizedSegment))
    : operators;

  const ventilationActivites = operators.reduce((acc, op) => {
    const key = op.activite || 'Non renseigne';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    nb_operateurs_bio_total: operators.length,
    nb_concurrents_directs: concurrents.length,
    concurrents_directs: concurrents.slice(0, 25),
    ventilation_activites: ventilationActivites,
    detail_operateurs: operators
  };
}

async function fetchMacroTrends() {
  try {
    const entries = await Promise.all(
      Object.entries(WORLD_BANK_INDICATORS).map(async ([key, indicator]) => {
        const series = await fetchWorldBankSeries(indicator);
        return [key, series];
      })
    );
    return entries.reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  } catch (error) {
    console.warn('Impossible de récupérer les indicateurs World Bank:', error.message);
    return {};
  }
}

async function fetchWorldBankSeries(indicator) {
  const url = `https://api.worldbank.org/v2/country/${WORLD_BANK_COUNTRY}/indicator/${indicator}?format=json&per_page=8`;
  const response = await axios.get(url, { timeout: 15000 });
  const [, data] = response.data || [];
  if (!Array.isArray(data)) return [];
  return data
    .filter(entry => entry.value != null)
    .slice(0, 6)
    .map(entry => ({
      annee: Number(entry.date),
      valeur: Number(entry.value)
    }))
    .sort((a, b) => a.annee - b.annee);
}

function lookupDepartementFallback(codeDepartement) {
  if (!donneesBio || !codeDepartement) return null;
  const formattedCode = String(codeDepartement).padStart(2, '0');
  const departements = donneesBio.departements || {};
  const key =
    Object.keys(departements).find(k => k.startsWith(`${formattedCode} `)) ||
    Object.keys(departements).find(k => k.startsWith(`${formattedCode}-`));

  if (!key) return null;
  const data = departements[key];
  return {
    risque_pollution_basol: data.risque_pollution_basol || null,
    risque_inondation_azi: data.risque_inondation_azi || null,
    hist_catnat: {
      secheresse: data.hist_secheresse_catnat || 0,
      inondation: data.hist_inondation_catnat || 0
    },
    basol_total: data.nb_sites_basol || null,
    azi_total: data.nb_zones_azi || null
  };
}

function selectBestCommuneMatch(nomVille, communes) {
  if (!communes?.length) {
    return null;
  }

  const target = normalizeText(nomVille);
  if (!target) {
    return communes[0];
  }

  const exact = communes.find(commune => normalizeText(commune.nom) === target);
  if (exact) return exact;

  const partials = communes.filter(commune =>
    normalizeText(commune.nom).includes(target)
  );
  if (partials.length) {
    return partials.sort((a, b) => (b.population || 0) - (a.population || 0))[0];
  }

  return communes.sort((a, b) => (b.population || 0) - (a.population || 0))[0];
}

function normalizeGeoRiskError(error) {
  if (!error) return 'erreur inconnue';
  if (error.response) {
    return `${error.response.status} ${error.response.statusText || 'reponse'}`;
  }
  return error.message || 'erreur inconnue';
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function openDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
      if (err) {
        reject(err);
      } else {
        resolve(db);
      }
    });
  });
}

function closeDatabase(db) {
  return new Promise((resolve, reject) => {
    db.close(err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  collectContexte
};
