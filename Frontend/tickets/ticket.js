// Variables globales
let currentTicket = null;
let updateInterval = null;
let ticketsHistory = [];
let currentFilter = 'all';

// Track current ticket and queue status
let currentTicket = null;
let ticketCache = new Map();
let wsConnection = null;
let isWebSocketConnected = false;

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
  
  // Check for ticket parameter in URL or sessionStorage (from QR scan)
  const urlParams = new URLSearchParams(window.location.search);
  const ticketParam = urlParams.get('ticket');
  const sessionTicket = sessionStorage.getItem('currentTicketNumber');
  
  if (ticketParam) {
    // Load specific ticket from URL parameter
    console.log('Loading ticket from URL parameter:', ticketParam);
    await loadTicketByNumber(ticketParam);
  } else if (sessionTicket) {
    // Load ticket from QR scan redirection
    console.log('Loading ticket from QR scan session:', sessionTicket);
    await loadTicketByNumber(sessionTicket);
    // Clear the session storage after loading
    sessionStorage.removeItem('currentTicketNumber');
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
      
      // Find the most recent active ticket (waiting only)
      const activeTicket = tickets.find(ticket => 
        ticket.status === 'waiting'
      );
      
      if (activeTicket) {
        currentTicket = activeTicket;
        displayCurrentTicket();
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
        // Ticket should be considered done, show completed state
        showCompletedState();
      } else {
        // Ticket is active, display it and connect WebSocket
        displayCurrentTicket();
        initializeWebSocket();
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
        if (currentTicket.status === 'waiting') {
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
  
  // Special handling for position 1 (your turn)
  if (currentTicket.status === 'waiting' && currentTicket.position_in_queue === 1) {
    // Show "your turn" status with appropriate messaging
    displayYourTurnStatus();
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
  
  // Check if it's the patient's turn (position 1)
  if (currentTicket.position_in_queue === 1 && currentTicket.status === 'waiting') {
    showTurnNotification();
  } else {
    hideTurnNotification();
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

// Show turn notification when it's the patient's turn
function showTurnNotification() {
  const turnNotification = document.getElementById('turnNotification');
  if (turnNotification) {
    turnNotification.style.display = 'flex';
    
    // Play sound notification if available
    playNotificationSound();
    
    // Hide the regular alert notification when showing turn notification
    const regularAlert = document.getElementById('notificationAlert');
    if (regularAlert) {
      regularAlert.style.display = 'none';
    }
    
    // Auto-scroll to the notification
    setTimeout(() => {
      turnNotification.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 500);
  }
}

// Hide turn notification
function hideTurnNotification() {
  const turnNotification = document.getElementById('turnNotification');
  if (turnNotification) {
    turnNotification.style.display = 'none';
  }
}

// Play notification sound
function playNotificationSound() {
  // Create audio context for notification sound
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.log('Audio notification not available');
  }
}

// Confirm presence - called when patient clicks confirmation button
async function confirmPresence() {
  try {
    APIUtils.showNotification('Confirmation envoyée...', 'info');
    
    // Hide the turn notification
    hideTurnNotification();
    
    // Update local status to show patient is heading to secretary
    const mainCard = document.getElementById('mainTicketCard');
    if (mainCard) {
      // Add a "heading to secretary" status display
      const headingMessage = document.createElement('div');
      headingMessage.className = 'heading-status';
      headingMessage.innerHTML = `
        <div class="heading-message">
          <i class="fas fa-walking"></i>
          <h3>En route vers le secrétariat</h3>
          <p>Merci d'avoir confirmé. Dirigez-vous maintenant vers le secrétariat.</p>
          <div class="countdown-timer">
            <i class="fas fa-hourglass-half"></i>
            <span>Temps restant: <strong id="countdownTime">60</strong> secondes</span>
          </div>
        </div>
      `;
      
      // Insert after the ticket info section
      const ticketInfo = mainCard.querySelector('.ticket-info');
      if (ticketInfo) {
        ticketInfo.after(headingMessage);
      }
      
      // Start countdown timer
      startCountdownTimer();
    }
    
    APIUtils.showNotification('Dirigez-vous vers le secrétariat maintenant !', 'success');
  } catch (error) {
    console.error('Error confirming presence:', error);
    APIUtils.showNotification('Erreur lors de la confirmation', 'error');
  }
}

// Start countdown timer (1 minute)
function startCountdownTimer() {
  let timeLeft = 60;
  const countdownElement = document.getElementById('countdownTime');
  
  const timer = setInterval(() => {
    timeLeft--;
    if (countdownElement) {
      countdownElement.textContent = timeLeft;
      
      // Change color when time is running out
      if (timeLeft <= 10) {
        countdownElement.style.color = '#dc3545';
        countdownElement.parentElement.style.animation = 'pulse 0.5s infinite';
      }
    }
    
    if (timeLeft <= 0) {
      clearInterval(timer);
      // Auto-refresh the ticket data when time is up
      refreshTicketData();
    }
  }, 1000);
}

// Display "your turn" status with appropriate messaging
function displayYourTurnStatus() {
  const mainCard = document.getElementById('mainTicketCard');
  if (!mainCard) return;
  
  mainCard.innerHTML = `
    <div class="ticket-card-header">
      <div class="ticket-number">
        <h2 id="ticketNumber">${currentTicket.ticket_number}</h2>
        <span class="ticket-status waiting" id="ticketStatus">C'est votre tour !</span>
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

    <div class="your-turn-status">
      <div class="your-turn-message">
        <i class="fas fa-bell"></i>
        <h3>C'est votre tour !</h3>
        <p>Présentez-vous au service. Votre ticket a été appelé.</p>
      </div>
      
      <div class="your-turn-actions">
        <button class="action-btn refresh-btn" onclick="refreshTicket()">
          <i class="fas fa-sync-alt"></i>
          Actualiser
        </button>
      </div>
    </div>
  `;
}

// Show completed state when ticket is done
function showCompletedState() {
  const mainCard = document.getElementById('mainTicketCard');
  if (mainCard) {
    mainCard.innerHTML = `
      <div class="empty-state completed">
        <i class="fas fa-check-circle"></i>
        <h3>Votre consultation est terminée</h3>
        <p>Merci de votre patience ! Votre ticket a été traité avec succès.</p>
        <div class="empty-state-actions">
          <a href="../qr code/qr.html" class="btn primary-btn">Nouveau ticket</a>
          <a href="../Acceuil/acceuil.html" class="btn secondary-btn">Retour à l'accueil</a>
        </div>
      </div>
    `;
  }
  
  // Disconnect WebSocket
  if (wsConnection) {
    wsClient.disconnectAll();
    wsConnection = null;
    isWebSocketConnected = false;
  }
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

  // Disconnect WebSocket on page unload
  window.addEventListener('beforeunload', () => {
    if (wsConnection) {
      wsClient.disconnectAll();
    }
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
          
          // Check if this was a completion (status changed from waiting to completed)
          const wasCompleted = ticketStatus.status === 'completed' && 
                             currentTicket && 
                             currentTicket.status === 'waiting';
          
          currentTicket = null;
          
          if (wasCompleted) {
            showEmptyState();
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
      // Filter for active tickets (waiting only)
      filteredTickets = ticketsHistory.filter(ticket => 
        ticket.status === 'waiting'
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

// Exposer les fonctions globalement
window.closeModal = closeModal;
window.handleLogout = handleLogout;
window.refreshTicketData = refreshTicketData;
window.refreshTicket = refreshTicket;
window.shareTicket = shareTicket;
window.printTicket = printTicket;
window.filterHistory = filterHistory;
window.confirmPresence = confirmPresence;

// Initialize WebSocket connection for real-time updates
function initializeWebSocket() {
  if (!currentTicket || !currentTicket.service_id) {
    console.log('No ticket or service ID available for WebSocket connection');
    return;
  }
  
  // Disconnect existing connection if any
  if (wsConnection) {
    wsClient.disconnect(`service_${currentTicket.service_id}`);
    wsConnection = null;
  }
  
  console.log(`Initializing WebSocket for service ${currentTicket.service_id} and ticket ${currentTicket.ticket_number}`);
  
  // Connect to service updates
  wsConnection = wsClient.connectToService(currentTicket.service_id, handleRealtimeUpdate);
  
  // Also connect to specific ticket updates
  wsClient.connectToTicket(currentTicket.ticket_number, handleTicketUpdate);
  
  // Add event listeners for queue updates
  wsClient.addEventListener('queue_updated', handleQueueUpdate);
  wsClient.addEventListener('patient_called', handlePatientCalled);
  wsClient.addEventListener('ticket_updated', handleTicketStatusUpdate);
  
  isWebSocketConnected = true;
}

// Handle real-time updates from WebSocket
function handleRealtimeUpdate(data) {
  console.log('Received real-time update:', data);
  
  if (data.type === 'queue_update' && data.event === 'position_change') {
    // Update queue positions for all waiting tickets
    if (data.data && data.data.queue) {
      const myTicketUpdate = data.data.queue.find(t => t.ticket_number === currentTicket.ticket_number);
      if (myTicketUpdate) {
        currentTicket.position_in_queue = myTicketUpdate.position;
        currentTicket.estimated_wait_time = myTicketUpdate.estimated_wait_time;
        
        // Check if it's our turn
        if (myTicketUpdate.position === 1) {
          displayYourTurnStatus();
        } else {
          displayCurrentTicket();
        }
      }
    }
  }
}

// Handle specific ticket updates
function handleTicketUpdate(data) {
  console.log('Received ticket update:', data);
  
  if (data.type === 'ticket_update' && data.event === 'status_change') {
    if (data.data && data.data.status) {
      currentTicket.status = data.data.status;
      
      // If ticket is completed, show thank you page
      if (data.data.status === 'completed') {
        showCompletedState();
      } else {
        displayCurrentTicket();
      }
    }
  }
}

// Handle queue updates
function handleQueueUpdate(event) {
  console.log('Queue updated event:', event);
  
  if (event.serviceId === currentTicket.service_id && event.data) {
    handleRealtimeUpdate(event.data);
  }
}

// Handle patient called event
function handlePatientCalled(event) {
  console.log('Patient called event:', event);
  
  if (event.data && event.data.ticket_number === currentTicket.ticket_number) {
    // This ticket was called and completed
    currentTicket.status = 'completed';
    showCompletedState();
  } else if (event.serviceId === currentTicket.service_id) {
    // Another patient was called, refresh our position
    refreshTicket();
  }
}

// Handle ticket status update
function handleTicketStatusUpdate(event) {
  console.log('Ticket status updated:', event);
  
  if (event.ticketNumber === currentTicket.ticket_number && event.data) {
    handleTicketUpdate(event.data);
  }
}

// Show completed state when ticket is done
function showCompletedState() {
  const mainCard = document.getElementById('mainTicketCard');
  if (mainCard) {
    mainCard.innerHTML = `
      <div class="empty-state completed">
        <i class="fas fa-check-circle"></i>
        <h3>Votre consultation est terminée</h3>
        <p>Merci de votre patience ! Votre ticket a été traité avec succès.</p>
        <div class="empty-state-actions">
          <a href="../qr code/qr.html" class="btn primary-btn">Nouveau ticket</a>
          <a href="../Acceuil/acceuil.html" class="btn secondary-btn">Retour à l'accueil</a>
        </div>
      </div>
    `;
  }
  
  // Disconnect WebSocket
  if (wsConnection) {
    wsClient.disconnectAll();
    wsConnection = null;
    isWebSocketConnected = false;
  }
}
