/**
 * Admin Chatbot Interface for WaitLess CHU
 * Provides intelligent administrative assistance and system analytics
 */

class AdminChatbot extends PatientChatbot {
    constructor() {
        super();
        this.systemStats = {
            total_waiting: 0,
            active_services: 0,
            avg_wait_time: 0,
            today_tickets: 0
        };
        this.statsRefreshInterval = null;
    }
    
    async init() {
        console.log('🧠 Initializing Admin Chatbot...');
        
        // Check authentication first
        if (!this.checkAdminAuth()) return;
        
        // Generate admin session ID
        this.sessionId = this.generateAdminSessionId();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check chatbot health
        await this.checkChatbotHealth();
        
        // Load system stats
        await this.refreshSystemStats();
        
        // Setup auto-refresh for stats
        this.setupStatsAutoRefresh();
        
        // Load conversation history if exists
        await this.loadConversationHistory();
        
        console.log('✅ Admin Chatbot initialized successfully');
    }
    
    checkAdminAuth() {
        if (!apiClient.isAuthenticated()) {
            window.location.href = '../Acceuil/acceuil.html?login=true';
            return false;
        }
        
        if (!apiClient.isStaff()) {
            this.showNotification('Accès non autorisé. Cette page est réservée au personnel.', 'error');
            setTimeout(() => {
                window.location.href = '../Acceuil/acceuil.html';
            }, 2000);
            return false;
        }
        
        return true;
    }
    
    generateAdminSessionId() {
        const user = apiClient.getCurrentUser();
        const userId = user ? user.id : 'unknown';
        return `admin_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    async callChatbotAPI(message) {
        const response = await fetch(`${apiClient.baseURL}/api/chatbot/admin/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiClient.token}`
            },
            body: JSON.stringify({
                message: message,
                session_id: this.sessionId,
                chatbot_role: 'admin_assistant'
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    }
    
    async refreshSystemStats() {
        try {
            // Show loading state
            this.setStatsLoading(true);
            
            const response = await apiClient.getDashboardStats();
            
            if (response) {
                this.systemStats = {
                    total_waiting: response.total_waiting || 0,
                    active_services: response.active_services || 0,
                    avg_wait_time: response.avg_wait_time || 0,
                    today_tickets: response.today_tickets || 0
                };
                
                this.updateStatsDisplay();
            }
            
        } catch (error) {
            console.error('Failed to refresh system stats:', error);
            this.showNotification('Erreur lors du chargement des statistiques', 'warning');
        } finally {
            this.setStatsLoading(false);
        }
    }
    
    setStatsLoading(loading) {
        const statValues = document.querySelectorAll('.stat-value');
        statValues.forEach(stat => {
            if (loading) {
                stat.classList.add('loading');
            } else {
                stat.classList.remove('loading');
            }
        });
    }
    
    updateStatsDisplay() {
        document.getElementById('totalWaiting').textContent = this.systemStats.total_waiting;
        document.getElementById('activeServices').textContent = this.systemStats.active_services;
        document.getElementById('avgWaitTime').textContent = `${this.systemStats.avg_wait_time} min`;
        document.getElementById('todayTickets').textContent = this.systemStats.today_tickets;
        
        // Update status message based on data
        this.updateAdminStatus();
    }
    
    updateAdminStatus() {
        const statusElement = document.getElementById('assistantStatus');
        const waitingCount = this.systemStats.total_waiting;
        const avgWait = this.systemStats.avg_wait_time;
        
        if (waitingCount === 0) {
            statusElement.textContent = 'Système stable - Aucune file d\'attente';
            statusElement.className = 'status online';
        } else if (waitingCount > 50 || avgWait > 60) {
            statusElement.textContent = 'Attention - Charge élevée détectée';
            statusElement.className = 'status warning';
        } else {
            statusElement.textContent = `En ligne - ${waitingCount} patients en attente`;
            statusElement.className = 'status online';
        }
    }
    
    setupStatsAutoRefresh() {
        // Refresh stats every 30 seconds
        this.statsRefreshInterval = setInterval(() => {
            this.refreshSystemStats();
        }, 30000);
        
        // Clear interval on page unload
        window.addEventListener('beforeunload', () => {
            if (this.statsRefreshInterval) {
                clearInterval(this.statsRefreshInterval);
            }
        });
    }
    
    processMessageText(text) {
        // Enhanced processing for admin messages
        let processedText = super.processMessageText(text);
        
        // Add admin-specific formatting
        processedText = processedText
            .replace(/\[INSIGHT\](.*?)\[\/INSIGHT\]/g, '<div class="admin-insight"><h4>💡 Analyse</h4><p>$1</p></div>')
            .replace(/\[METRIC\](.*?)\[\/METRIC\]/g, '<span class="performance-metric">$1</span>')
            .replace(/\[WARNING\](.*?)\[\/WARNING\]/g, '<span class="alert-warning">⚠️ $1</span>');
        
        return processedText;
    }
    
    async exportConversation() {
        try {
            if (this.conversationHistory.length === 0) {
                this.showNotification('Aucune conversation à exporter', 'warning');
                return;
            }
            
            const user = apiClient.getCurrentUser();
            const exportData = {
                export_info: {
                    date: new Date().toISOString(),
                    user: user ? user.full_name : 'Inconnu',
                    session_id: this.sessionId,
                    total_messages: this.conversationHistory.length
                },
                system_stats: this.systemStats,
                conversation: this.conversationHistory
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `admin_chat_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('Conversation exportée avec succès', 'success');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification('Erreur lors de l\'export', 'error');
        }
    }
    
    // Override to add admin-specific quick actions
    sendQuickMessage(message) {
        // Enhance quick messages with current stats context
        const enhancedMessage = this.enhanceMessageWithStats(message);
        
        this.inputField.value = enhancedMessage;
        this.updateCharCounter();
        this.toggleSendButton();
        this.sendMessage();
    }
    
    enhanceMessageWithStats(message) {
        // Add current system context to certain messages
        const contextualMessages = {
            "Résumez l'activité d'aujourd'hui": 
                `Résumez l'activité d'aujourd'hui. Contexte actuel: ${this.systemStats.today_tickets} tickets créés, ${this.systemStats.total_waiting} patients en attente, temps moyen ${this.systemStats.avg_wait_time} minutes.`,
            
            "Quels services ont le plus d'attente ?": 
                `Analysez les services avec le plus d'attente. Il y a actuellement ${this.systemStats.total_waiting} patients en attente avec un temps moyen de ${this.systemStats.avg_wait_time} minutes.`,
            
            "Comment optimiser les temps d'attente ?": 
                `Proposez des optimisations pour les temps d'attente. Situation actuelle: ${this.systemStats.avg_wait_time} minutes en moyenne, ${this.systemStats.active_services} services actifs.`
        };
        
        return contextualMessages[message] || message;
    }
    
    clearChat() {
        if (confirm('Êtes-vous sûr de vouloir commencer une nouvelle session administrative ?')) {
            // Clear the chat area but keep the welcome message
            const welcomeMessage = this.messageContainer.querySelector('.welcome-message');
            this.messageContainer.innerHTML = '';
            if (welcomeMessage) {
                this.messageContainer.appendChild(welcomeMessage);
            }
            
            // Reset conversation data
            this.conversationHistory = [];
            this.sessionId = this.generateAdminSessionId();
            localStorage.removeItem(`chatbot_history_${this.sessionId}`);
            
            this.showNotification('Nouvelle session administrative commencée', 'success');
        }
    }
}

// Global admin functions
function refreshSystemStats() {
    if (window.adminChatbot) {
        adminChatbot.refreshSystemStats();
    }
}

function exportConversation() {
    if (window.adminChatbot) {
        adminChatbot.exportConversation();
    }
}

function sendQuickMessage(message) {
    if (window.adminChatbot) {
        adminChatbot.sendQuickMessage(message);
    }
}

function clearChat() {
    if (window.adminChatbot) {
        adminChatbot.clearChat();
    }
}

function toggleChatHistory() {
    if (window.adminChatbot) {
        adminChatbot.toggleChatHistory();
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (window.adminChatbot) {
            adminChatbot.sendMessage();
        }
    }
}

function handleLogout() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        apiClient.removeToken();
        window.location.href = '../Acceuil/acceuil.html';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize API client if not already done
    if (typeof apiClient === 'undefined') {
        window.apiClient = new APIClient();
    }
    
    // Initialize admin chatbot
    window.adminChatbot = new AdminChatbot();
    
    console.log('✅ Admin Chatbot interface loaded');
});

// Add admin-specific styles
const adminStyles = `
    .admin-message-enhancement {
        border-left: 3px solid #6366f1;
        padding-left: 1rem;
        margin: 0.5rem 0;
        background: #f8fafc;
        border-radius: 0 8px 8px 0;
    }
    
    .stats-highlight {
        background: linear-gradient(135deg, #eff6ff, #dbeafe);
        border: 1px solid #3b82f6;
        border-radius: 6px;
        padding: 0.5rem 0.75rem;
        margin: 0.25rem 0;
        font-weight: 500;
        color: #1e40af;
    }
    
    .refresh-animation {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;

// Inject admin styles
const adminStyleSheet = document.createElement('style');
adminStyleSheet.textContent = adminStyles;
document.head.appendChild(adminStyleSheet);