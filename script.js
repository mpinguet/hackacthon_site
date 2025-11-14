// ===========================
// FORM SUBMISSION HANDLER
// ===========================

const GEO_COMMUNES_ENDPOINT = 'https://geo.api.gouv.fr/communes';
let villeSearchAbortController = null;
let villeSearchDebounce = null;
let currentVilleMeta = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeMarketForm();
    setupVilleSearch();
});

function initializeMarketForm() {
    const form = document.getElementById('marketForm');
    if (!form) return;
    form.addEventListener('submit', handleMarketFormSubmit);
}

function setupVilleSearch() {
    const input = document.getElementById('ville');
    const helper = document.getElementById('villeHelper');
    if (!input) return;
    setHelperText(helper, 'Saisissez au moins 2 lettres pour rechercher une commune.');

    input.addEventListener('input', () => {
        const value = input.value.trim();
        currentVilleMeta = null;
        input.dataset.insee = '';
        input.dataset.departement = '';
        input.dataset.departementLabel = '';

        if (value.length < 2) {
            clearVilleOptions();
            setHelperText(helper, 'Tapez au moins 2 lettres...');
            return;
        }

        setHelperText(helper, 'Recherche en cours...');
        if (villeSearchDebounce) clearTimeout(villeSearchDebounce);
        villeSearchDebounce = setTimeout(() => {
            requestVilleSuggestions(value);
        }, 250);
    });

    input.addEventListener('change', () => syncVilleMetadata(input));
    input.addEventListener('blur', () => syncVilleMetadata(input));

    const savedVille = localStorage.getItem('villeGlobale');
    if (savedVille) {
        input.value = savedVille;
        const departementLabel = localStorage.getItem('departementGlobal') || '';
        const insee = localStorage.getItem('villeInseeGlobal') || '';
        if (departementLabel || insee) {
            currentVilleMeta = {
                nom: savedVille,
                insee,
                departement: departementLabel,
                departementLabel
            };
            input.dataset.insee = insee;
            input.dataset.departement = departementLabel;
            input.dataset.departementLabel = departementLabel;
        }
    }
}

function handleMarketFormSubmit(event) {
    event.preventDefault();

    const secteurInput = document.getElementById('secteur');
    const villeInput = document.getElementById('ville');
    const objectifInput = document.getElementById('objectif');
    const modelInput = document.getElementById('model');

    const secteur = (secteurInput?.value || '').trim();
    const ville = (villeInput?.value || '').trim();
    const villeMeta = currentVilleMeta || getVilleMetaFromInput(villeInput);
    const departement = villeMeta?.departementLabel || '';
    const objectif = (objectifInput?.value || '').trim();
    const model = (modelInput?.value || '').trim() || 'deepseek-r1:8b';

    const missing = [];
    if (!secteur) missing.push('secteur');
    if (!ville) missing.push('ville');
    if (!objectif) missing.push('objectif');

    if (missing.length) {
        alert(`Merci de renseigner les champs obligatoires : ${missing.join(', ')}`);
        (secteur ? (ville ? objectifInput : villeInput) : secteurInput)?.focus();
        return;
    }

    persistSelections({
        secteur,
        ville,
        departement,
        objectif,
        model,
        insee: villeMeta?.insee || ''
    });
    renderSubmissionPreview({ secteur, ville, departement, objectif, model });

    const params = new URLSearchParams({ secteur, ville, objectif, model });
    if (departement) params.set('departement', departement);
    if (villeMeta?.insee) {
        params.set('insee', villeMeta.insee);
    }

    setTimeout(() => {
        window.location.href = `results.html?${params.toString()}`;
    }, 600);
}

function persistSelections({ secteur, ville, departement, objectif, model, insee }) {
    localStorage.setItem('secteurGlobal', secteur);
    localStorage.setItem('villeGlobale', ville);
    localStorage.setItem('objectifGlobale', objectif);
    localStorage.setItem('modelGlobal', model);
    if (departement) localStorage.setItem('departementGlobal', departement);
    if (insee) localStorage.setItem('villeInseeGlobal', insee);
}

function renderSubmissionPreview({ secteur, ville, departement, objectif, model }) {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = `
        <div class="results-header">
            <i class="ri-check-double-line"></i>
            <div>
                <h3>Demande reçue</h3>
                <p>La configuration a bien été transmise à notre IA.</p>
            </div>
        </div>
        <ul class="results-summary">
            <li><i class="ri-archive-stack-line"></i>Secteur : <strong>${secteur}</strong></li>
            <li><i class="ri-building-line"></i>Ville ciblée : <strong>${ville}</strong></li>
            ${departement ? `<li><i class="ri-map-pin-line"></i>Département : <strong>${departement}</strong></li>` : ''}
            <li><i class="ri-focus-line"></i>Objectif : <strong>${objectif}</strong></li>
            <li><i class="ri-cpu-line"></i>Modele IA : <strong>${model}</strong></li>
        </ul>
        <div class="results-note">
            <i class="ri-robot-2-line"></i>
            <p>Préparation du rapport en cours... redirection automatique vers la page résultats.</p>
        </div>
    `;
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function requestVilleSuggestions(query) {
    const helper = document.getElementById('villeHelper');
    if (villeSearchAbortController) {
        villeSearchAbortController.abort();
    }
    villeSearchAbortController = new AbortController();
    const params = new URLSearchParams({
        nom: query,
        fields: 'nom,code,codeDepartement,departement',
        limit: '50',
        boost: 'population'
    });

    fetch(`${GEO_COMMUNES_ENDPOINT}?${params.toString()}`, { signal: villeSearchAbortController.signal })
        .then(response => {
            if (!response.ok) throw new Error(`Geo API ${response.status}`);
            return response.json();
        })
        .then(communes => {
            populateVilleSuggestions(communes);
            if (!communes.length) {
                setHelperText(helper, 'Aucune commune trouvée avec cette saisie.');
            } else {
                setHelperText(helper, 'Choisissez une commune dans la liste.');
            }
        })
        .catch(error => {
            if (error.name === 'AbortError') return;
            console.error('Recherche commune impossible', error);
            setHelperText(helper, 'Recherche impossible. Vrifiez votre connexion.');
            clearVilleOptions();
        });
}

function populateVilleSuggestions(communes) {
    const datalist = document.getElementById('villeSuggestions');
    if (!datalist) return;
    datalist.innerHTML = '';
    const fragment = document.createDocumentFragment();
    communes.forEach(commune => {
        const option = document.createElement('option');
        option.value = commune.nom;
        option.label = `${commune.nom}  ${commune.departement?.nom || commune.codeDepartement || ''}`;
        option.dataset.insee = commune.code;
        option.dataset.departement = commune.departement?.nom || '';
        option.dataset.departementLabel = `${commune.codeDepartement || ''} - ${commune.departement?.nom || ''}`;
        fragment.appendChild(option);
    });
    datalist.appendChild(fragment);
}

function clearVilleOptions() {
    const datalist = document.getElementById('villeSuggestions');
    if (datalist) datalist.innerHTML = '';
}

function syncVilleMetadata(input) {
    const meta = getVilleMetaFromInput(input);
    if (meta) {
        currentVilleMeta = meta;
        input.dataset.insee = meta.insee || '';
        input.dataset.departement = meta.departement || '';
        input.dataset.departementLabel = meta.departementLabel || '';
    } else {
        currentVilleMeta = null;
        input.dataset.insee = '';
        input.dataset.departement = '';
        input.dataset.departementLabel = '';
    }
}

function getVilleMetaFromInput(input) {
    if (!input) return null;
    const datalist = document.getElementById('villeSuggestions');
    if (!datalist) return null;
    const value = input.value.trim().toLowerCase();
    if (!value) return null;
    const option = Array.from(datalist.options).find(opt => (opt.value || '').toLowerCase() === value);
    if (!option) return null;
    return {
        nom: option.value,
        insee: option.dataset.insee || '',
        departement: option.dataset.departement || '',
        departementLabel: option.dataset.departementLabel || ''
    };
}


function setHelperText(element, text) {
    if (element) {
        element.textContent = text;
    }
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if(target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ===========================
// ANIMATION ON SCROLL
// ===========================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if(entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Application de l'animation aux cartes et features
document.querySelectorAll('.card, .feature-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease-out';
    observer.observe(el);
});

// ===========================
// STATISTIQUES ANIMÉES
// ===========================

function animateStats() {
    const stats = document.querySelectorAll('.stat-number');
    
    stats.forEach(stat => {
        const target = stat.textContent;
        const isPercentage = target.includes('%');
        const number = parseInt(target);
        
        if(!isNaN(number)) {
            let current = 0;
            const increment = number / 50;
            
            const timer = setInterval(() => {
                current += increment;
                if(current >= number) {
                    stat.textContent = target;
                    clearInterval(timer);
                } else {
                    stat.textContent = Math.floor(current) + (isPercentage ? '%' : '');
                }
            }, 30);
        }
    });
}

// Observer pour déclencher l'animation des stats
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if(entry.isIntersecting) {
            animateStats();
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const impactSection = document.querySelector('.impact');
if(impactSection) {
    statsObserver.observe(impactSection);
}

// ===========================
// NAVIGATION ACTIVE STATE
// ===========================

window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');
    
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        
        if(window.pageYOffset >= sectionTop - 100) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if(link.getAttribute('href') === '#' + current) {
            link.classList.add('active');
        }
    });
});

// ===========================
// CONSOLE MESSAGE
// ===========================

console.log('%cBioMarket Insights', 'color: #7cb342; font-size: 20px; font-weight: bold;');
console.log('%cÉtudes de marché bio par IA - Développé avec passion', 'color: #2d5016; font-size: 12px;');






