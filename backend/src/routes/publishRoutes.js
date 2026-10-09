// /publish: the publishing API for contributors' scripts. Authenticated by API key only.
//
// Order matters on the upload routes: key check → scope → rate limit → multer → signature check.
// Nothing is written to disk before the caller is known to be allowed to upload.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateApiKey, requireScope } from '../middlewares/apiKeyMiddleware.js';
import { verifyImageSignatures } from '../middlewares/imageSignatureMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';
import * as publish from '../controllers/publishController.js';
import { TooManyRequestsError } from '../errors.js';

// Retry-After tells scripts how long to wait (the sample scripts sleep for exactly that long).
const tooMany = (message) => (req, res, next) => {
  const resetTime = req.rateLimit?.resetTime;
  res.set('Retry-After', String(resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : 60));
  next(new TooManyRequestsError(message));
};

// Guessing keys: only rejected keys (401) count, per IP.
const badKeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.PUBLISH_BAD_KEY_LIMIT) || 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode !== 401,
  handler: tooMany('Too many invalid API keys from this address, try again later'),
});

// Uploads per key, so a runaway script (or a stolen key) can't flood the review queue or the disk.
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.PUBLISH_RATE_LIMIT) || 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `key:${req.apiKey.id}`,
  handler: tooMany('Upload limit reached for this API key, wait a few minutes (see the RateLimit headers)'),
});

const router = express.Router();
router.use(badKeyLimiter, authenticateApiKey);

router.get('/whoami', publish.whoami);
router.post('/comics', requireScope('comics:write'), uploadLimiter, upload.single('cover'), verifyImageSignatures, publish.createComic);
router.post(
  '/comics/:comic/chapters',
  requireScope('chapters:write'),
  uploadLimiter,
  upload.array('pages', 100),
  verifyImageSignatures,
  publish.createChapter,
);

export default router;
