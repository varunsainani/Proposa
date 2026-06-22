import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async Express handler so thrown errors / rejected promises are
 * forwarded to next() and reach the central error handler. Express 4 does not
 * catch async rejections on its own.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => unknown
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
