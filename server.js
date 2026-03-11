const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store active users, message history, blacklist, zoom level, and nickname mode
const activeUsers = new Map();
const messageHistory = [];
const blacklistedUsers = new Set();
let currentZoomLevel = 100;
let manualNicknameMode = false; // false = auto, true = manual

// Generate random nickname
function generateRandomNickname() {
    const adjectives = [
        'Cool', 'Smart', 'Brave', 'Swift', 'Mighty', 'Clever', 'Bold', 'Bright', 'Happy', 'Lucky',
        'Wild', 'Calm', 'Fierce', 'Noble', 'Sly', 'Keen', 'Daring', 'Witty', 'Gentle', 'Cosmic',
        'Silent', 'Rapid', 'Golden', 'Silver', 'Crimson', 'Azure', 'Vivid', 'Nimble', 'Jolly', 'Rustic',
        'Stellar', 'Mystic', 'Radiant', 'Shadow', 'Crystal', 'Velvet', 'Iron', 'Amber', 'Jade', 'Coral',
        'Frosty', 'Stormy', 'Sunny', 'Misty', 'Dusty', 'Rocky', 'Sandy', 'Snowy', 'Breezy', 'Cloudy'
    ];
    const nouns = [
        'Tiger', 'Eagle', 'Wolf', 'Dragon', 'Phoenix', 'Lion', 'Shark', 'Bear', 'Fox', 'Hawk',
        'Panda', 'Raven', 'Otter', 'Falcon', 'Dolphin', 'Lynx', 'Cobra', 'Bison', 'Crane', 'Jaguar',
        'Owl', 'Stag', 'Viper', 'Parrot', 'Beetle', 'Mantis', 'Condor', 'Coyote', 'Moose', 'Badger',
        'Heron', 'Gecko', 'Puma', 'Ibis', 'Wren', 'Finch', 'Lemur', 'Quail', 'Koala', 'Newt',
        'Marten', 'Osprey', 'Robin', 'Starling', 'Sparrow', 'Toucan', 'Ferret', 'Penguin', 'Walrus', 'Squid'
    ];

    const activeNicknames = new Set(
        Array.from(activeUsers.values())
            .map(u => u.nickname)
            .filter(Boolean)
    );

    // Try to find a unique nickname without a number suffix first
    for (let attempt = 0; attempt < 50; attempt++) {
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const nickname = `${adj}${noun}`;
        if (!activeNicknames.has(nickname)) {
            return nickname;
        }
    }

    // Fallback: add a number to guarantee uniqueness
    let nickname;
    do {
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 1000);
        nickname = `${adj}${noun}${num}`;
    } while (activeNicknames.has(nickname));

    return nickname;
}

// Generate random color for nickname
function generateRandomColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
        '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
        '#10AC84', '#EE5A24', '#0652DD', '#9980FA', '#EA2027',
        '#006BA6', '#0496C7', '#FFBC42', '#D81159', '#8F00FF'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Handle socket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    // Generate color for the user
    const color = generateRandomColor();
    
    // Initialize user without nickname if manual mode is enabled
    if (manualNicknameMode) {
        // Store user info without nickname (will be set later)
        activeUsers.set(socket.id, { nickname: null, color, isVIP: false, nicknameSet: false });
        
        // Send manual nickname mode signal
        socket.emit('nickname-mode', { manual: true });
    } else {
        // Generate random nickname for auto mode
        const nickname = generateRandomNickname();
        activeUsers.set(socket.id, { nickname, color, isVIP: false, nicknameSet: true });
        
        // Send auto nickname mode signal
        socket.emit('nickname-mode', { manual: false });
    }
    
    // Handle VIP status setting
    socket.on('set-vip-status', (vipStatus) => {
        const user = activeUsers.get(socket.id);
        if (user) {
            user.isVIP = vipStatus;
            console.log(`User ${user.nickname} set as VIP: ${vipStatus}`);
            
            // Send updated user info
            socket.emit('user-info', { 
                nickname: user.nickname, 
                color: user.color, 
                isVIP: user.isVIP 
            });
            
            // Notify backoffice
            io.emit('backoffice-vip-status', { 
                nickname: user.nickname, 
                socketId: socket.id, 
                isVIP: vipStatus 
            });
            
            // Update VIP count
            const vipCount = Array.from(activeUsers.values()).filter(u => u.isVIP).length;
            io.emit('backoffice-vip-count', vipCount);
        }
    });

    // Handle manual nickname setting
    socket.on('set-nickname', (requestedNickname) => {
        const user = activeUsers.get(socket.id);
        if (user && manualNicknameMode && !user.nicknameSet) {
            // Sanitize and validate nickname
            const nickname = String(requestedNickname).trim().substring(0, 20);
            if (nickname.length >= 2) {
                // Check if nickname is already taken
                const isNicknameTaken = Array.from(activeUsers.values()).some(u => 
                    u.nickname && u.nickname.toLowerCase() === nickname.toLowerCase()
                );
                
                if (!isNicknameTaken) {
                    user.nickname = nickname;
                    user.nicknameSet = true;
                    
                    console.log(`User ${socket.id} set nickname to: ${nickname}`);
                    
                    // Send success response
                    socket.emit('nickname-accepted', { nickname, color: user.color });
                    
                    // Now send all the initial data
                    socket.emit('user-info', { 
                        nickname: user.nickname, 
                        color: user.color, 
                        isVIP: user.isVIP 
                    });
                    
                    // Send message history to the new user
                    socket.emit('message-history', messageHistory);
                    
                    // Send current zoom level to the new user
                    socket.emit('zoom-level', currentZoomLevel);
                    
                    // Broadcast user count to all clients
                    io.emit('user-count', activeUsers.size);
                    
                    // Announce new user joined (to others only)
                    socket.broadcast.emit('user-joined', { nickname, color: user.color });
                    
                    // Notify backoffice of new user (manual mode)
                    io.emit('backoffice-user-joined', { nickname, socketId: socket.id });
                } else {
                    socket.emit('nickname-rejected', { reason: 'Nickname already taken' });
                }
            } else {
                socket.emit('nickname-rejected', { reason: 'Nickname must be at least 2 characters long' });
            }
        }
    });
    
    // Send initial data only in auto nickname mode
    if (!manualNicknameMode) {
        const user = activeUsers.get(socket.id);
        socket.emit('user-info', { 
            nickname: user.nickname, 
            color: user.color, 
            isVIP: user.isVIP 
        });
        
        // Send message history to the new user
        socket.emit('message-history', messageHistory);
        
        // Send current zoom level to the new user
        socket.emit('zoom-level', currentZoomLevel);
        
        // Broadcast user count to all clients
        io.emit('user-count', activeUsers.size);
        
        // Announce new user joined (to others only)
        socket.broadcast.emit('user-joined', {
            message: `${user.nickname} joined the chat`,
            timestamp: new Date().toISOString()
        });
        
        // Notify backoffice of new user (only in auto mode)
        io.emit('backoffice-user-joined', { nickname: user.nickname, socketId: socket.id });
    }
    
    // Handle chat messages
    socket.on('chat-message', (data) => {
        const user = activeUsers.get(socket.id);
        if (user) {
            // Check if user has set nickname in manual mode
            if (manualNicknameMode && !user.nicknameSet) {
                socket.emit('backoffice-error', { message: 'Please set your nickname first' });
                return;
            }
            
            // Check if user is blacklisted
            if (blacklistedUsers.has(socket.id)) {
                socket.emit('backoffice-error', { message: 'You are not allowed to send messages' });
                return;
            }
            
            const messageData = {
                id: Date.now() + Math.random(), // Simple unique ID
                nickname: user.nickname,
                color: user.color,
                message: data.message,
                timestamp: new Date().toISOString(),
                isVIP: user.isVIP || false
            };
            
            // Store message in history
            messageHistory.push(messageData);
            
            // Keep only last 100 messages to prevent memory issues
            if (messageHistory.length > 100) {
                messageHistory.shift();
            }
            
            // Broadcast message to all clients
            io.emit('chat-message', messageData);
            
            // Notify backoffice of new message
            io.emit('backoffice-message-sent', { 
                nickname: user.nickname, 
                message: data.message 
            });
            io.emit('backoffice-message-count', messageHistory.length);
        }
    });
    
    // Handle user typing indicator
    socket.on('typing', (isTyping) => {
        const user = activeUsers.get(socket.id);
        if (user) {
            socket.broadcast.emit('user-typing', {
                nickname: user.nickname,
                isTyping: isTyping
            });
        }
    });
    
    // Handle backoffice requests
    socket.on('backoffice-get-stats', () => {
        const vipCount = Array.from(activeUsers.values()).filter(user => user.isVIP).length;
        socket.emit('backoffice-stats', {
            onlineUsers: activeUsers.size,
            totalMessages: messageHistory.length,
            blacklistedUsers: blacklistedUsers.size,
            vipUsers: vipCount
        });
        
        // Send current zoom level to backoffice
        socket.emit('backoffice-zoom-updated', currentZoomLevel);
    });
    
    socket.on('backoffice-new-session', () => {
        // Clear all messages
        messageHistory.length = 0;
        
        // Blacklist all current users except VIPs
        for (const socketId of activeUsers.keys()) {
            const user = activeUsers.get(socketId);
            if (user && !user.isVIP) {
                blacklistedUsers.add(socketId);
                io.emit('backoffice-user-blacklisted', { nickname: user.nickname });
            } else if (user && user.isVIP) {
                console.log(`VIP user ${user.nickname} exempted from blacklist`);
            }
        }
        
        // Notify all clients that session was cleared
        io.emit('session-cleared');
        
        // Notify backoffice
        io.emit('backoffice-session-cleared');
        io.emit('backoffice-stats', {
            onlineUsers: activeUsers.size,
            totalMessages: messageHistory.length,
            blacklistedUsers: blacklistedUsers.size
        });
        
        console.log('New session started - messages cleared, users blacklisted');
    });
    
    socket.on('backoffice-clear-messages', () => {
        // Clear all messages only (no blacklisting)
        messageHistory.length = 0;
        
        // Notify all clients that messages were cleared
        io.emit('messages-cleared');
        
        // Notify backoffice
        io.emit('backoffice-messages-cleared');
        io.emit('backoffice-message-count', 0);
        
        console.log('Messages cleared - users not blacklisted');
    });
    
    socket.on('backoffice-clear-blacklist', () => {
        // Clear blacklist
        blacklistedUsers.clear();
        
        // Notify backoffice
        io.emit('backoffice-blacklist-cleared');
        io.emit('backoffice-blacklist-count', 0);
        
        console.log('Blacklist cleared');
    });

    // Handle nickname mode toggle
    socket.on('backoffice-toggle-nickname-mode', () => {
        manualNicknameMode = !manualNicknameMode;
        
        // Notify all backoffice clients of the change
        io.emit('backoffice-nickname-mode-changed', { 
            manual: manualNicknameMode 
        });
        
        console.log(`Nickname mode changed to: ${manualNicknameMode ? 'Manual' : 'Auto'}`);
    });

    // Send current nickname mode to backoffice
    socket.on('backoffice-get-nickname-mode', () => {
        socket.emit('backoffice-nickname-mode-changed', { 
            manual: manualNicknameMode 
        });
    });
    
    socket.on('backoffice-set-zoom', (zoom) => {
        // Validate zoom level
        zoom = Math.max(80, Math.min(200, parseInt(zoom)));
        currentZoomLevel = zoom;
        
        // Broadcast zoom change to all clients
        io.emit('zoom-level', zoom);
        
        // Notify backoffice of successful update
        socket.emit('backoffice-zoom-updated', zoom);
        
        console.log(`Font zoom set to ${zoom}%`);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        const user = activeUsers.get(socket.id);
        if (user) {
            // Announce user left
            socket.broadcast.emit('user-left', {
                message: `${user.nickname} left the chat`,
                timestamp: new Date().toISOString()
            });
            
            // Notify backoffice
            io.emit('backoffice-user-left', { nickname: user.nickname });
        }
        
        // Remove user from active users and blacklist
        activeUsers.delete(socket.id);
        blacklistedUsers.delete(socket.id);
        
        // Update user count
        io.emit('user-count', activeUsers.size);
        io.emit('backoffice-user-count', activeUsers.size);
        io.emit('backoffice-blacklist-count', blacklistedUsers.size);
        
        // Update VIP count
        const vipCount = Array.from(activeUsers.values()).filter(u => u.isVIP).length;
        io.emit('backoffice-vip-count', vipCount);
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the backoffice page
app.get('/backoffice', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'backoffice.html'));
});

// Start server
server.listen(PORT, () => {
    console.log(`Chat server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});