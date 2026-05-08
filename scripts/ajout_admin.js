// scripts/ajout_admin.js
const bcrypt = require('bcrypt');
const db = require('../db');


const nom = "Admin";
const email = "admin2@admin.com"; // Email différent
const motDePasse = "admin123";
;

bcrypt.hash(motDePasse, 10, (err, hash) => {
  if (err) throw err;

  const sql = 'INSERT INTO admins (nom, email, mot_de_passe) VALUES (?, ?, ?)';
  db.query(sql, ['Admin', email, hash], (err, result) => {
    if (err) throw err;
    console.log('Admin ajouté !');
    process.exit();
  });
});
