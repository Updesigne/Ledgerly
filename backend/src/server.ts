import 'dotenv/config';
import { app } from './app.js';
import { startEventIndexer } from './workers/event-indexer.js';

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => {
  console.log(`Receivables Marketplace API listening on http://localhost:${port}`);
  console.log(`JSON state directory: ${process.env.DATA_DIR ?? './data'}`);
  startEventIndexer();
});

function shutdown(signal: string) {
  console.log(`${signal} received; shutting down backend.`);
  server.close(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
