import type { NextFunction, Request, Response } from 'express';

export const asyncHandler =
  (fn: (req: any, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err: any) => {
      console.error('[api]', req.method, req.originalUrl, err?.message);
      const status = err?.status ?? 400;
      res.status(status).json({ error: err?.message ?? 'Request failed' });
    });
  };

export function fail(message: string, status = 400): never {
  const err: any = new Error(message);
  err.status = status;
  throw err;
}
