// utils/notifyAdminCancel.js

const db = require('../db');

function notifyAdminReservationCancelled({ idReservation, nom, prenom }) {
  const titre = "Réservation annulée";
  const message = `L’utilisateur ${prenom} ${nom} a annulé sa réservation n°${idReservation}.`;

  // On envoie à tous les administrateurs (tu peux aussi cibler un seul admin)
  const sqlAdmins = `SELECT id_admin FROM admins`;

  db.query(sqlAdmins, (err, admins) => {
    if (err || admins.length === 0) return console.warn("Aucun admin pour notifier");

    admins.forEach(admin => {
      db.query(
        `INSERT INTO notifications (id_utilisateur, id_reservation, titre, message, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [admin.id_admin, idReservation, titre, message],
        (err) => {
          if (err) console.warn("Erreur lors de l'envoi de la notification à l’admin :", err);
        }
      );
    });
  });
}

module.exports = notifyAdminReservationCancelled;
