/**
 * Loading Manager for Beautiful Loading States
 * Provides consistent loading indicators across the application
 */

class LoadingManager {
    constructor() {
        this.activeLoaders = new Set();
        this.createGlobalStyles();
    }
    
    // Create global styles for loading components
    createGlobalStyles() {
        if (document.getElementById('loading-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'loading-styles';
        style.textContent = `
            /* Loading Overlay Styles */
            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.95);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                backdrop-filter: blur(2px);
                border-radius: inherit;
            }
            
            .loading-overlay-dark {
                background: rgba(0, 0, 0, 0.8);
                color: white;
            }
            
            /* Global Loading Overlay */
            .global-loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(3px);
            }
            
            .loading-content {
                text-align: center;
                padding: 2rem;
                border-radius: 12px;
                background: white;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                max-width: 300px;
            }
            
            /* Spinner Animations */
            .spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #4A90E2;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            }
            
            .spinner-large {
                width: 60px;
                height: 60px;
                border: 6px solid #f3f3f3;
                border-top: 6px solid #4A90E2;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1.5rem;
            }
            
            .spinner-small {
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #4A90E2;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 0.5rem;
            }
            
            /* Dots Loader */
            .dots-loader {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 4px;
                margin: 1rem auto;
            }
            
            .dots-loader .dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: #4A90E2;
                animation: dots-bounce 1.4s ease-in-out infinite both;
            }
            
            .dots-loader .dot:nth-child(1) { animation-delay: -0.32s; }
            .dots-loader .dot:nth-child(2) { animation-delay: -0.16s; }
            .dots-loader .dot:nth-child(3) { animation-delay: 0; }
            
            /* Wave Loader */
            .wave-loader {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 3px;
                margin: 1rem auto;
            }
            
            .wave-loader .bar {
                width: 4px;
                height: 20px;
                background-color: #4A90E2;
                border-radius: 2px;
                animation: wave 1.2s ease-in-out infinite;
            }
            
            .wave-loader .bar:nth-child(1) { animation-delay: 0s; }
            .wave-loader .bar:nth-child(2) { animation-delay: 0.1s; }
            .wave-loader .bar:nth-child(3) { animation-delay: 0.2s; }
            .wave-loader .bar:nth-child(4) { animation-delay: 0.3s; }
            .wave-loader .bar:nth-child(5) { animation-delay: 0.4s; }
            
            /* Pulse Loader */
            .pulse-loader {
                width: 40px;
                height: 40px;
                background-color: #4A90E2;
                border-radius: 50%;
                margin: 1rem auto;
                animation: pulse 1.5s ease-in-out infinite;
            }
            
            /* Progress Bar */
            .loading-progress {
                width: 100%;
                height: 4px;
                background-color: #f3f3f3;
                border-radius: 2px;
                overflow: hidden;
                margin: 1rem 0;
            }
            
            .loading-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #4A90E2, #357ABD);
                border-radius: 2px;
                animation: progress-indeterminate 2s linear infinite;
            }
            
            /* Skeleton Loaders */
            .skeleton {
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: skeleton-loading 1.5s infinite;
                border-radius: 4px;
            }
            
            .skeleton-text {
                height: 1rem;
                margin: 0.5rem 0;
            }
            
            .skeleton-title {
                height: 1.5rem;
                margin: 1rem 0;
                width: 70%;
            }
            
            .skeleton-avatar {
                width: 3rem;
                height: 3rem;
                border-radius: 50%;
            }
            
            .skeleton-card {
                height: 200px;
                border-radius: 8px;
            }
            
            /* Loading Text */
            .loading-text {
                margin-top: 1rem;
                font-size: 14px;
                color: #666;
                text-align: center;
            }
            
            .loading-message {
                margin-top: 0.5rem;
                font-size: 16px;
                font-weight: 500;
                color: #333;
                text-align: center;
            }
            
            /* Button Loading States */
            .btn-loading {
                position: relative;
                pointer-events: none;
                opacity: 0.7;
            }
            
            .btn-loading::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 16px;
                height: 16px;
                border: 2px solid transparent;
                border-top: 2px solid currentColor;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            .btn-loading .btn-text {
                opacity: 0;
            }
            
            /* Animations */
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            @keyframes dots-bounce {
                0%, 80%, 100% {
                    transform: scale(0);
                }
                40% {
                    transform: scale(1);
                }
            }
            
            @keyframes wave {
                0%, 40%, 100% {
                    transform: scaleY(0.4);
                }
                20% {
                    transform: scaleY(1);
                }
            }
            
            @keyframes pulse {
                0% {
                    transform: scale(0);
                    opacity: 1;
                }
                100% {
                    transform: scale(1);
                    opacity: 0;
                }
            }
            
            @keyframes progress-indeterminate {
                0% {
                    transform: translateX(-100%);
                }
                100% {
                    transform: translateX(100%);
                }
            }
            
            @keyframes skeleton-loading {
                0% {
                    background-position: -200% 0;
                }
                100% {
                    background-position: 200% 0;
                }
            }
            
            /* Fade in/out animations */
            .fade-in {
                animation: fadeIn 0.3s ease-in;
            }
            
            .fade-out {
                animation: fadeOut 0.3s ease-out;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Show loading overlay on specific element
    show(element, options = {}) {
        if (!element) return null;
        
        const defaults = {
            message: 'Chargement...',
            type: 'spinner', // spinner, dots, wave, pulse, skeleton
            theme: 'light', // light, dark
            overlay: true
        };
        
        const config = { ...defaults, ...options };
        const loaderId = `loader_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Remove existing loader if any
        this.hide(element);
        
        const loader = document.createElement('div');
        loader.className = `loading-overlay ${config.theme === 'dark' ? 'loading-overlay-dark' : ''} fade-in`;
        loader.setAttribute('data-loader-id', loaderId);
        
        loader.innerHTML = this.getLoaderHTML(config);
        
        // Ensure element has relative positioning
        const originalPosition = element.style.position;
        if (!originalPosition || originalPosition === 'static') {
            element.style.position = 'relative';
            loader.setAttribute('data-original-position', originalPosition || 'static');
        }
        
        element.appendChild(loader);
        this.activeLoaders.add(loaderId);
        
        return loaderId;
    }
    
    // Hide loading overlay
    hide(element) {
        if (!element) return;
        
        const loader = element.querySelector('.loading-overlay');
        if (loader) {
            const loaderId = loader.getAttribute('data-loader-id');
            const originalPosition = loader.getAttribute('data-original-position');
            
            loader.classList.add('fade-out');
            
            setTimeout(() => {
                if (loader.parentElement) {
                    loader.remove();
                    
                    // Restore original position if needed
                    if (originalPosition) {
                        element.style.position = originalPosition;
                    }
                }
                
                if (loaderId) {
                    this.activeLoaders.delete(loaderId);
                }
            }, 300);
        }
    }
    
    // Show global loading overlay
    showGlobal(options = {}) {
        const defaults = {
            message: 'Chargement en cours...',
            description: null,
            type: 'spinner',
            cancelable: false
        };
        
        const config = { ...defaults, ...options };
        
        // Remove existing global loader
        this.hideGlobal();
        
        const overlay = document.createElement('div');
        overlay.id = 'global-loader';
        overlay.className = 'global-loading-overlay fade-in';
        
        let cancelButton = '';
        if (config.cancelable) {
            cancelButton = `
                <button class="btn btn-secondary" onclick="LoadingManager.hideGlobal()" style="margin-top: 1rem;">
                    Annuler
                </button>
            `;
        }
        
        overlay.innerHTML = `
            <div class="loading-content">
                ${this.getLoaderHTML(config)}
                <div class="loading-message">${config.message}</div>
                ${config.description ? `<div class="loading-text">${config.description}</div>` : ''}
                ${cancelButton}
            </div>
        `;
        
        document.body.appendChild(overlay);
        return overlay;
    }
    
    // Hide global loading overlay
    hideGlobal() {
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => {
                if (loader.parentElement) {
                    loader.remove();
                }
            }, 300);
        }
    }
    
    // Show button loading state
    showButtonLoading(button, text = null) {
        if (!button) return;
        
        button.classList.add('btn-loading');
        button.disabled = true;
        
        const textElement = button.querySelector('.btn-text') || button;
        if (text) {
            textElement.setAttribute('data-original-text', textElement.textContent);
            textElement.textContent = text;
        }
    }
    
    // Hide button loading state
    hideButtonLoading(button) {
        if (!button) return;
        
        button.classList.remove('btn-loading');
        button.disabled = false;
        
        const textElement = button.querySelector('.btn-text') || button;
        const originalText = textElement.getAttribute('data-original-text');
        if (originalText) {
            textElement.textContent = originalText;
            textElement.removeAttribute('data-original-text');
        }
    }
    
    // Create skeleton loader for content
    showSkeleton(element, config = {}) {
        if (!element) return;
        
        const defaults = {
            type: 'text', // text, card, list, avatar
            count: 3
        };
        
        const settings = { ...defaults, ...config };
        const skeletonHTML = this.getSkeletonHTML(settings);
        
        element.innerHTML = skeletonHTML;
        element.classList.add('fade-in');
    }
    
    // Get loader HTML based on type
    getLoaderHTML(config) {
        switch (config.type) {
            case 'dots':
                return `
                    <div class="dots-loader">
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <div class="dot"></div>
                    </div>
                    ${config.message ? `<div class="loading-text">${config.message}</div>` : ''}
                `;
            
            case 'wave':
                return `
                    <div class="wave-loader">
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                    </div>
                    ${config.message ? `<div class="loading-text">${config.message}</div>` : ''}
                `;
            
            case 'pulse':
                return `
                    <div class="pulse-loader"></div>
                    ${config.message ? `<div class="loading-text">${config.message}</div>` : ''}
                `;
            
            case 'progress':
                return `
                    <div class="loading-progress">
                        <div class="loading-progress-bar"></div>
                    </div>
                    ${config.message ? `<div class="loading-text">${config.message}</div>` : ''}
                `;
            
            case 'spinner':
            default:
                const spinnerClass = config.size === 'large' ? 'spinner-large' : 
                                  config.size === 'small' ? 'spinner-small' : 'spinner';
                return `
                    <div class="${spinnerClass}"></div>
                    ${config.message ? `<div class="loading-text">${config.message}</div>` : ''}
                `;
        }
    }
    
    // Get skeleton HTML based on type
    getSkeletonHTML(config) {
        switch (config.type) {
            case 'card':
                return `
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text" style="width: 80%;"></div>
                `;
            
            case 'list':
                let listHTML = '';
                for (let i = 0; i < config.count; i++) {
                    listHTML += `
                        <div style="display: flex; align-items: center; margin: 1rem 0;">
                            <div class="skeleton skeleton-avatar" style="margin-right: 1rem;"></div>
                            <div style="flex: 1;">
                                <div class="skeleton skeleton-text" style="width: 60%;"></div>
                                <div class="skeleton skeleton-text" style="width: 40%;"></div>
                            </div>
                        </div>
                    `;
                }
                return listHTML;
            
            case 'avatar':
                return `
                    <div style="display: flex; align-items: center;">
                        <div class="skeleton skeleton-avatar" style="margin-right: 1rem;"></div>
                        <div style="flex: 1;">
                            <div class="skeleton skeleton-text" style="width: 70%;"></div>
                            <div class="skeleton skeleton-text" style="width: 50%;"></div>
                        </div>
                    </div>
                `;
            
            case 'text':
            default:
                let textHTML = '';
                for (let i = 0; i < config.count; i++) {
                    const width = Math.random() * 30 + 70; // Random width between 70-100%
                    textHTML += `<div class="skeleton skeleton-text" style="width: ${width}%;"></div>`;
                }
                return textHTML;
        }
    }
    
    // Utility methods
    isLoading(element) {
        return element ? element.querySelector('.loading-overlay') !== null : false;
    }
    
    getActiveLoadersCount() {
        return this.activeLoaders.size;
    }
    
    hideAllLoaders() {
        document.querySelectorAll('.loading-overlay').forEach(loader => {
            const parent = loader.parentElement;
            if (parent) {
                this.hide(parent);
            }
        });
        
        this.hideGlobal();
    }
}

// Create global instance
const LoadingManager_Instance = new LoadingManager();

// Export methods for global use
window.LoadingManager = {
    show: (element, options) => LoadingManager_Instance.show(element, options),
    hide: (element) => LoadingManager_Instance.hide(element),
    showGlobal: (options) => LoadingManager_Instance.showGlobal(options),
    hideGlobal: () => LoadingManager_Instance.hideGlobal(),
    showButtonLoading: (button, text) => LoadingManager_Instance.showButtonLoading(button, text),
    hideButtonLoading: (button) => LoadingManager_Instance.hideButtonLoading(button),
    showSkeleton: (element, config) => LoadingManager_Instance.showSkeleton(element, config),
    isLoading: (element) => LoadingManager_Instance.isLoading(element),
    hideAllLoaders: () => LoadingManager_Instance.hideAllLoaders()
};