// Express 4 does not catch rejected promises from async handlers. This wrapper forwards them
// to next(err), so controllers don't need their own try/catch.
export default function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
