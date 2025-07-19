# Gestion du Personnel - WaitLess CHU

## Vue d'ensemble

Le module de gestion du personnel permet aux administrateurs de gérer tous les membres du personnel hospitalier (secrétaires, médecins, administrateurs) et leurs assignations de services.

## Fonctionnalités

### 👥 Gestion des Membres du Personnel
- **Ajout de nouveaux membres** : Créer des comptes pour les secrétaires, médecins et administrateurs
- **Modification des profils** : Mettre à jour les informations personnelles et les rôles
- **Désactivation de comptes** : Désactiver temporairement l'accès d'un membre du personnel
- **Recherche et filtrage** : Trouver rapidement les membres du personnel par nom, rôle ou statut

### 🏥 Assignation de Services
- **Assigner des services** : Associer un membre du personnel à un service médical spécifique
- **Gestion des permissions** : Configurer les droits d'accès pour chaque assignation
- **Retrait d'assignation** : Retirer un service d'un membre du personnel

### 📊 Statistiques et Rapports
- **Vue d'ensemble** : Statistiques globales sur le personnel
- **Activité récente** : Historique des actions de chaque membre du personnel
- **Rapports détaillés** : Analyses sur la performance et l'utilisation

## Accès

### Rôles Autorisés
- **Administrateurs** : Accès complet à toutes les fonctionnalités
- **Secrétaires/Médecins** : Accès limité (lecture seule de leur propre profil)

### Navigation
1. Connectez-vous en tant qu'administrateur
2. Accédez au menu "Personnel" dans la barre de navigation
3. Ou utilisez le lien direct : `/staff/staff.html`

## Interface Utilisateur

### Panneau de Gauche - Liste du Personnel
- **Recherche** : Barre de recherche par nom ou email
- **Filtres** : Par rôle (Secrétaire, Médecin, Administrateur) et statut (Actif/Inactif)
- **Actions** : Boutons pour actualiser et ajouter un nouveau membre

### Panneau de Droite - Détails du Personnel
- **Informations personnelles** : Nom, email, téléphone, rôle
- **Services assignés** : Liste des services gérés par le membre
- **Activité récente** : Historique des actions effectuées

### Actions Rapides
- **Import en lot** : Importer plusieurs membres du personnel depuis un fichier
- **Gestion des permissions** : Configurer les droits d'accès globaux
- **Rapports personnel** : Générer des statistiques détaillées
- **Export données** : Exporter les données du personnel

## API Endpoints

### GET `/api/admin/staff`
Récupère la liste de tous les membres du personnel.

### GET `/api/admin/staff/stats`
Récupère les statistiques globales du personnel.

### POST `/api/admin/staff`
Crée un nouveau membre du personnel.

### PUT `/api/admin/staff/{staff_id}`
Met à jour les informations d'un membre du personnel.

### PUT `/api/admin/staff/{staff_id}/deactivate`
Désactive un membre du personnel.

### POST `/api/admin/staff/{staff_id}/assign-service`
Assigne un service à un membre du personnel.

### DELETE `/api/admin/staff/{staff_id}/service-assignment`
Retire l'assignation de service d'un membre du personnel.

### GET `/api/admin/staff/{staff_id}/activity`
Récupère l'historique d'activité d'un membre du personnel.

## Utilisation

### Ajouter un Nouveau Membre du Personnel

1. Cliquez sur "Nouveau Personnel" dans le panneau de gauche
2. Remplissez le formulaire :
   - **Prénom et Nom** : Nom complet du membre
   - **Email** : Adresse email unique (servira d'identifiant)
   - **Téléphone** : Numéro de contact (optionnel)
   - **Rôle** : Sélectionnez le rôle approprié
   - **Service Assigné** : Service médical à gérer (optionnel)
   - **Mot de passe** : Mot de passe initial
3. Cliquez sur "Créer le Personnel"

### Modifier un Membre du Personnel

1. Sélectionnez le membre dans la liste de gauche
2. Cliquez sur "Modifier" dans le panneau de droite
3. Modifiez les informations souhaitées
4. Cliquez sur "Mettre à Jour"

### Assigner un Service

1. Sélectionnez le membre du personnel
2. Cliquez sur "Assigner un Service" dans la section Services Assignés
3. Sélectionnez le service à assigner
4. Configurez les permissions :
   - ✅ Ajouter des patients
   - ✅ Gérer la file d'attente
   - ✅ Voir les rapports
   - ✅ Gérer les tickets
5. Cliquez sur "Assigner le Service"

### Désactiver un Membre

1. Sélectionnez le membre du personnel
2. Cliquez sur "Désactiver" dans le panneau de droite
3. Confirmez l'action

## Sécurité

### Authentification
- Toutes les opérations nécessitent une authentification administrateur
- Les tokens JWT sont utilisés pour la sécurité des sessions

### Permissions
- Seuls les administrateurs peuvent gérer le personnel
- Les secrétaires et médecins ont un accès limité à leur propre profil
- Les permissions sont vérifiées côté serveur pour chaque action

### Validation
- Validation des emails uniques
- Vérification des mots de passe forts
- Validation des données avant sauvegarde

## Intégration

### Avec le Système de Files d'Attente
- Les assignations de services déterminent quels patients un membre peut gérer
- Les permissions contrôlent les actions disponibles dans l'interface secrétariat

### Avec le Système de Rapports
- Les activités du personnel sont tracées pour les rapports
- Les statistiques de performance incluent les actions du personnel

### Avec le Système d'Authentification
- Les rôles du personnel déterminent l'accès aux différentes interfaces
- Les comptes désactivés ne peuvent plus se connecter

## Support

Pour toute question ou problème avec la gestion du personnel :

- **Email** : admin@waitless.chu
- **Documentation API** : `/docs` (Swagger UI)
- **Logs** : Vérifiez les logs du serveur pour les erreurs détaillées

## Développement

### Structure des Fichiers
```
staff/
├── staff.html          # Interface principale
├── staff.css           # Styles CSS
├── staff.js            # Logique JavaScript
└── README.md           # Documentation
```

### Technologies Utilisées
- **Frontend** : HTML5, CSS3, JavaScript (ES6+)
- **Backend** : FastAPI, SQLAlchemy, PostgreSQL
- **Authentification** : JWT, bcrypt
- **Interface** : Responsive design avec Font Awesome

### Personnalisation
- Les rôles peuvent être étendus dans `models.py`
- Les permissions peuvent être modifiées dans l'interface
- Les styles peuvent être personnalisés dans `staff.css` 