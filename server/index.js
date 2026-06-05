import app, { PORT } from './app.js';

const server = app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Stop the old process (Task Manager) or run: npx kill-port ${PORT}`
    );
    process.exit(1);
  }
  throw error;
});
