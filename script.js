// ===========================
// FORM SUBMISSION HANDLER
// ===========================


document.getElementById('marketForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Récupération des valeurs du formulaire
    const secteur = document.getElementById('secteur').value;
    let secteurGlobal = document.getElementById('secteur').value;
    localStorage.setItem('secteurGlobal', secteurGlobal);
    const region = document.getElementById('region').value;
    let regionGlobale = document.getElementById('region').value;
    localStorage.setItem('regionGlobale', regionGlobale);
    const objectif = document.getElementById('objectif').value;
    let objectiGlobale = document.getElementById('objectif').value;
    localStorage.setItem('objectifGlobale', objectiGlobale);
    
    // Validation et affichage des résultats
    if(secteur && region && objectif) {
        const resultsDiv = document.getElementById('results');
        resultsDiv.style.display = 'block';
        
        // Affichage dynamique des résultats
        resultsDiv.innerHTML = `
            <h3>✅ Demande Reçue!</h3>
            <p><strong>Secteur:</strong> ${secteur}</p>
            <p><strong>Région:</strong> ${region}</p>
            <p><strong>Objectif:</strong> ${objectif}</p>
            <p style="margin-top: 1.5rem; padding: 1rem; background: white; border-radius: 8px; border-left: 4px solid var(--secondary);">
                🤖 Notre IA analyse actuellement:<br>
                • Les acteurs majeurs du ${secteur} en ${region}<br>
                • Les tendances de consommation bio<br>
                • Les opportunités de marché<br>
                • La concurrence locale et nationale<br>
            </p>
        `;
        
        // Réinitialisation du formulaire
        document.getElementById('marketForm').reset();
        
        // Scroll vers les résultats
        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
});

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

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('marketForm');
    if (!form) return;
    
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        
        const secteur = encodeURIComponent(document.getElementById('secteur').value);
        const region = encodeURIComponent(document.getElementById('region').value);
        const objectif = encodeURIComponent(document.getElementById('objectif').value);
        
        console.log('📤 Envoi des paramètres:');
        console.log('  - secteur:', document.getElementById('secteur').value);
        console.log('  - region:', document.getElementById('region').value);
        console.log('  - objectif:', document.getElementById('objectif').value);
        
        const url = `results.html?secteur=${secteur}&region=${region}&objectif=${objectif}`;
        console.log('🔗 URL générée:', url);
        
        // Attendre 2 secondes avant d'ouvrir la nouvelle page
        setTimeout(function() {
            window.open(url, '_blank');
        }, 2000); // 2000 millisecondes = 2 secondes
    });
});
// ===========================
// CONSOLE MESSAGE
// ===========================

console.log('%c🌱 BioMarket Insights', 'color: #7cb342; font-size: 20px; font-weight: bold;');
console.log('%cÉtudes de marché bio par IA - Développé avec ❤️', 'color: #2d5016; font-size: 12px;');