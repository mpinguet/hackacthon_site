// ===========================
// FORM SUBMISSION HANDLER
// ===========================

document.addEventListener('DOMContentLoaded', initializeMarketForm);

function initializeMarketForm() {
    const form = document.getElementById('marketForm');
    if (!form) return;
    form.addEventListener('submit', handleMarketFormSubmit);
}

function handleMarketFormSubmit(event) {
    event.preventDefault();

    const secteurInput = document.getElementById('secteur');
    const villeInput = document.getElementById('ville');
    const regionInput = document.getElementById('region');
    const objectifInput = document.getElementById('objectif');

    const secteur = (secteurInput?.value || '').trim();
    const ville = (villeInput?.value || '').trim();
    const region = (regionInput?.value || '').trim();
    const objectif = (objectifInput?.value || '').trim();

    const missing = [];
    if (!secteur) missing.push('secteur');
    if (!ville) missing.push('ville');
    if (!objectif) missing.push('objectif');

    if (missing.length) {
        alert(`Merci de renseigner les champs obligatoires : ${missing.join(', ')}`);
        (secteur ? (ville ? objectifInput : villeInput) : secteurInput)?.focus();
        return;
    }

    persistSelections({ secteur, ville, region, objectif });
    renderSubmissionPreview({ secteur, ville, region, objectif });

    const params = new URLSearchParams({ secteur, ville, objectif });
    if (region) params.set('region', region);

    setTimeout(() => {
        window.location.href = `results.html?${params.toString()}`;
    }, 600);
}

function persistSelections({ secteur, ville, region, objectif }) {
    localStorage.setItem('secteurGlobal', secteur);
    localStorage.setItem('villeGlobale', ville);
    localStorage.setItem('regionGlobale', region);
    localStorage.setItem('objectifGlobale', objectif);
}

function renderSubmissionPreview({ secteur, ville, region, objectif }) {
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
            ${region ? `<li><i class="ri-map-pin-line"></i>Département : <strong>${region}</strong></li>` : ''}
            <li><i class="ri-focus-line"></i>Objectif : <strong>${objectif}</strong></li>
        </ul>
        <div class="results-note">
            <i class="ri-robot-2-line"></i>
            <p>Préparation du rapport en cours... redirection automatique vers la page résultats.</p>
        </div>
    `;
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
