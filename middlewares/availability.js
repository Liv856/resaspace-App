const db = require('../db');

module.exports = async function checkAvailability(req, res, next) {
  const { date_debut, date_fin } = req.body;
  
  try {
    // 1. Récupérer les paramètres admin
    const [settings] = await db.queryAsync(`
      SELECT 
        MAX(CASE WHEN cle = 'jours_ouverture' THEN valeur END) as jours_ouverture,
        MAX(CASE WHEN cle = 'heure_ouverture' THEN valeur END) as heure_ouverture,
        MAX(CASE WHEN cle = 'heure_fermeture' THEN valeur END) as heure_fermeture
      FROM parametres
    `);

    // 2. Vérifier le jour
    const startDate = new Date(date_debut);
    const day = startDate.getDay().toString(); // 0-6 (0=dimanche)
    
    if (!settings.jours_ouverture.split(',').includes(day)) {
      return res.status(400).json({ 
        error: "Réservations impossibles ce jour (selon paramètres admin)" 
      });
    }

    // 3. Vérifier les heures
    const [openH, openM] = settings.heure_ouverture.split(':').map(Number);
    const [closeH, closeM] = settings.heure_fermeture.split(':').map(Number);
    
    const startH = startDate.getHours() + (startDate.getMinutes() / 60);
    const endH = new Date(date_fin).getHours() + (new Date(date_fin).getMinutes() / 60);

    
    if (startH < openH + (openM / 60) || endH > closeH + (closeM / 60)) {
      return res.status(400).json({
        error: `Hors horaires d'ouverture (${settings.heure_ouverture}-${settings.heure_fermeture})`
      });
    }

    next();
  } catch (err) {
    console.error('Erreur vérification disponibilité:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};