// utils/notifications.js

const db = require('../db');

function notifyUserReservationStatus({ idReservation, statut, messageAdmin }) {
  const titre = `Réservation ${statut === 'validee' ? 'validée' : 'refusée'}`;

  // Chercher les infos utilisateur
  const sql = `
    SELECT r.id_utilisateur, rs.nom AS nom_ressource
    FROM reservations r
    JOIN ressources rs ON r.id_ressource = rs.id_ressource
    WHERE r.id_reservation = ?
  `;
  db.query(sql, [idReservation], (err, result) => {
    if (err || result.length === 0) return;

    const reservation = result[0];
    const message = messageAdmin || `Votre réservation pour "${reservation.nom_ressource}" a été ${statut}.`;

    db.query(
      `INSERT INTO notifications (id_utilisateur, id_reservation, titre, message, created_at) VALUES (?, ?, ?, ?, NOW())`,
      [reservation.id_utilisateur, idReservation, titre, message],
      (err) => {
        if (err) console.error('Erreur création notification :', err);
        else console.log('✅ Notification automatique créée');
      }
    );
  });
}

module.exports = notifyUserReservationStatus;
