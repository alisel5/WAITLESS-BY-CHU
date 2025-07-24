/**
 * Enhanced Dashboard with Real-time Updates
 * Beautiful UX with WebSocket integration and loading states
 */

class DashboardManager {
    constructor() {
        this.dashboardData = {
            stats: {
                total_waiting: 0,
                active_services: 0,
                avg_wait_time: 0
            },
            services: [],
            alerts: [],
            connection_stats: {}
        };
        
        this.refreshInterval = null;
        this.isRealTimeEnabled = false;
        
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
        MessageManager.success('Dashboard chargé avec succès', { duration: 3000 });
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
        try {
            // Load dashboard stats from backend
            const dashboardStats = await apiClient.getDashboardStats().catch(err => {
                    console.warn('Dashboard stats failed, using fallback:', err);
                    return this.getFallbackStats();
            });
            
            if (dashboardStats) {
                this.dashboardData.stats = dashboardStats;
                this.dashboardData.services = dashboardStats.services || [];
            }
            
            // Update UI
            this.updateStats();
            
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
        
        // Queue actions removed as queue section is no longer needed
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'r':
                        e.preventDefault();
                        this.refreshData();
                        break;
                }
            }
        });
    }
    
    // setupQueueActions method removed as queue section is no longer needed
    
    setupRealTimeUpdates() {
        try {
            // Connect to admin dashboard WebSocket
            wsClient.connectToAdminDashboard((data) => {
                this.handleRealTimeUpdate(data);
            });
            
            // Listen for WebSocket events
            wsClient.addEventListener('dashboard_connected', () => {
                this.isRealTimeEnabled = true;
                MessageManager.info('Mises à jour activées', { duration: 3000 });
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
                    this.dashboardData.stats.total_waiting =
            (this.dashboardData.stats.total_waiting || 0) + 1;
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
        
        // Animate number changes with proper backend data mapping
        this.animateNumber('waitingPatients', stats.total_waiting || 0);
        this.animateNumber('activeServices', stats.active_services || 0);
        
        // Update average wait time with proper formatting
        const avgWaitElement = document.getElementById('avgWaitTime');
        if (avgWaitElement) {
            const avgWaitTime = stats.avg_wait_time || 0;
            avgWaitElement.textContent = `${avgWaitTime} min`;
        }
        
        // Update total consultations count (all time)
        const completedElement = document.getElementById('completedToday');
        if (completedElement) {
            this.animateNumber('completedToday', stats.total_consultations || 0);
        }
        
        // Update change indicators
        this.updateChangeIndicators(stats);
        
        console.log('📊 Dashboard stats updated:', stats);
    }
    
    updateChangeIndicators(stats) {
        // Update waiting patients change
        this.updateChangeIndicator('waitingPatients', stats.waiting_change || 0, 'patients');
        
        // Update average wait time change
        this.updateChangeIndicator('avgWaitTime', stats.avg_wait_time_change || 0, 'time');
        
        // Update completed consultations change (shows today's completed vs total)
        this.updateChangeIndicator('completedToday', stats.total_completed_today || 0, 'consultations');
        
        // Note: Services Actifs doesn't have change tracking as services are relatively stable
    }
    
    updateChangeIndicator(statId, change, type) {
        const statCard = document.getElementById(statId)?.closest('.stat-card');
        if (!statCard) return;
        
        const changeElement = statCard.querySelector('.stat-change');
        if (!changeElement) return;
        
        // Remove existing classes
        changeElement.classList.remove('positive', 'negative', 'neutral');
        
        let changeText = '';
        let changeClass = 'neutral';
        
        if (type === 'time') {
            // For time, negative change is good (faster), positive is bad (slower)
            if (change < 0) {
                changeText = `-${Math.abs(change)} min hier`;
                changeClass = 'positive';
            } else if (change > 0) {
                changeText = `+${change} min hier`;
                changeClass = 'negative';
            } else {
                changeText = 'Stable';
                changeClass = 'neutral';
            }
        } else if (type === 'patients') {
            if (change > 0) {
                changeText = `+${change} aujourd'hui`;
                changeClass = 'negative'; // More patients waiting is bad
            } else if (change < 0) {
                changeText = `${change} aujourd'hui`;
                changeClass = 'positive'; // Fewer patients waiting is good
            } else {
                changeText = 'Stable';
                changeClass = 'neutral';
            }
        } else if (type === 'consultations') {
            if (change > 0) {
                changeText = `${change} aujourd'hui`;
                changeClass = 'positive'; // More consultations completed is good
            } else if (change < 0) {
                changeText = `${change} aujourd'hui`;
                changeClass = 'negative'; // Fewer consultations completed is bad
            } else {
                changeText = '0 aujourd\'hui';
                changeClass = 'neutral';
            }
        } else if (type === 'tickets') {
            if (change > 0) {
                changeText = `+${change} aujourd'hui`;
                changeClass = 'neutral'; // More tickets created is neutral
            } else if (change < 0) {
                changeText = `${change} aujourd'hui`;
                changeClass = 'neutral';
            } else {
                changeText = 'Stable';
                changeClass = 'neutral';
            }
        }
        
        changeElement.textContent = changeText;
        changeElement.classList.add(changeClass);
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
    
    // displayServices and displayAlerts methods removed as these sections are no longer needed
    
    // UI Creation Methods

    

    
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
        // Removed connection status display to eliminate "Déconnecté" text
        return;
    }
    
    updateConnectionStats() {
        const stats = this.dashboardData.connection_stats;
        if (!stats) return;
        
        console.log('📊 Connection stats:', stats);
        // Could display connection statistics in UI if needed
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
        }
    }
    
    async refreshData() {
        try {
            await this.loadInitialData();
            MessageManager.success('Données actualisées', { duration: 2000 });
        } catch (error) {
            MessageManager.error('Erreur lors de l\'actualisation');
        }
    }
    
    startPeriodicRefresh() {
        // Refresh every 30 seconds as backup when real-time is not available
        this.refreshInterval = setInterval(() => {
            if (!this.isRealTimeEnabled) {
                this.refreshData();
            }
        }, 30000);
    }
    
    getFallbackStats() {
        return {
            total_waiting: 0,
            waiting_change: 0,
            active_services: 0,
            avg_wait_time: 0,
            avg_wait_time_change: 0,
            total_completed_today: 0,
            completed_change: 0,
            today_tickets: 0,
            tickets_change: 0,
            total_consultations: 0,
            total_patients: 0,
            services: []
        };
    }
    
    showFallbackData() {
        this.dashboardData = {
            stats: this.getFallbackStats(),
            services: []
        };
        
        this.updateStats();
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

// Global functions removed as queue and alerts sections are no longer needed

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