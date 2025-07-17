// Données simulées pour le dashboard
const mockQueues = [
  {
    id: 1,
    service: "Cardiologie",
    waitingCount: 8,
    avgWaitTime: "25 min",
    status: "active"
  },
  {
    id: 2,
    service: "Dermatologie",
    waitingCount: 12,
    avgWaitTime: "18 min",
    status: "active"
  },
  {
    id: 3,
    service: "Pédiatrie",
    waitingCount: 5,
    avgWaitTime: "15 min",
    status: "active"
  },
  {
    id: 4,
    service: "Radiologie",
    waitingCount: 3,
    avgWaitTime: "30 min",
    status: "active"
  }
];

const mockAlerts = [
  {
    id: 1,
    type: "warning",
    message: "File d'attente longue en Cardiologie",
    time: "Il y a 5 min"
  },
  {
    id: 2,
    type: "info",
    message: "Nouveau patient prioritaire en Urgences",
    time: "Il y a 10 min"
  },
  {
    id: 3,
    type: "success",
    message: "Service de Dermatologie libéré",
    time: "Il y a 15 min"
  }
];

// Fonction pour afficher les files d'attente
function displayQueues() {
  const queueList = document.getElementById('queueList');
  
  queueList.innerHTML = mockQueues.map(queue => `
    <div class="queue-item" data-id="${queue.id}">
      <div class="queue-info">
        <h4>${queue.service}</h4>
        <p>Service actif</p>
      </div>
      <div class="queue-status">
        <div class="waiting-count">${queue.waitingCount}</div>
        <div class="wait-time">${queue.avgWaitTime}</div>
      </div>
    </div>
  `).join('');
}

// Fonction pour afficher les alertes
function displayAlerts() {
  const alertsList = document.getElementById('alertsList');
  
  alertsList.innerHTML = mockAlerts.map(alert => `
    <div class="alert-item" data-id="${alert.id}">
      <div class="alert-icon">
        ${alert.type === 'warning' ? '⚠️' : alert.type === 'info' ? 'ℹ️' : '✅'}
      </div>
      <div class="alert-content">
        <h4>${alert.message}</h4>
        <p>${alert.time}</p>
      </div>
    </div>
  `).join('');
}

// Fonction pour mettre à jour les statistiques
function updateStats() {
  const totalWaiting = mockQueues.reduce((sum, queue) => sum + queue.waitingCount, 0);
  const avgWaitTime = Math.round(mockQueues.reduce((sum, queue) => {
    const time = parseInt(queue.avgWaitTime);
    return sum + time;
  }, 0) / mockQueues.length);
  
  document.getElementById('waitingPatients').textContent = totalWaiting;
  document.getElementById('avgWaitTime').textContent = `${avgWaitTime} min`;
  document.getElementById('activeServices').textContent = mockQueues.length;
}

// Fonction pour actualiser les données
function refreshData() {
  // Simuler des changements dans les données
  mockQueues.forEach(queue => {
    queue.waitingCount += Math.floor(Math.random() * 3) - 1; // -1, 0, ou +1
    if (queue.waitingCount < 0) queue.waitingCount = 0;
    
    const currentTime = parseInt(queue.avgWaitTime);
    queue.avgWaitTime = `${Math.max(5, currentTime + Math.floor(Math.random() * 6) - 3)} min`;
  });
  
  displayQueues();
  updateStats();
}

// Fonction pour ajouter une nouvelle alerte
function addAlert(type, message) {
  const newAlert = {
    id: Date.now(),
    type,
    message,
    time: "À l'instant"
  };
  
  mockAlerts.unshift(newAlert);
  if (mockAlerts.length > 5) {
    mockAlerts.pop(); // Garder seulement les 5 dernières alertes
  }
  
  displayAlerts();
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  displayQueues();
  displayAlerts();
  updateStats();
  
  // Actualiser les données toutes les 30 secondes
  setInterval(refreshData, 30000);
  
  // Ajouter une alerte de test toutes les 2 minutes
  setInterval(() => {
    const alertTypes = ['info', 'warning', 'success'];
    const randomType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    const messages = [
      'Nouveau patient arrivé',
      'Service temporairement fermé',
      'Médecin disponible',
      'File d\'attente réduite'
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    addAlert(randomType, randomMessage);
  }, 120000);
});

// Fonction pour exporter les données (pour les rapports)
function exportDashboardData() {
  const data = {
    timestamp: new Date().toISOString(),
    queues: mockQueues,
    alerts: mockAlerts,
    stats: {
      totalWaiting: mockQueues.reduce((sum, queue) => sum + queue.waitingCount, 0),
      activeServices: mockQueues.length,
      avgWaitTime: Math.round(mockQueues.reduce((sum, queue) => {
        const time = parseInt(queue.avgWaitTime);
        return sum + time;
      }, 0) / mockQueues.length)
    }
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dashboard-data-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Exposer la fonction d'export globalement
window.exportDashboardData = exportDashboardData; 