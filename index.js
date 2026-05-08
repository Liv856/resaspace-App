const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const userRoutes = require('./routes/userRoutes');  // <-- ici le chemin vers userRoutes.js
const adminRoutes = require('./routes/adminRoutes');
const app = express();
const PORT = 3000;
app.use(session({
  secret: 'maCleSecreteSuperSecurisee',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Middlewares globaux
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', adminRoutes);


// Middleware pour vérifier connexion utilisateur (général)
function verifierConnexion(req, res, next) {
  if (!req.session.utilisateur) {
    return res.redirect('/auth.html');
  }
  next();
}

// Utilisation des routes utilisateurs (register, login, modification, réservation...)
app.use('/api/users', userRoutes);

// Routes protégées qui ne sont pas dans userRoutes.js
app.get('/dashboard', verifierConnexion, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/profil.html', verifierConnexion, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profil.html'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error(err);
    res.redirect('/auth.html');
  });
});

app.get('/deconnexion', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error("Erreur de déconnexion :", err);
    res.redirect('/register.html');
  });
});
// Ajoutez cette route avant le lancement du serveur
app.get('/ressources.html', verifierConnexion, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ressources.html'));
});

app.get('/reserver.html', verifierConnexion, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reserver.html'));
});
// **Route pour la page d'accueil**
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'accueil.html'));
});


// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
