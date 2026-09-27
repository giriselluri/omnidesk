import type { Request, Response, NextFunction } from 'express';
import { db } from './db.js';
import type { User } from '../shared/types.js';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Current active session tracking
let currentUserId = 'usr_owner_giri'; // default to owner for seamless initial state

export function setActiveUserId(userId: string) {
  if (db.users.has(userId)) {
    currentUserId = userId;
  }
}

export function getActiveUserId(): string {
  return currentUserId;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check header or fallback to current active session
  const headerUserId = req.headers['x-user-id'] as string;
  const targetId = headerUserId && db.users.has(headerUserId) ? headerUserId : currentUserId;
  const user = db.users.get(targetId);

  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }

  if (user.status === 'disabled') {
    res.status(403).json({ error: 'Account has been disabled by the workspace administrator.' });
    return;
  }

  req.user = user;
  next();
}

export function requireRole(role: 'owner') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({ error: 'Forbidden: Owner role required' });
      return;
    }
    next();
  };
}
