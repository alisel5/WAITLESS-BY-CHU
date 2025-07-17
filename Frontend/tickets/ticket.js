// Variables globales
let currentTicket = null;
let updateInterval = null;
let ticketsHistory = [];
let currentFilter = 'all';

// Configuration
const UPDATE_INTERVAL = 10000; // 10 secondes
const ALERT_THRESHOLD = 3; // Alert quand il reste 3 personnes

// Initialisation de la page
document.addEventListener('DOMContentLoaded', function() {
  initializePage();
  setupEventListeners();
  loadTicketData();
  startAutoUpdate();
});

// Initialiser la page
function initializePage() {
  console.log('Page de suivi de ticket initialisée');
  
  // Animation d'entrée
  animatePageLoad();
  
  // Charger les données de test
  loadSampleData();
}

// Configurer les écouteurs d'événements
function setupEventListeners() {
  // Écouteurs pour les filtres d'historique
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      filterButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

// Animation de chargement de la page
function animatePageLoad() {
  const elements = document.querySelectorAll('.ticket-header, .ticket-card, .tickets-history');
  elements.forEach((element, index) => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(30px)';
    
    setTimeout(() => {
      element.style.transition = 'all 0.8s ease-out';
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    }, index * 200);
  });
}

// Charger les données du ticket
function loadTicketData() {
  // Simuler le chargement depuis le localStorage ou l'API
  const savedTicket = localStorage.getItem('currentTicket');
  
  if (savedTicket) {
    try {
      currentTicket = JSON.parse(savedTicket);
    } catch (error) {
      console.error('Erreur lors du chargement du ticket:', error);
      currentTicket = generateSampleTicket();
    }
  } else {
    currentTicket = generateSampleTicket();
  }
  
  updateTicketDisplay();
}

// Générer un ticket de test
function generateSampleTicket() {
  const now = new Date();
  const estimatedArrival = new Date(now.getTime() + 18 * 60000); // +18 minutes
  
  return {
    id: Date.now(),
    number: 'T-2025-001',
    service: 'Cardiologie',
    ticketType: 'Standard',
    priority: 'Normale',
    status: 'active',
    position: 5,
    peopleAhead: 4,
    estimatedTime: 18,
    estimatedArrival: estimatedArrival.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    issueDate: now.toLocaleDateString('fr-FR'),
    issueTime: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    qrCode: 'T-2025-001|cardiology|' + Date.now()
  };
}

// Mettre à jour l'affichage du ticket
function updateTicketDisplay() {
  if (!currentTicket) return;
  
  // Mettre à jour les informations principales
  document.getElementById('ticketNumber').textContent = currentTicket.number;
  document.getElementById('serviceName').textContent = currentTicket.service;
  document.getElementById('ticketType').textContent = currentTicket.ticketType;
  document.getElementById('priority').textContent = currentTicket.priority;
  document.getElementById('issueDate').textContent = currentTicket.issueDate;
  
  // Mettre à jour le statut
  const statusElement = document.getElementById('ticketStatus');
  statusElement.textContent = getStatusText(currentTicket.status);
  statusElement.className = `ticket-status ${currentTicket.status}`;
  
  // Mettre à jour la position et les statistiques
  document.getElementById('positionNumber').textContent = currentTicket.position;
  document.getElementById('peopleAhead').textContent = currentTicket.peopleAhead;
  document.getElementById('estimatedTime').textContent = currentTicket.estimatedTime;
  document.getElementById('estimatedArrival').textContent = currentTicket.estimatedArrival;
  
  // Mettre à jour la barre de progression
  updateProgressBar();
  
  // Vérifier les alertes
  checkAlerts();
  
  // Mettre à jour l'horodatage
  updateLastUpdate();
}

// Obtenir le texte du statut
function getStatusText(status) {
  const statusTexts = {
    'active': 'En attente',
    'completed': 'Terminé',
    'expired': 'Expiré',
    'cancelled': 'Annulé'
  };
  return statusTexts[status] || 'Inconnu';
}

// Mettre à jour la barre de progression
function updateProgressBar() {
  const progressFill = document.getElementById('progressFill');
  const totalQueue = currentTicket.position + currentTicket.peopleAhead;
  const progress = ((totalQueue - currentTicket.peopleAhead) / totalQueue) * 100;
  
  progressFill.style.width = `${progress}%`;
}

// Vérifier les alertes
function checkAlerts() {
  const alertElement = document.getElementById('notificationAlert');
  const alertCount = document.getElementById('alertCount');
  
  if (currentTicket.peopleAhead <= ALERT_THRESHOLD && currentTicket.peopleAhead > 0) {
    alertCount.textContent = currentTicket.peopleAhead;
    alertElement.style.display = 'flex';
    alertElement.classList.add('bounce');
  } else {
    alertElement.style.display = 'none';
    alertElement.classList.remove('bounce');
  }
}

// Mettre à jour l'horodatage
function updateLastUpdate() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('lastUpdate').textContent = `Dernière mise à jour : ${timeString}`;
}

// Démarrer la mise à jour automatique
function startAutoUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  updateInterval = setInterval(() => {
    updateTicketData();
  }, UPDATE_INTERVAL);
}

// Mettre à jour les données du ticket
function updateTicketData() {
  if (!currentTicket || currentTicket.status !== 'active') return;
  
  // Simuler une mise à jour des données
  simulateQueueUpdate();
  
  // Sauvegarder les données mises à jour
  localStorage.setItem('currentTicket', JSON.stringify(currentTicket));
  
  // Mettre à jour l'affichage
  updateTicketDisplay();
}

// Simuler une mise à jour de la file
function simulateQueueUpdate() {
  // Réduire le nombre de personnes devant
  if (currentTicket.peopleAhead > 0) {
    currentTicket.peopleAhead--;
    currentTicket.position = Math.max(1, currentTicket.position - 1);
  }
  
  // Mettre à jour le temps estimé
  const avgTimePerPerson = 4.5; // 4.5 minutes par personne
  currentTicket.estimatedTime = Math.max(0, currentTicket.peopleAhead * avgTimePerPerson);
  
  // Mettre à jour l'heure d'arrivée estimée
  const now = new Date();
  const estimatedArrival = new Date(now.getTime() + currentTicket.estimatedTime * 60000);
  currentTicket.estimatedArrival = estimatedArrival.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  
  // Vérifier si le ticket est terminé
  if (currentTicket.peopleAhead === 0) {
    currentTicket.status = 'completed';
    stopAutoUpdate();
  }
}

// Arrêter la mise à jour automatique
function stopAutoUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

// Actualiser manuellement
function refreshTicket() {
  const refreshBtn = document.querySelector('.refresh-btn');
  refreshBtn.classList.add('loading');
  
  // Simuler un délai de chargement
  setTimeout(() => {
    updateTicketData();
    refreshBtn.classList.remove('loading');
    
    // Animation de succès
    refreshBtn.innerHTML = '<i class="fas fa-check"></i> Actualisé';
    setTimeout(() => {
      refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualiser';
    }, 1000);
  }, 1000);
}

// Partager le ticket
function shareTicket() {
  if (navigator.share) {
    navigator.share({
      title: 'Mon ticket WaitLess',
      text: `Ticket ${currentTicket.number} - Position ${currentTicket.position} dans la file`,
      url: window.location.href
    });
  } else {
    // Fallback pour les navigateurs qui ne supportent pas l'API Share
    const shareText = `Ticket ${currentTicket.number} - Position ${currentTicket.position} dans la file`;
    navigator.clipboard.writeText(shareText).then(() => {
      showNotification('Informations copiées dans le presse-papiers', 'success');
    });
  }
}

// Imprimer le ticket
function printTicket() {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ticket ${currentTicket.number}</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 20px;
          background: white;
        }
        .ticket-print {
          max-width: 400px;
          margin: 0 auto;
          border: 2px solid #4A90E2;
          border-radius: 15px;
          padding: 20px;
        }
        .ticket-header {
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px dashed #ccc;
        }
        .ticket-number {
          font-size: 24px;
          font-weight: bold;
          color: #4A90E2;
          margin-bottom: 10px;
        }
        .ticket-info {
          margin-bottom: 20px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .label {
          font-weight: bold;
          color: #4A90E2;
        }
        .queue-info {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 10px;
          text-align: center;
          margin-bottom: 20px;
        }
        .position {
          font-size: 32px;
          font-weight: bold;
          color: #4A90E2;
        }
        .estimated-time {
          font-size: 18px;
          color: #666;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="ticket-print">
        <div class="ticket-header">
          <h2>WaitLess CHU</h2>
          <div class="ticket-number">${currentTicket.number}</div>
        </div>
        
        <div class="ticket-info">
          <div class="info-row">
            <span class="label">Service:</span>
            <span>${currentTicket.service}</span>
          </div>
          <div class="info-row">
            <span class="label">Type:</span>
            <span>${currentTicket.ticketType}</span>
          </div>
          <div class="info-row">
            <span class="label">Priorité:</span>
            <span>${currentTicket.priority}</span>
          </div>
          <div class="info-row">
            <span class="label">Date:</span>
            <span>${currentTicket.issueDate}</span>
          </div>
        </div>
        
        <div class="queue-info">
          <div class="position">Position ${currentTicket.position}</div>
          <div>${currentTicket.peopleAhead} personnes devant vous</div>
          <div class="estimated-time">Temps estimé: ${currentTicket.estimatedTime} min</div>
        </div>
      </div>
    </body>
    </html>
  `);
  
  printWindow.document.close();
  printWindow.print();
}

// Filtrer l'historique
function filterHistory(filter) {
  currentFilter = filter;
  renderHistoryList();
}

// Charger les données de test
function loadSampleData() {
  ticketsHistory = [
    {
      id: 1,
      number: 'T-2025-001',
      service: 'Cardiologie',
      ticketType: 'Standard',
      status: 'active',
      position: 5,
      peopleAhead: 4,
      estimatedTime: 18,
      issueDate: '15/01/2025',
      issueTime: '09:30'
    },
    {
      id: 2,
      number: 'T-2024-999',
      service: 'Dermatologie',
      ticketType: 'Prioritaire',
      status: 'completed',
      position: 1,
      peopleAhead: 0,
      estimatedTime: 0,
      issueDate: '14/01/2025',
      issueTime: '14:15'
    },
    {
      id: 3,
      number: 'T-2024-998',
      service: 'Neurologie',
      ticketType: 'Standard',
      status: 'expired',
      position: 8,
      peopleAhead: 7,
      estimatedTime: 32,
      issueDate: '13/01/2025',
      issueTime: '11:00'
    }
  ];
  
  renderHistoryList();
}

// Rendre la liste d'historique
function renderHistoryList() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;
  
  let filteredTickets = ticketsHistory;
  
  // Appliquer le filtre
  if (currentFilter !== 'all') {
    filteredTickets = ticketsHistory.filter(ticket => ticket.status === currentFilter);
  }
  
  historyList.innerHTML = '';
  
  filteredTickets.forEach(ticket => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.onclick = () => showTicketDetails(ticket);
    
    historyItem.innerHTML = `
      <div class="history-item-header">
        <div class="history-ticket-number">${ticket.number}</div>
        <span class="history-status ${ticket.status}">${getStatusText(ticket.status)}</span>
      </div>
      <div class="history-details">
        <div class="history-detail">
          <span class="history-label">Service:</span>
          <span class="history-value">${ticket.service}</span>
        </div>
        <div class="history-detail">
          <span class="history-label">Type:</span>
          <span class="history-value">${ticket.ticketType}</span>
        </div>
        <div class="history-detail">
          <span class="history-label">Date:</span>
          <span class="history-value">${ticket.issueDate}</span>
        </div>
        <div class="history-detail">
          <span class="history-label">Position:</span>
          <span class="history-value">${ticket.position}${ticket.peopleAhead > 0 ? ` (${ticket.peopleAhead} devant)` : ''}</span>
        </div>
      </div>
    `;
    
    historyList.appendChild(historyItem);
  });
}

// Afficher les détails d'un ticket
function showTicketDetails(ticket) {
  const modal = document.getElementById('ticketModal');
  const modalContent = document.getElementById('modalContent');
  
  modalContent.innerHTML = `
    <div class="ticket-details">
      <div class="detail-section">
        <h4>Informations du ticket</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Numéro:</span>
            <span class="detail-value">${ticket.number}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Service:</span>
            <span class="detail-value">${ticket.service}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Type:</span>
            <span class="detail-value">${ticket.ticketType}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Statut:</span>
            <span class="detail-value">${getStatusText(ticket.status)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Position:</span>
            <span class="detail-value">${ticket.position}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Personnes devant:</span>
            <span class="detail-value">${ticket.peopleAhead}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Temps estimé:</span>
            <span class="detail-value">${ticket.estimatedTime} min</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Date d'émission:</span>
            <span class="detail-value">${ticket.issueDate} à ${ticket.issueTime}</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
}

// Fermer la modal
function closeModal() {
  const modal = document.getElementById('ticketModal');
  modal.style.display = 'none';
}

// Afficher une notification
function showNotification(message, type = 'info') {
  // Créer l'élément de notification
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;
  
  // Styles de la notification
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#4A90E2'};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    transform: translateX(400px);
    transition: transform 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  // Animation d'entrée
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);
  
  // Supprimer après 3 secondes
  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Gestionnaire d'erreurs global
window.addEventListener('error', function(event) {
  console.error('Erreur JavaScript:', event.error);
  showNotification('Une erreur est survenue', 'error');
});

// Gestionnaire pour les promesses rejetées
window.addEventListener('unhandledrejection', function(event) {
  console.error('Promesse rejetée:', event.reason);
  showNotification('Une erreur est survenue', 'error');
});

// Nettoyer lors de la fermeture de la page
window.addEventListener('beforeunload', function() {
  stopAutoUpdate();
});
