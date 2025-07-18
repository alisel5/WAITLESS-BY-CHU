/**
 * Enhanced Message Manager for Beautiful Notifications
 * Provides consistent user feedback across the application
 */

class MessageManager {
    constructor() {
        this.messages = new Map();
        this.messageQueue = [];
        this.isProcessingQueue = false;
        this.maxMessages = 5;
        this.defaultDuration = 5000;
        
        this.createGlobalStyles();
        this.createContainer();
    }
    
    // Create global styles for messages
    createGlobalStyles() {
        if (document.getElementById('message-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'message-styles';
        style.textContent = `
            /* Message Container */
            .message-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10001;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 400px;
                pointer-events: none;
            }
            
            /* Base Message Styles */
            .message {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                padding: 16px;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                pointer-events: auto;
                transform: translateX(100%);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border-left: 4px solid #ccc;
                position: relative;
                overflow: hidden;
            }
            
            .message.show {
                transform: translateX(0);
                opacity: 1;
            }
            
            .message.hide {
                transform: translateX(100%);
                opacity: 0;
                margin-bottom: -100px;
            }
            
            /* Message Types */
            .message-success {
                border-left-color: #28a745;
                background: linear-gradient(135deg, #d4edda 0%, #ffffff 100%);
            }
            
            .message-error {
                border-left-color: #dc3545;
                background: linear-gradient(135deg, #f8d7da 0%, #ffffff 100%);
            }
            
            .message-warning {
                border-left-color: #ffc107;
                background: linear-gradient(135deg, #fff3cd 0%, #ffffff 100%);
            }
            
            .message-info {
                border-left-color: #17a2b8;
                background: linear-gradient(135deg, #d1ecf1 0%, #ffffff 100%);
            }
            
            /* Message Icon */
            .message-icon {
                font-size: 20px;
                min-width: 20px;
                margin-top: 2px;
            }
            
            .message-success .message-icon {
                color: #28a745;
            }
            
            .message-error .message-icon {
                color: #dc3545;
            }
            
            .message-warning .message-icon {
                color: #ffc107;
            }
            
            .message-info .message-icon {
                color: #17a2b8;
            }
            
            /* Message Content */
            .message-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .message-title {
                font-weight: 600;
                font-size: 14px;
                color: #333;
                margin: 0;
            }
            
            .message-text {
                font-size: 13px;
                color: #666;
                margin: 0;
                line-height: 1.4;
            }
            
            .message-actions {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }
            
            .message-action {
                background: none;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .message-action:hover {
                background: #f8f9fa;
            }
            
            .message-action.primary {
                background: #4A90E2;
                color: white;
                border-color: #4A90E2;
            }
            
            .message-action.primary:hover {
                background: #357ABD;
            }
            
            /* Close Button */
            .message-close {
                position: absolute;
                top: 8px;
                right: 8px;
                background: none;
                border: none;
                font-size: 16px;
                color: #999;
                cursor: pointer;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
            }
            
            .message-close:hover {
                background: rgba(0, 0, 0, 0.1);
                color: #666;
            }
            
            /* Progress Bar for Auto-dismiss */
            .message-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(0, 0, 0, 0.1);
                transition: width linear;
            }
            
            .message-success .message-progress {
                background: #28a745;
            }
            
            .message-error .message-progress {
                background: #dc3545;
            }
            
            .message-warning .message-progress {
                background: #ffc107;
            }
            
            .message-info .message-progress {
                background: #17a2b8;
            }
            
            /* Modal Messages */
            .message-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10002;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            
            .message-modal-overlay.show {
                opacity: 1;
                visibility: visible;
            }
            
            .message-modal {
                background: white;
                border-radius: 12px;
                padding: 24px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
                transform: scale(0.9);
                transition: transform 0.3s ease;
            }
            
            .message-modal-overlay.show .message-modal {
                transform: scale(1);
            }
            
            .message-modal-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }
            
            .message-modal-icon {
                font-size: 24px;
            }
            
            .message-modal-title {
                font-size: 18px;
                font-weight: 600;
                margin: 0;
                color: #333;
            }
            
            .message-modal-content {
                margin-bottom: 20px;
                color: #666;
                line-height: 1.5;
            }
            
            .message-modal-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }
            
            .message-modal-action {
                padding: 8px 16px;
                border-radius: 6px;
                border: 1px solid #ddd;
                background: white;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s ease;
            }
            
            .message-modal-action.primary {
                background: #4A90E2;
                color: white;
                border-color: #4A90E2;
            }
            
            .message-modal-action:hover {
                background: #f8f9fa;
            }
            
            .message-modal-action.primary:hover {
                background: #357ABD;
            }
            
            /* Responsive Design */
            @media (max-width: 768px) {
                .message-container {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
                
                .message {
                    transform: translateY(-100%);
                }
                
                .message.show {
                    transform: translateY(0);
                }
                
                .message.hide {
                    transform: translateY(-100%);
                    margin-bottom: 0;
                }
            }
            
            /* Animations */
            @keyframes messageSlideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes messageSlideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Create message container
    createContainer() {
        if (document.getElementById('message-container')) return;
        
        const container = document.createElement('div');
        container.id = 'message-container';
        container.className = 'message-container';
        document.body.appendChild(container);
    }
    
    // Show message notification
    show(type, message, options = {}) {
        const defaults = {
            duration: this.defaultDuration,
            title: null,
            actions: [],
            persistent: false,
            closable: true,
            progress: true
        };
        
        const config = { ...defaults, ...options };
        const messageId = this.generateId();
        
        // Add to queue if too many messages
        if (this.messages.size >= this.maxMessages) {
            this.messageQueue.push({ type, message, config, messageId });
            this.processQueue();
            return messageId;
        }
        
        const messageElement = this.createMessageElement(type, message, config, messageId);
        this.messages.set(messageId, {
            element: messageElement,
            config: config,
            timer: null
        });
        
        const container = document.getElementById('message-container');
        container.appendChild(messageElement);
        
        // Trigger show animation
        requestAnimationFrame(() => {
            messageElement.classList.add('show');
        });
        
        // Auto-dismiss if not persistent
        if (!config.persistent && config.duration > 0) {
            this.startAutoDismiss(messageId, config.duration);
        }
        
        return messageId;
    }
    
    // Create message element
    createMessageElement(type, message, config, messageId) {
        const element = document.createElement('div');
        element.className = `message message-${type}`;
        element.setAttribute('data-message-id', messageId);
        
        const icon = this.getIcon(type);
        const title = config.title || this.getDefaultTitle(type);
        
        let actionsHTML = '';
        if (config.actions && config.actions.length > 0) {
            actionsHTML = `
                <div class="message-actions">
                    ${config.actions.map((action, index) => `
                        <button class="message-action ${action.primary ? 'primary' : ''}" 
                                onclick="MessageManager.handleAction('${messageId}', ${index})">
                            ${action.text}
                        </button>
                    `).join('')}
                </div>
            `;
        }
        
        element.innerHTML = `
            <div class="message-icon">
                <i class="${icon}"></i>
            </div>
            <div class="message-content">
                ${title ? `<div class="message-title">${title}</div>` : ''}
                <div class="message-text">${message}</div>
                ${actionsHTML}
            </div>
            ${config.closable ? `
                <button class="message-close" onclick="MessageManager.hide('${messageId}')">
                    <i class="fas fa-times"></i>
                </button>
            ` : ''}
            ${config.progress && !config.persistent ? '<div class="message-progress"></div>' : ''}
        `;
        
        return element;
    }
    
    // Hide message
    hide(messageId) {
        const messageData = this.messages.get(messageId);
        if (!messageData) return;
        
        const element = messageData.element;
        
        // Clear timer if exists
        if (messageData.timer) {
            clearTimeout(messageData.timer);
        }
        
        // Hide animation
        element.classList.add('hide');
        
        setTimeout(() => {
            if (element.parentElement) {
                element.remove();
            }
            this.messages.delete(messageId);
            this.processQueue();
        }, 300);
    }
    
    // Start auto-dismiss timer
    startAutoDismiss(messageId, duration) {
        const messageData = this.messages.get(messageId);
        if (!messageData) return;
        
        const progressBar = messageData.element.querySelector('.message-progress');
        if (progressBar) {
            progressBar.style.width = '100%';
            progressBar.style.transitionDuration = `${duration}ms`;
            
            requestAnimationFrame(() => {
                progressBar.style.width = '0%';
            });
        }
        
        messageData.timer = setTimeout(() => {
            this.hide(messageId);
        }, duration);
    }
    
    // Handle action clicks
    handleAction(messageId, actionIndex) {
        const messageData = this.messages.get(messageId);
        if (!messageData || !messageData.config.actions) return;
        
        const action = messageData.config.actions[actionIndex];
        if (action && action.callback) {
            action.callback();
        }
        
        // Auto-hide after action unless specified otherwise
        if (!action.keepOpen) {
            this.hide(messageId);
        }
    }
    
    // Process message queue
    processQueue() {
        if (this.isProcessingQueue || this.messageQueue.length === 0) return;
        if (this.messages.size >= this.maxMessages) return;
        
        this.isProcessingQueue = true;
        
        const { type, message, config, messageId } = this.messageQueue.shift();
        this.show(type, message, { ...config, _id: messageId });
        
        this.isProcessingQueue = false;
        
        // Process next in queue if available
        if (this.messageQueue.length > 0) {
            setTimeout(() => this.processQueue(), 100);
        }
    }
    
    // Show modal message
    showModal(type, title, message, options = {}) {
        const defaults = {
            actions: [
                { text: 'OK', primary: true, callback: () => this.hideModal() }
            ],
            closable: true
        };
        
        const config = { ...defaults, ...options };
        const modalId = this.generateId();
        
        const overlay = document.createElement('div');
        overlay.className = 'message-modal-overlay';
        overlay.id = `modal-${modalId}`;
        
        const icon = this.getIcon(type);
        const actionsHTML = config.actions.map((action, index) => `
            <button class="message-modal-action ${action.primary ? 'primary' : ''}"
                    onclick="MessageManager.handleModalAction('${modalId}', ${index})">
                ${action.text}
            </button>
        `).join('');
        
        overlay.innerHTML = `
            <div class="message-modal">
                <div class="message-modal-header">
                    <div class="message-modal-icon message-${type}">
                        <i class="${icon}"></i>
                    </div>
                    <h3 class="message-modal-title">${title}</h3>
                </div>
                <div class="message-modal-content">${message}</div>
                <div class="message-modal-actions">
                    ${actionsHTML}
                </div>
            </div>
        `;
        
        // Store config for action handling
        overlay._config = config;
        
        document.body.appendChild(overlay);
        
        // Show modal
        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });
        
        // Close on backdrop click if closable
        if (config.closable) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hideModal(modalId);
                }
            });
        }
        
        return modalId;
    }
    
    // Hide modal
    hideModal(modalId = null) {
        const modal = modalId ? document.getElementById(`modal-${modalId}`) : 
                     document.querySelector('.message-modal-overlay.show');
        
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentElement) {
                    modal.remove();
                }
            }, 300);
        }
    }
    
    // Handle modal action clicks
    handleModalAction(modalId, actionIndex) {
        const modal = document.getElementById(`modal-${modalId}`);
        if (!modal || !modal._config || !modal._config.actions) return;
        
        const action = modal._config.actions[actionIndex];
        if (action && action.callback) {
            action.callback();
        }
        
        // Auto-hide modal unless specified otherwise
        if (!action.keepOpen) {
            this.hideModal(modalId);
        }
    }
    
    // Convenience methods
    success(message, options = {}) {
        return this.show('success', message, options);
    }
    
    error(message, options = {}) {
        return this.show('error', message, options);
    }
    
    warning(message, options = {}) {
        return this.show('warning', message, options);
    }
    
    info(message, options = {}) {
        return this.show('info', message, options);
    }
    
    confirm(title, message, onConfirm, onCancel = null) {
        return this.showModal('warning', title, message, {
            actions: [
                { 
                    text: 'Annuler', 
                    callback: onCancel || (() => {})
                },
                { 
                    text: 'Confirmer', 
                    primary: true, 
                    callback: onConfirm 
                }
            ]
        });
    }
    
    alert(title, message, callback = null) {
        return this.showModal('info', title, message, {
            actions: [
                { 
                    text: 'OK', 
                    primary: true, 
                    callback: callback || (() => {})
                }
            ]
        });
    }
    
    // Utility methods
    getIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }
    
    getDefaultTitle(type) {
        const titles = {
            success: 'Succès',
            error: 'Erreur',
            warning: 'Attention',
            info: 'Information'
        };
        return titles[type] || '';
    }
    
    generateId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Clear all messages
    clearAll() {
        this.messages.forEach((_, messageId) => {
            this.hide(messageId);
        });
        this.messageQueue = [];
    }
    
    // Get active messages count
    getActiveCount() {
        return this.messages.size;
    }
}

// Create global instance
const MessageManager_Instance = new MessageManager();

// Export for global use
window.MessageManager = {
    show: (type, message, options) => MessageManager_Instance.show(type, message, options),
    hide: (messageId) => MessageManager_Instance.hide(messageId),
    success: (message, options) => MessageManager_Instance.success(message, options),
    error: (message, options) => MessageManager_Instance.error(message, options),
    warning: (message, options) => MessageManager_Instance.warning(message, options),
    info: (message, options) => MessageManager_Instance.info(message, options),
    showModal: (type, title, message, options) => MessageManager_Instance.showModal(type, title, message, options),
    hideModal: (modalId) => MessageManager_Instance.hideModal(modalId),
    confirm: (title, message, onConfirm, onCancel) => MessageManager_Instance.confirm(title, message, onConfirm, onCancel),
    alert: (title, message, callback) => MessageManager_Instance.alert(title, message, callback),
    handleAction: (messageId, actionIndex) => MessageManager_Instance.handleAction(messageId, actionIndex),
    handleModalAction: (modalId, actionIndex) => MessageManager_Instance.handleModalAction(modalId, actionIndex),
    clearAll: () => MessageManager_Instance.clearAll(),
    getActiveCount: () => MessageManager_Instance.getActiveCount()
};