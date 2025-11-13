/**
 * Nettoie et transforme les données brutes de l'API pour les rendre
 * plus facilement analysables par une IA (LLM).
 * Ce script est le Funnel de données final, réduisant
 * la complexité pour l'analyse stratégique.
 * @param {object} rawData - L'objet JSON brut parsé, issu des requêtes.
 * @returns {object} - Un objet nettoyé, structuré et compact pour le Super-Prompt.
 */
function cleanDataForAI(rawData) {

    // --- 1. Informations Générales et Géographiques ---
    const generalInfo = {
        ville_analysee: rawData.meta.ville_recherchee,
        segment_analyse: rawData.meta.segment_analyse,
        region: rawData.geo.nom_region,
        population: rawData.geo.population,
        // Supprime la date de génération pour simplifier le prompt
    };

    // --- 2. Analyse de la Concurrence (Simplifiée) ---
    // On ne garde que les chiffres pour éviter de surcharger le prompt avec des listes d'opérateurs
    const concurrence = {
        nombre_operateurs_bio_total: rawData.concurrence_locale_api.nb_operateurs_bio_total,
        nombre_concurrents_directs: rawData.concurrence_locale_api.nb_concurrents_directs,
        // Le JSON source a 'ventilation_activites', on le mappe sur 'ventilation_acteurs'
        ventilation_acteurs: rawData.concurrence_locale_api.ventilation_activites
        // ATTENTION: La liste 'operateurs_details' a été retirée pour la performance du prompt
    };

    // --- 3. Synthèse des Risques Locaux (Simplifiée et Agrégée) ---
    // Le champ 'resume' n'existe pas, on le crée à la volée.
    const catastrophesResume = rawData.risques_locaux_api.catnat.items.reduce((acc, item) => {
        const risque = item.libelle_risque_jo;
        acc[risque] = (acc[risque] || 0) + 1;
        return acc;
    }, {});

    const risques = {
        // Nouvelle structure agrégée des risques : l'IA n'a besoin que du décompte
        sites_pollues_basol_total: rawData.risques_locaux_api.basol.total,
        zones_inondables_azi_statut: (rawData.risques_locaux_api.azi.total > 0 ? "OUI" : "NON"),
        catastrophes_naturelles_resume: catastrophesResume, // Le résumé agrégé
    };

    // --- 4. Tendances de Production & Économiques ---
    // On assemble tous les KPI de tendance dans un seul bloc pour l'IA
    const tendances = {
        production_locale_region_5_ans: rawData.production_locale_region_5ans,
        production_nationale_5_ans: rawData.production_nationale_5ans,
        
        evolution_ventes_pct_5_ans: rawData.tendance_ventes_pct_5ans,
        
        // On vérifie la validité des données de commerce avant de les inclure
        commerce_exterieur_5_ans: (rawData.tendance_commerce_5ans.periode.debut === 6666) 
            ? "Données indisponibles" 
            : rawData.tendance_commerce_5_ans,
    };

    // --- Assemblage Final (Le JSON d'entrée de l'IA) ---
    const cleanedData = {
        metadata: generalInfo,
        concurrence_locale: concurrence,
        risques_synthese: risques,
        tendances_production_marche: tendances,
    };

    return cleanedData;
}