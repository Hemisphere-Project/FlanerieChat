// Initialize Socket.IO connection
const socket = io();

// DOM elements
const connectionStatus = document.getElementById('connection-status');
const onlineUsers = document.getElementById('online-users');
const totalMessages = document.getElementById('total-messages');
const blacklistedUsers = document.getElementById('blacklisted-users');
const vipUsers = document.getElementById('vip-users');
const activityLog = document.getElementById('activity-log');
const newSessionBtn = document.getElementById('new-session-btn');
const clearMessagesBtn = document.getElementById('clear-messages-btn');
const clearBlacklistBtn = document.getElementById('clear-blacklist-btn');
const nicknameModeToggle = document.getElementById('nickname-mode-toggle');
const nicknameModeLabel = document.getElementById('nickname-mode-label');
const nicknameModeDescription = document.getElementById('nickname-mode-description');
const zoomDecreaseBtn = document.getElementById('zoom-decrease-btn');
const zoomIncreaseBtn = document.getElementById('zoom-increase-btn');
const zoomSlider = document.getElementById('zoom-slider');
const zoomValue = document.getElementById('zoom-value');
const confirmDialog = document.getElementById('confirm-dialog');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');
const toastContainer = document.getElementById('toast-container');

// State
let stats = {
    onlineUsers: 0,
    totalMessages: 0,
    blacklistedUsers: 0,
    vipUsers: 0
};

let currentZoom = 100;

// Utility functions
function formatTimestamp(timestamp = new Date()) {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function addLogEntry(message, type = 'system') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `
        <span class="timestamp">${formatTimestamp()}</span>
        <span class="message">${message}</span>
    `;
    
    activityLog.appendChild(logEntry);
    activityLog.scrollTop = activityLog.scrollHeight;
    
    // Keep only last 50 entries
    const entries = activityLog.querySelectorAll('.log-entry');
    if (entries.length > 50) {
        entries[0].remove();
    }
}

function updateStats() {
    onlineUsers.textContent = stats.onlineUsers;
    totalMessages.textContent = stats.totalMessages;
    blacklistedUsers.textContent = stats.blacklistedUsers;
    vipUsers.textContent = stats.vipUsers;
}

function updateZoomDisplay(zoom) {
    currentZoom = zoom;
    zoomValue.textContent = `${zoom}%`;
    zoomSlider.value = zoom;
}

function updateNicknameModeDisplay(isManual) {
    if (isManual) {
        nicknameModeLabel.textContent = 'Manual Nickname';
        nicknameModeDescription.textContent = 'Users must choose their own nicknames';
        nicknameModeToggle.classList.remove('btn-primary');
        nicknameModeToggle.classList.add('btn-warning');
    } else {
        nicknameModeLabel.textContent = 'Auto Nickname';
        nicknameModeDescription.textContent = 'Users get random nicknames automatically';
        nicknameModeToggle.classList.remove('btn-warning');
        nicknameModeToggle.classList.add('btn-primary');
    }
}

function setZoom(zoom) {
    // Clamp zoom between 80 and 200
    zoom = Math.max(80, Math.min(200, zoom));
    updateZoomDisplay(zoom);
    
    // Send zoom change to server
    socket.emit('backoffice-set-zoom', zoom);
    addLogEntry(`Font zoom set to ${zoom}%`, 'system');
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function showConfirmDialog(title, message, onConfirm) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmDialog.classList.remove('hidden');
    
    const handleConfirm = () => {
        confirmDialog.classList.add('hidden');
        confirmOk.removeEventListener('click', handleConfirm);
        confirmCancel.removeEventListener('click', handleCancel);
        onConfirm();
    };
    
    const handleCancel = () => {
        confirmDialog.classList.add('hidden');
        confirmOk.removeEventListener('click', handleConfirm);
        confirmCancel.removeEventListener('click', handleCancel);
    };
    
    confirmOk.addEventListener('click', handleConfirm);
    confirmCancel.addEventListener('click', handleCancel);
}

// Socket event handlers
socket.on('connect', () => {
    console.log('Backoffice connected to server');
    connectionStatus.textContent = 'Connected';
    connectionStatus.classList.add('connected');
    addLogEntry('Connected to chat server', 'success');
    
    // Request current stats
    socket.emit('backoffice-get-stats');
    
    // Request current nickname mode
    socket.emit('backoffice-get-nickname-mode');
});

socket.on('disconnect', () => {
    console.log('Backoffice disconnected from server');
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.classList.remove('connected');
    addLogEntry('Disconnected from chat server', 'error');
});

socket.on('connect_error', () => {
    console.log('Backoffice connection error');
    addLogEntry('Connection error', 'error');
});

// Backoffice-specific events
socket.on('backoffice-stats', (data) => {
    stats = { ...stats, ...data };
    updateStats();
});

socket.on('backoffice-user-count', (count) => {
    stats.onlineUsers = count;
    updateStats();
});

socket.on('backoffice-message-count', (count) => {
    stats.totalMessages = count;
    updateStats();
});

socket.on('backoffice-blacklist-count', (count) => {
    stats.blacklistedUsers = count;
    updateStats();
});

socket.on('backoffice-vip-count', (count) => {
    stats.vipUsers = count;
    updateStats();
});

socket.on('backoffice-session-cleared', () => {
    addLogEntry('New session started - all messages cleared and users blacklisted', 'success');
    showToast('New session started successfully', 'success');
});

socket.on('backoffice-messages-cleared', () => {
    addLogEntry('Messages cleared - users can continue chatting', 'success');
    showToast('Messages cleared successfully', 'success');
});

socket.on('backoffice-blacklist-cleared', () => {
    addLogEntry('Blacklist cleared - all users can now send messages', 'success');
    showToast('Blacklist cleared successfully', 'success');
});

socket.on('backoffice-user-joined', (data) => {
    addLogEntry(`User joined: ${data.nickname}`, 'system');
});

socket.on('backoffice-user-left', (data) => {
    addLogEntry(`User left: ${data.nickname}`, 'system');
});

socket.on('backoffice-message-sent', (data) => {
    addLogEntry(`Message from ${data.nickname}: ${data.message.substring(0, 50)}${data.message.length > 50 ? '...' : ''}`, 'system');
});

socket.on('backoffice-user-blacklisted', (data) => {
    addLogEntry(`User blacklisted: ${data.nickname}`, 'warning');
});

socket.on('backoffice-vip-status', (data) => {
    const vipText = data.isVIP ? 'became VIP' : 'lost VIP status';
    addLogEntry(`${data.nickname} ${vipText} 👑`, 'system');
});

socket.on('backoffice-zoom-updated', (zoom) => {
    updateZoomDisplay(zoom);
    showToast(`Font zoom updated to ${zoom}%`, 'success');
});

socket.on('backoffice-error', (data) => {
    addLogEntry(`Error: ${data.message}`, 'error');
    showToast(data.message, 'error');
});

socket.on('backoffice-nickname-mode-changed', (data) => {
    updateNicknameModeDisplay(data.manual);
    const mode = data.manual ? 'Manual' : 'Auto';
    addLogEntry(`Nickname mode changed to: ${mode}`, 'system');
    showToast(`Nickname mode changed to: ${mode}`, 'success');
});

// Button event handlers
newSessionBtn.addEventListener('click', () => {
    showConfirmDialog(
        'Start New Session',
        'This will clear all messages and blacklist all currently connected users. Are you sure?',
        () => {
            socket.emit('backoffice-new-session');
            addLogEntry('New session requested', 'system');
        }
    );
});

clearMessagesBtn.addEventListener('click', () => {
    showConfirmDialog(
        'Clear Messages',
        'This will clear all chat messages but users will remain able to chat. Are you sure?',
        () => {
            socket.emit('backoffice-clear-messages');
            addLogEntry('Clear messages requested', 'system');
        }
    );
});

clearBlacklistBtn.addEventListener('click', () => {
    showConfirmDialog(
        'Clear Blacklist',
        'This will allow all blacklisted users to send messages again. Are you sure?',
        () => {
            socket.emit('backoffice-clear-blacklist');
            addLogEntry('Blacklist clear requested', 'system');
        }
    );
});

// Nickname mode toggle event handler
nicknameModeToggle.addEventListener('click', () => {
    socket.emit('backoffice-toggle-nickname-mode');
    addLogEntry('Nickname mode toggle requested', 'system');
});

// Zoom control event handlers
zoomDecreaseBtn.addEventListener('click', () => {
    setZoom(currentZoom - 10);
});

zoomIncreaseBtn.addEventListener('click', () => {
    setZoom(currentZoom + 10);
});

zoomSlider.addEventListener('input', (e) => {
    setZoom(parseInt(e.target.value));
});

// Close modal when clicking outside
confirmDialog.addEventListener('click', (e) => {
    if (e.target === confirmDialog) {
        confirmDialog.classList.add('hidden');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        confirmDialog.classList.add('hidden');
    }
});

// Initialize
window.addEventListener('load', () => {
    addLogEntry('Backoffice initialized', 'system');
    updateStats();
});