/**
 * AI WAIT TIME VISUALIZATION - INTERACTIVE JAVASCRIPT
 * ===================================================
 * 
 * This script provides dynamic interactions for the AI wait time estimation
 * system, including real-time updates, chart animations, and API integration.
 */

class AIWaitTimeVisualizer {
    constructor() {
        this.apiBaseUrl = 'http://localhost:8000/api';
        this.updateInterval = 5000; // 5 seconds
        this.ticketId = this.getTicketIdFromUrl();
        this.trendChart = null;
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        console.log('🤖 Initializing AI Wait Time Visualizer...');
        
        // Initialize components
        this.initializeTrendChart();
        this.startRealTimeUpdates();
        
        // Load initial data
        await this.loadAIEstimation();
        
        // Add interactive events
        this.addEventListeners();
        
        this.isInitialized = true;
        console.log('✅ AI Visualizer initialized successfully!');
    }

    getTicketIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('ticket_id') || localStorage.getItem('currentTicketId') || '1';
    }

    async loadAIEstimation() {
        try {
            console.log('📡 Loading AI estimation data...');
            
            // Simulate API call for demo purposes
            const aiData = await this.simulateAIResponse();
            
            // Update UI with AI data
            this.updatePredictionDisplay(aiData);
            this.updateConfidenceRing(aiData.confidence);
            this.updateInsights(aiData.insights);
            this.updatePredictionRange(aiData.range);
            this.updateFactors(aiData.factors);
            this.updateTrendChart(aiData.trend);
            
        } catch (error) {
            console.error('❌ Error loading AI estimation:', error);
            this.showErrorState();
        }
    }

    async simulateAIResponse() {
        // Simulate realistic AI response for demo
        const currentTime = new Date();
        const baseTime = 18 + Math.random() * 15; // 18-33 minutes
        
        return {
            estimated_minutes: Math.round(baseTime),
            confidence: 88 + Math.random() * 10, // 88-98%
            range: {
                min: Math.round(baseTime * 0.8),
                max: Math.round(baseTime * 1.3),
                current: Math.round(baseTime)
            },
            insights: [
                this.getRandomInsight('traffic'),
                this.getRandomInsight('priority'),
                this.getRandomInsight('consultation')
            ],
            factors: [
                { name: 'Heure de pointe', impact: '+15%', type: 'positive' },
                { name: 'Cardiologie', impact: 'Nominal', type: 'neutral' },
                { name: 'Priorité élevée', impact: '-20%', type: 'negative' },
                { name: 'File actuelle', impact: '+5%', type: 'positive' }
            ],
            trend: this.generateTrendData()
        };
    }

    getRandomInsight(type) {
        const insights = {
            traffic: [
                'Flux normal pour cette heure',
                'Légère affluence matinale',
                'Période calme de la journée',
                'Pic d\'activité en cours'
            ],
            priority: [
                'Priorité élevée - temps réduit',
                'Priorité normale - temps standard',
                'Cas urgent traité en priorité',
                'File prioritaire activée'
            ],
            consultation: [
                'Consultation rapide prévue',
                'Consultation standard attendue',
                'Consultation approfondie possible',
                'Temps de consultation optimisé'
            ]
        };
        
        const options = insights[type] || insights.traffic;
        return options[Math.floor(Math.random() * options.length)];
    }

    generateTrendData() {
        const data = [];
        const now = new Date();
        
        for (let i = 11; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 5 * 60000); // 5-minute intervals
            const baseValue = 20 + Math.sin(i * 0.5) * 5 + Math.random() * 4;
            
            data.push({
                time: time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                value: Math.round(baseValue)
            });
        }
        
        return data;
    }

    updatePredictionDisplay(aiData) {
        const timeValue = document.getElementById('aiPredictionTime');
        const clockHand = document.getElementById('aiClockHand');
        
        if (timeValue) {
            // Animate number change
            timeValue.style.transform = 'scale(1.2)';
            timeValue.style.opacity = '0.7';
            
            setTimeout(() => {
                timeValue.textContent = aiData.estimated_minutes;
                timeValue.style.transform = 'scale(1)';
                timeValue.style.opacity = '1';
            }, 150);
        }
        
        if (clockHand) {
            // Animate clock hand based on wait time
            const angle = Math.min(aiData.estimated_minutes * 6, 360); // 6 degrees per minute
            clockHand.style.transform = `translate(0, -50%) rotate(${angle}deg)`;
        }
    }

    updateConfidenceRing(confidence) {
        const confidenceCircle = document.getElementById('confidenceCircle');
        const confidenceScore = document.getElementById('confidenceScore');
        
        if (confidenceCircle && confidenceScore) {
            const circumference = 2 * Math.PI * 45; // radius = 45
            const dashOffset = circumference - (confidence / 100) * circumference;
            
            confidenceCircle.style.strokeDashoffset = dashOffset;
            
            // Animate confidence score
            this.animateNumber(confidenceScore, parseInt(confidenceScore.textContent), Math.round(confidence));
        }
    }

    updateInsights(insights) {
        const insightElements = [
            document.getElementById('aiInsight1'),
            document.getElementById('aiInsight2'),
            document.getElementById('aiInsight3')
        ];
        
        insights.forEach((insight, index) => {
            if (insightElements[index]) {
                insightElements[index].textContent = insight;
            }
        });
    }

    updatePredictionRange(range) {
        const minTime = document.getElementById('minTime');
        const currentTime = document.getElementById('currentTime');
        const maxTime = document.getElementById('maxTime');
        const rangeFill = document.getElementById('rangeFill');
        
        if (minTime) minTime.textContent = range.min;
        if (currentTime) currentTime.textContent = range.current;
        if (maxTime) maxTime.textContent = range.max;
        
        if (rangeFill) {
            const percentage = ((range.current - range.min) / (range.max - range.min)) * 100;
            rangeFill.style.width = `${Math.min(Math.max(percentage, 10), 90)}%`;
        }
    }

    updateFactors(factors) {
        const factorItems = document.querySelectorAll('.factor-item');
        
        factors.forEach((factor, index) => {
            if (factorItems[index]) {
                const label = factorItems[index].querySelector('.factor-label');
                const impact = factorItems[index].querySelector('.factor-impact');
                
                if (label) label.textContent = factor.name;
                if (impact) {
                    impact.textContent = factor.impact;
                    impact.className = `factor-impact ${factor.type}`;
                }
            }
        });
    }

    initializeTrendChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;
        
        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Temps d\'attente estimé',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Minutes',
                            color: '#666',
                            font: {
                                family: 'Poppins',
                                size: 12
                            }
                        },
                        grid: {
                            color: 'rgba(102, 126, 234, 0.1)'
                        },
                        ticks: {
                            color: '#666',
                            font: {
                                family: 'Poppins'
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Heure',
                            color: '#666',
                            font: {
                                family: 'Poppins',
                                size: 12
                            }
                        },
                        grid: {
                            color: 'rgba(102, 126, 234, 0.1)'
                        },
                        ticks: {
                            color: '#666',
                            font: {
                                family: 'Poppins'
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(102, 126, 234, 0.9)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        cornerRadius: 8,
                        titleFont: {
                            family: 'Poppins'
                        },
                        bodyFont: {
                            family: 'Poppins'
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    updateTrendChart(trendData) {
        if (!this.trendChart || !trendData) return;
        
        this.trendChart.data.labels = trendData.map(point => point.time);
        this.trendChart.data.datasets[0].data = trendData.map(point => point.value);
        this.trendChart.update('active');
    }

    animateNumber(element, start, end, duration = 1000) {
        const startTime = performance.now();
        
        const updateNumber = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = Math.round(start + (end - start) * this.easeOutQuart(progress));
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            }
        };
        
        requestAnimationFrame(updateNumber);
    }

    easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    startRealTimeUpdates() {
        // Update every 5 seconds
        setInterval(() => {
            if (this.isInitialized) {
                this.loadAIEstimation();
                this.updateLastUpdateTime();
            }
        }, this.updateInterval);
        
        // Initial update time
        this.updateLastUpdateTime();
    }

    updateLastUpdateTime() {
        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate) {
            const now = new Date();
            lastUpdate.textContent = `Dernière mise à jour : ${now.toLocaleTimeString('fr-FR')}`;
        }
    }

    addEventListeners() {
        // Add click handlers for interactive elements
        document.querySelectorAll('.factor-item').forEach(item => {
            item.addEventListener('click', () => {
                this.showFactorDetails(item);
            });
        });
        
        // Add hover effects for insights
        document.querySelectorAll('.insight-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = 'rgba(102, 126, 234, 0.05)';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = 'transparent';
            });
        });
    }

    showFactorDetails(factorElement) {
        const label = factorElement.querySelector('.factor-label').textContent;
        const impact = factorElement.querySelector('.factor-impact').textContent;
        
        // Simple alert for demo - could be replaced with modal
        alert(`Facteur IA: ${label}\nImpact: ${impact}\n\nCe facteur influence le calcul du temps d'attente basé sur l'analyse des données historiques et en temps réel.`);
    }

    showErrorState() {
        console.log('⚠️ Showing error state for AI visualization');
        
        const container = document.querySelector('.ai-prediction-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; color: #666;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f59e0b; margin-bottom: 20px;"></i>
                    <h3>Connexion IA temporairement indisponible</h3>
                    <p>Nous utilisons les estimations de base en attendant le retour de l'IA.</p>
                    <button onclick="location.reload()" style="
                        background: #667eea; 
                        color: white; 
                        border: none; 
                        padding: 12px 24px; 
                        border-radius: 8px; 
                        margin-top: 20px;
                        cursor: pointer;
                    ">Réessayer</button>
                </div>
            `;
        }
    }
}

// Global functions for external access
window.AIWaitTimeVisualizer = AIWaitTimeVisualizer;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.aiVisualizer = new AIWaitTimeVisualizer();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIWaitTimeVisualizer;
}