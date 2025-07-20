// Track Status JavaScript
let currentTicketNumber = null;
let stopTrackingFunction = null;
let isAutoUpdateEnabled = false;
let wsConnected = false;

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
        
        // Connect to real-time updates for this ticket
        connectToRealTimeUpdates(ticketNumber);
        
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
    disconnectFromRealTimeUpdates();
}); 

// Connect to real-time updates via WebSocket
function connectToRealTimeUpdates(ticketNumber) {
    if (window.wsClient && !wsConnected) {
        try {
            // Connect to ticket-specific updates
            window.wsClient.connectToTicket(ticketNumber, handleRealTimeUpdate);
            
            // Listen for specific events
            window.wsClient.addEventListener('ticket_updated', ({ ticketNumber: updatedTicket, data }) => {
                if (updatedTicket === currentTicketNumber) {
                    console.log('📱 Received real-time ticket update:', data);
                    handleTicketUpdate(data);
                }
            });
            
            wsConnected = true;
            console.log('🔗 Connected to real-time updates for ticket:', ticketNumber);
            
            // Show connection indicator
            showConnectionStatus(true);
            
        } catch (error) {
            console.error('Failed to connect to real-time updates:', error);
            showConnectionStatus(false);
        }
    }
}

// Handle real-time updates
function handleRealTimeUpdate(data) {
    console.log('📡 Real-time update received:', data);
    
    if (data.type === 'ticket_update' && data.event === 'status_change') {
        handleTicketUpdate(data.data);
    }
}

// Handle ticket updates from WebSocket
function handleTicketUpdate(updateData) {
    console.log('🔄 Processing ticket update:', updateData);
    
    // Update position
    if (updateData.position !== undefined) {
        document.getElementById('queuePosition').textContent = updateData.position;
    }
    
    // Update wait time
    if (updateData.estimated_wait_time !== undefined) {
        document.getElementById('waitTime').textContent = APIUtils.formatWaitTime(updateData.estimated_wait_time);
    }
    
    // Update status
    if (updateData.status) {
        const statusBadge = document.getElementById('statusBadge');
        statusBadge.textContent = getStatusText(updateData.status);
        statusBadge.className = `status-badge ${updateData.status}`;
    }
    
    // Update last update time
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('fr-FR');
    
    // Show notification for important updates
    if (updateData.message) {
        APIUtils.showNotification(updateData.message, updateData.completed ? 'success' : 'info');
    }
    
    // Special handling for "your turn" scenario
    if (updateData.position === 1 && updateData.status === 'waiting') {
        APIUtils.showNotification('🔔 C\'est votre tour ! Présentez-vous au service.', 'success');
        // Could add sound or more prominent visual indicator here
    }
    
    // Handle completion
    if (updateData.completed || updateData.status === 'completed') {
        APIUtils.showNotification('✅ Consultation terminée. Merci !', 'success');
        // Disconnect from updates since ticket is done
        disconnectFromRealTimeUpdates();
    }
}

// Show connection status
function showConnectionStatus(connected) {
    let indicator = document.getElementById('connectionIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'connectionIndicator';
        indicator.className = 'connection-indicator';
        document.querySelector('.realtime-section').appendChild(indicator);
    }
    
    if (connected) {
        indicator.innerHTML = '<i class="fas fa-wifi"></i> Mises à jour en temps réel actives';
        indicator.className = 'connection-indicator connected';
    } else {
        indicator.innerHTML = '<i class="fas fa-wifi"></i> Mises à jour manuelles seulement';
        indicator.className = 'connection-indicator disconnected';
    }
}

// Disconnect from real-time updates
function disconnectFromRealTimeUpdates() {
    if (window.wsClient && currentTicketNumber) {
        window.wsClient.disconnect(`ticket_${currentTicketNumber}`);
        wsConnected = false;
        showConnectionStatus(false);
        console.log('🔌 Disconnected from real-time updates');
    }
} 