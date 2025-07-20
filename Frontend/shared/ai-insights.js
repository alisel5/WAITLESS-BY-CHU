/**
 * AI Insights Manager
 * Handles AI predictions and analytics display across the application
 */

class AIInsightsManager {
    constructor() {
        this.predictionCache = new Map();
        this.cacheTimeout = 300000; // 5 minutes
        this.isEnabled = true;
    }

    /**
     * Get smart wait time prediction for a patient
     */
    async getWaitTimePrediction(serviceId, position, priority = 'medium') {
        try {
            const cacheKey = `${serviceId}_${position}_${priority}`;
            
            // Check cache first
            if (this.predictionCache.has(cacheKey)) {
                const cached = this.predictionCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            const response = await apiClient.post('/api/ai/predict-wait-time', {
                service_id: serviceId,
                position: position,
                priority: priority
            });

            if (response.success) {
                // Cache the result
                this.predictionCache.set(cacheKey, {
                    data: response,
                    timestamp: Date.now()
                });

                return response;
            }

            throw new Error('AI prediction failed');

        } catch (error) {
            console.warn('AI prediction error:', error);
            // Return fallback prediction
            return this.getFallbackPrediction(position);
        }
    }

    /**
     * Get service insights for admin/staff
     */
    async getServiceInsights(serviceId) {
        try {
            const response = await apiClient.get(`/api/ai/service-insights/${serviceId}`);
            
            if (response.success) {
                return response.insights;
            }

            throw new Error('Failed to get service insights');

        } catch (error) {
            console.error('Error getting service insights:', error);
            return null;
        }
    }

    /**
     * Get real-time analytics for dashboard
     */
    async getRealTimeAnalytics(serviceId) {
        try {
            const response = await apiClient.get(`/api/ai/real-time-analytics/${serviceId}`);
            
            if (response.success) {
                return response.real_time_data;
            }

            throw new Error('Failed to get real-time analytics');

        } catch (error) {
            console.error('Error getting real-time analytics:', error);
            return null;
        }
    }

    /**
     * Get optimization suggestions
     */
    async getOptimizationSuggestions(serviceId) {
        try {
            const response = await apiClient.get(`/api/ai/queue-optimization-suggestions/${serviceId}`);
            
            if (response.success) {
                return response.optimization_suggestions;
            }

            return [];

        } catch (error) {
            console.error('Error getting optimization suggestions:', error);
            return [];
        }
    }

    /**
     * Display AI prediction in UI
     */
    displayPrediction(prediction, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const predictionData = prediction.prediction;
        const quality = predictionData.prediction_quality;
        const confidence = Math.round(predictionData.confidence_score * 100);

        const qualityColors = {
            'high': '#4CAF50',
            'medium': '#FF9800', 
            'low': '#f44336'
        };

        container.innerHTML = `
            <div class="ai-prediction">
                <div class="prediction-header">
                    <i class="fas fa-robot"></i>
                    <span>Prédiction IA</span>
                    <span class="quality-badge" style="background-color: ${qualityColors[quality]}">
                        ${confidence}% confiance
                    </span>
                </div>
                <div class="prediction-content">
                    <div class="wait-time">
                        <span class="time-value">${predictionData.estimated_wait_minutes}</span>
                        <span class="time-unit">minutes</span>
                    </div>
                    <div class="prediction-details">
                        <small>Position: ${predictionData.your_position || 'N/A'}</small>
                        <small>Priorité: ${predictionData.priority || 'medium'}</small>
                        <small>Heure estimée: ${this.formatEstimatedTime(predictionData.estimated_call_time)}</small>
                    </div>
                </div>
                ${this.renderPredictionFactors(predictionData.factors)}
            </div>
        `;
    }

    /**
     * Display service insights widget
     */
    displayServiceInsights(insights, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !insights) return;

        const realTime = insights.real_time;
        const performance = insights.performance;

        container.innerHTML = `
            <div class="ai-insights-widget">
                <div class="insights-header">
                    <i class="fas fa-chart-line"></i>
                    <span>Insights IA</span>
                </div>
                <div class="insights-content">
                    <div class="insight-item">
                        <label>Statut actuel:</label>
                        <span class="status-${realTime.current_status}">${realTime.current_status}</span>
                    </div>
                    <div class="insight-item">
                        <label>File d'attente:</label>
                        <span>${realTime.current_waiting} patients</span>
                    </div>
                    <div class="insight-item">
                        <label>Taux de completion:</label>
                        <span>${realTime.today_completion_rate}%</span>
                    </div>
                    ${performance.avg_service_time ? `
                        <div class="insight-item">
                            <label>Temps moy. service:</label>
                            <span>${performance.avg_service_time} min</span>
                        </div>
                    ` : ''}
                </div>
                ${this.renderAlerts(realTime.alerts)}
            </div>
        `;
    }

    /**
     * Display optimization suggestions
     */
    displayOptimizationSuggestions(suggestions, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!suggestions || suggestions.length === 0) {
            container.innerHTML = `
                <div class="no-suggestions">
                    <i class="fas fa-check-circle"></i>
                    <p>Aucune suggestion d'optimisation pour le moment</p>
                </div>
            `;
            return;
        }

        const priorityIcons = {
            'high': 'fas fa-exclamation-triangle',
            'medium': 'fas fa-info-circle',
            'low': 'fas fa-lightbulb'
        };

        const priorityColors = {
            'high': '#f44336',
            'medium': '#FF9800',
            'low': '#4CAF50'
        };

        const suggestionsHTML = suggestions.map(suggestion => `
            <div class="suggestion-item priority-${suggestion.priority}">
                <div class="suggestion-header">
                    <i class="${priorityIcons[suggestion.priority]}" style="color: ${priorityColors[suggestion.priority]}"></i>
                    <span class="suggestion-title">${suggestion.title}</span>
                </div>
                <div class="suggestion-content">
                    <p class="suggestion-description">${suggestion.description}</p>
                    ${suggestion.recommendation ? `
                        <p class="suggestion-recommendation">
                            <strong>Recommandation:</strong> ${suggestion.recommendation}
                        </p>
                    ` : ''}
                    <p class="suggestion-impact">
                        <strong>Impact attendu:</strong> ${suggestion.expected_impact}
                    </p>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="ai-suggestions">
                <div class="suggestions-header">
                    <i class="fas fa-magic"></i>
                    <span>Suggestions d'optimisation</span>
                </div>
                <div class="suggestions-list">
                    ${suggestionsHTML}
                </div>
            </div>
        `;
    }

    /**
     * Render prediction factors (for debugging/transparency)
     */
    renderPredictionFactors(factors) {
        if (!factors || typeof factors !== 'object') return '';

        const factorEntries = Object.entries(factors)
            .filter(([key, value]) => key !== 'fallback' && typeof value === 'number')
            .map(([key, value]) => `
                <div class="factor-item">
                    <span class="factor-name">${this.formatFactorName(key)}:</span>
                    <span class="factor-value">${value.toFixed(2)}</span>
                </div>
            `).join('');

        if (!factorEntries) return '';

        return `
            <details class="prediction-factors">
                <summary>Facteurs de prédiction</summary>
                <div class="factors-list">
                    ${factorEntries}
                </div>
            </details>
        `;
    }

    /**
     * Render alerts
     */
    renderAlerts(alerts) {
        if (!alerts || alerts.length === 0) return '';

        const alertsHTML = alerts.map(alert => `
            <div class="alert-item">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${alert}</span>
            </div>
        `).join('');

        return `
            <div class="insights-alerts">
                <div class="alerts-header">Alertes</div>
                <div class="alerts-list">
                    ${alertsHTML}
                </div>
            </div>
        `;
    }

    /**
     * Format factor names for display
     */
    formatFactorName(factorKey) {
        const factorNames = {
            'base_time': 'Temps de base',
            'time_factor': 'Facteur horaire',
            'load_factor': 'Charge service',
            'priority_factor': 'Facteur priorité',
            'trend_factor': 'Tendance récente'
        };

        return factorNames[factorKey] || factorKey;
    }

    /**
     * Format estimated call time
     */
    formatEstimatedTime(isoString) {
        if (!isoString) return 'N/A';

        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } catch (error) {
            return 'N/A';
        }
    }

    /**
     * Fallback prediction when AI fails
     */
    getFallbackPrediction(position) {
        const estimatedWait = Math.max(1, (position - 1) * 15);
        
        return {
            success: true,
            prediction: {
                estimated_wait_minutes: estimatedWait,
                base_time_per_patient: 15,
                confidence_score: 0.5,
                prediction_quality: 'low',
                factors: { fallback: true },
                estimated_call_time: new Date(Date.now() + estimatedWait * 60000).toISOString()
            },
            ai_enabled: false,
            fallback: true
        };
    }

    /**
     * Initialize AI insights for a page
     */
    async initializeForPage(pageType, serviceId = null) {
        try {
            // Add AI status indicator
            this.addAIStatusIndicator();

            if (pageType === 'secretary' && serviceId) {
                await this.initializeSecretaryInsights(serviceId);
            } else if (pageType === 'admin') {
                await this.initializeAdminInsights();
            }

        } catch (error) {
            console.error('Error initializing AI insights:', error);
        }
    }

    /**
     * Initialize insights for secretary page
     */
    async initializeSecretaryInsights(serviceId) {
        try {
            // Get service insights
            const insights = await this.getServiceInsights(serviceId);
            if (insights) {
                this.displayServiceInsights(insights, 'aiInsightsContainer');
            }

            // Get optimization suggestions
            const suggestions = await this.getOptimizationSuggestions(serviceId);
            this.displayOptimizationSuggestions(suggestions, 'aiSuggestionsContainer');

            // Set up periodic updates
            setInterval(async () => {
                const realTimeData = await this.getRealTimeAnalytics(serviceId);
                if (realTimeData) {
                    this.updateRealTimeData(realTimeData);
                }
            }, 60000); // Update every minute

        } catch (error) {
            console.error('Error initializing secretary insights:', error);
        }
    }

    /**
     * Add AI status indicator to the page
     */
    addAIStatusIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'ai-status-indicator';
        indicator.className = 'ai-status-indicator';
        indicator.innerHTML = `
            <div class="ai-status-content">
                <i class="fas fa-robot"></i>
                <span>IA Activée</span>
                <div class="ai-status-dot"></div>
            </div>
        `;

        // Add to header or appropriate location
        const header = document.querySelector('.navbar') || document.querySelector('header');
        if (header) {
            header.appendChild(indicator);
        }
    }

    /**
     * Update real-time data displays
     */
    updateRealTimeData(data) {
        // Update any real-time displays
        const elements = document.querySelectorAll('[data-ai-realtime]');
        elements.forEach(element => {
            const dataType = element.getAttribute('data-ai-realtime');
            if (data[dataType] !== undefined) {
                element.textContent = data[dataType];
            }
        });
    }
}

// Global instance
const aiInsights = new AIInsightsManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIInsightsManager;
}