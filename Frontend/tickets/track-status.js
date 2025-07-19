// Track Status JavaScript
let currentTicketNumber = null;
let stopTrackingFunction = null;
let isAutoUpdateEnabled = false;

// Track ticket function
async function trackTicket() {
    const ticketInput = document.getElementById('ticketNumber');
    const ticketNumber = ticketInput.value.trim();
    
    if (!ticketNumber) {
        APIUtils.showNotification('Veuillez entrer un numéro de ticket', 'error');
        return;
    }
    
    currentTicketNumber = ticketNumber;
    showStatusDisplay();
    showLoadingState();
    
    try {
        const ticket = await apiClient.getTicketStatus(ticketNumber);
        displayTicketInfo(ticket);
    } catch (error) {
        console.error('Error tracking ticket:', error);
        showErrorState();
    }
}

// Show status display section
function showStatusDisplay() {
    document.getElementById('statusDisplay').style.display = 'block';
    document.getElementById('statusDisplay').scrollIntoView({ behavior: 'smooth' });
}

// Show loading state
function showLoadingState() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('ticketInfo').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
}

// Display ticket information
function displayTicketInfo(ticket) {
    // Hide loading and error states
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('ticketInfo').style.display = 'block';
    
    // Update ticket details
    document.getElementById('ticketNumberDisplay').textContent = ticket.ticket_number;
    document.getElementById('serviceName').textContent = ticket.service?.name || 'Service inconnu';
    document.getElementById('queuePosition').textContent = ticket.position_in_queue || 'N/A';
    document.getElementById('waitTime').textContent = ticket.estimated_wait_time ? 
        APIUtils.formatWaitTime(ticket.estimated_wait_time) : 'N/A';
    
    // Update status badge
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = getStatusText(ticket.status);
    statusBadge.className = `status-badge ${ticket.status}`;
    
    // Update last update time
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('fr-FR');
    
    // Show notification for important status changes
    if (ticket.status === 'waiting' && ticket.position_in_queue === 1) {
        APIUtils.showNotification('🔔 Votre tour est arrivé ! Présentez-vous au service.', 'success');
    }
}

// Show error state
function showErrorState() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('ticketInfo').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
}

// Get status text in French
  function getStatusText(status) {
      const statusMap = {
          'waiting': 'En Attente',
          'completed': 'Terminé',
          'cancelled': 'Annulé'
      };
    return statusMap[status] || status;
}

// Toggle auto update
function toggleAutoUpdate() {
    const btn = document.getElementById('autoUpdateBtn');
    
    if (!isAutoUpdateEnabled) {
        // Start auto update
        if (currentTicketNumber) {
            stopTrackingFunction = APIUtils.startStatusTracking(
                currentTicketNumber, 
                displayTicketInfo,
                30000 // Update every 30 seconds
            );
            
            isAutoUpdateEnabled = true;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Mise à jour Auto: ON';
            btn.classList.add('active');
            APIUtils.showNotification('Mise à jour automatique activée (30s)', 'info');
        } else {
            APIUtils.showNotification('Aucun ticket à suivre', 'error');
        }
    } else {
        // Stop auto update
        if (stopTrackingFunction) {
            stopTrackingFunction();
            stopTrackingFunction = null;
        }
        
        isAutoUpdateEnabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Mise à jour Auto: OFF';
        btn.classList.remove('active');
        APIUtils.showNotification('Mise à jour automatique désactivée', 'info');
    }
}

// Refresh status manually
async function refreshStatus() {
    if (!currentTicketNumber) {
        APIUtils.showNotification('Aucun ticket à actualiser', 'error');
        return;
    }
    
    try {
        const ticket = await apiClient.getTicketStatus(currentTicketNumber);
        displayTicketInfo(ticket);
        APIUtils.showNotification('Statut actualisé', 'success');
    } catch (error) {
        console.error('Error refreshing status:', error);
        APIUtils.showNotification('Erreur lors de l\'actualisation', 'error');
    }
}

// Handle Enter key in ticket input
document.addEventListener('DOMContentLoaded', function() {
    const ticketInput = document.getElementById('ticketNumber');
    
    ticketInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            trackTicket();
        }
    });
    
    // Check for ticket number in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const ticketFromUrl = urlParams.get('ticket');
    if (ticketFromUrl) {
        ticketInput.value = ticketFromUrl;
        trackTicket();
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    if (stopTrackingFunction) {
        stopTrackingFunction();
    }
}); 