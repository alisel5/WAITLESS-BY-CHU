/**
 * Patient Chatbot Interface for WaitLess CHU
 * Provides intelligent assistance for hospital navigation and queue management
 */

class PatientChatbot {
    constructor() {
        this.sessionId = null;
        this.isTyping = false;
        this.conversationHistory = [];
        this.messageContainer = document.getElementById('chatMessages');
        this.inputField = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendBtn');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.charCounter = document.getElementById('charCounter');
        
        this.init();
    }
    
    async init() {
        console.log('🤖 Initializing Patient Chatbot...');
        
        // Generate session ID
        this.sessionId = this.generateSessionId();
        console.log('Session ID generated:', this.sessionId);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check chatbot health
        await this.checkChatbotHealth();
        
        // Don't load conversation history automatically - let user start fresh
        // await this.loadConversationHistory();
        
        console.log('✅ Patient Chatbot initialized successfully');
    }
    
    generateSessionId() {
        return `patient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    setupEventListeners() {
        // Input field events
        this.inputField.addEventListener('input', () => {
            this.updateCharCounter();
            this.toggleSendButton();
        });
        
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Send button
        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });
        
        // Remove the problematic DOMNodeInserted event listener
        // this.messageContainer.addEventListener('DOMNodeInserted', () => {
        //     this.scrollToBottom();
        // });
    }
    
    updateCharCounter() {
        const currentLength = this.inputField.value.length;
        const maxLength = this.inputField.maxLength;
        this.charCounter.textContent = `${currentLength}/${maxLength}`;
        
        if (currentLength > maxLength * 0.9) {
            this.charCounter.style.color = 'var(--warning-color)';
        } else {
            this.charCounter.style.color = 'var(--text-light)';
        }
    }
    
    toggleSendButton() {
        const hasText = this.inputField.value.trim().length > 0;
        this.sendButton.disabled = !hasText || this.isTyping;
        
        if (hasText && !this.isTyping) {
            this.sendButton.style.background = 'var(--primary-color)';
        } else {
            this.sendButton.style.background = 'var(--text-light)';
        }
    }
    
    async checkChatbotHealth() {
        try {
            const response = await fetch(`${apiClient.baseURL}/api/chatbot/health`);
            const health = await response.json();
            
            if (health.status === 'healthy') {
                this.updateStatus('En ligne - Prêt à vous aider', 'online');
            } else {
                this.updateStatus('Service temporairement indisponible', 'offline');
            }
        } catch (error) {
            console.warn('Chatbot health check failed:', error);
            this.updateStatus('Connexion limitée', 'warning');
        }
    }
    
    updateStatus(message, type = 'online') {
        const statusElement = document.getElementById('assistantStatus');
        statusElement.textContent = message;
        
        statusElement.className = `status ${type}`;
    }
    
    async sendMessage() {
        const message = this.inputField.value.trim();
        if (!message || this.isTyping) return;
        
        console.log('Sending message:', message);
        
        // Clear input and disable sending
        this.inputField.value = '';
        this.updateCharCounter();
        this.isTyping = true;
        this.toggleSendButton();
        
        // Add user message to chat
        this.addMessage(message, 'user');
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Send message to chatbot API
            const response = await this.callChatbotAPI(message);
            console.log('API response:', response);
            
            if (response.success) {
                // Add bot response
                console.log('Adding bot response:', response.response);
                this.addMessage(response.response, 'assistant');
                
                // Update conversation history
                this.conversationHistory.push({
                    user: message,
                    assistant: response.response,
                    timestamp: new Date().toISOString()
                });
                
                // Save to localStorage
                this.saveConversationHistory();
                
            } else {
                throw new Error(response.error || 'Erreur de communication');
            }
            
        } catch (error) {
            console.error('Chat error:', error);
            this.addMessage(
                "Je m'excuse, je rencontre des difficultés techniques. Veuillez réessayer dans quelques instants ou contactez l'accueil pour une aide immédiate.",
                'assistant',
                true
            );
            this.showNotification('Erreur de connexion avec l\'assistant', 'error');
        } finally {
            this.hideTypingIndicator();
            this.isTyping = false;
            this.toggleSendButton();
            this.inputField.focus();
        }
    }
    
    async callChatbotAPI(message) {
        console.log('Calling chatbot API with:', {
            message: message.substring(0, 50) + '...',
            session_id: this.sessionId,
            chatbot_role: 'patient_assistant'
        });
        
        const response = await fetch(`${apiClient.baseURL}/api/chatbot/patient/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiClient.token && { 'Authorization': `Bearer ${apiClient.token}` })
            },
            body: JSON.stringify({
                message: message,
                session_id: this.sessionId,
                chatbot_role: 'patient_assistant'
            })
        });
        
        console.log('API response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API response data:', data);
        return data;
    }
    
    addMessage(text, sender, isError = false) {
        console.log('Adding message:', { text: text.substring(0, 50) + '...', sender, isError });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message`;
        messageDiv.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const avatar = document.createElement('div');
        avatar.className = `message-avatar ${sender}`;
        avatar.innerHTML = sender === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${sender}`;
        if (isError) bubble.classList.add('error');
        
        // Process message text for better formatting
        const processedText = this.processMessageText(text);
        bubble.innerHTML = processedText;
        
        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = new Date().toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        bubble.appendChild(time);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(bubble);
        
        // Store the message in a more persistent way
        messageDiv.setAttribute('data-message-id', messageDiv.id);
        messageDiv.setAttribute('data-sender', sender);
        messageDiv.setAttribute('data-timestamp', Date.now().toString());
        
        this.messageContainer.appendChild(messageDiv);
        console.log('Message added to container. Total messages:', this.messageContainer.children.length, 'Message ID:', messageDiv.id);
        
        this.scrollToBottom();
    }
    
    processMessageText(text) {
        // Convert markdown-like formatting
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>')              // Italic
            .replace(/`(.*?)`/g, '<code>$1</code>')            // Code
            .replace(/\n/g, '<br>')                            // Line breaks
            .replace(/📍\s*\*\*(.*?)\*\*/g, '<div class="location-info">📍 <strong>$1</strong></div>')
            .replace(/🚨\s*\*\*(.*?)\*\*/g, '<div class="emergency-warning">🚨 <strong>$1</strong></div>');
    }
    
    showTypingIndicator() {
        this.typingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        this.typingIndicator.style.display = 'none';
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        }, 100);
    }
    
    async loadConversationHistory() {
        try {
            const saved = localStorage.getItem(`chatbot_history_${this.sessionId}`);
            if (saved && saved !== '[]') {
                this.conversationHistory = JSON.parse(saved);
                
                // Only restore messages if we have a valid conversation history
                if (this.conversationHistory && this.conversationHistory.length > 0) {
                    console.log('Loading conversation history:', this.conversationHistory.length, 'messages');
                    
                    // Restore messages
                    this.conversationHistory.forEach(item => {
                        if (item.user && item.assistant) {
                            this.addMessage(item.user, 'user');
                            this.addMessage(item.assistant, 'assistant');
                        }
                    });
                }
            }
        } catch (error) {
            console.warn('Failed to load conversation history:', error);
            this.conversationHistory = [];
        }
    }
    
    saveConversationHistory() {
        try {
            localStorage.setItem(
                `chatbot_history_${this.sessionId}`, 
                JSON.stringify(this.conversationHistory)
            );
        } catch (error) {
            console.warn('Failed to save conversation history:', error);
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        const container = document.getElementById('messageContainer');
        container.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
    
    // Quick action methods
    sendQuickMessage(message) {
        this.inputField.value = message;
        this.updateCharCounter();
        this.toggleSendButton();
        this.sendMessage();
    }
    
    clearChat() {
        if (confirm('Êtes-vous sûr de vouloir commencer une nouvelle conversation ?')) {
            // Clear the chat area but keep the welcome message
            const welcomeMessage = this.messageContainer.querySelector('.welcome-message');
            
            // Remove only chat messages, not the welcome message
            const chatMessages = this.messageContainer.querySelectorAll('.chat-message');
            chatMessages.forEach(msg => msg.remove());
            
            // Reset conversation data
            this.conversationHistory = [];
            this.sessionId = this.generateSessionId();
            localStorage.removeItem(`chatbot_history_${this.sessionId}`);
            
            this.showNotification('Nouvelle conversation commencée', 'success');
        }
    }
    
    async toggleChatHistory() {
        const sidebar = document.getElementById('chatHistorySidebar');
        const overlay = document.getElementById('overlay');
        
        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            overlay.classList.remove('visible');
        } else {
            sidebar.classList.add('open');
            overlay.classList.add('visible');
            await this.loadHistorySidebar();
        }
    }
    
    async loadHistorySidebar() {
        const content = document.getElementById('historyContent');
        
        if (this.conversationHistory.length === 0) {
            content.innerHTML = '<p class="no-history">Aucun historique disponible</p>';
            return;
        }
        
        let historyHTML = '<div class="history-list">';
        
        this.conversationHistory.forEach((item, index) => {
            const time = new Date(item.timestamp).toLocaleString('fr-FR');
            historyHTML += `
                <div class="history-item">
                    <div class="history-time">${time}</div>
                    <div class="history-user">Vous: ${item.user}</div>
                    <div class="history-assistant">Assistant: ${item.assistant.substring(0, 100)}...</div>
                </div>
            `;
        });
        
        historyHTML += '</div>';
        content.innerHTML = historyHTML;
    }
    
    minimizeChat() {
        // This could implement a minimized chat widget
        this.showNotification('Fonctionnalité à venir', 'info');
    }
}

// Utility Functions
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (window.chatbot) {
            window.chatbot.sendMessage();
        }
    }
}

function sendMessage() {
    if (window.chatbot) {
        window.chatbot.sendMessage();
    }
}

function sendQuickMessage(message) {
    if (window.chatbot) {
        window.chatbot.sendQuickMessage(message);
    }
}

function clearChat() {
    if (window.chatbot) {
        window.chatbot.clearChat();
    }
}

function toggleChatHistory() {
    if (window.chatbot) {
        window.chatbot.toggleChatHistory();
    }
}

function minimizeChat() {
    if (window.chatbot) {
        window.chatbot.minimizeChat();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize API client if not already done
    if (typeof apiClient === 'undefined') {
        window.apiClient = new APIClient();
    }
    
    // Initialize chatbot
    window.chatbot = new PatientChatbot();
    
    console.log('✅ Patient Chatbot interface loaded');
});

// Add CSS for special message types
const additionalStyles = `
    .location-info {
        background: #eff6ff;
        border: 1px solid #3b82f6;
        border-radius: 8px;
        padding: 0.75rem;
        margin: 0.5rem 0;
        color: #1d4ed8;
    }
    
    .emergency-warning {
        background: #fef2f2;
        border: 1px solid #ef4444;
        border-radius: 8px;
        padding: 0.75rem;
        margin: 0.5rem 0;
        color: #dc2626;
    }
    
    .message-bubble.error {
        background: #fef2f2;
        border-color: #ef4444;
        color: #dc2626;
    }
    
    .history-item {
        border-bottom: 1px solid var(--border-color);
        padding: 1rem 0;
    }
    
    .history-time {
        font-size: 0.8rem;
        color: var(--text-light);
        margin-bottom: 0.5rem;
    }
    
    .history-user {
        font-weight: 500;
        margin-bottom: 0.25rem;
    }
    
    .history-assistant {
        color: var(--text-light);
        font-size: 0.9rem;
    }
    
    .status.online {
        color: var(--success-color);
    }
    
    .status.offline {
        color: var(--error-color);
    }
    
    .status.warning {
        color: var(--warning-color);
    }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);