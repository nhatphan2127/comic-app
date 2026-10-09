// Authentication for the publishing API (/publish). Session tokens are NOT accepted here, and
// API keys are not accepted anywhere else, so a leaked key can only publish — never change a
// password, read messages or act as staff.
import { authenticate } from '../services/apiKeyService.js';
import { ForbiddenError, UnauthorizedError } from '../errors.js';

export async function authenticateApiKey(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing API key. Send "Authorization: Bearer ink_..." (create a key in the Studio → API keys).');
    }
    const { key, user } = await authenticate(header.slice(7).trim(), req.ip);
    req.apiKey = key;
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export const requireScope = (scope) => (req, res, next) =>
  req.apiKey?.scopes.includes(scope) ? next() : next(new ForbiddenError(`This API key is missing the "${scope}" scope`));
