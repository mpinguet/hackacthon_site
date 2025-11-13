const API_ANALYZE_URL = 'http://localhost:3000/api/analyze';

function decodeParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key) ? decodeURIComponent(params.get(key)) : '';
}

const secteur = decodeParam('secteur') || 'Alimentaire Bio';
const ville = decodeParam('ville') || decodeParam('region') || 'Paris';
const region = decodeParam('region') || '';
const objectif = decodeParam('objectif') || 'Analyse de marché générale';

let chartInstances = [];
let collapsibleInitialized = false;
let progressValue = 0;
let progressTimer = null;

init();

async function init() {
  startProgressLoop();
  try {
    const study = await fetchStudy();
    updateProgress(55, 'Analyse des données contextuelles...');
    renderMetadata(study);
    renderSummary(study);
    renderSignals(study);
    renderKpis(study);
    updateProgress(70, 'Génération des visualisations...');
    renderCharts(study.chartData, study.context);
    renderKeyPoints(study.keyPoints);
    renderActors(study);
    renderCompetitionDetails(study.context?.concurrence_locale_api);
    updateProgress(85, 'Synthèse des recommandations...');
    renderRecommendations(study.recommendations);
    renderContext(study.context);
    renderMacro(study.context?.macro_france);
    renderRiskTimeline(study.context?.risques_locaux_api);
    renderRaw(study);
    setupCollapsibles();
    finishProgress('Analyse terminée. Préparation du rapport...');
    setTimeout(hideStatusBanner, 600);
  } catch (error) {
    console.error('Erreur étude:', error);
    failProgress(error.message || "Impossible de récupérer l'étude");
    showStatusError(error.message || "Impossible de récupérer l'étude" );
  }
}

async function fetchStudy() {
  const response = await fetch(API_ANALYZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secteur, region, objectif, ville })
  });
  if (!response.ok) throw new Error(`API analyse: ${response.status}`);
  return response.json();
}

function hideStatusBanner() {
  const banner = document.getElementById('statusBanner');
  if (banner) banner.style.display = 'none';
  document.getElementById('metadata').style.display = 'block';
  document.getElementById('mainReport').style.display = 'block';
}

function showStatusError(message) {
  const banner = document.getElementById('statusBanner');
  if (!banner) return;
  banner.querySelector('.status-text h3').textContent = 'Erreur';
  banner.querySelector('.status-text p').textContent = message;
  banner.querySelector('.progress-bar').style.display = 'none';
  const icon = banner.querySelector('.status-icon i');
  if (icon) {
    icon.classList.remove('status-spinner');
    icon.className = 'ri-error-warning-line';
  }
}

function renderMetadata(study) {
  const secteurLabel = study?.metadata?.secteur || secteur;
  const villeLabel = study?.metadata?.ville || study?.context?.geo?.nom_commune || ville;
  const regionLabel = study?.metadata?.region || study?.context?.geo?.nom_region || region;
  setBadge('secteurBadge', `<i class="ri-archive-stack-line"></i><span>${secteurLabel}</span>`);
  setBadge('villeBadge', villeLabel ? `<i class="ri-building-4-line"></i><span>${villeLabel}</span>` : '');
  setBadge('regionBadge', regionLabel ? `<i class="ri-map-pin-2-line"></i><span>${regionLabel}</span>` : '');
  setText('dateGeneration', new Date().toLocaleString('fr-FR'));
  setText('objectifValue', objectif);
}

function renderSummary(study) {
  setText('summaryText', study.summary || 'Aucun résumé disponible.');
}

function renderSignals(study) {
  const board = document.getElementById('signalsBoard');
  if (!board) return;
  const signals = computeSignals(study);
  board.innerHTML = signals.map(signal => `
    <div class="signal-card signal-${signal.severity}">
      <div class="signal-dot"></div>
      <div class="signal-content">
        <div class="signal-label">${signal.label}</div>
        <div class="signal-message">${signal.message}</div>
      </div>
    </div>
  `).join('');
}

function computeSignals(study) {
  const signals = [];
  const kpis = study?.kpis || {};
  const croissance = parsePercent(kpis.croissance);
  if (croissance != null) {
    if (croissance < 1) {
      signals.push({ label: 'Croissance du marché', message: 'Tendance en régression, revoir le positionnement.', severity: 'bad' });
    } else if (croissance < 4) {
      signals.push({ label: 'Croissance du marché', message: 'Progression modérée, surveiller la dynamique.', severity: 'watch' });
    } else {
      signals.push({ label: 'Croissance du marché', message: 'Croissance soutenue, opportunité favorable.', severity: 'good' });
    }
  }

  const operateursTotal = study?.operateurs?.total ?? kpis.acteurs;
  if (typeof operateursTotal === 'number') {
    if (operateursTotal < 5) {
      signals.push({ label: 'Présence d’acteurs', message: 'Très peu d’opérateurs référencés, marché à structurer.', severity: 'bad' });
    } else if (operateursTotal < 15) {
      signals.push({ label: 'Présence d’acteurs', message: 'Réseau local à étoffer.', severity: 'watch' });
    } else {
      signals.push({ label: 'Présence d’acteurs', message: 'Écosystème local actif.', severity: 'good' });
    }
  }

  const potentiel = (kpis.potentiel || '').toLowerCase();
  if (potentiel) {
    if (potentiel.includes('très') || potentiel.includes('elev')) {
      signals.push({ label: 'Potentiel commercial', message: 'Potentiel élevé identifié.', severity: 'good' });
    } else if (potentiel.includes('mod')) {
      signals.push({ label: 'Potentiel commercial', message: 'Potentiel moyen, besoin d’innovations.', severity: 'watch' });
    } else {
      signals.push({ label: 'Potentiel commercial', message: 'Potentiel limité actuellement.', severity: 'bad' });
    }
  }

  const risks = study?.context?.risques_locaux_api || {};
  const catnatTotal = risks?.catnat?.total;
  if (typeof catnatTotal === 'number') {
    if (catnatTotal > 15) {
      signals.push({ label: 'Risques CATNAT', message: 'Historique d’événements élevé, vigilance réglementaire.', severity: 'bad' });
    } else if (catnatTotal > 5) {
      signals.push({ label: 'Risques CATNAT', message: 'Quelques aléas recensés, prévoir un plan de mitigation.', severity: 'watch' });
    } else {
      signals.push({ label: 'Risques CATNAT', message: 'Risque naturel limité.', severity: 'good' });
    }
  }

  const ventes = study?.context?.tendance_ventes_pct_5ans?.details || [];
  if (ventes.length >= 2) {
    const last = ventes[ventes.length - 1]?.evolution_pct_moyenne;
    if (typeof last === 'number') {
      if (last < 0) {
        signals.push({ label: 'Évolution des ventes', message: 'Dernière année en baisse, revoir l’offre.', severity: 'bad' });
      } else if (last < 3) {
        signals.push({ label: 'Évolution des ventes', message: 'Croissance fragile, intensifier l’acquisition.', severity: 'watch' });
      } else {
        signals.push({ label: 'Évolution des ventes', message: 'Croissance confirmée sur la période récente.', severity: 'good' });
      }
    }
  }

  return signals;
}

function renderKpis(study) {
  const kpis = study.kpis || {};
  setText('kpiMarche', kpis.marche);
  setText('kpiActeurs', kpis.acteurs);
  setText('kpiCroissance', kpis.croissance);
  setText('kpiPotentiel', kpis.potentiel);
  if (study.operateurs && typeof study.operateurs.total === 'number') {
    setText('kpiActeurs', study.operateurs.total);
  }
  if (kpis.trends) {
    updateKpiTrend('kpiTrendMarche', kpis.trends.marche);
    updateKpiTrend('kpiTrendActeurs', kpis.trends.acteurs);
    updateKpiTrend('kpiTrendCroissance', kpis.trends.croissance);
    updateKpiTrend('kpiTrendPotentiel', kpis.trends.potentiel);
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value != null ? value : '-';
}

function setBadge(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!value) {
    el.style.display = 'none';
    el.innerHTML = '';
  } else {
    el.style.display = 'inline-flex';
    el.innerHTML = value;
  }
}

function renderCharts(data, context) {
  chartInstances.forEach(instance => instance.destroy && instance.destroy());
  chartInstances = [];
  const activityDataset = computeActivityDataset(data, context);
  renderSimpleChart('pieChart', 'pie', activityDataset, { plugins: { legend: { position: 'bottom' } } });

  const demandeDataset = computeDemandDataset(data, context);
  renderComplexChart('lineChart', 'line', demandeDataset, { plugins: { legend: { position: 'bottom' } } });

  const segmentsDataset = computeSegmentDataset(data, context);
  renderSimpleChart('barChart', 'bar', segmentsDataset, { plugins: { legend: { display: false } } });

  const competitorDataset = computeCompetitorDataset(context);
  renderSimpleChart('doughnutChart', 'doughnut', competitorDataset, { plugins: { legend: { position: 'bottom' } } });

  const productionDataset = computeProductionDataset(context);
  renderComplexChart('productionChart', 'line', productionDataset, {
    plugins: { legend: { position: 'bottom' } },
    tension: 0.3
  });

  const commerceDataset = computeCommerceDataset(context);
  renderSimpleChart('commerceChart', 'bar', commerceDataset, { plugins: { legend: { position: 'bottom' } } });

  const macroDataset = computeMacroDataset(context);
  renderComplexChart('macroChart', 'line', macroDataset, {
    plugins: { legend: { position: 'bottom' } },
    tension: 0.3
  });
}

function renderSimpleChart(canvasId, type, dataset, options = {}) {
  const ctx = getChartContext(canvasId, dataset);
  if (!ctx) return;
  const colors = dataset.colors || buildColors(dataset.data.length);
  const chart = new Chart(ctx, {
    type,
    data: {
      labels: dataset.labels,
      datasets: [{
        label: dataset.label || undefined,
        data: dataset.data,
        backgroundColor: colors,
        borderColor: colors,
        tension: options.tension || 0.4,
        fill: options.fill || false
      }]
    },
    options: {
      responsive: true,
      plugins: options.plugins || {}
    }
  });
  chartInstances.push(chart);
}

function renderComplexChart(canvasId, type, dataset, options = {}) {
  const ctx = getChartContext(canvasId, dataset);
  if (!ctx) return;
  const chart = new Chart(ctx, {
    type,
    data: {
      labels: dataset.labels,
      datasets: dataset.datasets
    },
    options: {
      responsive: true,
      plugins: options.plugins || {},
      interaction: { intersect: false },
      scales: type === 'bar' ? undefined : {
        y: { beginAtZero: false }
      }
    }
  });
  chartInstances.push(chart);
}

function getChartContext(canvasId, dataset) {
  const canvas = document.getElementById(canvasId);
  const card = canvas ? canvas.closest('.chart-card') : null;
  if (!canvas || !card) return null;
  const hasData = dataset && Array.isArray(dataset.labels) && dataset.labels.length && (
    (dataset.data && dataset.data.length) ||
    (dataset.datasets && dataset.datasets.some(ds => ds.data && ds.data.length && ds.data.some(val => val != null)))
  );
  if (!hasData) {
    card.style.display = 'none';
    return null;
  }
  card.style.display = '';
  return canvas.getContext('2d');
}

function buildColors(count) {
  const palette = ['#7cb342','#aed581','#2d5016','#9ccc65','#c5e1a5','#dcedc8','#4caf50','#689f38','#558b2f','#8bc34a'];
  return Array.from({ length: count }, (_, idx) => palette[idx % palette.length]);
}

function computeActivityDataset(chartData, context) {
  if (Array.isArray(chartData?.marketShare) && chartData.marketShare.length) {
    return {
      labels: chartData.marketShareLabels || [],
      data: chartData.marketShare
    };
  }
  const ventilation = context?.concurrence_locale_api?.ventilation_activites;
  if (ventilation && Object.keys(ventilation).length) {
    const labels = Object.keys(ventilation);
    const data = labels.map(label => ventilation[label]);
    return { labels, data };
  }
  return null;
}

function computeDemandDataset(chartData, context) {
  if (Array.isArray(chartData?.evolution) && chartData.evolution.length) {
    return {
      labels: chartData.evolutionLabels || [],
      datasets: [{
        label: 'Demande (%)',
        data: chartData.evolution,
        borderColor: '#7cb342',
        backgroundColor: 'rgba(124,179,66,0.15)',
        fill: true,
        tension: 0.4
      }]
    };
  }
  const details = context?.tendance_ventes_pct_5ans?.details;
  if (Array.isArray(details) && details.length) {
    const labels = details.map(item => item.annee);
    const data = details.map(item => Number(item.evolution_pct_moyenne) || 0);
    return {
      labels,
      datasets: [{
        label: 'Demande (%)',
        data,
        borderColor: '#7cb342',
        backgroundColor: 'rgba(124,179,66,0.15)',
        fill: true,
        tension: 0.4
      }]
    };
  }
  return null;
}

function computeSegmentDataset(chartData, context) {
  if (Array.isArray(chartData?.segments) && chartData.segments.length) {
    return {
      labels: chartData.segmentsLabels || [],
      data: chartData.segments
    };
  }
  const detail = context?.concurrence_locale_api?.detail_operateurs;
  if (Array.isArray(detail) && detail.length) {
    const counts = detail.reduce((acc, op) => {
      const key = op.categorie || op.activite || 'Autre';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const labels = Object.keys(counts).slice(0, 8);
    const data = labels.map(label => counts[label]);
    return { labels, data };
  }
  return null;
}

function computeCompetitorDataset(context) {
  const ventilation = context?.concurrence_locale_api?.ventilation_activites;
  if (ventilation && Object.keys(ventilation).length) {
    const labels = Object.keys(ventilation);
    const data = labels.map(label => ventilation[label]);
    return { labels, data };
  }
  const detail = context?.concurrence_locale_api?.detail_operateurs;
  if (Array.isArray(detail) && detail.length) {
    const top = detail.slice(0, 6);
    return {
      labels: top.map(op => op.nom || 'Opérateur'),
      data: top.map(() => 1)
    };
  }
  return null;
}

function computeProductionDataset(context) {
  const region = context?.production_locale_region_5ans || [];
  const national = context?.production_nationale_5ans || [];
  if (!region.length && !national.length) return null;
  const years = Array.from(new Set([...region, ...national].map(item => item.annee))).sort((a, b) => a - b);
  const regionData = years.map(year => (region.find(item => item.annee === year)?.surface_totale_ha) || null);
  const nationalData = years.map(year => (national.find(item => item.annee === year)?.surface_totale_ha) || null);
  if (!regionData.some(Boolean) && !nationalData.some(Boolean)) return null;
  return {
    labels: years,
    datasets: [
      {
        label: 'Région (ha)',
        data: regionData,
        borderColor: '#7cb342',
        backgroundColor: 'rgba(124,179,66,0.15)',
        fill: false,
        tension: 0.3
      },
      {
        label: 'France (ha)',
        data: nationalData,
        borderColor: '#2d5016',
        backgroundColor: 'rgba(45,80,22,0.15)',
        fill: false,
        tension: 0.3
      }
    ]
  };
}

function computeCommerceDataset(context) {
  const details = context?.tendance_commerce_5ans?.details;
  if (!Array.isArray(details) || !details.length) return null;
  const labels = details.map(item => item.annee);
  const data = details.map(item => Number(item.total_valeur_M_eur) || 0);
  if (!data.some(val => val)) return null;
  return {
    labels,
    data,
    label: 'Commerce (M€)'
  };
}

function computeMacroDataset(context) {
  const macro = context?.macro_france;
  if (!macro) return null;
  const seriesKeys = Object.keys(macro);
  if (!seriesKeys.length) return null;
  const years = Array.from(new Set(seriesKeys.flatMap(key => (macro[key] || []).map(item => item.annee)))).sort((a, b) => a - b);
  if (!years.length) return null;
  const datasets = [];
  if (macro.population?.length) {
    datasets.push({
      label: 'Population (M)',
      data: years.map(year => {
        const value = macro.population.find(item => item.annee === year)?.valeur;
        return value != null ? Number(value) / 1_000_000 : null;
      }),
      borderColor: '#2d5016',
      backgroundColor: 'rgba(45,80,22,0.1)',
      fill: false,
      tension: 0.3
    });
  }
  if (macro.gdp_growth?.length) {
    datasets.push({
      label: 'Croissance PIB (%)',
      data: years.map(year => macro.gdp_growth.find(item => item.annee === year)?.valeur ?? null),
      borderColor: '#7cb342',
      backgroundColor: 'rgba(124,179,66,0.1)',
      fill: false,
      tension: 0.3
    });
  }
  if (macro.agri_land_pct?.length) {
    datasets.push({
      label: 'Surface agricole (%)',
      data: years.map(year => macro.agri_land_pct.find(item => item.annee === year)?.valeur ?? null),
      borderColor: '#aed581',
      backgroundColor: 'rgba(174,213,129,0.15)',
      fill: false,
      tension: 0.3
    });
  }
  if (!datasets.length) return null;
  return { labels: years, datasets };
}

function renderKeyPoints(points) {
  const list = document.getElementById('pointsList');
  if (!list) return;
  list.innerHTML = '';
  const pointIcons = [
    'ri-line-chart-line',
    'ri-bar-chart-grouped-line',
    'ri-shopping-bag-3-line',
    'ri-price-tag-3-line',
    'ri-seedling-line',
    'ri-settings-3-line'
  ];
  (points || []).forEach((text, idx) => {
    const div = document.createElement('div');
    div.className = 'point-item';
    const icon = pointIcons[idx % pointIcons.length];
    div.innerHTML = `<div class="point-icon"><i class="${icon}"></i></div><div class="point-text">${text}</div>`;
    list.appendChild(div);
  });
}

function renderActors(study) {
  const grid = document.getElementById('actorsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const actors = Array.isArray(study.actors) && study.actors.length ? study.actors : (study.operateurs?.list || []);
  const actorIcons = [
    'ri-store-2-line',
    'ri-building-2-line',
    'ri-archive-stack-line',
    'ri-truck-line',
    'ri-restaurant-2-line',
    'ri-leaf-line'
  ];
  (actors || []).forEach((actor, idx) => {
    const div = document.createElement('div');
    div.className = 'actor-card';
    const siteLink = actor.site ? `<a href="${actor.site}" target="_blank" rel="noopener">Site</a>` : '-';
    const icon = actorIcons[idx % actorIcons.length];
    div.innerHTML = `
      <div class="actor-header">
        <div class="actor-logo"><i class="${icon}"></i></div>
        <div>
          <div class="actor-name">${actor.name || actor.nom || '-'}</div>
          <div class="actor-type">${actor.type || actor.categorie || actor.activite || '-'}</div>
        </div>
      </div>
      <div class="actor-info">
        <div class="actor-stat"><span>Position:</span><strong>${actor.market || '-'}</strong></div>
        <div class="actor-stat"><span>Ressource:</span><strong>${actor.growth || siteLink}</strong></div>
      </div>`;
    grid.appendChild(div);
  });
}

function renderCompetitionDetails(concurrence) {
  const summaryHost = document.getElementById('competitionSummary');
  const splitHost = document.getElementById('activitySplit');
  const table = document.getElementById('competitorsTable');
  if (!summaryHost || !splitHost || !table) return;
  if (!concurrence) {
    summaryHost.innerHTML = '<p>Données concurrence indisponibles.</p>';
    splitHost.innerHTML = '';
    table.innerHTML = '';
    return;
  }

  summaryHost.innerHTML = `
    <div class="summary-card">
      <div class="summary-label">Opérateurs référencés</div>
      <div class="summary-value">${concurrence.nb_operateurs_bio_total ?? '-'}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Concurrents directs</div>
      <div class="summary-value">${concurrence.nb_concurrents_directs ?? '-'}</div>
    </div>
  `;

  const ventilation = concurrence.ventilation_activites || {};
  const total = Object.values(ventilation).reduce((sum, val) => sum + (Number(val) || 0), 0);
  if (total) {
    splitHost.innerHTML = Object.entries(ventilation)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => {
        const pct = total ? ((value / total) * 100).toFixed(1) : '-';
        return `
          <div class="split-item">
            <div class="split-label">${label}</div>
            <div class="split-bar">
              <div class="split-fill" style="width:${pct}%;"></div>
            </div>
            <div class="split-value">${value} opérateurs • ${pct}%</div>
          </div>
        `;
      })
      .join('');
  } else {
    splitHost.innerHTML = '<p>Aucune ventilation disponible.</p>';
  }

  const competitors = concurrence.concurrents_directs || [];
  if (!competitors.length) {
    table.innerHTML = '<tbody><tr><td>Aucun concurrent direct identifié.</td></tr></tbody>';
  } else {
    const headers = ['Nom', 'Activité', 'Catégorie', 'Ville', 'Labels'];
    const rows = competitors.map(comp => [
      comp.nom || '-',
      comp.activite || '-',
      comp.categorie || '-',
      comp.ville || '-',
      (comp.labels || []).slice(0, 2).join(' • ') || '-'
    ]);
    table.innerHTML = `
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
      </tbody>
    `;
  }
}

function renderRecommendations(list) {
  const cont = document.getElementById('recosList');
  if (!cont) return;
  cont.innerHTML = '';
  (list || []).forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'reco-item';
    div.innerHTML = `
      <div class="reco-number">${idx + 1}</div>
      <div class="reco-content">
        <div class="reco-title">${item.title || '-'}</div>
        <div class="reco-desc">${item.desc || ''}</div>
      </div>`;
    cont.appendChild(div);
  });
}

function renderContext(context) {
  if (!context) return;
  const geoHost = document.getElementById('contextGeo');
  if (geoHost) {
    geoHost.innerHTML = '';
    const geo = context.geo || {};
    addContextCard(geoHost, 'Ville', geo.nom_commune || ville);
    addContextCard(geoHost, 'Région', geo.nom_region || region || '-');
    addContextCard(geoHost, 'Population', geo.population ? Intl.NumberFormat('fr-FR').format(geo.population) : '-');
    addContextCard(geoHost, 'Code INSEE', geo.code_commune || '-');
  }
  const riskHost = document.getElementById('contextRisks');
  if (riskHost) {
    riskHost.innerHTML = '';
    const risks = context.risques_locaux_api || {};
    [['BASOL','basol'],['AZI','azi'],['CATNAT','catnat']].forEach(([label,key]) => {
      const bloc = risks[key] || {};
      const total = typeof bloc.total === 'number' ? bloc.total : (Array.isArray(bloc.items) ? bloc.items.length : 0);
      addContextCard(riskHost, label, total);
    });
  }
  buildTable('prodRegionTable', ['Année','Surface (ha)','Fermes'], (context.production_locale_region_5ans || []).map(item => [item.annee || '-', formatNumber(item.surface_totale_ha), formatNumber(item.nb_fermes)]));
  buildTable('prodNationalTable', ['Année','Surface (ha)','Fermes'], (context.production_nationale_5ans || []).map(item => [item.annee || '-', formatNumber(item.surface_totale_ha), formatNumber(item.nb_fermes)]));
  buildTable('ventesTable', ['Année','Évolution (%)'], (context.tendance_ventes_pct_5ans?.details || []).map(item => [item.annee || '-', formatPercent(item.evolution_pct_moyenne)]));
  buildTable('commerceTable', ['Année','Valeur (M€)'], (context.tendance_commerce_5ans?.details || []).map(item => [item.annee || '-', formatNumber(item.total_valeur_M_eur)]));
}

function renderMacro(macro) {
  const cardsHost = document.getElementById('macroCards');
  const table = document.getElementById('macroTable');
  if (!cardsHost || !table) return;
  if (!macro || !Object.keys(macro).length) {
    cardsHost.innerHTML = '<p>Données nationales indisponibles.</p>';
    table.innerHTML = '';
    return;
  }

  const cardConfigs = [
    { key: 'population', label: 'Population France', suffix: 'hab.' },
    { key: 'gdp_growth', label: 'Croissance PIB', suffix: '%' },
    { key: 'agri_land_pct', label: 'Surface agricole (% du territoire)', suffix: '%' }
  ];

  cardsHost.innerHTML = cardConfigs.map(cfg => {
    const latest = (macro[cfg.key] || []).slice(-1)[0];
    const previous = (macro[cfg.key] || []).slice(-2)[0];
    const delta = latest && previous ? latest.valeur - previous.valeur : null;
    const deltaText =
      delta == null
        ? '-'
        : `${delta > 0 ? '+' : ''}${delta.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}${cfg.suffix}`;
    return `
      <div class="summary-card">
        <div class="summary-label">${cfg.label}</div>
        <div class="summary-value">${latest ? latest.valeur.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '-'}</div>
        <div class="summary-delta">${latest ? `Variation ${latest.annee}: ${deltaText}` : ''}</div>
      </div>
    `;
  }).join('');

  const yearsSet = new Set();
  Object.values(macro).forEach(series => {
    (series || []).forEach(point => yearsSet.add(point.annee));
  });
  const years = Array.from(yearsSet).sort((a, b) => b - a);

  const headers = ['Année', 'Population', 'Croissance PIB (%)', 'Surface agricole (%)'];
  const rows = years.map(year => {
    const pop = (macro.population || []).find(item => item.annee === year)?.valeur;
    const gdp = (macro.gdp_growth || []).find(item => item.annee === year)?.valeur;
    const agri = (macro.agri_land_pct || []).find(item => item.annee === year)?.valeur;
    return [
      year,
      pop != null ? pop.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : '-',
      gdp != null ? gdp.toFixed(2) : '-',
      agri != null ? agri.toFixed(2) : '-'
    ];
  });

  if (!rows.length) {
    table.innerHTML = '<tbody><tr><td>Données macro indisponibles.</td></tr></tbody>';
    return;
  }

  table.innerHTML = `
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
    </tbody>
  `;
}

function addContextCard(host, label, value) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<div class="context-label">${label}</div><div class="context-value">${value}</div>`;
  host.appendChild(card);
}

function buildTable(tableId, headers, rows) {
  const table = document.getElementById(tableId);
  if (!table) return;
  if (!Array.isArray(rows) || !rows.length) {
    table.innerHTML = '<tbody><tr><td colspan="'+headers.length+'">Donnée indisponible</td></tr></tbody>';
    return;
  }
  const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
  const tbodyRows = rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('');
  table.innerHTML = thead + '<tbody>' + tbodyRows + '</tbody>';
}

function renderRaw(payload) {
  const rawEl = document.getElementById('rawData');
  if (rawEl) rawEl.textContent = JSON.stringify(payload, null, 2);
}

function startProgressLoop() {
  updateProgress(10, 'Connexion aux sources de données...');
  progressTimer = setInterval(() => {
    if (progressValue < 60) {
      updateProgress(progressValue + Math.random() * 4, 'Collecte en cours...');
    }
  }, 1000);
}

function updateProgress(value, message) {
  progressValue = Math.min(100, Math.max(progressValue, value));
  const fill = document.querySelector('.progress-fill');
  if (fill) fill.style.width = `${progressValue}%`;
  if (message) {
    const desc = document.querySelector('#statusBanner .status-text p');
    if (desc) desc.textContent = message;
  }
}

function finishProgress(message) {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  updateProgress(100, message || 'Analyse finalisée.');
}

function failProgress(message) {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  updateProgress(100, message);
}

function renderRiskTimeline(risques) {
  const host = document.getElementById('riskTimeline');
  if (!host) return;
  if (!risques || !risques.catnat) {
    host.innerHTML = '<p>Données risques indisponibles.</p>';
    return;
  }
  const events = risques.catnat.items || risques.catnat.derniers_evenements || [];
  if (!events.length) {
    host.innerHTML = '<p>Aucun événement majeur recensé.</p>';
    return;
  }
  host.innerHTML = events.slice(0, 8).map(evt => `
    <div class="timeline-entry">
      <div class="timeline-node"></div>
      <div class="timeline-content">
        <div class="timeline-title">${evt.libelle_risque_jo || evt.risque || 'Événement'}</div>
        <div class="timeline-date">${evt.date_debut_evt || evt.debut || '-'} → ${evt.date_fin_evt || evt.fin || '-'}</div>
        <div class="timeline-meta">${evt.libelle_commune || risques.code_commune || ''}</div>
      </div>
    </div>
  `).join('');
}

function setupCollapsibles() {
  const sections = document.querySelectorAll('.report-section.collapsible');
  sections.forEach(section => {
    const toggle = section.querySelector('.collapse-toggle');
    const content = section.querySelector('.section-content');
    if (!toggle || !content) return;
    toggle.addEventListener('click', () => {
      section.classList.toggle('collapsed');
      if (section.classList.contains('collapsed')) {
        content.style.maxHeight = '0px';
        toggle.innerHTML = '<i class="ri-arrow-down-s-line"></i>';
      } else {
        content.style.maxHeight = content.scrollHeight + 'px';
        toggle.innerHTML = '<i class="ri-arrow-up-s-line"></i>';
      }
    });
    content.style.maxHeight = content.scrollHeight + 'px';
  });
  if (!collapsibleInitialized) {
    window.addEventListener('resize', adjustCollapsibleHeights);
    collapsibleInitialized = true;
  }
}

function adjustCollapsibleHeights() {
  document.querySelectorAll('.report-section.collapsible').forEach(section => {
    if (section.classList.contains('collapsed')) return;
    const content = section.querySelector('.section-content');
    if (content) {
      content.style.maxHeight = content.scrollHeight + 'px';
    }
  });
}

function formatNumber(value) {
  if (value == null || value === '') return '-';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(numeric);
}

function formatPercent(value) {
  if (value == null || value === '') return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return `${num.toFixed(2)}%`;
}
function updateKpiTrend(elementId, trendText) {
  const trend = document.getElementById(elementId);
  if (!trend) return;
  const value = (trendText || '').toLowerCase();
  let cssClass = 'neutral';
  if (['forte','élevé','elevé','explosive','croissant'].some(v => value.includes(v))) {
    cssClass = 'positive';
  } else if (['faible','risque','baisse','décroissant','decroissant'].some(v => value.includes(v))) {
    cssClass = 'negative';
  }
  trend.className = `kpi-trend ${cssClass}`;
  trend.textContent = trendText || '-';
}
function parsePercent(value) {
  if (value == null) return null;
  const match = String(value).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}
