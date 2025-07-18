// Dashboard data from backend
let dashboardData = {
  services: [],
  alerts: [],
  stats: {
    total_waiting: 0,
    total_consulting: 0,
    active_services: 0,
    avg_wait_time: 0
  }
};

// Load dashboard data from backend
async function loadDashboardData() {
  try {
    APIUtils.showLoading(document.getElementById('queueList'));
    
    // Load dashboard stats
    const stats = await apiClient.getDashboardStats();
    if (stats) {
      dashboardData.stats = stats;
      dashboardData.services = stats.services || [];
      displayQueues();
      updateStats();
    }
    
    // Load alerts
    const alerts = await apiClient.getAlerts();
    if (alerts) {
      dashboardData.alerts = alerts;
      displayAlerts();
    }
    
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    APIUtils.showError(document.getElementById('queueList'), 'Erreur lors du chargement des données');
    APIUtils.showNotification('Erreur de connexion au serveur', 'error');
  }
}

// Fonction pour afficher les files d'attente
function displayQueues() {
  const queueList = document.getElementById('queueList');
  
  if (!dashboardData.services || dashboardData.services.length === 0) {
    queueList.innerHTML = '<p>Aucun service actif</p>';
    return;
  }
  
  queueList.innerHTML = dashboardData.services.map(service => `
    <div class="queue-item" data-id="${service.id}">
      <div class="queue-info">
        <h4>${service.name}</h4>
        <p>${service.location}</p>
      </div>
      <div class="queue-status">
        <div class="waiting-count">${service.current_waiting}</div>
        <div class="wait-time">${APIUtils.formatWaitTime(service.avg_wait_time)}</div>
      </div>
    </div>
  `).join('');
}

// Fonction pour afficher les alertes
function displayAlerts() {
  const alertsList = document.getElementById('alertsList');
  
  if (!dashboardData.alerts || dashboardData.alerts.length === 0) {
    alertsList.innerHTML = '<p>Aucune alerte récente</p>';
    return;
  }
  
  alertsList.innerHTML = dashboardData.alerts.map(alert => `
    <div class="alert-item ${alert.type}" data-id="${alert.id}">
      <div class="alert-content">
        <p>${alert.message}</p>
        <span class="alert-time">${APIUtils.formatDate(alert.created_at)}</span>
      </div>
    </div>
  `).join('');
}

// Fonction pour mettre à jour les statistiques
function updateStats() {
  const stats = dashboardData.stats;
  
  document.getElementById('waitingPatients').textContent = stats.total_waiting || 0;
  document.getElementById('activeServices').textContent = stats.active_services || 0;
  document.getElementById('avgWaitTime').textContent = APIUtils.formatWaitTime(stats.avg_wait_time || 0);
  
  // Update completed consultations (you can extend this based on backend data)
  const completedElement = document.getElementById('completedToday');
  if (completedElement) {
    // This could be enhanced with actual daily completion data from backend
    completedElement.textContent = '0'; // Placeholder
  }
}

// Fonction pour actualiser les données
async function refreshData() {
  try {
    await loadDashboardData();
    console.log('Dashboard data refreshed');
  } catch (error) {
    console.error('Error refreshing dashboard data:', error);
  }
}

// Fonction pour ajouter une nouvelle alerte (this would typically come from backend notifications)
function addAlert(type, message) {
  const newAlert = {
    id: Date.now(),
    type: type,
    message: message,
    created_at: new Date().toISOString()
  };
  
  dashboardData.alerts.unshift(newAlert);
  if (dashboardData.alerts.length > 5) {
    dashboardData.alerts.pop(); // Garder seulement les 5 dernières alertes
  }
  
  displayAlerts();
}

// Check authentication and role
function checkAdminAuth() {
  if (!apiClient.isAuthenticated()) {
    window.location.href = '../Acceuil/acceuil.html?login=true';
    return false;
  }
  
  if (!apiClient.isAdmin()) {
    APIUtils.showNotification('Accès non autorisé. Cette page est réservée aux administrateurs.', 'error');
    window.location.href = '../qr code/qr.html';
    return false;
  }
  
  return true;
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication and authorization
  if (!checkAdminAuth()) {
    return;
  }
  
  // Load initial data
  await loadDashboardData();
  
  // Actualiser les données toutes les 30 secondes
  setInterval(refreshData, 30000);
  
  console.log('Dashboard initialized for admin user');
});

// Fonction pour exporter les données (pour les rapports)
function exportDashboardData() {
  const data = {
    timestamp: new Date().toISOString(),
    services: dashboardData.services,
    alerts: dashboardData.alerts,
    stats: dashboardData.stats
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dashboard-data-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Logout function
async function handleLogout() {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
    try {
      await apiClient.logout();
      APIUtils.showNotification('Déconnexion réussie', 'success');
      window.location.href = '../Acceuil/acceuil.html';
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if backend call fails
      apiClient.removeToken();
      window.location.href = '../Acceuil/acceuil.html';
    }
  }
}

// Exposer les fonctions globalement
window.exportDashboardData = exportDashboardData;
window.handleLogout = handleLogout; 