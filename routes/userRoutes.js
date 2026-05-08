const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifierUtilisateur } = require('../middlewares');
router.get('/moncompte', verifierUtilisateur, (req, res) => {
  res.send('Bienvenue utilisateur');
});
// Middleware de protection
function verifierConnexion(req, res, next) {
  if (!req.session.utilisateur) {
    return res.redirect('/auth.html');
  }
  next();
}
const crypto = require('crypto');
const nodemailer = require('nodemailer');

router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  db.query('SELECT * FROM utilisateurs WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).send('Erreur serveur');
    if (results.length === 0) return res.status(400).send('Email non trouvé');

    const token = crypto.randomBytes(32).toString('hex');
    const expiration = Date.now() + 3600000; // 1h

    db.query('UPDATE utilisateurs SET resetToken = ?, resetTokenExpiration = ? WHERE email = ?', [token, expiration, email], (err) => {
      if (err) return res.status(500).send('Erreur serveur');

      // Config nodemailer (ajuste ton email/mot de passe)
      const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: { user: 'ton.email@gmail.com', pass: 'ton_mdp' }
      });

      const mailOptions = {
        from: 'ton.email@gmail.com',
        to: email,
        subject: 'Réinitialisation de votre mot de passe',
        html: `<p>Pour réinitialiser votre mot de passe, cliquez <a href="http://localhost:3000/reset-password?token=${token}">ici</a></p>`
      };

      transporter.sendMail(mailOptions, (error) => {
        if (error) return res.status(500).send('Erreur envoi email');
        res.send('Email de réinitialisation envoyé');
      });
    });
  });
});
router.get('/reset-password', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).send('Token manquant');

  db.query('SELECT * FROM utilisateurs WHERE resetToken = ? AND resetTokenExpiration > ?', [token, Date.now()], (err, results) => {
    if (err) return res.status(500).send('Erreur serveur');
    if (results.length === 0) return res.status(400).send('Token invalide ou expiré');

    // Ici on peut renvoyer une page HTML simple ou JSON pour le front React
    res.send(`
      <form action="/reset-password" method="POST">
        <input type="hidden" name="token" value="${token}" />
        <input type="password" name="password" placeholder="Nouveau mot de passe" required />
        <button type="submit">Réinitialiser</button>
      </form>
    `);
  });
});
const bcrypt = require('bcrypt');

router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;

  db.query('SELECT * FROM utilisateurs WHERE resetToken = ? AND resetTokenExpiration > ?', [token, Date.now()], async (err, results) => {
    if (err) return res.status(500).send('Erreur serveur');
    if (results.length === 0) return res.status(400).send('Token invalide ou expiré');

    const hashedPassword = await bcrypt.hash(password, 10);

    db.query('UPDATE utilisateurs SET password = ?, resetToken = NULL, resetTokenExpiration = NULL WHERE resetToken = ?', [hashedPassword, token], (err) => {
      if (err) return res.status(500).send('Erreur serveur');
      res.send('Mot de passe réinitialisé avec succès');
    });
  });
});

// Route d'inscription
router.post('/register', (req, res) => { 
  const { prenom, nom, email, motdepasse } = req.body;

  console.log("Mot de passe reçu :", motdepasse);

  if (!prenom || !nom || !email || !motdepasse) {
    return res.send("Tous les champs sont obligatoires.");
  }

  bcrypt.hash(motdepasse, 10, (err, hash) => {
    if (err) {
      console.error('Erreur de hash :', err);
      return res.send('Erreur lors de l\'inscription.');
    }

    const sql = 'INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe) VALUES (?, ?, ?, ?)';
    db.query(sql, [nom, prenom, email, hash], (err, result) => {
      if (err) {
        console.error('Erreur MySQL :', err);
        return res.send('Erreur lors de l\'inscription.');
      }
      const insertedId = result.insertId;
      req.session.utilisateur = { id: insertedId, prenom, nom, email };
      console.log('Utilisateur inscrit :', email);
      res.redirect('/dashboard');
    });
  });
});
router.post('/annuler/:id_reservation', verifierConnexion, (req, res) => {
  const idReservation = req.params.id_reservation;
  const idUtilisateur = req.session.utilisateur.id;

  const sqlReservation = `
    SELECT * FROM reservations 
    WHERE id_reservation = ? AND id_utilisateur = ? AND statut = 'en_attente'
  `;

  db.query(sqlReservation, [idReservation, idUtilisateur], (err, result) => {
    if (err) return res.status(500).json({ erreur: 'Erreur serveur' });
    if (result.length === 0) {
      return res.status(400).json({ erreur: 'Réservation introuvable ou déjà traitée' });
    }

    const reservation = result[0];
    const dateDebut = new Date(reservation.date_debut);
    const now = new Date();

    const sqlParam = `SELECT valeur FROM parametres WHERE cle = 'delai_annulation'`;
    db.query(sqlParam, (err, paramResult) => {
      if (err || paramResult.length === 0) {
        return res.status(500).json({ erreur: 'Paramètre "delai_annulation" manquant' });
      }

      const delaiHeures = parseInt(paramResult[0].valeur);
      const diffHeures = (dateDebut - now) / (1000 * 60 * 60);

      if (diffHeures < delaiHeures) {
        return res.status(400).json({ erreur: `Le délai d'annulation est dépassé. (Annulation autorisée jusqu'à ${delaiHeures}h avant)` });
      }

      const sqlUpdate = `UPDATE reservations SET statut = 'annulee' WHERE id_reservation = ?`;
      db.query(sqlUpdate, [idReservation], (err) => {
        if (err) return res.status(500).json({ erreur: 'Erreur lors de l\'annulation' });

        // MODIFICATION ICI : Récupérer l'ID de l'admin au lieu de l'utilisateur
        const sqlAdmin = `SELECT id_admin FROM admins LIMIT 1`;
        db.query(sqlAdmin, (err, adminResults) => {
          if (err || adminResults.length === 0) {
            console.error("Impossible de trouver un admin pour la notification");
            return res.json({ success: true, message: "Réservation annulée avec succès." });
          }

          const idAdmin = adminResults[0].id_admin;
          const titre = "Réservation annulée";
          const message = `${req.session.utilisateur.prenom} ${req.session.utilisateur.nom} a annulé la réservation #${idReservation} (${reservation.nom_ressource})`;

          db.query(
            `INSERT INTO notifications (id_utilisateur, titre, message) VALUES (?, ?, ?)`,
            [idAdmin, titre, message],
            (err) => {
              if (err) console.warn("Notification non créée");
              return res.json({ success: true, message: "Réservation annulée avec succès." });
            }
          );
        });
      });
    });
  });
});

// Route de connexion
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM utilisateurs WHERE email = ?';
  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error('Erreur MySQL :', err);
      return res.status(500).json({ erreur: 'Erreur serveur. Veuillez réessayer.' });
    }

    // ✅ Vérifier si email existe
    if (results.length === 0) {
      return res.status(401).json({ erreur: 'Mot de passe ou compte supprimé.Prenez contact avec l’administrateur.' });
    }

    const utilisateur = results[0];

    // ❌ Cas 1 : Utilisateur supprimé
    if (utilisateur.statut && utilisateur.statut.toLowerCase() === 'supprimé') {
      return res.status(403).json({
        erreur: 'Votre compte a été supprimé. Veuillez contacter l’administrateur.'
      });
    }

    // ✅ Vérification du mot de passe
    bcrypt.compare(password, utilisateur.mot_de_passe, (err, isMatch) => {
      if (err) {
        console.error('Erreur bcrypt :', err);
        return res.status(500).json({ erreur: 'Erreur serveur. Veuillez réessayer.' });
      }

      if (!isMatch) {
        return res.status(401).json({ erreur: 'Mot de passe incorrect ou compte supprimé.' });
      }

      // ✅ Connexion réussie
      req.session.utilisateur = {
        id: utilisateur.id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        bloque: utilisateur.bloque,
        statut: utilisateur.statut
      };

      return res.json({ success: true });
    });
  });
});

// Modifier le profil
router.post('/utilisateur/modifier', verifierConnexion, (req, res) => {
  const { nom, prenom, email, motdepasse } = req.body;
  const utilisateur = req.session.utilisateur;
  const id = utilisateur.id;

  if (motdepasse && motdepasse.trim() !== '') {
    bcrypt.hash(motdepasse, 10, (err, hash) => {
      if (err) {
        console.error("Erreur de hash :", err);
        return res.status(500).json({ message: "Erreur serveur" });
      }

      const sql = `UPDATE utilisateurs SET nom = ?, prenom = ?, email = ?, mot_de_passe = ? WHERE id = ?`;
      db.query(sql, [nom, prenom, email, hash, id], (err) => {
        if (err) {
          console.error("Erreur mise à jour profil :", err);
          return res.status(500).json({ message: "Erreur serveur" });
        }

        req.session.utilisateur.nom = nom;
        req.session.utilisateur.prenom = prenom;
        req.session.utilisateur.email = email;

        res.json({ message: "Profil mis à jour avec succès." });
      });
    });

  } else {
    const sql = `UPDATE utilisateurs SET nom = ?, prenom = ?, email = ? WHERE id = ?`;
    db.query(sql, [nom, prenom, email, id], (err) => {
      if (err) {
        console.error("Erreur mise à jour profil :", err);
        return res.status(500).json({ message: "Erreur serveur" });
      }

      req.session.utilisateur.nom = nom;
      req.session.utilisateur.prenom = prenom;
      req.session.utilisateur.email = email;

      res.json({ message: "Profil mis à jour avec succès." });
    });
  }
});

// Voir toutes les ressources actives
router.get('/ressources', (req, res) => {
  const sql = 'SELECT * FROM ressources WHERE statut = "actif" ORDER BY created_at DESC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    res.json(results);
  });
});
router.get('/ressources/disponibles', (req, res) => {
  const sql = `
    SELECT * FROM ressources WHERE statut = "actif"
    AND id_ressource NOT IN (
      SELECT id_ressource FROM reservations
      WHERE statut != 'Refusée' AND (
        (date_debut <= NOW() AND date_fin >= NOW())
      )
    )
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    res.json(results);
  });
});

// Voir une ressource spécifique
router.get('/ressources/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'SELECT * FROM ressources WHERE id_ressource = ? AND statut = "actif"';
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    if (results.length === 0) {
      return res.status(404).json({ error: 'Ressource non trouvée' });
    }
    res.json(results[0]);
  });
});

// Réservation
router.post('/reserver', verifierConnexion, (req, res) => {
  const { ressource: id_ressource, date_debut, date_fin, commentaire } = req.body;
  const id_utilisateur = req.session.utilisateur.id;

  // 🔒 Étape 0 : Vérifier si l'utilisateur est bloqué
  db.query('SELECT bloque FROM utilisateurs WHERE id = ?', [id_utilisateur], (err, userResults) => {
    if (err) {
      console.error("Erreur lors de la vérification du statut de l'utilisateur :", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }

    if (userResults.length === 0 || userResults[0].bloque === 1) {
      return res.status(403).json({ success: false, message: "Votre compte est bloqué. Vous ne pouvez pas effectuer de réservation." });
    }

    // ✅ Étape 1 : Récupérer les paramètres
    const sqlParams = `SELECT cle, valeur FROM parametres WHERE cle IN ('heure_ouverture', 'heure_fermeture', 'duree_max_reservation')`;

    db.query(sqlParams, (err, paramResults) => {
      if (err) {
        console.error("Erreur paramètres :", err);
        return res.status(500).json({ success: false, message: "Erreur lors du chargement des paramètres." });
      }

      const paramMap = {};
      paramResults.forEach(p => paramMap[p.cle] = p.valeur);

      const heureOuverture = parseInt(paramMap.heure_ouverture.split(':')[0]);
      const heureFermeture = parseInt(paramMap.heure_fermeture.split(':')[0]);
      const dureeMax = parseFloat(paramMap.duree_max_reservation);

      // 🧠 Vérifications côté serveur
      const debut = new Date(date_debut);
      const fin = new Date(date_fin);
      const heureDebut = debut.getHours();
      const heureFin = fin.getHours();
      const dureeHeures = (fin - debut) / (1000 * 60 * 60);

      if (heureDebut < heureOuverture || heureFin > heureFermeture) {
        return res.status(400).json({
          success: false,
          message: `Horaires autorisés : de ${paramMap.heure_ouverture} à ${paramMap.heure_fermeture}`
        });
      }

      const dureeJours = dureeHeures / 24;
if (dureeJours > dureeMax) {
  return res.status(400).json({
    success: false,
    message: `Durée maximale autorisée : ${dureeMax} jours`
  });
}
      // ✅ Étape 2 : Vérifier les conflits de réservation
      const checkSQL = `
        SELECT * FROM reservations
        WHERE id_ressource = ?
        AND statut != 'Refusée'
        AND (
          (date_debut <= ? AND date_fin >= ?) OR
          (date_debut <= ? AND date_fin >= ?) OR
          (date_debut >= ? AND date_fin <= ?)
        )
      `;

      db.query(checkSQL, [id_ressource, date_debut, date_debut, date_fin, date_fin, date_debut, date_fin], (err, results) => {
        if (err) {
          console.error('Erreur de vérification :', err);
          return res.status(500).json({ success: false, message: "Erreur serveur." });
        }

        if (results.length > 0) {
          return res.status(400).json({
            success: false,
            message: "Cette ressource est déjà réservée pour cette période."
          });
        }

        // ✅ Étape 3 : Insertion
        const insertSQL = `
          INSERT INTO reservations (id_utilisateur, id_ressource, date_debut, date_fin, commentaire, statut)
          VALUES (?, ?, ?, ?, ?, 'en_attente')
        `;

        db.query(insertSQL, [id_utilisateur, id_ressource, date_debut, date_fin, commentaire], (err) => {
          if (err) {
            console.error('Erreur lors de l\'insertion :', err);
            return res.status(500).json({ success: false, message: "Erreur lors de la réservation." });
          }

          res.json({ success: true, message: "Réservation enregistrée avec succès !" });
        });
      });
    });
  });
});


// Historique
router.get('/historique', verifierConnexion, (req, res) => {
  const id_utilisateur = req.session.utilisateur.id;
  const sql = `
    SELECT r.*, res.nom AS nom_ressource, res.type AS type_ressource
    FROM reservations r
    JOIN ressources res ON r.id_ressource = res.id_ressource
    WHERE r.id_utilisateur = ?
    ORDER BY r.date_debut DESC
  `;
  db.query(sql, [id_utilisateur], (err, results) => {
    if (err) {
      console.error('Erreur SQL historique:', err);
      return res.status(500).send('Erreur serveur');
    }
    res.json(results);
  });
});

// Ajoute cette route pour les notifications non lues
router.get('/notifications/non-lues', verifierConnexion, (req, res) => {
  const userId = req.session.utilisateur.id;
  const sql = `SELECT * FROM notifications 
               WHERE id_utilisateur = ? AND lue = FALSE
               ORDER BY created_at DESC LIMIT 5`;
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    res.json(results);
  });
});
router.get('/mes-reservations', (req, res) => {
  if (!req.session.utilisateur) return res.status(401).send('Non connecté');

  const id_utilisateur = req.session.utilisateur.id;

  const sql = `
    SELECT r.*, res.nom AS nom_ressource, res.type
    FROM reservations r
    JOIN ressources res ON r.id_ressource = res.id_ressource
    WHERE r.id_utilisateur = ?
    ORDER BY r.date_debut DESC
  `;

  db.query(sql, [id_utilisateur], (err, results) => {
    if (err) return res.status(500).send('Erreur serveur');
    res.json(results);
  });
});

// Route pour marquer une notification comme lue
router.put('/notifications/:id/lue', verifierConnexion, (req, res) => {
  const notificationId = req.params.id;
  const sql = 'UPDATE notifications SET lue = TRUE WHERE id_notification = ?';
  db.query(sql, [notificationId], (err) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    res.json({ success: true });
  });
});
router.get('/notifications/non-lues/count', verifierConnexion, (req, res) => {
  const userId = req.session.utilisateur.id;
  const sql = `SELECT COUNT(*) as count FROM notifications 
               WHERE id_utilisateur = ? AND lue = FALSE`;
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    res.json({ count: results[0].count });
  });
});
// POST /api/users/annuler/:id_reservation
router.post('/annuler/:id_reservation', verifierConnexion, (req, res) => {
  const idReservation = req.params.id_reservation;
  const idUtilisateur = req.session.utilisateur.id;

  // Étape 1 : Vérifier si la réservation est encore en attente
  const sqlReservation = `
    SELECT * FROM reservations 
    WHERE id_reservation = ? AND id_utilisateur = ? AND statut = 'en_attente'
  `;

  db.query(sqlReservation, [idReservation, idUtilisateur], (err, result) => {
    if (err) return res.status(500).json({ erreur: 'Erreur serveur' });
    if (result.length === 0) {
      return res.status(400).json({ erreur: 'Réservation introuvable ou déjà traitée' });
    }

    const reservation = result[0];
    const dateDebut = new Date(reservation.date_debut);
    const now = new Date();

    // Étape 2 : Vérifier le délai d'annulation depuis les paramètres
    const sqlParam = `SELECT valeur FROM parametres WHERE cle = 'delai_annulation'`;
    db.query(sqlParam, (err, paramResult) => {
      if (err || paramResult.length === 0) {
        return res.status(500).json({ erreur: 'Paramètre "delai_annulation" manquant' });
      }

      const delaiHeures = parseInt(paramResult[0].valeur);
      const diffHeures = (dateDebut - now) / (1000 * 60 * 60);

      if (diffHeures < delaiHeures) {
        return res.status(400).json({ erreur: `Le délai d’annulation est dépassé. (Annulation autorisée jusqu’à ${delaiHeures}h avant)` });
      }

      // Étape 3 : Annuler la réservation
      const sqlUpdate = `UPDATE reservations SET statut = 'annulee' WHERE id_reservation = ?`;
      db.query(sqlUpdate, [idReservation], (err) => {
        if (err) return res.status(500).json({ erreur: 'Erreur lors de l’annulation' });

        // Étape 4 : Créer une notification
        const titre = "Réservation annulée";
        const message = `${req.session.utilisateur.prenom} ${req.session.utilisateur.nom} a annulé une réservation (#${idReservation})`;

        db.query(
          `INSERT INTO notifications (id_utilisateur, titre, message) VALUES (?, ?, ?)`,
          [idUtilisateur, titre, message],
          (err) => {
            if (err) console.warn("Notification non créée");
            return res.json({ success: true, message: "Réservation annulée avec succès." });
          }
        );
      });
    });
  });
});

module.exports = router;