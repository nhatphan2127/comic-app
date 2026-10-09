import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { storageRoot, cleanupUploadsOnFailure } from './middlewares/uploadMiddleware.js';
import errorHandler, { notFoundHandler } from './middlewares/errorMiddleware.js';
import { requireTrustedOrigin } from './middlewares/csrfMiddleware.js';
import { TooManyRequestsError } from './errors.js';
import { API_PREFIX } from './utils/http.js';
import v1Routes from './routes/index.js';
import docsRoutes from './docs/docsRoutes.js';

// Comma-separated list, e.g. CLIENT_ORIGIN=https://comic.example.com,http://localhost:5173
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Brute-force protection for login, register and password reset: 20 attempts per IP per 15 minutes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => !['/login', '/register', '/password-reset', '/password-reset/confirm'].includes(req.path),
  // Goes through errorHandler, so the 429 is a problem+json body like every other error.
  handler: (req, res, next) => next(new TooManyRequestsError('Too many attempts, please try again later')),
});

const app = express();
app.disable('x-powered-by');
// Images in /storage are loaded by the frontend from another origin, so allow cross-origin resource loading.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// Location is exposed so the browser lets the frontend read it after a 201.
// credentials: the frontend sends the session cookie with every request.
app.use(cors({ origin: allowedOrigins, credentials: true, exposedHeaders: ['Location'] }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/storage', express.static(storageRoot, { dotfiles: 'deny' }));
app.use(cleanupUploadsOnFailure);

app.get('/', (req, res) => {
  res.json({ data: { name: 'Comic platform API', versions: { v1: API_PREFIX }, docs: '/api/docs' } });
});

app.use('/api', docsRoutes);
app.use(API_PREFIX, requireTrustedOrigin(allowedOrigins));
app.use(`${API_PREFIX}/auth`, authLimiter);
app.use(API_PREFIX, v1Routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
