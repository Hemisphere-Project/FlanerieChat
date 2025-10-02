# Flanerie Chat

A simple real-time web chat application built with Node.js, Express, and Socket.IO.

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

3. Start chatting! Each user gets a random nickname and color automatically.

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

## File Structure

```
FlanerieChat/
├── server.js          # Main server file
├── package.json       # Project dependencies and scripts
├── public/
│   ├── index.html     # Main HTML page
│   ├── styles.css     # CSS styling
│   └── script.js      # Client-side JavaScript
└── README.md          # This file
```

## Configuration

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable:

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

This project is licensed under the MIT License.