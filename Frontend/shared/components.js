/**
 * WaitLess CHU - Shared UI Components
 * Dynamic header and footer components with role-based access control
 */

class UIComponents {
    constructor() {
        this.currentUser = null;
        this.currentPage = this.getCurrentPageName();
        this.init();
    }

    init() {
        // Load user data if authenticated
        if (typeof apiClient !== 'undefined' && apiClient.isAuthenticated()) {
            this.currentUser = apiClient.getCurrentUser();
        }
    }

    getCurrentPageName() {
        const path = window.location.pathname;
        const fileName = path.split('/').pop();
        return fileName.replace('.html', '');
    }

    /**
     * Generate role-based navigation items
     */
    getNavigationItems() {
        if (!this.currentUser) {
            return this.getPublicNavigation();
        }

        const role = this.currentUser.role;
        const baseItems = [
            { name: 'Accueil', path: '../Acceuil/acceuil.html', icon: 'fas fa-home' }
        ];

        const roleSpecificItems = {
            admin: [
                { name: 'Dashboard', path: '../dashboard/dashboard.html', icon: 'fas fa-chart-line' },
                { name: 'Personnel', path: '../staff/staff.html', icon: 'fas fa-users-cog' },
                { name: 'Services', path: '../services/services.html', icon: 'fas fa-hospital' },
                { name: 'Patients', path: '../patients/patients.html', icon: 'fas fa-user-injured' },
                { name: 'QR Codes', path: '../qr-display/qr-display.html', icon: 'fas fa-qrcode' },
                { name: 'Rapports', path: '../reports/reports.html', icon: 'fas fa-chart-bar' },
                { name: 'Assistant IA', path: '../chatbot/admin-chatbot.html', icon: 'fas fa-robot' }
            ],
            staff: [
                { name: 'Secrétariat', path: '../secretary/secretary.html', icon: 'fas fa-clipboard-list' }
            ],
            doctor: [
                { name: 'Consultations', path: '../secretary/secretary.html', icon: 'fas fa-stethoscope' }
            ],
            patient: [
                { name: 'Scanner QR', path: '../qr code/qr.html', icon: 'fas fa-qrcode' },
                { name: 'Mes Tickets', path: '../tickets/ticket.html', icon: 'fas fa-ticket-alt' },
                { name: 'Assistant', path: '../chatbot/chatbot.html', icon: 'fas fa-comments' }
            ]
        };

        return [...baseItems, ...(roleSpecificItems[role] || [])];
    }

    getPublicNavigation() {
        return [
            { name: 'Accueil', path: '#home', icon: 'fas fa-home' },
            { name: 'Fonctionnalités', path: '#features', icon: 'fas fa-star' },
            { name: 'Application', path: '#app', icon: 'fas fa-mobile-alt' },
            { name: 'Équipe', path: '#team', icon: 'fas fa-users' },
            { name: 'Contact', path: '#contact', icon: 'fas fa-envelope' }
        ];
    }

    /**
     * Generate header HTML with role-based navigation
     */
    generateHeader() {
        const navItems = this.getNavigationItems();
        const isAuthenticated = this.currentUser !== null;

        const navHTML = navItems.map(item => {
            const isActive = this.isActivePage(item.path);
            return `
                <li>
                    <a href="${item.path}" ${isActive ? 'class="active"' : ''}>
                        <i class="${item.icon}"></i>
                        ${item.name}
                    </a>
                </li>
            `;
        }).join('');

        const accountSection = isAuthenticated ? this.generateAccountSection() : this.generateLoginButton();

        return `
            <header class="navbar">
                <div class="logo">
                    <img src="../Acceuil/public/logofinal.png" alt="WaitLess Logo" class="logo-img">
                </div>
                <nav class="main-nav">
                    <ul>
                        ${navHTML}
                    </ul>
                </nav>
                ${accountSection}
            </header>
        `;
    }

    isActivePage(path) {
        if (path.startsWith('#')) return false;
        const pageName = path.split('/').pop().replace('.html', '');
        return pageName === this.currentPage;
    }

    generateAccountSection() {
        const user = this.currentUser;
        const displayName = user.full_name.length > 15 ? user.full_name.substring(0, 15) + '...' : user.full_name;
        const roleText = this.getRoleDisplayName(user.role);

        return `
            <div class="account-section">
                <div class="user-info-header">
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="user-details">
                        <span class="user-name">${displayName}</span>
                        <span class="user-role">${roleText}</span>
                    </div>
                </div>
                <button class="logout-btn" onclick="handleLogout()" title="Déconnexion">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        `;
    }

    generateLoginButton() {
        return `
            <div class="auth-section">
                <button class="login-btn" onclick="openUserLogin()">
                    <i class="fas fa-sign-in-alt"></i>
                    Connexion
                </button>
            </div>
        `;
    }

    getRoleDisplayName(role) {
        const roleNames = {
            'admin': 'Administrateur',
            'staff': 'Secrétaire',
            'doctor': 'Médecin',
            'patient': 'Patient'
        };
        return roleNames[role] || role;
    }

    /**
     * Generate footer HTML
     */
    generateFooter() {
        const currentYear = new Date().getFullYear();
        const isAuthenticated = this.currentUser !== null;
        const quickLinks = this.getFooterLinks();

        return `
            <footer class="app-footer">
                <div class="footer-content">
                    <div class="footer-section">
                        <div class="footer-logo">
                            <img src="../Acceuil/public/logofinal.png" alt="WaitLess Logo" class="footer-logo-img">
                            <div>
                                <h3>WaitLess CHU</h3>
                                <p>Gestion intelligente des temps d'attente</p>
                            </div>
                        </div>
                        <div class="footer-description">
                            <p>Optimisez votre expérience hospitalière avec notre solution innovante de gestion des files d'attente.</p>
                        </div>
                    </div>
                    
                    <div class="footer-section">
                        <h4><i class="fas fa-link"></i> Liens Rapides</h4>
                        <ul class="footer-links">
                            ${quickLinks}
                        </ul>
                    </div>
                    
                    <div class="footer-section">
                        <h4><i class="fas fa-envelope"></i> Contact</h4>
                        <div class="contact-info">
                            <p><i class="fas fa-envelope"></i> contact@waitless-chu.app</p>
                            <p><i class="fas fa-phone"></i> +212 6 00 00 00 00</p>
                            <p><i class="fas fa-map-marker-alt"></i> CHU Hassan II, Rabat</p>
                        </div>
                    </div>
                    
                    <div class="footer-section">
                        <h4><i class="fas fa-info-circle"></i> Assistance</h4>
                        <div class="support-links">
                            <a href="#" onclick="showHelpModal()"><i class="fas fa-question-circle"></i> Centre d'aide</a>
                            <a href="../chatbot/chatbot.html"><i class="fas fa-comments"></i> Chat Support</a>
                            <a href="#" onclick="showTechnicalSupport()"><i class="fas fa-tools"></i> Support Technique</a>
                        </div>
                    </div>
                </div>
                
                <div class="footer-divider"></div>
                
                <div class="footer-bottom">
                    <div class="footer-bottom-content">
                        <p>© ${currentYear} WaitLess CHU. Tous droits réservés.</p>
                        <div class="footer-meta">
                            <span>Projet de Fin d'Études 2025</span>
                            <span>•</span>
                            <span>Version 1.0</span>
                            ${isAuthenticated ? `<span>•</span><span>Connecté en tant que ${this.getRoleDisplayName(this.currentUser.role)}</span>` : ''}
                        </div>
                    </div>
                </div>
            </footer>
        `;
    }

    getFooterLinks() {
        const navItems = this.getNavigationItems();
        return navItems.slice(0, 6).map(item => `
            <li><a href="${item.path}"><i class="${item.icon}"></i> ${item.name}</a></li>
        `).join('');
    }

    /**
     * Inject header and footer into the current page
     */
    injectComponents() {
        // Ensure body has proper structure for sticky footer
        this.ensureBodyStructure();
        
        const existingHeader = document.querySelector('header.navbar, .navbar');
        if (existingHeader) {
            existingHeader.outerHTML = this.generateHeader();
        } else {
            document.body.insertAdjacentHTML('afterbegin', this.generateHeader());
        }

        const existingFooter = document.querySelector('footer, .footer, .app-footer');
        if (existingFooter) {
            existingFooter.outerHTML = this.generateFooter();
        } else {
            document.body.insertAdjacentHTML('beforeend', this.generateFooter());
        }

        this.applyEnhancedStyles();
    }

    /**
     * Ensure body has proper structure for sticky footer layout
     */
    ensureBodyStructure() {
        // Add necessary CSS classes to body
        document.body.classList.add('waitless-app');
        
        // Ensure proper min-height
        if (!document.body.style.minHeight) {
            document.body.style.minHeight = '100vh';
        }
        
        // Check if we need flex layout
        const computedStyle = window.getComputedStyle(document.body);
        if (computedStyle.display !== 'flex') {
            document.body.style.display = 'flex';
            document.body.style.flexDirection = 'column';
        }
    }

    /**
     * Apply enhanced CSS styles for header and footer
     */
    applyEnhancedStyles() {
        const styleId = 'waitless-shared-components';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = this.getEnhancedStyles();
        document.head.appendChild(style);
    }

    getEnhancedStyles() {
        return `
            /* Global Layout Fixes */
            .waitless-app {
                min-height: 100vh !important;
                display: flex !important;
                flex-direction: column !important;
            }

            /* Ensure main content takes remaining space */
            .waitless-app > *:not(header):not(footer):not(.navbar):not(.app-footer) {
                flex: 1;
            }

            /* Enhanced Header Styles */
            .navbar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem 2rem;
                background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
                backdrop-filter: blur(10px);
                box-shadow: 0 4px 20px rgba(74, 144, 226, 0.3);
                position: sticky;
                top: 0;
                z-index: 1000;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                flex-shrink: 0;
            }

            .logo {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            .logo-img {
                max-height: 80px;
                object-fit: contain;
                filter: brightness(1.1);
            }

            .main-nav ul {
                display: flex;
                list-style: none;
                gap: 0.5rem;
                margin: 0;
                padding: 0;
            }

            .main-nav ul li a {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: white;
                font-weight: 500;
                font-size: 0.9rem;
                padding: 0.7rem 1.2rem;
                border-radius: 10px;
                transition: all 0.3s ease;
                text-decoration: none;
                position: relative;
                overflow: hidden;
            }

            .main-nav ul li a:hover,
            .main-nav ul li a.active {
                background: rgba(255, 255, 255, 0.15);
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            }

            .main-nav ul li a.active {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
            }

            .main-nav ul li a i {
                font-size: 0.9rem;
                width: 16px;
                text-align: center;
            }

            /* Account Section Styles */
            .account-section {
                display: flex;
                align-items: center;
                gap: 1rem;
                background: rgba(255, 255, 255, 0.1);
                padding: 0.6rem 1rem;
                border-radius: 15px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
            }

            .user-info-header {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            .user-avatar {
                width: 36px;
                height: 36px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 14px;
                border: 2px solid rgba(255, 255, 255, 0.3);
            }

            .user-details {
                display: flex;
                flex-direction: column;
                color: white;
            }

            .user-name {
                font-weight: 600;
                font-size: 0.9rem;
                line-height: 1.2;
            }

            .user-role {
                font-size: 0.75rem;
                opacity: 0.8;
                font-weight: 400;
            }

            .logout-btn {
                background: rgba(255, 107, 107, 0.2);
                border: 1px solid rgba(255, 107, 107, 0.3);
                color: white;
                padding: 0.5rem;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 0.9rem;
            }

            .logout-btn:hover {
                background: rgba(255, 107, 107, 0.3);
                transform: translateY(-1px);
            }

            /* Auth Section Styles */
            .auth-section {
                display: flex;
                align-items: center;
            }

            .login-btn {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: white;
                padding: 0.7rem 1.2rem;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-weight: 500;
                backdrop-filter: blur(10px);
            }

            .login-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            }

            /* Enhanced Footer Styles */
            .app-footer {
                background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
                color: white;
                margin-top: auto;
                position: relative;
                overflow: hidden;
                flex-shrink: 0;
            }

            .app-footer::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            }

            .footer-content {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr;
                gap: 2rem;
                padding: 3rem 2rem 2rem;
                max-width: 1200px;
                margin: 0 auto;
            }

            .footer-section h3,
            .footer-section h4 {
                margin-bottom: 1rem;
                color: #ffffff;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .footer-logo {
                display: flex;
                align-items: center;
                gap: 1rem;
                margin-bottom: 1rem;
            }

            .footer-logo-img {
                max-height: 50px;
                object-fit: contain;
                filter: brightness(1.2);
            }

            .footer-description {
                opacity: 0.9;
                line-height: 1.6;
                font-size: 0.9rem;
            }

            .footer-links {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .footer-links li {
                margin-bottom: 0.5rem;
            }

            .footer-links a,
            .support-links a {
                color: rgba(255, 255, 255, 0.8);
                text-decoration: none;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.9rem;
                padding: 0.25rem 0;
            }

            .footer-links a:hover,
            .support-links a:hover {
                color: white;
                transform: translateX(5px);
                background: rgba(255, 255, 255, 0.1);
                padding-left: 0.5rem;
                border-radius: 4px;
            }

            .contact-info p {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-bottom: 0.5rem;
                font-size: 0.9rem;
                opacity: 0.9;
            }

            .support-links {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .footer-divider {
                height: 1px;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                margin: 1rem 2rem;
            }

            .footer-bottom {
                padding: 1.5rem 2rem;
                background: rgba(0, 0, 0, 0.1);
            }

            .footer-bottom-content {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 1rem;
            }

            .footer-meta {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.8rem;
                opacity: 0.7;
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .navbar {
                    padding: 1rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .main-nav ul {
                    flex-wrap: wrap;
                    gap: 0.25rem;
                }

                .main-nav ul li a {
                    padding: 0.5rem 0.8rem;
                    font-size: 0.8rem;
                }

                .user-details {
                    display: none;
                }

                .footer-content {
                    grid-template-columns: 1fr;
                    gap: 2rem;
                    padding: 2rem 1rem;
                }

                .footer-bottom-content {
                    flex-direction: column;
                    text-align: center;
                    gap: 0.5rem;
                }
            }

            @media (max-width: 480px) {
                .navbar {
                    padding: 0.75rem;
                }

                .logo-img {
                    max-height: 60px;
                }

                .main-nav ul li a {
                    padding: 0.4rem 0.6rem;
                    font-size: 0.75rem;
                }

                .main-nav ul li a i {
                    display: none;
                }
            }

            /* Content Container Improvements */
            .dashboard-container,
            .secretary-container,
            .ticket-container,
            .qr-container,
            .chatbot-container,
            .services-container,
            .staff-container,
            .patients-container {
                flex: 1;
                min-height: 0;
            }

            /* Smooth animations */
            @keyframes slideInFromTop {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes slideInFromBottom {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .navbar {
                animation: slideInFromTop 0.5s ease-out;
            }

            .app-footer {
                animation: slideInFromBottom 0.5s ease-out;
            }
        `;
    }

    updateForUser(user) {
        this.currentUser = user;
        this.injectComponents();
    }
}

// Global functions for modal support
window.showHelpModal = function() {
    if (typeof MessageManager !== 'undefined') {
        MessageManager.info('Centre d\'aide - Fonctionnalité en cours de développement', {
            title: 'Centre d\'aide',
            duration: 3000
        });
    } else {
        alert('Centre d\'aide - Fonctionnalité en cours de développement');
    }
};

window.showTechnicalSupport = function() {
    if (typeof MessageManager !== 'undefined') {
        MessageManager.info('Support technique disponible par email: support@waitless-chu.app', {
            title: 'Support Technique',
            duration: 5000
        });
    } else {
        alert('Support technique disponible par email: support@waitless-chu.app');
    }
};

// Global instance
let uiComponents;

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        uiComponents = new UIComponents();
        uiComponents.injectComponents();
        
        if (typeof apiClient !== 'undefined') {
            const originalSetToken = apiClient.setToken;
            apiClient.setToken = function(token) {
                originalSetToken.call(this, token);
                if (uiComponents) {
                    uiComponents.updateForUser(this.getCurrentUser());
                }
            };

            const originalRemoveToken = apiClient.removeToken;
            apiClient.removeToken = function() {
                originalRemoveToken.call(this);
                if (uiComponents) {
                    uiComponents.updateForUser(null);
                }
            };
        }
    }, 100);
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIComponents };
}
