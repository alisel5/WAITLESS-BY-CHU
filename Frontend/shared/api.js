/**
 * WaitLess CHU API Client
 * Shared client for frontend-backend communication
 */

const API_CONFIG = {
    BASE_URL: 'http://localhost:8000',
    TOKEN_KEY: 'waitless_token',
    USER_KEY: 'waitless_user'
};

class APIClient {
    constructor() {
        this.baseURL = API_CONFIG.BASE_URL;
        this.token = this.getToken();
    }

    // Token management
    getToken() {
        return localStorage.getItem(API_CONFIG.TOKEN_KEY);
    }

    setToken(token) {
        localStorage.setItem(API_CONFIG.TOKEN_KEY, token);
        this.token = token;
    }

    removeToken() {
        localStorage.removeItem(API_CONFIG.TOKEN_KEY);
        localStorage.removeItem(API_CONFIG.USER_KEY);
        this.token = null;
    }

    // User management
    getCurrentUser() {
        const userData = localStorage.getItem(API_CONFIG.USER_KEY);
        return userData ? JSON.parse(userData) : null;
    }

    setCurrentUser(user) {
        localStorage.setItem(API_CONFIG.USER_KEY, JSON.stringify(user));
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token;
    }

    // Check if user is admin
    isAdmin() {
        const user = this.getCurrentUser();
        return user && user.role === 'admin';
    }

    // Check if current user is staff (admin, staff, or doctor)
    isStaff() {
        const user = this.getCurrentUser();
        return user && ['admin', 'staff', 'doctor'].includes(user.role);
    }

    // Check if current user can manage queues (admin or staff)
    canManageQueues() {
        const user = this.getCurrentUser();
        return user && ['admin', 'staff'].includes(user.role);
    }

    // HTTP request helper
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Add authentication header if token exists
        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            
            // Handle authentication errors
            if (response.status === 401) {
                this.removeToken();
                window.location.href = '../Acceuil/acceuil.html?login=true';
                return null;
            }

            // Parse JSON response
            const data = await response.json();

            if (!response.ok) {
                const errorMessage = this.getErrorMessage(response.status, data);
                const error = new Error(errorMessage);
                error.status = response.status;
                error.originalData = data;
                throw error;
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            
            // Network errors
            if (!error.status) {
                error.message = 'Problème de connexion. Vérifiez votre connexion internet.';
            }
            
            throw error;
        }
    }

    // Get user-friendly error messages in French
    getErrorMessage(status, errorData = null) {
        const messages = {
            400: 'Données invalides. Vérifiez vos informations.',
            401: 'Session expirée. Veuillez vous reconnecter.',
            403: 'Accès non autorisé.',
            404: 'Ressource non trouvée.',
            409: 'Conflit détecté. Cette action ne peut pas être effectuée.',
            422: 'Données de validation incorrectes.',
            429: 'Trop de tentatives. Veuillez réessayer plus tard.',
            500: 'Erreur du serveur. Veuillez réessayer.',
            503: 'Service temporairement indisponible.'
        };

        if (errorData && errorData.detail) {
            // Try to translate common error details
            const detail = errorData.detail.toLowerCase();
            if (detail.includes('email') && detail.includes('already')) {
                return 'Cette adresse email est déjà utilisée.';
            }
            if (detail.includes('password') || detail.includes('incorrect')) {
                return 'Email ou mot de passe incorrect.';
            }
            if (detail.includes('inactive')) {
                return 'Votre compte est désactivé.';
            }
            if (detail.includes('not found')) {
                return 'Élément non trouvé.';
            }
            if (detail.includes('active ticket')) {
                return 'Vous avez déjà un ticket actif.';
            }
            if (detail.includes('service') && detail.includes('inactive')) {
                return 'Ce service est actuellement indisponible.';
            }
        }

        return messages[status] || 'Une erreur inattendue est survenue.';
    }

    // Authentication APIs
    async login(email, password) {
        const response = await this.makeRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (response) {
            this.setToken(response.access_token);
            this.setCurrentUser(response.user);
        }

        return response;
    }

    async register(userData) {
        const response = await this.makeRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        if (response) {
            this.setToken(response.access_token);
            this.setCurrentUser(response.user);
        }

        return response;
    }

    async logout() {
        try {
            await this.makeRequest('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.removeToken();
        }
    }

    async getCurrentUserInfo() {
        return await this.makeRequest('/api/auth/me');
    }

    // Services APIs
    async getServices() {
        return await this.makeRequest('/api/services/');
    }

    async getActiveServices() {
        return await this.makeRequest('/api/services/active/list');
    }

    async getActiveServicesWithQR() {
        return await this.makeRequest('/api/services/active/with-qr');
    }

    async getService(id) {
        return await this.makeRequest(`/api/services/${id}`);
    }

    async createService(serviceData) {
        return await this.makeRequest('/api/services/', {
            method: 'POST',
            body: JSON.stringify(serviceData)
        });
    }

    async updateService(id, serviceData) {
        return await this.makeRequest(`/api/services/${id}`, {
            method: 'PUT',
            body: JSON.stringify(serviceData)
        });
    }

    async deleteService(id) {
        return await this.makeRequest(`/api/services/${id}`, {
            method: 'DELETE'
        });
    }

    async getServiceQRCode(id) {
        return await this.makeRequest(`/api/services/${id}/qr-code`);
    }

    // Tickets APIs
    async createTicket(ticketData) {
        return await this.makeRequest('/api/tickets/create', {
            method: 'POST',
            body: JSON.stringify(ticketData)
        });
    }

    async joinQueueOnline(queueData) {
        return await this.makeRequest('/api/tickets/join-online', {
            method: 'POST',
            body: JSON.stringify(queueData)
        });
    }

    async getMyTickets() {
        return await this.makeRequest('/api/tickets/my-tickets');
    }

    async getTicketStatus(ticketNumber) {
        return await this.makeRequest(`/api/tickets/${ticketNumber}`);
    }

    async scanQR(qrData) {
        return await this.makeRequest('/api/tickets/scan', {
            method: 'POST',
            body: JSON.stringify({ qr_data: qrData })
        });
    }

    async scanToJoin(qrData, patientData) {
        const params = new URLSearchParams({
            patient_name: patientData.name,
            patient_phone: patientData.phone,
            patient_email: patientData.email,
            priority: patientData.priority || 'medium'
        });

        return await this.makeRequest(`/api/tickets-qr/scan-to-join?${params}`, {
            method: 'POST',
            body: JSON.stringify({ qr_data: qrData })
        });
    }

    async updateTicketStatus(id, status) {
        return await this.makeRequest(`/api/tickets/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    }

    // Queue APIs
    async getQueueStatus(serviceId) {
        return await this.makeRequest(`/api/queue/service/${serviceId}`);
    }

    async getTicketStatusWithQueueInfo(ticketNumber) {
        return await this.makeRequest(`/api/queue/ticket-status/${ticketNumber}`);
    }

    async callNextPatient(serviceId) {
        return await this.makeRequest(`/api/queue/call-next/${serviceId}`, {
            method: 'POST'
        });
    }

    async callNextPatientForSecretary() {
        return await this.makeRequest('/api/admin/secretary/call-next', {
            method: 'POST'
        });
    }

    async completeConsultation(ticketId) {
        return await this.makeRequest(`/api/queue/complete-consultation/${ticketId}`, {
            method: 'POST'
        });
    }

    async getQueueStatistics(serviceId) {
        return await this.makeRequest(`/api/queue/statistics/${serviceId}`);
    }

    // Admin APIs
    async getDashboardStats() {
        return await this.makeRequest('/api/admin/dashboard');
    }

    async getPatients() {
        return await this.makeRequest('/api/admin/patients');
    }

    async createPatient(patientData) {
        return await this.makeRequest('/api/admin/patients', {
            method: 'POST',
            body: JSON.stringify(patientData)
        });
    }

    async updatePatient(patientId, patientData) {
        return await this.makeRequest(`/api/admin/patients/${patientId}`, {
            method: 'PUT',
            body: JSON.stringify(patientData)
        });
    }

    async deletePatient(patientId) {
        return await this.makeRequest(`/api/admin/patients/${patientId}`, {
            method: 'DELETE'
        });
    }

    async getAlerts() {
        return await this.makeRequest('/api/admin/alerts');
    }

    async getDailyReports() {
        return await this.makeRequest('/api/admin/reports/daily');
    }

    // Health check
    async healthCheck() {
        return await this.makeRequest('/');
    }
}

// Create global API client instance
const apiClient = new APIClient();

// Utility functions for common operations
const APIUtils = {
    // Show loading state
    showLoading(element) {
        if (element) {
            element.innerHTML = '<div class="loading">Chargement...</div>';
        }
    },

    // Show error message
    showError(element, message) {
        if (element) {
            element.innerHTML = `<div class="error">Erreur: ${message}</div>`;
        }
    },

    // Enhanced error handling with context
    handleError(error, context = '', showNotification = true) {
        console.error(`Error in ${context}:`, error);
        
        let message = error.message || 'Une erreur est survenue';
        
        // Add context-specific messages
        if (context.includes('login')) {
            message = 'Impossible de se connecter. Vérifiez vos identifiants.';
        } else if (context.includes('join') || context.includes('queue')) {
            message = 'Impossible de rejoindre la file. Réessayez.';
        } else if (context.includes('load') || context.includes('fetch')) {
            message = 'Impossible de charger les données. Actualisez la page.';
        }
        
        if (showNotification && window.MessageManager) {
            window.MessageManager.error(message, { duration: 5000 });
        }
        
        return message;
    },

    // Format date for display
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Format wait time
    formatWaitTime(minutes) {
        if (minutes < 60) {
            return `${minutes} min`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return `${hours}h ${remainingMinutes}min`;
        }
    },

    // Show notification (deprecated - use MessageManager instead)
    showNotification(message, type = 'info') {
        if (window.MessageManager) {
            window.MessageManager.show(type, message, { duration: 3000 });
        } else {
            // Fallback for when MessageManager is not available
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    },

    // Real-time status tracker
    startStatusTracking(ticketNumber, callback, intervalMs = 30000) {
        const updateStatus = async () => {
            try {
                const ticket = await apiClient.getTicketStatus(ticketNumber);
                callback(ticket);
            } catch (error) {
                console.error('Status update failed:', error);
            }
        };

        // Initial update
        updateStatus();
        
        // Set up interval
        const intervalId = setInterval(updateStatus, intervalMs);
        
        // Return function to stop tracking
        return () => clearInterval(intervalId);
    }
};

// Export for use in other files
window.apiClient = apiClient;
window.APIUtils = APIUtils; 