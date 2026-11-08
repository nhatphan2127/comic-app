import app from './app.js';
import { logger } from './config/logger.js';
import { cleanupStaleAdminImports } from './services/adminImportService.js';

const port = Number(process.env.PORT) || 5000;
// HOST=127.0.0.1 keeps the backend reachable only through the local Nginx reverse proxy.
const host = process.env.HOST || undefined;
await cleanupStaleAdminImports({ recoverCommitting: true });
const server = app.listen(port, host, () => {
  logger.info(`Backend listening on http://${host || 'localhost'}:${port}`);
});
// Node cuts off any request whose body takes longer than 5 minutes to arrive, which a big chapter or a
// bulk-import zip on a slow connection easily does. 30 minutes by default.
server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS) || 30 * 60 * 1000;
