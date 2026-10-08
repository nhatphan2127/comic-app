// Business errors carry their own HTTP status, so services can throw them without knowing about `res`.
// errorMiddleware turns `err.status` into the response status code.
export class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') { super(message, 400); }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') { super(message, 401); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') { super(message, 403); }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') { super(message, 404); }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') { super(message, 409); }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload too large') { super(message, 413); }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'Unsupported media type') { super(message, 415); }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') { super(message, 429); }
}
