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
        return user && (user.role === 'admin' || user.role === 'doctor');
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
                throw new Error(data.detail || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
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

    async callNextPatient(serviceId) {
        return await this.makeRequest(`/api/queue/call-next/${serviceId}`, {
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

    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
};

// Export for use in other files
window.apiClient = apiClient;
window.APIUtils = APIUtils; 