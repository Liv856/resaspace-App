// middlewares.js
const db = require('./db');

async function verifierUtilisateur(req, res, next) {
  if (!req.session?.utilisateur) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const rows = await db.query(
      'SELECT bloque, statut FROM utilisateurs WHERE id = ?', 
      [req.session.utilisateur.id]
    );

    const user = rows[0]; // accès à la première ligne

    if (!user || user.statut === 'supprimé') {
      req.session.destroy();
      return res.status(403).json({ error: 'Compte supprimé' });
    }

    req.session.utilisateur.bloque = user.bloque;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}


function verifierNonBloque(req, res, next) {
  const utilisateur = req.session.utilisateur;

  if (!utilisateur) {
    return res.redirect('/auth.html');
  }

  const sql = 'SELECT bloque FROM utilisateurs WHERE id = ?';
  db.query(sql, [utilisateur.id], (err, results) => {
    if (err) {
      console.error('Erreur vérification blocage :', err);
      return res.status(500).send('Erreur serveur');
    }

    if (results.length === 0 || results[0].bloque === 1) {
      return res.status(403).send('Votre compte est bloqué. Accès refusé.');
    }

    next();
  });
}


// Ajoutez cette fonction avant l'export
function verifierAdmin(req, res, next) {
  if (req.session?.admin) {
    next();
  } else {
    res.status(403).json({ 
      error: 'Accès admin refusé',
      code: 'ADMIN_ACCESS_DENIED'
    });
  }
}

// Modifiez l'export pour inclure verifierAdmin
module.exports = { 
  verifierUtilisateur, 
  verifierAdmin,
  verifierNonBloque
};