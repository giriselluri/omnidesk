import { randomUUID } from 'crypto';
import { db } from './db.js';
import type { EmailThread, EmailDraft } from '../shared/types.js';

export function listThreads(query?: string): EmailThread[] {
  let list = Array.from(db.emailThreads.values());
  if (query) {
    const qLower = query.toLowerCase();
    list = list.filter(
      (t) =>
        t.subject.toLowerCase().includes(qLower) ||
        t.from.toLowerCase().includes(qLower) ||
        t.snippet.toLowerCase().includes(qLower)
    );
  }
  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getThread(threadId: string): EmailThread | undefined {
  return db.emailThreads.get(threadId);
}

export function createDraft(userId: string, data: { threadId?: string; recipient: string; subject: string; body: string }): EmailDraft {
  const draft: EmailDraft = {
    id: 'drf_' + randomUUID().slice(0, 8),
    user_id: userId,
    thread_id: data.threadId,
    recipient: data.recipient,
    subject: data.subject,
    body: data.body,
    status: 'draft',
    created_at: new Date().toISOString(),
  };
  db.emailDrafts.set(draft.id, draft);
  db.logAudit(userId, 'gmail.draft_created', 'email_draft', draft.id, { recipient: draft.recipient, subject: draft.subject });
  return draft;
}

export function updateDraft(userId: string, draftId: string, updates: Partial<Pick<EmailDraft, 'recipient' | 'subject' | 'body'>>): EmailDraft | null {
  const draft = db.emailDrafts.get(draftId);
  if (!draft || draft.user_id !== userId) return null;
  if (draft.status === 'sent') throw new Error('Cannot edit an already sent draft');

  if (updates.recipient !== undefined) draft.recipient = updates.recipient;
  if (updates.subject !== undefined) draft.subject = updates.subject;
  if (updates.body !== undefined) draft.body = updates.body;
  draft.updated_at = new Date().toISOString();

  db.emailDrafts.set(draftId, draft);
  return draft;
}

export function approveAndSendDraft(userId: string, draftId: string, confirmed: boolean): { success: boolean; draft?: EmailDraft; error?: string } {
  if (!confirmed) {
    return { success: false, error: 'Explicit user confirmation is strictly required to send email.' };
  }

  const draft = db.emailDrafts.get(draftId);
  if (!draft || draft.user_id !== userId) {
    return { success: false, error: 'Draft not found or unauthorized.' };
  }

  if (draft.status === 'sent') {
    return { success: false, error: 'This draft has already been sent.' };
  }

  if (!draft.recipient || !draft.recipient.includes('@')) {
    return { success: false, error: 'Valid recipient email address is required.' };
  }

  draft.status = 'sent';
  draft.sent_at = new Date().toISOString();
  db.emailDrafts.set(draftId, draft);

  // If this draft belongs to a thread, append outgoing message to the thread
  if (draft.thread_id) {
    const thread = db.emailThreads.get(draft.thread_id);
    if (thread) {
      const user = db.users.get(userId);
      thread.messages.push({
        id: 'msg_sent_' + randomUUID().slice(0, 8),
        from: user?.email || 'me',
        from_name: user?.display_name || 'Me',
        to: draft.recipient,
        date: draft.sent_at,
        body: draft.body,
      });
      thread.unread = false;
      thread.snippet = 'You: ' + draft.body.slice(0, 100);
      db.emailThreads.set(thread.id, thread);
    }
  }

  db.logAudit(userId, 'gmail.message_sent', 'email_draft', draft.id, {
    recipient: draft.recipient,
    subject: draft.subject,
    sent_at: draft.sent_at,
  });

  return { success: true, draft };
}
