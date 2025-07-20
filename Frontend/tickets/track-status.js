// Track Status JavaScript
let currentTicketNumber = null;
let stopTrackingFunction = null;
let isAutoUpdateEnabled = false;
let wsConnection = null;

// Initialize WebSocket for real-time updates
function initializeWebSocket(ticketNumber) {
    // Disconnect existing connection if any
    if (wsConnection) {
        wsClient.disconnect(`ticket_${currentTicketNumber}`);
        wsConnection = null;
    }
    
    // Connect to ticket updates
    wsConnection = wsClient.connectToTicket(ticketNumber, handleRealtimeUpdate);
    
    // Add event listeners
    wsClient.addEventListener('ticket_updated', handleTicketUpdate);
}

// Handle real-time updates
function handleRealtimeUpdate(data) {
    console.log('Real-time update received:', data);
    
    if (data.type === 'ticket_update' && data.event === 'status_change') {
        // Update the display with new data
        if (data.data) {
            const ticketInfo = {
                ticket_number: currentTicketNumber,
                status: data.data.status,
                position_in_queue: data.data.position || 'N/A',
                estimated_wait_time: data.data.estimated_wait_time || 0,
                service: { name: document.getElementById('serviceName').textContent }
            };
            
            displayTicketInfo(ticketInfo);
            
            // Show notification if it's their turn
            if (data.data.position === 1 && data.data.status === 'waiting') {
                APIUtils.showNotification('🔔 C\'est votre tour ! Présentez-vous au service.', 'success');
            } else if (data.data.status === 'completed') {
                APIUtils.showNotification('✅ Votre consultation est terminée. Merci !', 'success');
            }
        }
    }
}

// Handle ticket update event
function handleTicketUpdate(event) {
    if (event.ticketNumber === currentTicketNumber && event.data) {
        handleRealtimeUpdate(event.data);
    }
}

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
        
        // Initialize WebSocket for real-time updates
        initializeWebSocket(ticketNumber);
        
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
    
    // Show appropriate message based on status
    if (ticket.status === 'completed') {
        // Show completed state
        document.getElementById('ticketInfo').innerHTML = `
            <div class="completed-state">
                <i class="fas fa-check-circle"></i>
                <h3>Consultation terminée</h3>
                <p>Votre ticket ${ticket.ticket_number} a été traité avec succès.</p>
                <p>Merci de votre patience !</p>
            </div>
        `;
    } else if (ticket.status === 'waiting' && ticket.position_in_queue === 1) {
        // Show "your turn" state
        APIUtils.showNotification('🔔 C\'est votre tour ! Présentez-vous au service.', 'success');
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
    if (wsConnection) {
        wsClient.disconnectAll();
    }
}); 