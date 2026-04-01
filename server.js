import { createStandaloneFlanerieChat } from './src/flanerie-chat.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const { server } = createStandaloneFlanerieChat();

server.listen(port, () => {
    console.log(`Chat server running on port ${port}`);
    console.log(`Open http://localhost:${port} in your browser`);
});