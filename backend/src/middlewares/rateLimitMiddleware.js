// Rate limits shared by more than one router. Limiters keep their counters in the instance, so a
// limiter mounted on several routes gives them one shared budget.
import rateLimit from 'express-rate-limit';
import { TooManyRequestsError } from '../errors.js';

// Retry-After tells scripts how long to wait (the sample publishing scripts sleep for exactly that long).
export const tooMany = (message) => (req, res, next) => {
  const resetTime = req.rateLimit?.resetTime;
  res.set('Retry-After', String(resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : 60));
  next(new TooManyRequestsError(message));
};

// New comics per account per hour, Studio and publishing API together. Counted per user, not per
// API key, so making more keys (or switching to the website) doesn't raise the budget.
// Only comics actually created count: a typo (400) or a taken url (409) doesn't use up the budget.
// Mount it after authentication: it needs req.user.
export const comicCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.COMIC_CREATE_RATE_LIMIT) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipFailedRequests: true,
  keyGenerator: (req) => `comic-create:${req.user.id}`,
  handler: tooMany('You have created too many comics in the last hour, try again later (see the RateLimit headers)'),
});
