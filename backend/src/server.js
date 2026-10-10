import app from './app.js';

const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
// Node cuts off any request whose body takes longer than 5 minutes to arrive, which a big chapter or a
// bulk-import zip on a slow connection easily does. 30 minutes by default.
server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS) || 30 * 60 * 1000;
