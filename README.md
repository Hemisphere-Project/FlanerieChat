# Flanerie Chat

A real-time chat application built with Node.js, Express, and Socket.IO. The package now ships as an ESM module and can run either as a standalone app or be mounted inside an existing Express and Socket.IO server.

## Features

- **Real-time messaging** using WebSocket connections
- **Single chat room** for all users
- **Random nicknames** assigned to each user
- **Random colors** for usernames
- **Dark mode** interface
- **Mobile-friendly** responsive design
- **Typing indicators** to show when users are typing
- **User count** display
- **Connection status** notifications

## Technologies Used

- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Real-time Communication**: WebSockets via Socket.IO

## Installation

1. Clone or download this repository
2. Navigate to the project directory:
   ```bash
   cd FlanerieChat
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Standalone mode

1. Start the server:
   ```bash
   npm start
   ```
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Start chatting.

### Embedded mode

You can mount the chat into an existing Express app and Socket.IO server.

Requirements in the host app:

- The host already has an Express app instance.
- The host already has an HTTP server created from that Express app.
- The host already has a Socket.IO server attached to that HTTP server.
- The host app uses ESM imports.

```js
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { mountFlanerieChat } from 'flanerie-chat';

const app = express();
const server = createServer(app);
const io = new Server(server);

mountFlanerieChat({
    app,
    io,
    mountPath: '/chat'
});

server.listen(3000);
```

If you are embedding from the same repository instead of consuming the published package, import from the local module file:

```js
import { mountFlanerieChat } from './src/flanerie-chat.js';
```

That setup exposes:

- `/chat` for the chat UI
- `/chat/backoffice` for the backoffice UI
- Socket.IO traffic on the `/chat` namespace using the existing server's Socket.IO path

How it works:

- `mountPath` controls where the browser UI is served.
- `namespace` controls which Socket.IO namespace the chat uses.
- If `namespace` is omitted, it defaults to the same value as `mountPath`.
- `socketPath` controls the Socket.IO transport endpoint and must match the path used when the host app created its Socket.IO server.

Example with an existing app that already has other routes and sockets:

```js
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { mountFlanerieChat } from 'flanerie-chat';

const app = express();
const server = createServer(app);
const io = new Server(server);

app.get('/health', (request, response) => {
   response.json({ ok: true });
});

io.of('/notifications').on('connection', (socket) => {
   socket.emit('ready');
});

mountFlanerieChat({
   app,
   io,
   mountPath: '/chat'
});

server.listen(3000);
```

In that example:

- the host app keeps its own `/health` route
- the host app keeps its own `/notifications` Socket.IO namespace
- Flanerie Chat is isolated under `/chat` and `/chat/backoffice`

If your host app uses a custom Socket.IO path, pass it explicitly:

```js
const io = new Server(server, {
   path: '/realtime/socket.io'
});

mountFlanerieChat({
    app,
    io,
    mountPath: '/chat',
    socketPath: '/realtime/socket.io'
});
```

If you want the UI route and Socket.IO namespace to differ, set both explicitly:

```js
mountFlanerieChat({
   app,
   io,
   mountPath: '/chat',
   namespace: '/customer-chat'
});
```

That serves the pages at `/chat` and `/chat/backoffice`, but the browser connects over the `/customer-chat` Socket.IO namespace.

## Features Overview

### Server Features
- Express.js web server serving static files
- Socket.IO for real-time WebSocket communication
- Random nickname generation (e.g., "CoolTiger123")
- Random color assignment for usernames
- User connection/disconnection handling
- Message broadcasting to all connected users
- Typing indicator support

### Client Features
- Clean, modern dark theme interface
- Mobile-responsive design
- Real-time message display
- Typing indicators
- Connection status notifications
- Automatic scrolling to latest messages
- Message timestamps
- User count display

## Module API

### `createStandaloneFlanerieChat(options)`

Creates an Express app, HTTP server, and Socket.IO server, then mounts Flanerie Chat onto them.

```js
import { createStandaloneFlanerieChat } from 'flanerie-chat';

const { server } = createStandaloneFlanerieChat();
server.listen(3000);
```

### `mountFlanerieChat(options)`

Mounts Flanerie Chat into an existing Express and Socket.IO setup.

Supported options:

- `app`: required Express app instance
- `io`: required Socket.IO server instance
- `mountPath`: route prefix for the UI, defaults to `/`
- `socketPath`: Socket.IO transport path, defaults to `/socket.io`
- `namespace`: Socket.IO namespace, defaults to the `mountPath`

Return value:

- `router`: the Express router mounted into the host app
- `io`: the Socket.IO namespace used by the chat
- `state`: in-memory chat state containers for the mounted instance
- `mountPath`: normalized route prefix
- `namespace`: normalized Socket.IO namespace
- `socketPath`: normalized Socket.IO transport path
- `clientConfig`: the config injected into the browser pages

## File Structure

```
FlanerieChat/
├── server.js              # Standalone launcher
├── src/
│   └── flanerie-chat.js   # Reusable ESM module API
├── package.json           # Project dependencies and scripts
├── public/
│   ├── index.html         # Main HTML page template
│   ├── backoffice.html    # Backoffice HTML page template
│   ├── styles.css         # Chat styling
│   ├── backoffice.css     # Backoffice styling
│   ├── script.js          # Chat client logic
│   └── backoffice.js      # Backoffice client logic
└── README.md              # This file
```

## Configuration

The standalone server runs on port 3000 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## Browser Support

This application works on all modern browsers that support:
- WebSockets
- ES6+ JavaScript
- CSS Grid and Flexbox
- CSS Custom Properties (variables)

## Development

To run in development mode with automatic server restart:

```bash
npm run dev
```

This uses nodemon to restart the server automatically when files change.

## Deployment

For production deployment:

1. Set the `NODE_ENV` environment variable to `production`
2. Ensure all dependencies are installed
3. Start the server with `npm start`
4. Configure your reverse proxy (nginx, Apache) if needed
5. Set up SSL/HTTPS for secure WebSocket connections

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the GNU GPL v3