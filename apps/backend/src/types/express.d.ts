import type { SessionUser } from '../auth/requireAuth.js';

// Passport's default Express.User is an empty interface, so req.user would be
// `{}` everywhere. Widening it here gives every route real field types.
declare global {
  namespace Express {
    interface User extends SessionUser {}
  }
}

export {};
