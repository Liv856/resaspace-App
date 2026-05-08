const express = require('express');
const path = require('path');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt'); // ajoute si pas déjà
const { verifierAdmin } = require('../middlewares');
const { subscribe, notifyAll } = require('../utils/observer');
const notifyUserReservationStatus = require('../utils/notifications');

// S'abonner à l'événement "statut changé"
subscribe(notifyUserReservationStatus);

// GET - Affichage du formulaire de login
router.get('/login', (req, res) => {
  const error = req.query.error; // pour afficher un message d’erreur si besoin
  res.sendFile(path.join(__dirname, '../public/admin-login.html'));
});
router.post('/login-admin', (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM admins WHERE email = ?', [email], (err, results) => {
    if (err || results.length === 0) {
      return res.status(401).send('Identifiants admin incorrects.');
    }

    const admin = results[0];

    bcrypt.compare(password, admin.mot_de_passe, (err, isMatch) => {
      if (!isMatch) {
        return res.status(401).send('Mot de passe incorrect.');
      }

      req.session.utilisateur = {
        id: admin.id_admin,
        nom: admin.nom,
        email: admin.email,
        role: 'admin'
      };

      return res.redirect('/admin/dashboard');
    });
  });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body; // récupérer les champs envoyés par le formulaire
  
  // Requête pour récupérer l'admin en fonction de l'email (= username ici)
  const sql = 'SELECT * FROM admins WHERE email = ?';
  db.query(sql, [username], (err, results) => {
    if (err) return res.status(500).send('Erreur serveur');
    if (results.length === 0) {
      // Redirection avec erreur
      return res.redirect('/admin/login?error=Admin%20introuvable');
    }

    const admin = results[0];
    bcrypt.compare(password, admin.mot_de_passe, (err, isMatch) => {
      if (err) return res.status(500).send('Erreur serveur');
      if (!isMatch) {
        return res.redirect('/admin/login?error=Mot%20de%20passe%20incorrect');
      }

      // Authentification réussie : stocker admin dans session
      req.session.admin = { id: admin.id_admin, nom: admin.nom, email: admin.email };

      // Redirection vers dashboard
      res.redirect('/admin/dashboard');
    });
  });
});

// GET - Dashboard
router.get('/dashboard', (req, res) => {
  if (!req.session.admin) {
    return res.redirect('/admin/login');
  }
  res.sendFile(path.join(__dirname, '../public/admin-dashboard.html'));
});

// GET - Déconnexion
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});
// Afficher tous les utilisateurs
router.get('/users', (req, res) => {
  db.query(
    'SELECT id, nom, prenom, email, date_inscription, bloque, statut FROM utilisateurs', 
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json(result);
    }
  );
});
// GET /admin/utilisateurs - retourne tous les utilisateurs actifs
router.get('/utilisateurs', verifierAdmin, (req, res) => {
  const sql = `
    SELECT id, nom, prenom FROM utilisateurs 
    WHERE statut != 'supprimé'
    ORDER BY nom ASC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Erreur récupération utilisateurs :", err);
      return res.status(500).json({ erreur: "Erreur serveur" });
    }
    res.json(results);
  });
});

// Supprimer un utilisateur
router.delete('/users/:id', (req, res) => {
  const id = req.params.id;
  db.query(
    'UPDATE utilisateurs SET statut = "supprimé", bloque = 1, email = CONCAT(email, "_deleted_", UUID()) WHERE id = ?', 
    [id], 
    (err) => {
      if (err) return res.status(500).send(err);
      res.sendStatus(200);
    }
  );
});
// Bloquer / débloquer un utilisateur
router.put('/users/block/:id', (req, res) => {
  const id = req.params.id;
  const bloque = req.body.bloque;
  db.query(
    'UPDATE utilisateurs SET bloque = ? WHERE id = ?', 
    [bloque, id], 
    (err) => {
      if (err) return res.status(500).send(err);
      res.sendStatus(200);
    }
  );
});

// Modifier un utilisateur
router.put('/users/:id', (req, res) => {
  const { nom, prenom, email } = req.body;
  const id = req.params.id;
  db.query('UPDATE utilisateurs SET nom = ?, prenom = ?, email = ? WHERE id = ?', [nom, prenom, email, id], (err) => {
    if (err) return res.status(500).send(err);
    res.sendStatus(200);
  });
});
// Gestion des ressources - version améliorée
router.get('/ressources', verifierAdmin, (req, res) => {
  const sql = 'SELECT * FROM ressources WHERE statut = "actif" ORDER BY created_at DESC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    res.json(results);
  });
});

router.post('/ressources', verifierAdmin, (req, res) => {
  const { nom, type, description } = req.body;
  if (!nom || !type) {
    return res.status(400).json({ error: 'Nom et type sont obligatoires' });
  }

  const sql = 'INSERT INTO ressources (nom, type, description) VALUES (?, ?, ?)';
  db.query(sql, [nom, type, description], (err, result) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    res.status(201).json({ id: result.insertId, message: 'Ressource créée' });
  });
});

router.put('/ressources/:id', verifierAdmin, (req, res) => {
  const { nom, type, description } = req.body;
  const id = req.params.id;

  const sql = 'UPDATE ressources SET nom = ?, type = ?, description = ? WHERE id_ressource = ? AND statut = "actif"';
  db.query(sql, [nom, type, description, id], (err, result) => {
  if (err) return res.status(500).json({ error: 'Erreur serveur' });
  
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Ressource non trouvée' });
  }

  res.json({ message: 'Ressource mise à jour' });
});

});

router.delete('/ressources/:id', verifierAdmin, (req, res) => {
  const id = req.params.id;
  const sql = 'UPDATE ressources SET statut = "supprimé" WHERE id_ressource = ?';
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ressource non trouvée' });
    }
    res.json({ message: 'Ressource supprimée' });
  });
});

// POST /admin/notifications
router.post('/notifications', verifierAdmin, (req, res) => {
  const { id_utilisateur, titre, message } = req.body;

  if (!id_utilisateur || !titre || !message) {
    return res.status(400).json({ erreur: 'Tous les champs sont obligatoires.' });
  }

  db.query(
    `INSERT INTO notifications (id_utilisateur, titre, message) VALUES (?, ?, ?)`,
    [id_utilisateur, titre, message],
    (err) => {
      if (err) {
        console.error("Erreur notification :", err);
        return res.status(500).json({ erreur: 'Erreur serveur.' });
      }

      res.json({ success: true, message: 'Notification envoyée avec succès' });
    }
  );
});
router.get('/notifications', verifierAdmin, (req, res) => {
  const idAdmin = req.session.admin.id_admin;
  const sql = `SELECT * FROM notifications WHERE id_utilisateur = ? ORDER BY created_at DESC`;
  db.query(sql, [idAdmin], (err, results) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    res.json(results);
  });
});
// GET - Liste des réservations avec filtres
router.get('/reservations', verifierAdmin, (req, res) => {
  let { statut, date_debut, date_fin } = req.query;
  
  let sql = `
    SELECT r.*, 
           u.nom AS nom_utilisateur, u.prenom, u.email,
           rs.nom AS nom_ressource, rs.type AS type_ressource
    FROM reservations r
    JOIN utilisateurs u ON r.id_utilisateur = u.id
    JOIN ressources rs ON r.id_ressource = rs.id_ressource
    WHERE r.statut != 'annulee' AND 1=1
  `;
  
  const params = [];
  
  // Modification pour gérer plusieurs statuts
  if (statut) {
    if (statut.includes(',')) {
      // Si plusieurs statuts séparés par des virgules
      const statuts = statut.split(',');
      sql += ` AND r.statut IN (${statuts.map(() => '?').join(',')})`;
      params.push(...statuts);
    } else {
      // Si un seul statut
      sql += ' AND r.statut = ?';
      params.push(statut);
    }
  }
  
  if (date_debut) {
    sql += ' AND r.date_debut >= ?';
    params.push(date_debut);
  }
  
  if (date_fin) {
    sql += ' AND r.date_fin <= ?';
    params.push(date_fin);
  }
  
  sql += ' ORDER BY r.date_debut DESC';

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Erreur récupération réservations:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json(results);
  });
});
// PUT - Modifier une réservation
router.put('/reservations/:id', verifierAdmin, (req, res) => {
  const { statut, messageAdmin } = req.body;
  const idReservation = req.params.id;

  const statutsValides = ['en_attente', 'validee', 'refusee'];
  if (!statutsValides.includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  db.query(
    `UPDATE reservations SET statut = ? WHERE id_reservation = ?`,
    [statut, idReservation],
    (err, result) => {
      if (err) {
        console.error('Erreur modification réservation:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      // 🔔 Notifie tous les observateurs (ici notifyUserReservationStatus)
      if (statut === 'validee' || statut === 'refusee') {
        notifyAll({ idReservation, statut, messageAdmin });
      }

      res.json({ success: true });
    }
  );
});


// Fonction utilitaire pour créer des notifications
function creerNotification(idReservation, statut, messageAdmin, callback) {
  db.query(`
    SELECT r.id_utilisateur, u.email, rs.nom AS nom_ressource
    FROM reservations r
    JOIN utilisateurs u ON r.id_utilisateur = u.id
    JOIN ressources rs ON r.id_ressource = rs.id_ressource
    WHERE r.id_reservation = ?
  `, [idReservation], (err, results) => {
    if (err) return callback(err);
    
    if (!results || results.length === 0) {
      console.log('Aucune réservation trouvée pour notification');
      return callback(null, false);
    }

    const reservation = results[0];
    const titre = `Réservation ${statut === 'validee' ? 'validée' : 'refusée'}`;
    const message = messageAdmin || 
      `Votre réservation pour "${reservation.nom_ressource}" a été ${statut === 'validee' ? 'validée' : 'refusée'}.`;

    db.query(
      'INSERT INTO notifications (id_utilisateur, id_reservation, titre, message, created_at) VALUES (?, ?, ?, ?, NOW())',
      [reservation.id_utilisateur, idReservation, titre, message],
      (err) => {
        if (err) {
          console.error('Erreur création notification:', err);
          return callback(err);
        }
        console.log('Notification créée avec succès');
        callback(null, true);
      }
    );
  });
}
// ==================== STATISTIQUES ====================

// Dans adminRoutes.js
router.get('/stats/indicateurs', verifierAdmin, (req, res) => {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM reservations 
       WHERE MONTH(date_debut) = MONTH(CURRENT_DATE()) 
       AND statut = 'validee') as reservations_mois,
       
      (SELECT COUNT(*) FROM reservations 
       WHERE MONTH(date_debut) = MONTH(CURRENT_DATE()) - 1 
       AND statut = 'validee') as reservations_mois_precedent,
       
      (SELECT ROUND(COUNT(DISTINCT id_ressource) / 
       (SELECT COUNT(*) FROM ressources) * 100, 1)
       FROM reservations 
       WHERE date_debut >= CURDATE()) as taux_occupation,
       
      (SELECT GROUP_CONCAT(nom SEPARATOR ', ') 
       FROM ressources 
       WHERE id_ressource IN (
         SELECT id_ressource FROM reservations 
         GROUP BY id_ressource 
         ORDER BY COUNT(*) DESC 
         LIMIT 3
       )) as ressources_populaires,
       
      (SELECT COUNT(DISTINCT id_utilisateur) 
       FROM reservations 
       WHERE date_debut >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) as utilisateurs_actifs,
       
      (SELECT COUNT(*) FROM utilisateurs 
       WHERE date_inscription >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) as nouveaux_utilisateurs
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const data = results[0];
    // Ajouter une vérification pour éviter les divisions par zéro
    const reservationsPrecedent = data.reservations_mois_precedent || 1;
    data.comparaison_mois = Math.round(
      (data.reservations_mois - data.reservations_mois_precedent) / 
      reservationsPrecedent * 100
    );
    
    // S'assurer que toutes les valeurs ont une valeur par défaut
    data.taux_occupation = data.taux_occupation || 0;
    data.ressources_populaires = data.ressources_populaires || "Aucune donnée";
    
    res.json(data);
  });
});
router.get('/stats/reservations-par-type', verifierAdmin, (req, res) => {
  const sql = `
    SELECT r.type as label, COUNT(*) as value
    FROM reservations re
    JOIN ressources r ON re.id_ressource = r.id_ressource
    WHERE re.statut = 'validee'
    GROUP BY r.type
    ORDER BY value DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      labels: results.map(r => r.label),
      values: results.map(r => r.value)
    });
  });
});

router.get('/stats/evolution-mensuelle', verifierAdmin, (req, res) => {
  const sql = `
    SELECT 
      DATE_FORMAT(date_debut, '%Y-%m') as mois,
      COUNT(*) as value
    FROM reservations
    WHERE statut = 'validee'
    AND date_debut >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY DATE_FORMAT(date_debut, '%Y-%m')
    ORDER BY mois
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Formatage pour Chart.js
    const mois = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    res.json({
      mois: results.map(r => {
        const [annee, moisNum] = r.mois.split('-');
        return `${mois[parseInt(moisNum)-1]} ${annee}`;
      }),
      values: results.map(r => r.value)
    });
  });
});

// ==================== PARAMÈTRES ====================

router.get('/parametres', verifierAdmin, (req, res) => {
  const sql = 'SELECT cle, valeur FROM parametres';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const params = {};
    results.forEach(p => params[p.cle] = p.valeur);
    res.json(params);
  });
});

router.post('/parametres', verifierAdmin, (req, res) => {
  const {
    duree_max,
    creneaux_min,
    heure_ouverture,
    heure_fermeture,
    notifications_actives,
    email_admin,
    delai_annulation,
    max_reservations,
    jours_ouverture
  } = req.body;

  const parametres = [
    { cle: 'duree_max', valeur: duree_max },
    { cle: 'creneaux_min', valeur: creneaux_min },
    { cle: 'heure_ouverture', valeur: heure_ouverture },
    { cle: 'heure_fermeture', valeur: heure_fermeture },
    { cle: 'notifications_actives', valeur: notifications_actives ? '1' : '0' },
    { cle: 'email_admin', valeur: email_admin },
    { cle: 'delai_annulation', valeur: delai_annulation },
    { cle: 'max_reservations', valeur: max_reservations },
    { cle: 'jours_ouverture', valeur: jours_ouverture }
  ];

  const sql = `
    INSERT INTO parametres (cle, valeur) 
    VALUES ? 
    ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)
  `;
  
  const values = parametres.map(p => [p.cle, p.valeur]);

  db.query(sql, [values], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});
module.exports = router;