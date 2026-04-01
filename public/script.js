const chatConfig = window.__FLANERIE_CHAT_CONFIG__ || {};
const socketNamespace = chatConfig.namespace || '/';
const socketPath = chatConfig.socketPath || '/socket.io';

// Initialize Socket.IO connection
const socket = socketNamespace === '/'
    ? io({ path: socketPath })
    : io(socketNamespace, { path: socketPath });

// DOM elements
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const userCount = document.getElementById('user-count');
const userNickname = document.getElementById('user-nickname');
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');
const connectionStatus = document.getElementById('connection-status');
const connectionText = document.getElementById('connection-text');
const nicknameModal = document.getElementById('nickname-modal');
const nicknameInput = document.getElementById('nickname-input');
const nicknameSubmit = document.getElementById('nickname-submit');
const nicknameError = document.getElementById('nickname-error');

// User state
let currentUser = null;
let typingTimer = null;
let isTyping = false;
let isVIP = false;
let manualNicknameMode = false;
let nicknameSet = false;
let autoScrollEnabled = true;
let messageTimes = [];

// Check for VIP parameter in URL
function checkVIPStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('vip') === 'true';
}

// Utility functions
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function scrollToBottom() {
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 0);
}

function isNearBottom() {
    const threshold = 50;
    return chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < threshold;
}

chatMessages.addEventListener('scroll', () => {
    autoScrollEnabled = isNearBottom();
});

function generateConsistentColor(nickname) {
    // Generate a consistent color based on nickname
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
        '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
        '#10AC84', '#EE5A24', '#0652DD', '#9980FA', '#EA2027',
        '#006BA6', '#0496C7', '#FFBC42', '#D81159', '#8F00FF'
    ];
    
    let hash = 0;
    for (let i = 0; i < nickname.length; i++) {
        hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
}

function showConnectionStatus(message, isError = false) {
    connectionText.textContent = message;
    connectionStatus.className = `connection-status ${isError ? 'error' : ''}`;
    
    setTimeout(() => {
        connectionStatus.classList.add('hidden');
    }, 3000);
}

// Message creation functions
function createMessage(data, type = 'user') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    if (type === 'user') {
        messageDiv.classList.add('user-message');
        
        messageDiv.innerHTML = `
            <div class="message-line">
                <span class="nickname" style="color: ${data.color}">${sanitizeHTML(data.nickname)}</span>
                <span class="message-text">${sanitizeHTML(data.message)}</span>
            </div>
        `;
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
        
        // Extract nickname from system message for coloring
        const joinedMatch = data.message.match(/^(.+) joined the chat$/);
        const leftMatch = data.message.match(/^(.+) left the chat$/);
        
        let content;
        if (joinedMatch) {
            const nickname = joinedMatch[1];
            content = `
                <span class="nickname">${sanitizeHTML(nickname)}</span>
                <span class="system-text">joined</span>
            `;
        } else if (leftMatch) {
            const nickname = leftMatch[1];
            content = `
                <span class="nickname">${sanitizeHTML(nickname)}</span>
                <span class="system-text">left</span>
            `;
        } else {
            // Fallback for other system messages
            content = `
                <span class="system-text">${sanitizeHTML(data.message)}</span>
            `;
        }
        
        messageDiv.innerHTML = `<div class="system-content">${content}</div>`;
    }
    
    return messageDiv;
}

function addMessage(data, type = 'user', shouldScroll = true) {
    const messageElement = createMessage(data, type);
    
    // Remove welcome message if it exists
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    chatMessages.appendChild(messageElement);
    if (shouldScroll && autoScrollEnabled) {
        scrollToBottom();
    }
}

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to server');
    showConnectionStatus('Connecté au chat');
    
    // Send VIP status to server
    isVIP = checkVIPStatus();
    if (isVIP) {
        socket.emit('set-vip-status', true);
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    showConnectionStatus('Déconnecté du chat', true);
});

socket.on('connect_error', () => {
    console.log('Connection error');
    showConnectionStatus('Échec de connexion', true);
});

socket.on('nickname-mode', (data) => {
    manualNicknameMode = data.manual;
    if (manualNicknameMode) {
        showNicknameModal();
    }
});

socket.on('nickname-accepted', (data) => {
    nicknameSet = true;
    hideNicknameModal();
    showConnectionStatus('Pseudo accepté! Connexion...', false);
});

socket.on('nickname-rejected', (data) => {
    showNicknameError(data.reason);
    nicknameSubmit.disabled = false;
    nicknameSubmit.textContent = 'Rejoindre';
});

socket.on('user-info', (data) => {
    currentUser = data;
    const vipIndicator = data.isVIP ? ' 👑' : '';
    userNickname.textContent = `Vous: ${data.nickname}${vipIndicator}`;
    userNickname.style.color = data.color;
});

socket.on('message-history', (history) => {
    // Remove welcome message if it exists
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    // Add all previous messages without scrolling
    history.forEach(messageData => {
        addMessage(messageData, 'user', false);
    });
    
    // Scroll to bottom after all messages are added
    if (history.length > 0) {
        setTimeout(() => {
            scrollToBottom();
        }, 50);
    }
});

socket.on('user-count', (count) => {
    userCount.textContent = `${count} participants`;
});

socket.on('chat-message', (data) => {
    addMessage(data, 'user');
});

socket.on('user-joined', (data) => {
    addMessage(data, 'system');
});

socket.on('user-left', (data) => {
    addMessage(data, 'system');
});

socket.on('user-typing', (data) => {
    if (data.isTyping) {
        typingText.textContent = `${data.nickname} is typing...`;
        typingIndicator.classList.remove('hidden');
    } else {
        typingIndicator.classList.add('hidden');
    }
});

socket.on('session-cleared', () => {
    // Clear all messages from the chat silently
    // chatMessages.innerHTML = '<div class="welcome-message"><p>Welcome to Flanerie Chat! 🎉</p><p>Start chatting with others in real-time.</p></div>';
    chatMessages.innerHTML = '';
});

socket.on('messages-cleared', () => {
    // Clear all messages from the chat (messages-only clear)
    // chatMessages.innerHTML = '<div class="welcome-message"><p>Welcome to Flanerie Chat! 🎉</p><p>Start chatting with others in real-time.</p></div>';
    chatMessages.innerHTML = '';
});

socket.on('zoom-level', (zoomLevel) => {
    // Calculate scale factor (100% = 1.0, 150% = 1.5, etc.)
    const scaleFactor = zoomLevel / 100;
    
    // Apply zoom to chat area by scaling font sizes
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        chatContainer.style.setProperty('--zoom-scale', scaleFactor);
    }
});

// Rate limit check for non-VIP users (max 1 msg / 2s)
function isRateLimited() {
    if (isVIP) return false;
    const now = Date.now();
    messageTimes = messageTimes.filter(t => now - t < 2000);
    return messageTimes.length >= 1;
}

function disableSendTemporarily() {
    sendButton.disabled = true;
    messageInput.disabled = true;
    const remaining = 2000 - (Date.now() - messageTimes[0]);
    setTimeout(() => {
        sendButton.disabled = false;
        messageInput.disabled = false;
        messageInput.focus();
    }, Math.max(remaining, 100));
}

// Message sending functionality
function sendMessage() {
    const message = messageInput.value.trim();
    
    if (message && currentUser) {
        // Rate limit non-VIP users
        if (isRateLimited()) {
            disableSendTemporarily();
            return;
        }
        messageTimes.push(Date.now());

        // Send message to server
        socket.emit('chat-message', { message });
        
        // Clear input
        messageInput.value = '';
        
        // Re-enable auto-scroll on send
        autoScrollEnabled = true;
        scrollToBottom();
        
        // Stop typing indicator
        if (isTyping) {
            socket.emit('typing', false);
            isTyping = false;
        }
        
        // Adjust textarea height
        messageInput.style.height = 'auto';
    }
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Typing indicator functionality
messageInput.addEventListener('input', () => {
    if (!isTyping && messageInput.value.trim()) {
        isTyping = true;
        socket.emit('typing', true);
    }
    
    // Clear existing timer
    clearTimeout(typingTimer);
    
    // Set new timer
    typingTimer = setTimeout(() => {
        if (isTyping) {
            isTyping = false;
            socket.emit('typing', false);
        }
    }, 1000);
    
    // Auto-resize textarea
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
});

messageInput.addEventListener('blur', () => {
    if (isTyping) {
        isTyping = false;
        socket.emit('typing', false);
    }
});

// Focus input on page load
window.addEventListener('load', () => {
    messageInput.focus();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isTyping) {
        isTyping = false;
        socket.emit('typing', false);
    }
});

// Prevent zooming on input focus (iOS Safari)
messageInput.addEventListener('focus', () => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    }
});

messageInput.addEventListener('blur', () => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
    }
});

// Handle mobile keyboard and input visibility
function handleMobileInput() {
    if (!/Mobi|Android/i.test(navigator.userAgent)) return;

    // Scroll input into view when focused
    messageInput.addEventListener('focus', () => {
        setTimeout(() => {
            // Scroll to bottom of chat to ensure input is visible
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
            
            // Also scroll the input into view
            messageInput.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'end',
                inline: 'nearest'
            });
        }, 300); // Delay to account for keyboard animation
    });

    // Ensure input stays visible on viewport changes
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            if (document.activeElement === messageInput) {
                setTimeout(() => {
                    messageInput.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'end' 
                    });
                }, 100);
            }
        });
    }
}

// Nickname modal functions
function showNicknameModal() {
    nicknameModal.classList.remove('hidden');
    nicknameInput.focus();
    
    // Setup keyboard detection for mobile
    if (/Mobi|Android/i.test(navigator.userAgent)) {
        setupNicknameKeyboardDetection();
    }
}

function hideNicknameModal() {
    nicknameModal.classList.add('hidden');
    nicknameError.classList.add('hidden');
    nicknameModal.classList.remove('keyboard-open');
}

function showNicknameError(message) {
    nicknameError.textContent = message;
    nicknameError.classList.remove('hidden');
}

function validateNickname(nickname) {
    if (!nickname || nickname.trim().length < 2) {
        return 'Le pseudo doit contenir au moins 2 caractères';
    }
    if (nickname.length > 20) {
        return 'Le pseudo ne peut pas dépasser 20 caractères';
    }
    return null;
}

function submitNickname() {
    const nickname = nicknameInput.value.trim();
    const error = validateNickname(nickname);
    
    if (error) {
        showNicknameError(error);
        return;
    }
    
    nicknameError.classList.add('hidden');
    nicknameSubmit.disabled = true;
    nicknameSubmit.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/></svg>Connexion...';
    
    socket.emit('set-nickname', nickname);
}

function setupNicknameKeyboardDetection() {
    let initialViewportHeight = window.innerHeight;
    
    function handleViewportChange() {
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        
        // If viewport height decreased significantly (keyboard opened)
        if (heightDifference > 150) {
            nicknameModal.classList.add('keyboard-open');
        } else {
            nicknameModal.classList.remove('keyboard-open');
        }
    }
    
    // Listen for viewport changes
    window.addEventListener('resize', handleViewportChange);
    
    // Visual Viewport API support for better mobile keyboard detection
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleViewportChange);
    }
    
    // Focus/blur events as backup
    nicknameInput.addEventListener('focus', () => {
        setTimeout(() => {
            const currentHeight = window.innerHeight;
            const heightDifference = initialViewportHeight - currentHeight;
            if (heightDifference > 150) {
                nicknameModal.classList.add('keyboard-open');
            }
        }, 300); // Delay to account for keyboard animation
    });
    
    nicknameInput.addEventListener('blur', () => {
        setTimeout(() => {
            nicknameModal.classList.remove('keyboard-open');
        }, 100);
    });
}

// Nickname modal event listeners
nicknameSubmit.addEventListener('click', submitNickname);

nicknameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitNickname();
    }
});

nicknameInput.addEventListener('input', () => {
    nicknameError.classList.add('hidden');
});

// Initialize mobile input handling
handleMobileInput();