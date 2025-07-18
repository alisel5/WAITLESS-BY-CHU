// Variables globales
let currentTicket = null;
let updateInterval = null;
let ticketsHistory = [];
let currentFilter = 'all';

// Configuration
const UPDATE_INTERVAL = 10000; // 10 secondes
const ALERT_THRESHOLD = 3; // Alert quand il reste 3 personnes

// Check if user is authenticated and show appropriate UI
function checkAuthStatus() {
  const logoutLink = document.getElementById('logoutLink');
  if (apiClient.isAuthenticated()) {
    const user = apiClient.getCurrentUser();
    if (user) {
      logoutLink.style.display = 'block';
      console.log('User authenticated:', user.full_name);
    }
  } else {
    logoutLink.style.display = 'none';
  }
}

// Initialisation de la page
document.addEventListener('DOMContentLoaded', function() {
  initializePage();
  setupEventListeners();
  loadTicketData();
  startAutoUpdate();
});

// Initialiser la page
async function initializePage() {
  console.log('Page de suivi de ticket initialisée');
  
  // Check authentication status
  checkAuthStatus();
  
  // Animation d'entrée
  animatePageLoad();
  
  // Check for ticket parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const ticketParam = urlParams.get('ticket');
  
  if (ticketParam) {
    // Load specific ticket from URL parameter
    console.log('Loading ticket from URL parameter:', ticketParam);
    await loadTicketByNumber(ticketParam);
  } else {
    // Load user's tickets if authenticated
    if (apiClient.isAuthenticated()) {
      await loadUserTickets();
    } else {
      // Load any tickets from localStorage for non-authenticated users
      loadLocalStorageTickets();
    }
  }
}

// Load user's tickets from backend
async function loadUserTickets() {
  try {
    const tickets = await apiClient.getMyTickets();
    if (tickets && tickets.length > 0) {
      ticketsHistory = tickets;
      // Set the most recent ticket as current ticket
      const activeTicket = tickets.find(ticket => ticket.status === 'waiting' || ticket.status === 'consulting');
      if (activeTicket) {
        currentTicket = activeTicket;
        displayCurrentTicket();
      }
      renderHistoryList();
    } else {
      // No tickets found, show empty state
      showEmptyState();
    }
  } catch (error) {
    console.error('Error loading user tickets:', error);
    // Fall back to localStorage tickets for non-authenticated access
    loadLocalStorageTickets();
  }
}

// Load tickets from localStorage (for non-authenticated users)
function loadLocalStorageTickets() {
  const currentTicketNumber = localStorage.getItem('currentTicket');
  const savedTickets = JSON.parse(localStorage.getItem('tickets') || '[]');
  
  if (currentTicketNumber) {
    // Try to load the current ticket status from backend by scanning its QR
    loadTicketByNumber(currentTicketNumber);
  }
  
  if (savedTickets.length > 0) {
    ticketsHistory = savedTickets;
    renderHistoryList();
  }
}

// Load a specific ticket by its number
async function loadTicketByNumber(ticketNumber) {
  try {
    // Use the QR scan API to get ticket status
    const ticketData = await apiClient.scanQR(ticketNumber);
    if (ticketData && ticketData.type === 'ticket_status') {
      currentTicket = {
        id: ticketData.id,
        ticket_number: ticketData.ticket_number,
        service_name: ticketData.service_name,
        status: ticketData.status,
        position_in_queue: ticketData.position_in_queue,
        estimated_wait_time: ticketData.estimated_wait_time,
        created_at: ticketData.created_at
      };
      displayCurrentTicket();
    }
  } catch (error) {
    console.error('Error loading ticket:', error);
    showEmptyState();
  }
}

// Show empty state when no tickets are found
function showEmptyState() {
  const mainCard = document.getElementById('mainTicketCard');
  if (mainCard) {
    mainCard.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-ticket-alt"></i>
        <h3>Aucun ticket actif</h3>
        <p>Vous n'avez pas de ticket en cours.</p>
        <a href="../qr code/qr.html" class="btn">Rejoindre une file d'attente</a>
      </div>
    `;
  }
}

// Display current ticket information
function displayCurrentTicket() {
  if (!currentTicket) {
    showEmptyState();
    return;
  }
  
  const ticketNumber = document.getElementById('ticketNumber');
  const ticketStatus = document.getElementById('ticketStatus');
  const serviceName = document.getElementById('serviceName');
  const ticketType = document.getElementById('ticketType');
  const currentPosition = document.getElementById('currentPosition');
  const peopleAhead = document.getElementById('peopleAhead');
  const estimatedTime = document.getElementById('estimatedTime');
  
  if (ticketNumber) ticketNumber.textContent = currentTicket.ticket_number;
  if (ticketStatus) {
    ticketStatus.textContent = getStatusText(currentTicket.status);
    ticketStatus.className = `ticket-status ${currentTicket.status}`;
  }
  if (serviceName) serviceName.textContent = currentTicket.service_name;
  if (ticketType) ticketType.textContent = 'Standard';
  if (currentPosition) currentPosition.textContent = currentTicket.position_in_queue || 0;
  if (peopleAhead) peopleAhead.textContent = Math.max(0, (currentTicket.position_in_queue || 1) - 1);
  if (estimatedTime) estimatedTime.textContent = APIUtils.formatWaitTime(currentTicket.estimated_wait_time || 0);
  
  // Update progress bar
  updateProgressBar();
  
  // Check if alert should be shown
  if (currentTicket.position_in_queue <= ALERT_THRESHOLD && currentTicket.status === 'waiting') {
    showAlert();
  }
}

// Update progress bar based on position
function updateProgressBar() {
  const progressFill = document.querySelector('.progress-fill');
  if (progressFill && currentTicket) {
    // Calculate progress based on position (lower position = higher progress)
    const maxPosition = 20; // Assume max 20 people in queue for visualization
    const progress = Math.max(0, Math.min(100, 100 - ((currentTicket.position_in_queue - 1) / maxPosition) * 100));
    progressFill.style.width = `${progress}%`;
  }
}

// Show alert when position is low
function showAlert() {
  const alertMessage = `Attention! Il ne reste que ${currentTicket.position_in_queue} personne(s) avant vous.`;
  APIUtils.showNotification(alertMessage, 'warning');
}

// Configurer les écouteurs d'événements
function setupEventListeners() {
  // Écouteurs pour les filtres d'historique
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      filterButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const filter = this.getAttribute('data-filter') || this.textContent.toLowerCase();
      currentFilter = filter;
      renderHistoryList();
    });
  });
  
  // Modal close events
  const modal = document.getElementById('ticketModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }
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

// Charger les données de ticket
async function loadTicketData() {
  try {
    // Update current ticket status if we have one
    if (currentTicket) {
      const updatedTicket = await apiClient.scanQR(currentTicket.ticket_number);
      if (updatedTicket && updatedTicket.type === 'ticket_status') {
        currentTicket = {
          ...currentTicket,
          status: updatedTicket.status,
          position_in_queue: updatedTicket.position_in_queue,
          estimated_wait_time: updatedTicket.estimated_wait_time
        };
        displayCurrentTicket();
      }
    }
    
    // Update last update time
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) {
      lastUpdate.textContent = `Dernière mise à jour : ${new Date().toLocaleTimeString('fr-FR')}`;
    }
    
  } catch (error) {
    console.error('Error updating ticket data:', error);
  }
}

// Démarrer la mise à jour automatique
function startAutoUpdate() {
  // Arrêter d'abord tout intervalle existant
  stopAutoUpdate();
  
  // Démarrer le nouvel intervalle
  updateInterval = setInterval(async () => {
    await loadTicketData();
  }, UPDATE_INTERVAL);
  
  console.log('Mise à jour automatique démarrée');
}

// Arrêter la mise à jour automatique
function stopAutoUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
    console.log('Mise à jour automatique arrêtée');
  }
}

// Obtenir le texte du statut
function getStatusText(status) {
  switch (status) {
    case 'waiting':
      return 'En attente';
    case 'consulting':
      return 'En consultation';
    case 'completed':
      return 'Terminé';
    case 'cancelled':
      return 'Annulé';
    case 'expired':
      return 'Expiré';
    default:
      return 'Inconnu';
  }
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
  
  if (filteredTickets.length === 0) {
    historyList.innerHTML = '<p>Aucun ticket trouvé</p>';
    return;
  }
  
  filteredTickets.forEach(ticket => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.onclick = () => showTicketDetails(ticket);
    
    historyItem.innerHTML = `
      <div class="history-item-header">
        <div class="history-ticket-number">${ticket.ticket_number}</div>
        <span class="history-status ${ticket.status}">${getStatusText(ticket.status)}</span>
      </div>
      <div class="history-details">
        <div class="history-detail">
          <span class="history-label">Service:</span>
          <span class="history-value">${ticket.service_name || ticket.service}</span>
        </div>
        <div class="history-detail">
          <span class="history-label">Type:</span>
          <span class="history-value">Standard</span>
        </div>
        <div class="history-detail">
          <span class="history-label">Date:</span>
          <span class="history-value">${APIUtils.formatDate(ticket.created_at)}</span>
        </div>
        <div class="history-detail">
          <span class="history-label">Position:</span>
          <span class="history-value">${ticket.position_in_queue || 'N/A'}</span>
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
            <span class="detail-value">${ticket.ticket_number}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Service:</span>
            <span class="detail-value">${ticket.service_name || ticket.service}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Type:</span>
            <span class="detail-value">Standard</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Statut:</span>
            <span class="detail-value">${getStatusText(ticket.status)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Position:</span>
            <span class="detail-value">${ticket.position_in_queue || 'N/A'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Temps estimé:</span>
            <span class="detail-value">${APIUtils.formatWaitTime(ticket.estimated_wait_time || 0)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Date de création:</span>
            <span class="detail-value">${APIUtils.formatDate(ticket.created_at)}</span>
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
  if (modal) {
    modal.style.display = 'none';
  }
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

// Refresh ticket data manually
async function refreshTicketData() {
  try {
    APIUtils.showNotification('Actualisation des données...', 'info');
    await loadTicketData();
    
    if (apiClient.isAuthenticated()) {
      await loadUserTickets();
    }
    
    APIUtils.showNotification('Données actualisées', 'success');
  } catch (error) {
    console.error('Error refreshing data:', error);
    APIUtils.showNotification('Erreur lors de l\'actualisation', 'error');
  }
}

// Gestionnaire d'erreurs global
window.addEventListener('error', function(event) {
  console.error('Erreur JavaScript:', event.error);
  APIUtils.showNotification('Une erreur est survenue', 'error');
});

// Gestionnaire pour les promesses rejetées
window.addEventListener('unhandledrejection', function(event) {
  console.error('Promesse rejetée:', event.reason);
  APIUtils.showNotification('Une erreur est survenue', 'error');
});

// Nettoyer lors de la fermeture de la page
window.addEventListener('beforeunload', function() {
  stopAutoUpdate();
});

// Gestion de la visibilité de la page pour économiser les ressources
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    stopAutoUpdate();
  } else {
    startAutoUpdate();
  }
});

// Refresh ticket function (called from HTML)
async function refreshTicket() {
  await refreshTicketData();
}

// Share ticket function
function shareTicket() {
  if (!currentTicket) {
    APIUtils.showNotification('Aucun ticket à partager', 'warning');
    return;
  }
  
  const shareData = {
    title: 'Mon ticket WaitLess',
    text: `Ticket ${currentTicket.ticket_number} - Service: ${currentTicket.service_name}`,
    url: `${window.location.origin}${window.location.pathname}?ticket=${currentTicket.ticket_number}`
  };
  
  if (navigator.share) {
    navigator.share(shareData)
      .then(() => APIUtils.showNotification('Ticket partagé avec succès', 'success'))
      .catch(() => copyTicketToClipboard());
  } else {
    copyTicketToClipboard();
  }
}

// Copy ticket info to clipboard
function copyTicketToClipboard() {
  if (!currentTicket) return;
  
  const ticketInfo = `Ticket: ${currentTicket.ticket_number}\nService: ${currentTicket.service_name}\nStatut: ${getStatusText(currentTicket.status)}\nPosition: ${currentTicket.position_in_queue || 'N/A'}`;
  
  navigator.clipboard.writeText(ticketInfo)
    .then(() => APIUtils.showNotification('Informations du ticket copiées', 'success'))
    .catch(() => APIUtils.showNotification('Impossible de copier les informations', 'error'));
}

// Print ticket function
function printTicket() {
  if (!currentTicket) {
    APIUtils.showNotification('Aucun ticket à imprimer', 'warning');
    return;
  }
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Ticket ${currentTicket.ticket_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .ticket { border: 2px solid #333; padding: 20px; max-width: 400px; }
          .header { text-align: center; margin-bottom: 20px; }
          .info { margin: 10px 0; }
          .label { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <h2>WaitLess - Ticket</h2>
            <h1>${currentTicket.ticket_number}</h1>
          </div>
          <div class="info">
            <span class="label">Service:</span> ${currentTicket.service_name}
          </div>
          <div class="info">
            <span class="label">Statut:</span> ${getStatusText(currentTicket.status)}
          </div>
          <div class="info">
            <span class="label">Position:</span> ${currentTicket.position_in_queue || 'N/A'}
          </div>
          <div class="info">
            <span class="label">Date:</span> ${APIUtils.formatDate(currentTicket.created_at)}
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// Filter history function
function filterHistory(filter) {
  currentFilter = filter;
  
  // Update active button
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  renderHistoryList();
}

// Exposer les fonctions globalement
window.closeModal = closeModal;
window.handleLogout = handleLogout;
window.refreshTicketData = refreshTicketData;
window.refreshTicket = refreshTicket;
window.shareTicket = shareTicket;
window.printTicket = printTicket;
window.filterHistory = filterHistory;
