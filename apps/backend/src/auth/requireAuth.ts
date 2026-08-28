import type { NextFunction, Request, Response } from 'express';

/** The authenticated user shape attached by passport's deserializeUser. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Narrows `req.user` for handlers behind requireAuth, so route code can use
 * `req.user.id` without a non-null assertion at every call site.
 */
export interface AuthedRequest extends Request {
  user: SessionUser;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated?.() && req.user) {
    next();
    return;
  }
  res.status(401).json({ error: 'Not authenticated' });
}

/** Small helper so handlers read `getUser(req).id` instead of casting inline. */
export function getUser(req: Request): SessionUser {
  return req.user as SessionUser;
}
