/**
 * Enhanced Dashboard with Real-time Updates
 * Beautiful UX with WebSocket integration and loading states
 */

class DashboardManager {
    constructor() {
        this.dashboardData = {
            stats: {
                total_waiting: 0,
                total_consulting: 0,
                active_services: 0,
                avg_wait_time: 0
            },
            services: [],
            alerts: [],
            connection_stats: {}
        };
        
        this.refreshInterval = null;
        this.isRealTimeEnabled = false;
        this.lastUpdateTime = null;
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing Enhanced Dashboard...');
        
        // Check authentication
        if (!this.checkAuth()) return;
        
        // Setup UI components
        this.setupEventListeners();
        
        // Load initial data
        await this.loadInitialData();
        
        // Setup real-time updates
        this.setupRealTimeUpdates();
        
        // Start periodic refresh as backup
        this.startPeriodicRefresh();
        
        console.log('✅ Dashboard Enhanced loaded successfully');
    }
    
    checkAuth() {
        if (!apiClient.isAuthenticated()) {
            MessageManager.error('Vous devez être connecté pour accéder au dashboard');
            setTimeout(() => {
                window.location.href = '../Acceuil/acceuil.html';
            }, 2000);
            return false;
        }
        
        const user = apiClient.getCurrentUser();
        if (!user || !apiClient.isStaff()) {
            MessageManager.error('Accès non autorisé. Vous devez être membre du personnel.');
            setTimeout(() => {
                window.location.href = '../Acceuil/acceuil.html';
            }, 2000);
            return false;
        }
        
        return true;
    }
    
    async loadInitialData() {
        const container = document.getElementById('queueList');
        const alertsContainer = document.getElementById('alertsList');
        
        // Show loading states
        LoadingManager.show(container, {
            message: 'Chargement des files d\'attente...',
            type: 'dots'
        });
        
        LoadingManager.showSkeleton(alertsContainer, {
            type: 'list',
            count: 3
        });
        
        try {
            // Load dashboard stats and services
            const [dashboardStats, alerts] = await Promise.all([
                apiClient.getDashboardStats().catch(err => {
                    console.warn('Dashboard stats failed, using fallback:', err);
                    return this.getFallbackStats();
                }),
                apiClient.getAlerts().catch(err => {
                    console.warn('Alerts failed, using fallback:', err);
                    return [];
                })
            ]);
            
            if (dashboardStats) {
                this.dashboardData.stats = dashboardStats;
                this.dashboardData.services = dashboardStats.services || [];
            }
            
            this.dashboardData.alerts = alerts || [];
            
            // Update UI
            this.updateStats();
            this.displayServices();
            this.displayAlerts();
            
            this.lastUpdateTime = new Date();
            this.updateLastRefreshTime();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            MessageManager.error('Erreur lors du chargement des données', {
                duration: 5000,
                actions: [
                    {
                        text: 'Réessayer',
                        primary: true,
                        callback: () => this.loadInitialData()
                    }
                ]
            });
            
            // Show fallback data
            this.showFallbackData();
        } finally {
            LoadingManager.hide(container);
            LoadingManager.hide(alertsContainer);
        }
    }
    
    setupEventListeners() {
        // Handle logout
        window.handleLogout = () => {
            MessageManager.confirm(
                'Déconnexion',
                'Êtes-vous sûr de vouloir vous déconnecter ?',
                async () => {
                    LoadingManager.showGlobal({
                        message: 'Déconnexion en cours...',
                        type: 'dots'
                    });
                    
                    try {
                        await apiClient.logout();
                        window.location.href = '../Acceuil/acceuil.html';
                    } catch (error) {
                        console.error('Logout error:', error);
                        LoadingManager.hideGlobal();
                        MessageManager.error('Erreur lors de la déconnexion');
                    }
                }
            );
        };
        
        // Handle queue actions
        this.setupQueueActions();
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'r':
                        e.preventDefault();
                        this.refreshData();
                        break;
                    case 't':
                        e.preventDefault();
                        this.toggleRealTime();
                        break;
                }
            }
        });
    }
    
    setupQueueActions() {
        // Call next patient function
        window.callNextPatient = async (serviceId, serviceName) => {
            const confirmResult = await new Promise(resolve => {
                MessageManager.confirm(
                    'Appeler le patient suivant',
                    `Voulez-vous appeler le patient suivant pour le service ${serviceName} ?`,
                    () => resolve(true),
                    () => resolve(false)
                );
            });
            
            if (!confirmResult) return;
            
            const button = document.querySelector(`[onclick*="callNextPatient(${serviceId})"]`);
            if (button) {
                LoadingManager.showButtonLoading(button, 'Appel...');
            }
            
            try {
                const result = await apiClient.callNextPatient(serviceId);
                
                MessageManager.success(
                    `Patient ${result.patient_name} appelé avec succès`,
                    { duration: 4000 }
                );
                
                // Refresh data to show updates
                setTimeout(() => this.refreshData(), 1000);
                
            } catch (error) {
                console.error('Error calling next patient:', error);
                MessageManager.error(
                    apiClient.getErrorMessage(error.status || 500),
                    { duration: 5000 }
                );
            } finally {
                if (button) {
                    LoadingManager.hideButtonLoading(button);
                }
            }
        };
    }
    
    setupRealTimeUpdates() {
        try {
            // Connect to admin dashboard WebSocket
            wsClient.connectToAdminDashboard((data) => {
                this.handleRealTimeUpdate(data);
            });
            
            // Listen for WebSocket events
            wsClient.addEventListener('dashboard_connected', () => {
                this.isRealTimeEnabled = true;
                console.log('✅ Real-time updates connected');
            });
            
            wsClient.addEventListener('dashboard_initial_state', ({ data }) => {
                console.log('📊 Received initial dashboard state:', data);
                this.updateDashboardFromWebSocket(data);
            });
            
            wsClient.addEventListener('dashboard_queue_updated', ({ data }) => {
                console.log('🔄 Queue updated via WebSocket:', data);
                this.handleQueueUpdate(data);
            });
            
        } catch (error) {
            console.error('Failed to setup real-time updates:', error);
            this.isRealTimeEnabled = false;
            this.updateRealTimeStatus(false);
        }
    }
    
    handleRealTimeUpdate(data) {
        switch (data.type) {
            case 'initial_dashboard_state':
                this.updateDashboardFromWebSocket(data);
                break;
                
            case 'queue_update':
                this.handleQueueUpdate(data);
                break;
                
            case 'patient_called':
                this.handlePatientCalled(data);
                break;
                
            case 'emergency_alert':
                this.handleEmergencyAlert(data);
                break;
                
            default:
                console.log('🔔 Unhandled real-time update:', data);
        }
        
        this.lastUpdateTime = new Date();
        this.updateLastRefreshTime();
    }
    
    updateDashboardFromWebSocket(data) {
        if (data.stats) {
            this.dashboardData.stats = data.stats;
            this.updateStats();
        }
        
        if (data.services) {
            this.dashboardData.services = data.services;
            this.displayServices();
        }
        
        if (data.connection_stats) {
            this.dashboardData.connection_stats = data.connection_stats;
            this.updateConnectionStats();
        }
    }
    
    handleQueueUpdate(data) {
        // Find and update the specific service
        const serviceIndex = this.dashboardData.services.findIndex(
            s => s.id == data.service_id
        );
        
        if (serviceIndex !== -1 && data.data) {
            if (data.data.total_waiting !== undefined) {
                this.dashboardData.services[serviceIndex].waiting_count = data.data.total_waiting;
            }
            
            // Update overall stats
            this.dashboardData.stats.total_waiting = this.dashboardData.services
                .reduce((sum, s) => sum + (s.waiting_count || 0), 0);
            
            this.updateStats();
            this.displayServices();
        }
        
        // Show notification for position changes
        if (data.event === 'position_change') {
            MessageManager.info(
                `File d'attente mise à jour: ${data.data.total_waiting} personnes en attente`,
                { duration: 2000 }
            );
        }
    }
    
    handlePatientCalled(data) {
        MessageManager.success(
            `Patient appelé: ${data.data.patient_name}`,
            { 
                duration: 5000,
                title: 'Patient Appelé'
            }
        );
        
        // Update stats
        this.dashboardData.stats.total_consulting = 
            (this.dashboardData.stats.total_consulting || 0) + 1;
        this.dashboardData.stats.total_waiting = 
            Math.max(0, (this.dashboardData.stats.total_waiting || 0) - 1);
        
        this.updateStats();
        
        // Refresh full data after a delay
        setTimeout(() => this.refreshData(), 2000);
    }
    
    handleEmergencyAlert(data) {
        MessageManager.error(
            `🚨 URGENCE: ${data.data.message}`,
            {
                duration: 10000,
                persistent: true,
                title: 'ALERTE URGENCE'
            }
        );
        
        // Add to alerts list
        this.dashboardData.alerts.unshift({
            id: Date.now(),
            type: 'error',
            message: data.data.message,
            created_at: new Date().toISOString(),
            is_read: false
        });
        
        this.displayAlerts();
    }
    
    updateStats() {
        const stats = this.dashboardData.stats;
        
        // Animate number changes
        this.animateNumber('waitingPatients', stats.total_waiting || 0);
        this.animateNumber('activeServices', stats.active_services || 0);
        
        // Update wait time with formatting
        const avgWaitElement = document.getElementById('avgWaitTime');
        if (avgWaitElement) {
            avgWaitElement.textContent = APIUtils.formatWaitTime(stats.avg_wait_time || 0);
        }
        
        // Update completed consultations if available
        const completedElement = document.getElementById('completedToday');
        if (completedElement && stats.total_completed_today !== undefined) {
            this.animateNumber('completedToday', stats.total_completed_today);
        }
    }
    
    animateNumber(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const currentValue = parseInt(element.textContent) || 0;
        const difference = targetValue - currentValue;
        const duration = 1000; // 1 second
        const steps = 30;
        const stepValue = difference / steps;
        const stepDuration = duration / steps;
        
        let currentStep = 0;
        
        const timer = setInterval(() => {
            currentStep++;
            const newValue = currentValue + (stepValue * currentStep);
            
            if (currentStep >= steps) {
                element.textContent = targetValue;
                clearInterval(timer);
            } else {
                element.textContent = Math.round(newValue);
            }
        }, stepDuration);
    }
    
    displayServices() {
        const queueList = document.getElementById('queueList');
        if (!queueList) return;
        
        if (!this.dashboardData.services || this.dashboardData.services.length === 0) {
            queueList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-hospital"></i>
                    <p>Aucun service actif</p>
                </div>
            `;
            return;
        }
        
        queueList.innerHTML = this.dashboardData.services.map(service => {
            const waitingClass = service.waiting_count > 10 ? 'high' : 
                               service.waiting_count > 5 ? 'medium' : 'normal';
            
            return `
                <div class="queue-item" data-service-id="${service.id}">
                    <div class="queue-info">
                        <h4>${service.name}</h4>
                        <p class="location">
                            <i class="fas fa-map-marker-alt"></i>
                            ${service.location}
                        </p>
                        <div class="service-status">
                            <span class="status-badge status-${service.status}">
                                ${this.getStatusLabel(service.status)}
                            </span>
                            <span class="priority-badge priority-${service.priority}">
                                ${this.getPriorityLabel(service.priority)}
                            </span>
                        </div>
                    </div>
                    <div class="queue-stats">
                        <div class="stat-item">
                            <span class="stat-value waiting-count ${waitingClass}">${service.waiting_count || 0}</span>
                            <span class="stat-label">En attente</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${service.consulting_count || 0}</span>
                            <span class="stat-label">En consultation</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${APIUtils.formatWaitTime(service.avg_wait_time || 0)}</span>
                            <span class="stat-label">Temps moyen</span>
                        </div>
                    </div>
                    <div class="queue-actions">
                        <button class="action-btn primary" 
                                onclick="callNextPatient(${service.id}, '${service.name}')"
                                ${(service.waiting_count || 0) === 0 ? 'disabled' : ''}>
                            <i class="fas fa-user-plus"></i>
                            Appeler suivant
                        </button>
                        <button class="action-btn secondary" 
                                onclick="viewServiceDetails(${service.id})">
                            <i class="fas fa-eye"></i>
                            Détails
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    displayAlerts() {
        const alertsList = document.getElementById('alertsList');
        if (!alertsList) return;
        
        if (!this.dashboardData.alerts || this.dashboardData.alerts.length === 0) {
            alertsList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-bell"></i>
                    <p>Aucune alerte récente</p>
                </div>
            `;
            return;
        }
        
        alertsList.innerHTML = this.dashboardData.alerts.slice(0, 5).map(alert => `
            <div class="alert-item alert-${alert.type}" data-alert-id="${alert.id}">
                <div class="alert-icon">
                    <i class="${this.getAlertIcon(alert.type)}"></i>
                </div>
                <div class="alert-content">
                    <p class="alert-message">${alert.message}</p>
                    <span class="alert-time">${APIUtils.formatDate(alert.created_at)}</span>
                </div>
                <button class="alert-dismiss" onclick="dismissAlert(${alert.id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }
    
    // UI Creation Methods (disabled for cleaner interface)
    createRealtimeToggle_disabled() {
        const header = document.querySelector('.dashboard-header');
        if (!header) return;
        
        const toggle = document.createElement('div');
        toggle.className = 'realtime-toggle';
        toggle.innerHTML = `
            <label class="switch">
                <input type="checkbox" id="realtimeSwitch" ${this.isRealTimeEnabled ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
            <span class="toggle-label">Temps réel</span>
            <span class="connection-status" id="connectionStatus">
                <i class="fas fa-circle"></i>
                <span class="status-text">Déconnecté</span>
            </span>
        `;
        
        header.appendChild(toggle);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .realtime-toggle {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-top: 10px;
            }
            
            .switch {
                position: relative;
                display: inline-block;
                width: 50px;
                height: 24px;
            }
            
            .switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            
            .slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: .4s;
                border-radius: 24px;
            }
            
            .slider:before {
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            
            input:checked + .slider {
                background-color: #4A90E2;
            }
            
            input:checked + .slider:before {
                transform: translateX(26px);
            }
            
            .connection-status {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 12px;
            }
            
            .connection-status.connected {
                color: #28a745;
            }
            
            .connection-status.disconnected {
                color: #dc3545;
            }
        `;
        
        document.head.appendChild(style);
        
        // Handle toggle change
        document.getElementById('realtimeSwitch').addEventListener('change', (e) => {
            this.toggleRealTime(e.target.checked);
        });
    }
    
    createRefreshButton_disabled() {
        const header = document.querySelector('.dashboard-header p');
        if (!header) return;
        
        const refreshInfo = document.createElement('div');
        refreshInfo.className = 'refresh-info';
        refreshInfo.innerHTML = `
            <button class="refresh-btn" onclick="dashboardManager.refreshData()">
                <i class="fas fa-sync-alt"></i>
                Actualiser
            </button>
            <span class="last-update" id="lastUpdate">
                Dernière mise à jour : À l'instant
            </span>
        `;
        
        header.parentElement.appendChild(refreshInfo);
    }
    
    // Helper Methods
    getStatusLabel(status) {
        const labels = {
            'active': 'Actif',
            'inactive': 'Inactif',
            'emergency': 'Urgence'
        };
        return labels[status] || status;
    }
    
    getPriorityLabel(priority) {
        const labels = {
            'high': 'Haute',
            'medium': 'Normale',
            'low': 'Basse'
        };
        return labels[priority] || priority;
    }
    
    getAlertIcon(type) {
        const icons = {
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle',
            'success': 'fas fa-check-circle'
        };
        return icons[type] || icons.info;
    }
    
    updateRealTimeStatus(connected) {
        const status = document.getElementById('connectionStatus');
        if (!status) return;
        
        if (connected) {
            status.className = 'connection-status connected';
            status.querySelector('.status-text').textContent = 'Connecté';
        } else {
            status.className = 'connection-status disconnected';
            status.querySelector('.status-text').textContent = 'Déconnecté';
        }
    }
    
    updateConnectionStats() {
        const stats = this.dashboardData.connection_stats;
        if (!stats) return;
        
        console.log('📊 Connection stats:', stats);
        // Could display connection statistics in UI if needed
    }
    
    updateLastRefreshTime() {
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl && this.lastUpdateTime) {
            const timeAgo = this.getTimeAgo(this.lastUpdateTime);
            lastUpdateEl.textContent = `Dernière mise à jour : ${timeAgo}`;
        }
    }
    
    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        
        if (seconds < 60) return 'À l\'instant';
        if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
        if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`;
        return `Il y a ${Math.floor(seconds / 86400)} j`;
    }
    
    toggleRealTime(enable = null) {
        if (enable === null) {
            enable = !this.isRealTimeEnabled;
        }
        
        if (enable) {
            this.setupRealTimeUpdates();
        } else {
            wsClient.disconnect('admin_dashboard');
            this.isRealTimeEnabled = false;
            this.updateRealTimeStatus(false);
        }
        
        const checkbox = document.getElementById('realtimeSwitch');
        if (checkbox) {
            checkbox.checked = enable;
        }
    }
    
    async refreshData() {
        const button = document.querySelector('.refresh-btn');
        if (button) {
            LoadingManager.showButtonLoading(button, 'Actualisation...');
        }
        
        try {
            await this.loadInitialData();
            MessageManager.success('Données actualisées', { duration: 2000 });
        } catch (error) {
            MessageManager.error('Erreur lors de l\'actualisation');
        } finally {
            if (button) {
                LoadingManager.hideButtonLoading(button);
            }
        }
    }
    
    startPeriodicRefresh() {
        // Refresh every 30 seconds as backup when real-time is not available
        this.refreshInterval = setInterval(() => {
            if (!this.isRealTimeEnabled) {
                this.refreshData();
            }
            this.updateLastRefreshTime();
        }, 30000);
    }
    
    getFallbackStats() {
        return {
            total_waiting: 0,
            total_consulting: 0,
            active_services: 0,
            avg_wait_time: 0,
            services: []
        };
    }
    
    showFallbackData() {
        this.dashboardData = {
            stats: this.getFallbackStats(),
            services: [],
            alerts: []
        };
        
        this.updateStats();
        this.displayServices();
        this.displayAlerts();
    }
    
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        wsClient.disconnectAll();
        LoadingManager.hideAllLoaders();
        MessageManager.clearAll();
    }
}

// Global functions
window.viewServiceDetails = (serviceId) => {
    MessageManager.info(`Détails du service ${serviceId} - Fonctionnalité à implémenter`);
};

window.dismissAlert = (alertId) => {
    MessageManager.info(`Alerte ${alertId} supprimée`);
    // Remove from UI
    const alertElement = document.querySelector(`[data-alert-id="${alertId}"]`);
    if (alertElement) {
        alertElement.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => alertElement.remove(), 300);
    }
};

// Initialize dashboard when DOM is loaded
let dashboardManager;

document.addEventListener('DOMContentLoaded', () => {
    dashboardManager = new DashboardManager();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (dashboardManager) {
        dashboardManager.destroy();
    }
});