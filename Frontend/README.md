# WaitLess Frontend - Documentation

## Organisation des Pages

### Pages pour Patients (Utilisateurs finaux)

Ces pages sont destinées aux patients qui utilisent l'application pour gérer leurs rendez-vous et suivre leur file d'attente.

#### `Acceuil/` - Page d'accueil publique
- **Fichiers :** `acceuil.html`, `acceuil.css`, `acceuil.js`
- **Fonctionnalités :**
  - Présentation de l'application WaitLess
  - Vidéo de démonstration
  - Connexion utilisateur
  - Liens vers l'inscription et mot de passe oublié
  - Informations sur l'équipe et contact

#### `signup/` - Inscription et connexion
- **Fichiers :** `signup.html`, `style.css`, `mdpoublier.html`
- **Fonctionnalités :**
  - Formulaire d'inscription
  - Formulaire de connexion
  - Récupération de mot de passe
  - Navigation vers les autres pages

#### `qr code/` - Scanner QR code
- **Fichiers :** `qr.html`, `qr.css`, `qr.js`
- **Fonctionnalités :**
  - Scanner de QR code pour obtenir un ticket
  - Saisie manuelle du code
  - Génération de ticket numérique
  - Interface de caméra simulée

#### `tickets/` - Suivi de ticket
- **Fichiers :** `ticket.html`, `ticket.css`, `ticket.js`
- **Fonctionnalités :**
  - Affichage du numéro de ticket
  - Estimation du temps d'attente
  - Statut en temps réel
  - Notifications de progression

---

### 🏥 Pages pour Admin (Personnel hospitalier)

Ces pages sont destinées au personnel hospitalier pour gérer les files d'attente, les services et les patients.

#### `dashboard/` - Tableau de bord administratif
- **Fichiers :** `dashboard.html`, `dashboard.css`, `dashboard.js`
- **Fonctionnalités :**
  - Vue d'ensemble des files d'attente
  - Statistiques en temps réel
  - Alertes et notifications
  - Monitoring des services actifs
  - Indicateurs de performance

#### `services/` - Gestion des services médicaux
- **Fichiers :** `services.html`, `services.css`, `services.js`
- **Fonctionnalités :**
  - Ajout/modification/suppression de services
  - Configuration des temps d'attente
  - Gestion des priorités
  - Statut des services (actif/inactif)
  - Localisation des services

#### `patients/` - Gestion des patients
- **Fichiers :** `patients.html`, `patients.css`, `patients.js`
- **Fonctionnalités :**
  - Liste des patients en attente
  - Ajout/modification de patients
  - Filtrage par statut et service
  - Recherche de patients
  - Gestion des priorités
  - Export des données

#### `reports/` - Rapports et statistiques
- **Fichiers :** `reports.html`, `reports.css`, `reports.js`
- **Fonctionnalités :**
  - Statistiques détaillées
  - Graphiques de performance
  - Filtres par période et service
  - Export de rapports
  - Alertes et recommandations
  - Analyse des tendances

---

## Navigation

### Pour les Patients
```
Acceuil → Connexion → QR Code → Tickets
```

### Pour les Admins
```
Dashboard ↔ Services ↔ Patients ↔ Reports
```

## Design System

### Couleurs principales
- **Bleu principal :** `#4A90E2`
- **Bleu foncé :** `#357ABD`
- **Bleu clair :** `#d0e7ff`
- **Arrière-plan :** `#f7f9fc`
- **Texte :** `#333`
- **Texte secondaire :** `#666`

### Typographie
- **Police :** Poppins (Google Fonts)
- **Poids :** 400 (normal), 600 (semi-bold)

### Composants communs
- **Navbar :** Bleue (`#4A90E2`) avec logo et navigation
- **Footer :** Noir avec informations de contact
- **Modals :** Blanc avec ombre et bordure arrondie
- **Boutons :** Bleu principal avec effets de survol
- **Cartes :** Blanc avec ombre et bordure arrondie

## Responsive Design

Toutes les pages sont conçues pour être responsives avec :
- **Desktop :** Layout complet avec sidebar et grilles
- **Tablet :** Adaptation des grilles et navigation
- **Mobile :** Navigation hamburger et layout vertical

## Fonctionnalités Techniques

### JavaScript
- **Données simulées :** Pour la démonstration
- **Animations :** Transitions fluides et effets visuels
- **Interactivité :** Modals, filtres, recherche
- **Temps réel :** Mise à jour automatique des données

### CSS
- **Flexbox/Grid :** Layouts modernes
- **Animations :** Keyframes et transitions
- **Variables CSS :** Pour la cohérence des couleurs
- **Media queries :** Responsive design

## Structure des Données

### Services
```javascript
{
  id: "unique_id",
  name: "Nom du service",
  location: "Localisation",
  maxWaitTime: 30,
  priority: "high|medium|low",
  status: "active|inactive",
  description: "Description du service"
}
```

### Patients
```javascript
{
  id: "unique_id",
  firstName: "Prénom",
  lastName: "Nom",
  age: 25,
  phone: "0600000000",
  service: "Nom du service",
  status: "waiting|consulting|completed",
  priority: "high|medium|low",
  arrivalTime: "2025-01-15T10:30:00",
  notes: "Notes médicales"
}
```

## Déploiement

1. **Hébergement statique :** Toutes les pages peuvent être hébergées sur un serveur web statique
2. **Sécurité :** Implémenter l'authentification côté serveur
3. **Base de données :** Connecter à une API backend pour les données réelles
4. **SSL :** Certificat HTTPS recommandé pour la production

## Maintenance

- **Mise à jour des données :** Via l'API backend
- **Logs :** Monitoring des erreurs JavaScript
- **Performance :** Optimisation des images et scripts
- **Sécurité :** Validation des entrées utilisateur 