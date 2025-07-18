/**
 * WebSocket Client for Real-time Updates
 * Handles live queue updates, ticket status changes, and admin dashboard updates
 */

class WebSocketClient {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.connections = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        this.pingInterval = 30000; // 30 seconds
        this.pingTimers = new Map();
        this.isConnected = false;
        
        // Event listeners
        this.eventListeners = new Map();
        
        // Connection status indicator
        this.createConnectionIndicator();
    }
    
    // Get WebSocket URL from API URL
    getWebSocketURL() {
        const apiUrl = this.apiClient.baseURL;
        const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
        return `${wsUrl}/ws`;
    }
    
    // Connect to service queue updates
    connectToService(serviceId, onUpdate = null) {
        const wsUrl = `${this.getWebSocketURL()}/service/${serviceId}`;
        const connectionKey = `service_${serviceId}`;
        
        // Close existing connection if any
        this.disconnect(connectionKey);
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log(`🔗 Connected to service ${serviceId} updates`);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionIndicator(true);
            
            // Start ping to keep connection alive
            this.startPing(connectionKey, ws);
            
            // Trigger connection event
            this.triggerEvent('service_connected', { serviceId });
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServiceMessage(serviceId, data, onUpdate);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        ws.onclose = (event) => {
            console.log(`🔌 Service ${serviceId} WebSocket closed:`, event.code, event.reason);
            this.isConnected = false;
            this.updateConnectionIndicator(false);
            this.stopPing(connectionKey);
            
            // Attempt reconnection
            this.scheduleReconnect(() => this.connectToService(serviceId, onUpdate));
        };
        
        ws.onerror = (error) => {
            console.error(`❌ Service ${serviceId} WebSocket error:`, error);
            this.updateConnectionIndicator(false, 'error');
        };
        
        this.connections.set(connectionKey, ws);
        return ws;
    }
    
    // Connect to specific ticket updates
    connectToTicket(ticketNumber, onUpdate = null) {
        const wsUrl = `${this.getWebSocketURL()}/ticket/${ticketNumber}`;
        const connectionKey = `ticket_${ticketNumber}`;
        
        this.disconnect(connectionKey);
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log(`🎫 Connected to ticket ${ticketNumber} updates`);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionIndicator(true);
            this.startPing(connectionKey, ws);
            this.triggerEvent('ticket_connected', { ticketNumber });
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleTicketMessage(ticketNumber, data, onUpdate);
            } catch (error) {
                console.error('Error parsing ticket WebSocket message:', error);
            }
        };
        
        ws.onclose = (event) => {
            console.log(`🔌 Ticket ${ticketNumber} WebSocket closed`);
            this.isConnected = false;
            this.updateConnectionIndicator(false);
            this.stopPing(connectionKey);
            this.scheduleReconnect(() => this.connectToTicket(ticketNumber, onUpdate));
        };
        
        ws.onerror = (error) => {
            console.error(`❌ Ticket ${ticketNumber} WebSocket error:`, error);
            this.updateConnectionIndicator(false, 'error');
        };
        
        this.connections.set(connectionKey, ws);
        return ws;
    }
    
    // Connect to admin dashboard updates
    connectToAdminDashboard(onUpdate = null) {
        const wsUrl = `${this.getWebSocketURL()}/admin/dashboard`;
        const connectionKey = 'admin_dashboard';
        
        this.disconnect(connectionKey);
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('📊 Connected to admin dashboard updates');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionIndicator(true);
            this.startPing(connectionKey, ws);
            this.triggerEvent('dashboard_connected');
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleDashboardMessage(data, onUpdate);
            } catch (error) {
                console.error('Error parsing dashboard WebSocket message:', error);
            }
        };
        
        ws.onclose = (event) => {
            console.log('🔌 Admin dashboard WebSocket closed');
            this.isConnected = false;
            this.updateConnectionIndicator(false);
            this.stopPing(connectionKey);
            this.scheduleReconnect(() => this.connectToAdminDashboard(onUpdate));
        };
        
        ws.onerror = (error) => {
            console.error('❌ Admin dashboard WebSocket error:', error);
            this.updateConnectionIndicator(false, 'error');
        };
        
        this.connections.set(connectionKey, ws);
        return ws;
    }
    
    // Handle service messages
    handleServiceMessage(serviceId, data, onUpdate) {
        switch (data.type) {
            case 'initial_queue_state':
                console.log(`📋 Initial queue state for service ${serviceId}:`, data);
                this.triggerEvent('queue_initial_state', { serviceId, data });
                break;
                
            case 'queue_update':
                console.log(`🔄 Queue update for service ${serviceId}:`, data);
                this.triggerEvent('queue_updated', { serviceId, data });
                this.showQueueUpdateNotification(data);
                break;
                
            case 'patient_called':
                console.log(`📢 Patient called in service ${serviceId}:`, data);
                this.triggerEvent('patient_called', { serviceId, data });
                this.showPatientCalledNotification(data);
                break;
                
            case 'emergency_alert':
                console.log(`🚨 Emergency alert for service ${serviceId}:`, data);
                this.triggerEvent('emergency_alert', { serviceId, data });
                this.showEmergencyAlert(data);
                break;
                
            case 'connection_established':
                console.log(`✅ Service ${serviceId} connection established`);
                break;
                
            case 'pong':
                // Keep-alive response
                break;
                
            default:
                console.log(`📦 Unhandled service message type: ${data.type}`, data);
        }
        
        // Call custom update handler if provided
        if (onUpdate && typeof onUpdate === 'function') {
            onUpdate(data);
        }
    }
    
    // Handle ticket messages
    handleTicketMessage(ticketNumber, data, onUpdate) {
        switch (data.type) {
            case 'initial_ticket_state':
                console.log(`🎫 Initial ticket state for ${ticketNumber}:`, data);
                this.triggerEvent('ticket_initial_state', { ticketNumber, data });
                break;
                
            case 'ticket_update':
                console.log(`🔄 Ticket update for ${ticketNumber}:`, data);
                this.triggerEvent('ticket_updated', { ticketNumber, data });
                this.showTicketUpdateNotification(data);
                break;
                
            case 'ticket_connection_established':
                console.log(`✅ Ticket ${ticketNumber} connection established`);
                break;
                
            case 'pong':
                break;
                
            default:
                console.log(`📦 Unhandled ticket message type: ${data.type}`, data);
        }
        
        if (onUpdate && typeof onUpdate === 'function') {
            onUpdate(data);
        }
    }
    
    // Handle dashboard messages
    handleDashboardMessage(data, onUpdate) {
        switch (data.type) {
            case 'initial_dashboard_state':
                console.log('📊 Initial dashboard state:', data);
                this.triggerEvent('dashboard_initial_state', { data });
                break;
                
            case 'queue_update':
                console.log('📊 Dashboard queue update:', data);
                this.triggerEvent('dashboard_queue_updated', { data });
                break;
                
            case 'admin_connection_established':
                console.log('✅ Admin dashboard connection established');
                break;
                
            case 'pong':
                break;
                
            default:
                console.log(`📦 Unhandled dashboard message type: ${data.type}`, data);
        }
        
        if (onUpdate && typeof onUpdate === 'function') {
            onUpdate(data);
        }
    }
    
    // Start ping to keep connection alive
    startPing(connectionKey, ws) {
        const timer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            } else {
                clearInterval(timer);
            }
        }, this.pingInterval);
        
        this.pingTimers.set(connectionKey, timer);
    }
    
    // Stop ping timer
    stopPing(connectionKey) {
        const timer = this.pingTimers.get(connectionKey);
        if (timer) {
            clearInterval(timer);
            this.pingTimers.delete(connectionKey);
        }
    }
    
    // Schedule reconnection
    scheduleReconnect(reconnectFunc) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
            
            console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
            
            setTimeout(() => {
                reconnectFunc();
            }, delay);
        } else {
            console.log('❌ Max reconnection attempts reached');
            this.updateConnectionIndicator(false, 'failed');
        }
    }
    
    // Disconnect specific connection
    disconnect(connectionKey) {
        const ws = this.connections.get(connectionKey);
        if (ws) {
            this.stopPing(connectionKey);
            ws.close();
            this.connections.delete(connectionKey);
        }
    }
    
    // Disconnect all connections
    disconnectAll() {
        for (const [key, ws] of this.connections) {
            this.stopPing(key);
            ws.close();
        }
        this.connections.clear();
        this.isConnected = false;
        this.updateConnectionIndicator(false);
    }
    
    // Send admin action through WebSocket
    sendAdminAction(action, data = {}) {
        const adminWs = this.connections.get('admin_dashboard');
        if (adminWs && adminWs.readyState === WebSocket.OPEN) {
            const message = {
                type: action,
                ...data,
                timestamp: new Date().toISOString()
            };
            adminWs.send(JSON.stringify(message));
            return true;
        }
        return false;
    }
    
    // Event system
    addEventListener(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
    
    removeEventListener(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    triggerEvent(event, data = {}) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
    
    // Connection status indicator
    createConnectionIndicator() {
        if (document.getElementById('ws-connection-indicator')) return;
        
        const indicator = document.createElement('div');
        indicator.id = 'ws-connection-indicator';
        indicator.className = 'ws-connection-indicator disconnected';
        indicator.innerHTML = `
            <div class="ws-indicator-dot"></div>
            <span class="ws-indicator-text">Déconnecté</span>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .ws-connection-indicator {
                position: fixed;
                top: 10px;
                right: 10px;
                background: white;
                border-radius: 20px;
                padding: 8px 15px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                font-weight: 500;
                z-index: 10000;
                transition: all 0.3s ease;
            }
            
            .ws-indicator-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                transition: background-color 0.3s ease;
            }
            
            .ws-connection-indicator.connected .ws-indicator-dot {
                background-color: #28a745;
            }
            
            .ws-connection-indicator.disconnected .ws-indicator-dot {
                background-color: #dc3545;
            }
            
            .ws-connection-indicator.error .ws-indicator-dot {
                background-color: #ffc107;
            }
            
            .ws-connection-indicator.failed .ws-indicator-dot {
                background-color: #6c757d;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(indicator);
    }
    
    updateConnectionIndicator(connected, status = null) {
        const indicator = document.getElementById('ws-connection-indicator');
        if (!indicator) return;
        
        indicator.className = 'ws-connection-indicator';
        
        if (connected) {
            indicator.classList.add('connected');
            indicator.querySelector('.ws-indicator-text').textContent = 'Connecté';
        } else if (status === 'error') {
            indicator.classList.add('error');
            indicator.querySelector('.ws-indicator-text').textContent = 'Erreur';
        } else if (status === 'failed') {
            indicator.classList.add('failed');
            indicator.querySelector('.ws-indicator-text').textContent = 'Échoué';
        } else {
            indicator.classList.add('disconnected');
            indicator.querySelector('.ws-indicator-text').textContent = 'Déconnecté';
        }
    }
    
    // Notification methods
    showQueueUpdateNotification(data) {
        if (data.event === 'position_change') {
            MessageManager.show('info', `Mise à jour de la file: ${data.data.total_waiting} personnes en attente`, 3000);
        }
    }
    
    showPatientCalledNotification(data) {
        MessageManager.show('success', `Patient appelé: ${data.data.patient_name}`, 5000);
    }
    
    showTicketUpdateNotification(data) {
        if (data.event === 'status_change') {
            const message = data.data.message || `Statut du ticket mis à jour: ${data.data.status}`;
            MessageManager.show('info', message, 4000);
        }
    }
    
    showEmergencyAlert(data) {
        MessageManager.show('error', `🚨 URGENCE: ${data.data.message}`, 10000);
    }
    
    // Utility methods
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            activeConnections: this.connections.size,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

// Create global WebSocket client instance
const wsClient = new WebSocketClient(apiClient);

// Export for use in other files
window.wsClient = wsClient;