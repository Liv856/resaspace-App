# ResaSpace - Plateforme Web de Réservation de Salles et Matériels

**ResaSpace** est une application web de réservation de ressources (salles, matériels) au sein des écoles ou universités développée dans le cadre d'un projet de fin d'études de Licence 3 Mathématiques-Informatique. Elle permet de centraliser, organiser et suivre les réservations en temps réel afin d'éviter les conflits de créneaux.

---

## 🎯 Fonctionnalités Principales

L'application s'organise autour de deux espaces sécurisés :

### 👤 Espace Utilisateur (Étudiants & Personnel)
* **Authentification** : Inscription et connexion avec nom, prénom, email et mot de passe.
* **Réservation** : Formulaire de réservation permettant de choisir une ressource, une date de début et une date de fin.
* **Suivi** : Consultation d'un tableau de bord personnel avec l'historique et le statut des demandes.

### 👑 Espace Administrateur
* **Gestion des ressources** : Opérations CRUD (ajout, modification, suppression) sur les salles et matériels.
* **Gestion des demandes** : Interface dédiée pour valider ou refuser les réservations en attente.
* **Contrôle des utilisateurs** : Visualisation de la liste des inscrits avec possibilité de bloquer ou de supprimer un compte.
* **Configuration globale** : Paramétrage des règles du système comme la durée maximale ou les horaires d'ouverture.

---

## 🛠️ Technologies Utilisées

* **Frontend** : HTML, CSS, JavaScript
* **Backend** : Node.js, Express.js
* **Base de données** : MySQL
* **Sécurité** : Chiffrement avec Bcrypt et gestion des sessions via express-session

---

## 📁 Organisation du Dépôt

Le projet suit une structure Node.js claire :
* `/middlewares` : Gestion de la sécurité et du contrôle des sessions.
* `/public` : Interface client (fichiers HTML, CSS et scripts JS frontend).
* `/routes` : Définition des points d'accès (endpoints) de l'API.
* `index.js` : Point d'entrée principal du serveur backend.
* `db.js` : Configuration de la connexion à la base de données MySQL.

---

## 📄 Documentation jointe

Les documents d'accompagnement suivants sont disponibles à la racine :
1. **Cahier des charges** : Présentation du contexte, des objectifs généraux et de l'arborescence.
2. **Cahier d'analyse** : Règles de gestion métier, diagrammes de séquence et diagramme de classes UML.
**Guide utilisateur** : Manuel visuel d'aide à la navigation pour l'espace utilisateur.
3. **Guide administrateur** : Manuel visuel d'aide à la navigation pour l'espace d'administration.

---
*Note : Suite à la perte fortuite des scripts SQL bruts de la base de données, la structure relationnelle complète reste intégralement exploitable et documentée via le Diagramme de Classes UML présent à la page 15 du Cahier d'Analyse.*
