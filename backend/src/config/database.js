// Sequelize connection. Models live in src/models; importing src/models/index.js creates the tables.
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryTypes, Sequelize, Transaction, literal } from 'sequelize';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_PATH lets tests use an in-memory database (DB_PATH=:memory:).
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'comic-platform.sqlite');

// Sequelize looks up the current transaction in this store, so every query that runs inside
// withTransaction() joins the transaction automatically, without passing `{ transaction }` around.
const store = new AsyncLocalStorage();
Sequelize.useCLS({
  get: (key) => store.getStore()?.get(key),
  set: (key, value) => store.getStore()?.set(key, value),
  run: (fn) => {
    const context = new Map();
    return store.run(context, () => fn(context));
  },
  bind: (fn) => fn,
});

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
  // Table names are set on each model; timestamps are plain columns (see now() below).
  define: { freezeTableName: true, timestamps: false },
  // Take the write lock when the transaction starts instead of failing halfway through it.
  transactionType: Transaction.TYPES.IMMEDIATE,
  // A transaction runs on its own SQLite connection; other writes wait for it instead of failing.
  retry: { match: [/SQLITE_BUSY/], max: 10 },
});

// Timestamps are stored as SQLite text ('YYYY-MM-DD HH:MM:SS'), like the existing data.
export const now = () => literal('CURRENT_TIMESTAMP');

// For reporting queries that are clearer in SQL (recursive CTEs, UNIONs, many subqueries).
// `?` placeholders are filled from `replacements`, escaped by Sequelize.
export const select = (sql, replacements = []) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

// Transactions are queued so two of them never overlap on the database.
let transactionQueue = Promise.resolve();

export function withTransaction(work) {
  const run = () => sequelize.transaction(() => work());
  const result = transactionQueue.then(run, run);
  transactionQueue = result.catch(() => {});
  return result;
}

export default sequelize;
