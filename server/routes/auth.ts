import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware, setActiveUserId, getActiveUserId } from '../middleware.js';
import { randomUUID } from 'crypto';
import type { User } from '../../shared/types.js';

const router = Router();

// Current User Info
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    user: req.user,
    availableUsers: Array.from(db.users.values()),
  });
});

// Switch active user (for testing multi-user and owner vs member permissions in demo)
router.post('/switch-user', (req, res) => {
  const { userId } = req.body;
  if (!userId || !db.users.has(userId)) {
    res.status(400).json({ error: 'User not found' });
    return;
  }
  setActiveUserId(userId);
  const user = db.users.get(userId);
  res.json({ success: true, user });
});

// Accept invitation code
router.post('/accept-invite', (req, res) => {
  const { inviteCode, displayName } = req.body;
  if (!inviteCode) {
    res.status(400).json({ error: 'Invite code is required' });
    return;
  }

  const invitation = Array.from(db.invitations.values()).find(
    (inv) => inv.invite_code.toUpperCase() === inviteCode.trim().toUpperCase()
  );

  if (!invitation) {
    res.status(404).json({ error: 'Invalid invitation code' });
    return;
  }

  if (invitation.status === 'accepted') {
    res.status(400).json({ error: 'This invitation code has already been redeemed' });
    return;
  }

  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    invitation.status = 'expired';
    res.status(400).json({ error: 'This invitation has expired (valid for 48 hours)' });
    return;
  }

  // Create new active member
  const newUser: User = {
    id: 'usr_' + randomUUID().slice(0, 8),
    email: invitation.email,
    display_name: displayName || invitation.email.split('@')[0],
    role: invitation.role,
    status: 'active',
    avatar_url: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80`,
    created_at: new Date().toISOString(),
  };

  db.users.set(newUser.id, newUser);
  invitation.status = 'accepted';
  invitation.accepted_at = new Date().toISOString();

  db.logAudit(newUser.id, 'auth.invitation_accepted', 'user', newUser.id, {
    email: newUser.email,
    invite_code: invitation.invite_code,
  });

  setActiveUserId(newUser.id);
  res.json({ success: true, user: newUser });
});

export default router;
