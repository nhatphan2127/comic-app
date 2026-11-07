import fs from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const databasePath = path.resolve(
  process.env.DB_PATH || path.join(scriptDir, '..', 'data', 'comic-platform.sqlite')
);
const username = process.env.ADMIN_USERNAME || 'admin';
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const displayName = process.env.ADMIN_DISPLAY_NAME || 'Administrator';

function validateAdmin() {
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
    throw new Error('ADMIN_USERNAME must be 3-32 characters: letters, numbers, _ . -');
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('Set a valid ADMIN_EMAIL environment variable');
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
    throw new Error('Set ADMIN_PASSWORD to a password of 6-72 characters');
  }
  if (!displayName.trim() || displayName.length > 50) {
    throw new Error('ADMIN_DISPLAY_NAME must be 1-50 characters');
  }
}

async function confirmReset() {
  if (process.argv.includes('--yes')) return true;
  if (!process.stdin.isTTY) {
    throw new Error('Run interactively to confirm database reset, or pass --yes to confirm explicitly');
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(
      `This will permanently delete all data in "${databasePath}". Type RESET to continue: `
    );
    return answer === 'RESET';
  } finally {
    prompt.close();
  }
}

async function removeDatabaseFile(filePath) {
  try {
    const file = await fs.lstat(filePath);
    if (!file.isFile()) throw new Error(`Refusing to remove non-file database path: ${filePath}`);
    await fs.rm(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function setupDatabase() {
  validateAdmin();
  if (process.env.DB_PATH === ':memory:') {
    throw new Error('DB_PATH=:memory: is not supported for persistent database setup');
  }
  if (!(await confirmReset())) {
    console.log('Database setup cancelled; existing data was not changed.');
    return;
  }

  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await removeDatabaseFile(databasePath);
  await removeDatabaseFile(`${databasePath}-wal`);
  await removeDatabaseFile(`${databasePath}-shm`);
  await removeDatabaseFile(`${databasePath}-journal`);

  const { sequelize, User, UserPreference } = await import('../src/models/index.js');
  try {
    const { hashPassword } = await import('../src/services/authService.js');
    const id = uuidv4();
    const passwordHash = await hashPassword(password);
    await sequelize.transaction(async () => {
      await User.create({
        id,
        username,
        email,
        displayName,
        password: passwordHash,
        role: 'admin',
        isBanned: 0,
      });
      await UserPreference.create({ userId: id, theme: 'main', filter: 1 });
    });
    console.log(`Database created with empty tables and admin account "${username}".`);
    await sequelize.close();
  } catch (error) {
    await sequelize.close();
    throw error;
  }
}

setupDatabase().catch((error) => {
  console.error(`Database setup failed: ${error.message}`);
  process.exitCode = 1;
});
