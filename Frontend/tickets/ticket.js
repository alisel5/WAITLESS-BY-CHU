// Variables globales
let currentTicket = null;
let updateInterval = null;
let ticketsHistory = [];
let currentFilter = 'all';
let wsConnection = null;

// Configuration
const UPDATE_INTERVAL = 30000; // 30 secondes (reduced since we have real-time updates)
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
      
      // Find the most recent active ticket (waiting or consulting)
      const activeTicket = tickets.find(ticket => 
        ticket.status === 'waiting' || ticket.status === 'consulting'
      );
      
      if (activeTicket) {
        currentTicket = activeTicket;
        displayCurrentTicket();
        // Setup real-time updates for this ticket
        setupRealTimeUpdates();
      } else {
        // No active tickets, show empty state
        currentTicket = null;
        showEmptyState();
      }
      
      renderHistoryList();
    } else {
      // No tickets found, show empty state
      currentTicket = null;
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
    // Use the new endpoint that provides queue information
    const ticketData = await apiClient.getTicketStatusWithQueueInfo(ticketNumber);
    if (ticketData) {
      currentTicket = {
        id: ticketData.id,
        ticket_number: ticketData.ticket_number,
        service_name: ticketData.service_name,
        service_id: ticketData.service_id,
        status: ticketData.status,
        position_in_queue: ticketData.position_in_queue,
        estimated_wait_time: ticketData.estimated_wait_time,
        created_at: ticketData.created_at,
        priority: 'medium' // Default priority
      };
      
      // Check if ticket should be shown as done
      if (ticketData.should_show_as_done) {
        // Ticket should be considered done, show empty state
        currentTicket = null;
        showEmptyState();
      } else {
        // Ticket is active, display it
        displayCurrentTicket();
      }
    }
  } catch (error) {
    console.error('Error loading ticket:', error);
    // Fallback to old method
    try {
      const ticketData = await apiClient.scanQR(ticketNumber);
      if (ticketData && ticketData.type === 'ticket_status') {
        currentTicket = {
          id: ticketData.id,
          ticket_number: ticketData.ticket_number,
          service_name: ticketData.service_name,
          service: ticketData.service, // Keep both for compatibility
          status: ticketData.status,
          position_in_queue: ticketData.position_in_queue,
          estimated_wait_time: ticketData.estimated_wait_time,
          created_at: ticketData.created_at,
          priority: ticketData.priority || 'medium'
        };
        
        // Check if ticket is active before displaying
        if (currentTicket.status === 'waiting' || currentTicket.status === 'consulting') {
          displayCurrentTicket();
        } else {
          // Ticket is completed/cancelled, show empty state
          currentTicket = null;
          showEmptyState();
        }
      }
    } catch (fallbackError) {
      console.error('Fallback method also failed:', fallbackError);
      showEmptyState();
    }
  }
}

// Show empty state when no tickets are found
function showEmptyState() {
  const mainCard = document.getElementById('mainTicketCard');
  if (mainCard) {
    mainCard.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-check-circle"></i>
        <h3>Votre consultation est terminée</h3>
        <p>Votre ticket a été traité avec succès. Merci de votre patience !</p>
        <div class="empty-state-actions">
          <a href="../qr code/qr.html" class="btn primary-btn">Nouveau ticket</a>
          <a href="../Acceuil/acceuil.html" class="btn secondary-btn">Retour à l'accueil</a>
        </div>
      </div>
    `;
  }
}

// Show auto-completed state when ticket is auto-completed
function showAutoCompletedState() {
  const mainCard = document.getElementById('mainTicketCard');
  if (mainCard) {
    mainCard.innerHTML = `
      <div class="empty-state auto-completed">
        <i class="fas fa-user-check"></i>
        <h3>Consultation terminée automatiquement</h3>
        <p>Votre consultation a été marquée comme terminée car il n'y a plus de patients en attente. Merci !</p>
        <div class="empty-state-actions">
          <a href="../qr code/qr.html" class="btn primary-btn">Nouveau ticket</a>
          <a href="../Acceuil/acceuil.html" class="btn secondary-btn">Retour à l'accueil</a>
        </div>
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
  
  // Check if ticket is completed - if so, don't show in main card
  if (currentTicket.status === 'completed' || currentTicket.status === 'cancelled' || currentTicket.status === 'expired') {
    showEmptyState();
    return;
  }
  
  // Special handling for consulting status
  if (currentTicket.status === 'consulting') {
    // Show consulting status with appropriate messaging
    displayConsultingStatus();
    return;
  }
  
  const ticketNumber = document.getElementById('ticketNumber');
  const ticketStatus = document.getElementById('ticketStatus');
  const serviceName = document.getElementById('serviceName');
  const ticketType = document.getElementById('ticketType');
  const positionNumber = document.getElementById('positionNumber');
  const peopleAhead = document.getElementById('peopleAhead');
  const estimatedTime = document.getElementById('estimatedTime');
  const issueDate = document.getElementById('issueDate');
  const priority = document.getElementById('priority');
  
  if (ticketNumber) ticketNumber.textContent = currentTicket.ticket_number;
  if (ticketStatus) {
    ticketStatus.textContent = getStatusText(currentTicket.status);
    ticketStatus.className = `ticket-status ${currentTicket.status}`;
  }
  
  // Fix service name display
  if (serviceName) {
    let serviceDisplay = '';
    if (typeof currentTicket.service_name === 'string') {
      serviceDisplay = currentTicket.service_name;
    } else if (currentTicket.service && typeof currentTicket.service === 'object') {
      serviceDisplay = currentTicket.service.name || 'Service inconnu';
    } else if (currentTicket.service && typeof currentTicket.service === 'string') {
      serviceDisplay = currentTicket.service;
    } else {
      serviceDisplay = 'Service inconnu';
    }
    serviceName.textContent = serviceDisplay;
  }
  
  if (ticketType) ticketType.textContent = 'Standard';
  if (positionNumber) positionNumber.textContent = currentTicket.position_in_queue || 0;
  if (peopleAhead) peopleAhead.textContent = Math.max(0, (currentTicket.position_in_queue || 1) - 1);
  if (estimatedTime) estimatedTime.textContent = APIUtils.formatWaitTime(currentTicket.estimated_wait_time || 0);
  
  // Set issue date
  if (issueDate && currentTicket.created_at) {
    const date = new Date(currentTicket.created_at);
    issueDate.textContent = date.toLocaleDateString('fr-FR');
  }
  
  // Set priority
  if (priority) {
    const priorityText = {
      'low': 'Basse',
      'medium': 'Normale', 
      'high': 'Haute'
    };
    priority.textContent = priorityText[currentTicket.priority] || 'Normale';
  }
  
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

// Display consulting status with appropriate messaging
function displayConsultingStatus() {
  const mainCard = document.getElementById('mainTicketCard');
  if (!mainCard) return;
  
  mainCard.innerHTML = `
    <div class="ticket-card-header">
      <div class="ticket-number">
        <h2 id="ticketNumber">${currentTicket.ticket_number}</h2>
        <span class="ticket-status consulting" id="ticketStatus">En consultation</span>
      </div>
      <div class="ticket-qr">
        <div class="qr-code" id="qrCode">
          <i class="fas fa-qrcode"></i>
        </div>
      </div>
    </div>

    <div class="ticket-info">
      <div class="info-row">
        <span class="label">Service</span>
        <span class="value" id="serviceName">${currentTicket.service_name || 'Service inconnu'}</span>
      </div>
      <div class="info-row">
        <span class="label">Type</span>
        <span class="value" id="ticketType">Standard</span>
      </div>
      <div class="info-row">
        <span class="label">Priorité</span>
        <span class="value" id="priority">Normale</span>
      </div>
      <div class="info-row">
        <span class="label">Date d'émission</span>
        <span class="value" id="issueDate">${currentTicket.created_at ? new Date(currentTicket.created_at).toLocaleDateString('fr-FR') : 'N/A'}</span>
      </div>
    </div>

    <div class="consulting-status">
      <div class="consulting-message">
        <i class="fas fa-user-md"></i>
        <h3>Votre consultation est en cours</h3>
        <p>Veuillez vous présenter au service. Votre ticket a été appelé.</p>
      </div>
      
      <div class="consulting-actions">
        <button class="action-btn refresh-btn" onclick="refreshTicket()">
          <i class="fas fa-sync-alt"></i>
          Actualiser
        </button>
        <button class="action-btn complete-btn" onclick="markAsCompleted()">
          <i class="fas fa-check"></i>
          Marquer comme terminé
        </button>
      </div>
    </div>
  `;
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
      // Use the new endpoint that provides queue information
      const ticketStatus = await apiClient.getTicketStatusWithQueueInfo(currentTicket.ticket_number);
      if (ticketStatus) {
        // Check if ticket should be considered done based on backend logic
        const shouldShowAsDone = ticketStatus.should_show_as_done;
        
        currentTicket = {
          ...currentTicket,
          status: ticketStatus.status,
          position_in_queue: ticketStatus.position_in_queue,
          estimated_wait_time: ticketStatus.estimated_wait_time,
          service_id: ticketStatus.service_id,
          service_name: ticketStatus.service_name
        };
        
        // If ticket should be shown as done, clear it and show appropriate state
        if (shouldShowAsDone) {
          console.log('Ticket should be shown as done, clearing display');
          
          // Check if this was an auto-completion (status changed from consulting to completed)
          const wasAutoCompleted = ticketStatus.status === 'completed' && 
                                 currentTicket && 
                                 currentTicket.status === 'consulting';
          
          currentTicket = null;
          
          if (wasAutoCompleted) {
            showAutoCompletedState();
          } else {
            showEmptyState();
          }
          
          // Stop auto-update since ticket is done
          stopAutoUpdate();
        } else {
          displayCurrentTicket();
        }
      }
    }
    
    // Update last update time
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) {
      lastUpdate.textContent = `Dernière mise à jour : ${new Date().toLocaleTimeString('fr-FR')}`;
    }
    
  } catch (error) {
    console.error('Error updating ticket data:', error);
    // Fallback to old method if new endpoint fails
    try {
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
    } catch (fallbackError) {
      console.error('Fallback method also failed:', fallbackError);
    }
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
    if (currentFilter === 'active') {
      // Filter for active tickets (waiting or consulting)
      filteredTickets = ticketsHistory.filter(ticket => 
        ticket.status === 'waiting' || ticket.status === 'consulting'
      );
    } else {
      // Filter by specific status
      filteredTickets = ticketsHistory.filter(ticket => ticket.status === currentFilter);
    }
  }
  
  historyList.innerHTML = '';
  
  if (filteredTickets.length === 0) {
    historyList.innerHTML = '<p class="no-tickets">Aucun ticket trouvé</p>';
    return;
  }
  
  filteredTickets.forEach(ticket => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.onclick = () => showTicketDetails(ticket);
    
    // Fix service name display
    let serviceDisplay = '';
    if (typeof ticket.service_name === 'string') {
      serviceDisplay = ticket.service_name;
    } else if (ticket.service && typeof ticket.service === 'object') {
      serviceDisplay = ticket.service.name || 'Service inconnu';
    } else if (ticket.service && typeof ticket.service === 'string') {
      serviceDisplay = ticket.service;
    } else {
      serviceDisplay = 'Service inconnu';
    }
    
    historyItem.innerHTML = `
      <div class="history-item-header">
        <div class="history-ticket-number">${ticket.ticket_number}</div>
        <span class="history-status ${ticket.status}">${getStatusText(ticket.status)}</span>
      </div>
      <div class="history-details">
        <div class="history-detail">
          <span class="history-label">Service:</span>
          <span class="history-value">${serviceDisplay}</span>
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
  
  // Fix service name display
  let serviceDisplay = '';
  if (typeof ticket.service_name === 'string') {
    serviceDisplay = ticket.service_name;
  } else if (ticket.service && typeof ticket.service === 'object') {
    serviceDisplay = ticket.service.name || 'Service inconnu';
  } else if (ticket.service && typeof ticket.service === 'string') {
    serviceDisplay = ticket.service;
  } else {
    serviceDisplay = 'Service inconnu';
  }
  
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
            <span class="detail-value">${serviceDisplay}</span>
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

// Mark ticket as completed (for client-side use)
async function markAsCompleted() {
  if (!currentTicket) return;
  
  try {
    // Update local status to completed
    currentTicket.status = 'completed';
    showEmptyState();
    stopAutoUpdate();
    
    APIUtils.showNotification('Ticket marqué comme terminé', 'success');
  } catch (error) {
    console.error('Error marking ticket as completed:', error);
    APIUtils.showNotification('Erreur lors de la mise à jour du statut', 'error');
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
  
  // Fix service name display
  let serviceDisplay = '';
  if (typeof currentTicket.service_name === 'string') {
    serviceDisplay = currentTicket.service_name;
  } else if (currentTicket.service && typeof currentTicket.service === 'object') {
    serviceDisplay = currentTicket.service.name || 'Service inconnu';
  } else if (currentTicket.service && typeof currentTicket.service === 'string') {
    serviceDisplay = currentTicket.service;
  } else {
    serviceDisplay = 'Service inconnu';
  }
  
  const ticketInfo = `Ticket: ${currentTicket.ticket_number}\nService: ${serviceDisplay}\nStatut: ${getStatusText(currentTicket.status)}\nPosition: ${currentTicket.position_in_queue || 'N/A'}`;
  
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
  
  // Fix service name display
  let serviceDisplay = '';
  if (typeof currentTicket.service_name === 'string') {
    serviceDisplay = currentTicket.service_name;
  } else if (currentTicket.service && typeof currentTicket.service === 'object') {
    serviceDisplay = currentTicket.service.name || 'Service inconnu';
  } else if (currentTicket.service && typeof currentTicket.service === 'string') {
    serviceDisplay = currentTicket.service;
  } else {
    serviceDisplay = 'Service inconnu';
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
            <span class="label">Service:</span> ${serviceDisplay}
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

// Setup real-time WebSocket updates for ticket tracking
function setupRealTimeUpdates() {
  if (!currentTicket || !window.wsClient) {
    console.log('Cannot setup real-time updates: missing ticket or WebSocket client');
    return;
  }

  try {
    // Connect to ticket-specific updates
    wsConnection = wsClient.connectToTicket(currentTicket.ticket_number, handleRealTimeUpdate);
    
    // Also connect to service updates for broader queue changes
    if (currentTicket.service_id) {
      wsClient.connectToService(currentTicket.service_id, handleServiceUpdate);
    }
    
    console.log(`🔗 Real-time updates connected for ticket: ${currentTicket.ticket_number}`);
  } catch (error) {
    console.error('Failed to setup real-time updates:', error);
  }
}

// Handle real-time ticket updates
function handleRealTimeUpdate(data) {
  console.log('📦 Received real-time ticket update:', data);
  
  switch (data.type) {
    case 'initial_ticket_state':
    case 'ticket_update':
      if (data.ticket_number === currentTicket?.ticket_number) {
        updateTicketFromRealTimeData(data);
      }
      break;
      
    default:
      console.log('Unhandled ticket update type:', data.type);
  }
}

// Handle real-time service updates
function handleServiceUpdate(data) {
  console.log('🏥 Received real-time service update:', data);
  
  switch (data.type) {
    case 'queue_update':
      if (data.event === 'position_change' && currentTicket) {
        // Update position from queue data
        updatePositionFromQueueData(data.data);
      }
      break;
      
    case 'patient_called':
      if (data.data.ticket_number === currentTicket?.ticket_number) {
        // This patient was called!
        handlePatientCalled();
      } else {
        // Someone else was called, update positions
        refreshTicketData();
      }
      break;
      
    default:
      console.log('Unhandled service update type:', data.type);
  }
}

// Update ticket data from real-time WebSocket data
function updateTicketFromRealTimeData(data) {
  if (!currentTicket) return;
  
  let updated = false;
  
  // Update position
  if (data.position_in_queue !== undefined && data.position_in_queue !== currentTicket.position_in_queue) {
    currentTicket.position_in_queue = data.position_in_queue;
    updated = true;
  }
  
  // Update estimated wait time
  if (data.estimated_wait_time !== undefined && data.estimated_wait_time !== currentTicket.estimated_wait_time) {
    currentTicket.estimated_wait_time = data.estimated_wait_time;
    updated = true;
  }
  
  // Update status
  if (data.status && data.status !== currentTicket.status) {
    currentTicket.status = data.status;
    updated = true;
    
    // Show notification for status change
    if (window.MessageManager) {
      const statusMessages = {
        'consulting': '🎉 C\'est votre tour! Présentez-vous au service.',
        'completed': '✅ Votre consultation est terminée.',
        'cancelled': '❌ Votre ticket a été annulé.'
      };
      
      const message = statusMessages[data.status] || `Statut mis à jour: ${data.status}`;
      window.MessageManager.info(message, { duration: 5000 });
    }
  }
  
  if (updated) {
    console.log('🔄 Ticket updated from real-time data');
    displayCurrentTicket();
    
    // Check for alerts
    checkAlerts();
  }
}

// Update position from queue data
function updatePositionFromQueueData(queueData) {
  if (!currentTicket || !queueData.queue) return;
  
  // Find this ticket in the queue data
  const ticketInQueue = queueData.queue.find(item => 
    item.ticket_number === currentTicket.ticket_number
  );
  
  if (ticketInQueue && ticketInQueue.position !== currentTicket.position_in_queue) {
    currentTicket.position_in_queue = ticketInQueue.position;
    currentTicket.estimated_wait_time = ticketInQueue.estimated_wait_time;
    
    console.log(`📍 Position updated to: ${ticketInQueue.position}`);
    displayCurrentTicket();
    checkAlerts();
  }
}

// Handle when this patient is called
function handlePatientCalled() {
  currentTicket.status = 'consulting';
  displayCurrentTicket();
  
  // Show prominent notification
  if (window.MessageManager) {
    window.MessageManager.success('🎉 C\'est votre tour!', {
      title: 'Patient Appelé',
      duration: 10000,
      persistent: true,
      actions: [
        {
          text: 'J\'y vais!',
          primary: true,
          callback: () => {
            // Optionally redirect or update UI
          }
        }
      ]
    });
  }
  
  // Update UI to show consulting status
  updateTicketStatus('consulting');
}

// Clean up WebSocket connections
function cleanupRealTimeUpdates() {
  if (window.wsClient && currentTicket) {
    wsClient.disconnect(`ticket_${currentTicket.ticket_number}`);
    if (currentTicket.service_id) {
      wsClient.disconnect(`service_${currentTicket.service_id}`);
    }
    console.log('🔌 Real-time connections cleaned up');
  }
}

// Clean up on page unload
window.addEventListener('beforeunload', cleanupRealTimeUpdates);

// Exposer les fonctions globalement
window.closeModal = closeModal;
window.handleLogout = handleLogout;
window.refreshTicketData = refreshTicketData;
window.refreshTicket = refreshTicket;
window.shareTicket = shareTicket;
window.printTicket = printTicket;
window.filterHistory = filterHistory;
