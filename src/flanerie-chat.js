import express from 'express';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(moduleDir, '../public');
const chatTemplate = readFileSync(path.join(publicDirectory, 'index.html'), 'utf8');
const backofficeTemplate = readFileSync(path.join(publicDirectory, 'backoffice.html'), 'utf8');
const internalRealtimeKey = Symbol('flanerie-chat-internal-realtime');

function normalizeMountPath(mountPath = '/') {
    if (!mountPath || mountPath === '/') {
        return '/';
    }

    const normalized = `/${String(mountPath).replace(/^\/+|\/+$/g, '')}`;
    return normalized === '' ? '/' : normalized;
}

function normalizeSocketPath(socketPath = '/socket.io') {
    const normalized = `/${String(socketPath || '/socket.io').replace(/^\/+|\/+$/g, '')}`;
    return normalized === '/' ? '/socket.io' : normalized;
}

function normalizeNamespace(namespace, mountPath) {
    if (!namespace || namespace === '/') {
        return mountPath === '/' ? '/' : mountPath;
    }

    const normalized = `/${String(namespace).replace(/^\/+|\/+$/g, '')}`;
    return normalized === '' ? '/' : normalized;
}

function buildClientConfig({ mountPath, socketPath, namespace }) {
    return {
        mountPath,
        socketPath,
        namespace,
        socketClientScriptSrc: `${socketPath}/socket.io.js`
    };
}

function buildSocketClientTag(clientConfig) {
    if (!clientConfig.realtimeEnabled) {
        return '';
    }

    return `<script src="${clientConfig.socketClientScriptSrc}"></script>`;
}

function renderTemplate(template, clientConfig) {
    return template
        .replace('__FLANERIE_CHAT_CONFIG__', JSON.stringify(clientConfig).replace(/</g, '\\u003c'))
        .replace('__FLANERIE_SOCKET_IO_CLIENT_TAG__', buildSocketClientTag(clientConfig));
}

function generateRandomNickname(activeUsers) {
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
            .map((user) => user.nickname)
            .filter(Boolean)
    );

    for (let attempt = 0; attempt < 50; attempt += 1) {
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const nickname = `${adjective}${noun}`;

        if (!activeNicknames.has(nickname)) {
            return nickname;
        }
    }

    let nickname;
    do {
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const number = Math.floor(Math.random() * 1000);
        nickname = `${adjective}${noun}${number}`;
    } while (activeNicknames.has(nickname));

    return nickname;
}

function generateRandomColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
        '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
        '#10AC84', '#EE5A24', '#0652DD', '#9980FA', '#EA2027',
        '#006BA6', '#0496C7', '#FFBC42', '#D81159', '#8F00FF'
    ];

    return colors[Math.floor(Math.random() * colors.length)];
}

function registerSocketHandlers(chatIo) {
    const activeUsers = new Map();
    const messageHistory = [];
    const blacklistedUsers = new Set();
    let currentZoomLevel = 100;
    let manualNicknameMode = false;

    chatIo.on('connection', (socket) => {
        console.log('A user connected:', socket.id);

        const color = generateRandomColor();

        if (manualNicknameMode) {
            activeUsers.set(socket.id, { nickname: null, color, isVIP: false, nicknameSet: false });
            socket.emit('nickname-mode', { manual: true });
        } else {
            const nickname = generateRandomNickname(activeUsers);
            activeUsers.set(socket.id, { nickname, color, isVIP: false, nicknameSet: true });
            socket.emit('nickname-mode', { manual: false });
        }

        socket.on('set-vip-status', (vipStatus) => {
            const user = activeUsers.get(socket.id);
            if (!user) {
                return;
            }

            user.isVIP = vipStatus;
            console.log(`User ${user.nickname} set as VIP: ${vipStatus}`);

            socket.emit('user-info', {
                nickname: user.nickname,
                color: user.color,
                isVIP: user.isVIP
            });

            chatIo.emit('backoffice-vip-status', {
                nickname: user.nickname,
                socketId: socket.id,
                isVIP: vipStatus
            });

            const vipCount = Array.from(activeUsers.values()).filter((activeUser) => activeUser.isVIP).length;
            chatIo.emit('backoffice-vip-count', vipCount);
        });

        socket.on('set-nickname', (requestedNickname) => {
            const user = activeUsers.get(socket.id);
            if (!user || !manualNicknameMode || user.nicknameSet) {
                return;
            }

            const nickname = String(requestedNickname).trim().substring(0, 20);
            if (nickname.length < 2) {
                socket.emit('nickname-rejected', { reason: 'Nickname must be at least 2 characters long' });
                return;
            }

            const isNicknameTaken = Array.from(activeUsers.values()).some(
                (activeUser) => activeUser.nickname && activeUser.nickname.toLowerCase() === nickname.toLowerCase()
            );

            if (isNicknameTaken) {
                socket.emit('nickname-rejected', { reason: 'Nickname already taken' });
                return;
            }

            user.nickname = nickname;
            user.nicknameSet = true;

            console.log(`User ${socket.id} set nickname to: ${nickname}`);

            socket.emit('nickname-accepted', { nickname, color: user.color });
            socket.emit('user-info', {
                nickname: user.nickname,
                color: user.color,
                isVIP: user.isVIP
            });
            socket.emit('message-history', messageHistory);
            socket.emit('zoom-level', currentZoomLevel);

            chatIo.emit('user-count', activeUsers.size);
            socket.broadcast.emit('user-joined', { nickname, color: user.color });
            chatIo.emit('backoffice-user-joined', { nickname, socketId: socket.id });
        });

        if (!manualNicknameMode) {
            const user = activeUsers.get(socket.id);

            socket.emit('user-info', {
                nickname: user.nickname,
                color: user.color,
                isVIP: user.isVIP
            });
            socket.emit('message-history', messageHistory);
            socket.emit('zoom-level', currentZoomLevel);

            chatIo.emit('user-count', activeUsers.size);
            socket.broadcast.emit('user-joined', {
                message: `${user.nickname} joined the chat`,
                timestamp: new Date().toISOString()
            });
            chatIo.emit('backoffice-user-joined', { nickname: user.nickname, socketId: socket.id });
        }

        socket.on('chat-message', (data) => {
            const user = activeUsers.get(socket.id);
            if (!user) {
                return;
            }

            if (manualNicknameMode && !user.nicknameSet) {
                socket.emit('backoffice-error', { message: 'Please set your nickname first' });
                return;
            }

            if (blacklistedUsers.has(socket.id)) {
                socket.emit('backoffice-error', { message: 'You are not allowed to send messages' });
                return;
            }

            const messageData = {
                id: Date.now() + Math.random(),
                nickname: user.nickname,
                color: user.color,
                message: data.message,
                timestamp: new Date().toISOString(),
                isVIP: user.isVIP || false
            };

            messageHistory.push(messageData);
            if (messageHistory.length > 100) {
                messageHistory.shift();
            }

            chatIo.emit('chat-message', messageData);
            chatIo.emit('backoffice-message-sent', {
                nickname: user.nickname,
                message: data.message
            });
            chatIo.emit('backoffice-message-count', messageHistory.length);
        });

        socket.on('typing', (isTyping) => {
            const user = activeUsers.get(socket.id);
            if (!user) {
                return;
            }

            socket.broadcast.emit('user-typing', {
                nickname: user.nickname,
                isTyping
            });
        });

        socket.on('backoffice-get-stats', () => {
            const vipCount = Array.from(activeUsers.values()).filter((user) => user.isVIP).length;
            socket.emit('backoffice-stats', {
                onlineUsers: activeUsers.size,
                totalMessages: messageHistory.length,
                blacklistedUsers: blacklistedUsers.size,
                vipUsers: vipCount
            });
            socket.emit('backoffice-zoom-updated', currentZoomLevel);
        });

        socket.on('backoffice-new-session', () => {
            messageHistory.length = 0;

            for (const socketId of activeUsers.keys()) {
                const user = activeUsers.get(socketId);
                if (user && !user.isVIP) {
                    blacklistedUsers.add(socketId);
                    chatIo.emit('backoffice-user-blacklisted', { nickname: user.nickname });
                } else if (user && user.isVIP) {
                    console.log(`VIP user ${user.nickname} exempted from blacklist`);
                }
            }

            const vipCount = Array.from(activeUsers.values()).filter((user) => user.isVIP).length;

            chatIo.emit('session-cleared');
            chatIo.emit('backoffice-session-cleared');
            chatIo.emit('backoffice-stats', {
                onlineUsers: activeUsers.size,
                totalMessages: messageHistory.length,
                blacklistedUsers: blacklistedUsers.size,
                vipUsers: vipCount
            });

            console.log('New session started - messages cleared, users blacklisted');
        });

        socket.on('backoffice-clear-messages', () => {
            messageHistory.length = 0;

            chatIo.emit('messages-cleared');
            chatIo.emit('backoffice-messages-cleared');
            chatIo.emit('backoffice-message-count', 0);

            console.log('Messages cleared - users not blacklisted');
        });

        socket.on('backoffice-clear-blacklist', () => {
            blacklistedUsers.clear();

            chatIo.emit('backoffice-blacklist-cleared');
            chatIo.emit('backoffice-blacklist-count', 0);

            console.log('Blacklist cleared');
        });

        socket.on('backoffice-toggle-nickname-mode', () => {
            manualNicknameMode = !manualNicknameMode;
            chatIo.emit('backoffice-nickname-mode-changed', { manual: manualNicknameMode });

            console.log(`Nickname mode changed to: ${manualNicknameMode ? 'Manual' : 'Auto'}`);
        });

        socket.on('backoffice-get-nickname-mode', () => {
            socket.emit('backoffice-nickname-mode-changed', { manual: manualNicknameMode });
        });

        socket.on('backoffice-set-zoom', (zoom) => {
            const parsedZoom = Number.parseInt(zoom, 10);
            currentZoomLevel = Math.max(80, Math.min(200, parsedZoom));

            chatIo.emit('zoom-level', currentZoomLevel);
            socket.emit('backoffice-zoom-updated', currentZoomLevel);

            console.log(`Font zoom set to ${currentZoomLevel}%`);
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);

            const user = activeUsers.get(socket.id);
            if (user?.nickname) {
                socket.broadcast.emit('user-left', {
                    message: `${user.nickname} left the chat`,
                    timestamp: new Date().toISOString()
                });

                chatIo.emit('backoffice-user-left', { nickname: user.nickname });
            }

            activeUsers.delete(socket.id);
            blacklistedUsers.delete(socket.id);

            chatIo.emit('user-count', activeUsers.size);
            chatIo.emit('backoffice-user-count', activeUsers.size);
            chatIo.emit('backoffice-blacklist-count', blacklistedUsers.size);

            const vipCount = Array.from(activeUsers.values()).filter((activeUser) => activeUser.isVIP).length;
            chatIo.emit('backoffice-vip-count', vipCount);
        });
    });

    return {
        activeUsers,
        messageHistory,
        blacklistedUsers,
        getCurrentZoomLevel: () => currentZoomLevel,
        isManualNicknameMode: () => manualNicknameMode
    };
}

function getRealtimeContext(app) {
    if (!app[internalRealtimeKey]) {
        app[internalRealtimeKey] = {
            io: null,
            socketPath: null,
            listenPatched: false,
            mounts: []
        };
    }

    return app[internalRealtimeKey];
}

function attachMountToIo({ io, namespace, result }) {
    if (result.io) {
        return;
    }

    const chatNamespace = io.of(namespace);
    result.io = chatNamespace;
    result.state = registerSocketHandlers(chatNamespace);
}

function ensureSocketPathCompatibility(context, socketPath) {
    if (context.socketPath && context.socketPath !== socketPath) {
        throw new Error(
            `Flanerie Chat cannot create multiple internal Socket.IO servers with different socketPath values: ${context.socketPath} and ${socketPath}`
        );
    }

    context.socketPath = socketPath;
}

function ensureInternalIo({ app, httpServer, socketPath }) {
    const context = getRealtimeContext(app);
    ensureSocketPathCompatibility(context, socketPath);

    if (!context.io) {
        if (!httpServer) {
            throw new Error('Flanerie Chat needs an HTTP server to create its own Socket.IO instance');
        }

        context.io = new Server(httpServer, { path: socketPath });

        for (const mount of context.mounts) {
            attachMountToIo({
                io: context.io,
                namespace: mount.namespace,
                result: mount.result
            });
        }
    }

    return context.io;
}

function registerDeferredRealtimeMount({ app, socketPath, namespace, result }) {
    const context = getRealtimeContext(app);
    ensureSocketPathCompatibility(context, socketPath);
    context.mounts.push({ namespace, result });

    if (context.io) {
        attachMountToIo({ io: context.io, namespace, result });
        return;
    }

    if (context.listenPatched) {
        return;
    }

    const originalListen = app.listen.bind(app);
    context.listenPatched = true;

    app.listen = (...args) => {
        const server = originalListen(...args);
        ensureInternalIo({ app, httpServer: server, socketPath });
        return server;
    };
}

export function mountFlanerieChat({
    app,
    io,
    httpServer,
    mountPath = '/',
    socketPath = '/socket.io',
    namespace,
    assetsDirectory = publicDirectory
} = {}) {
    if (!app) {
        throw new Error('mountFlanerieChat requires an Express app instance');
    }

    const normalizedMountPath = normalizeMountPath(mountPath);
    const normalizedSocketPath = normalizeSocketPath(socketPath);
    const normalizedNamespace = normalizeNamespace(namespace, normalizedMountPath);
    const clientConfig = buildClientConfig({
        mountPath: normalizedMountPath,
        socketPath: normalizedSocketPath,
        namespace: normalizedNamespace
    });
    clientConfig.realtimeEnabled = true;
    const router = express.Router();
    const result = {
        router,
        io: null,
        state: null,
        ownsIo: false,
        realtimeEnabled: true,
        mountPath: normalizedMountPath,
        namespace: normalizedNamespace,
        socketPath: normalizedSocketPath,
        clientConfig
    };

    router.get('/', (request, response) => {
        response.type('html').send(renderTemplate(chatTemplate, clientConfig));
    });

    router.get('/backoffice', (request, response) => {
        response.type('html').send(renderTemplate(backofficeTemplate, clientConfig));
    });

    router.use(express.static(assetsDirectory, { index: false }));
    app.use(normalizedMountPath, router);

    if (io) {
        result.io = io.of(normalizedNamespace);
        result.state = registerSocketHandlers(result.io);
        return result;
    }

    result.ownsIo = true;

    if (httpServer) {
        const internalIo = ensureInternalIo({ app, httpServer, socketPath: normalizedSocketPath });
        attachMountToIo({ io: internalIo, namespace: normalizedNamespace, result });
        return result;
    }

    registerDeferredRealtimeMount({
        app,
        socketPath: normalizedSocketPath,
        namespace: normalizedNamespace,
        result
    });

    return result;
}

export function createStandaloneFlanerieChat({
    mountPath = '/',
    socketPath = '/socket.io',
    namespace,
    expressApp,
    httpServer,
    io: existingIo
} = {}) {
    const app = expressApp ?? express();
    const server = httpServer ?? createServer(app);
    const io = existingIo ?? new Server(server, { path: normalizeSocketPath(socketPath) });

    const chat = mountFlanerieChat({
        app,
        io,
        mountPath,
        socketPath,
        namespace
    });

    return {
        app,
        server,
        io,
        chat
    };
}