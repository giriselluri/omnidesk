import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware.js';
import { listThreads, getThread, createDraft, updateDraft, approveAndSendDraft } from '../gmail.js';
import { GoogleGenAI } from '@google/genai';

const router = Router();
router.use(authMiddleware);

// List threads
router.get('/threads', (req, res) => {
  const query = req.query.q as string | undefined;
  const threads = listThreads(query);
  res.json(threads);
});

// Get single thread
router.get('/threads/:id', (req, res) => {
  const thread = getThread(req.params.id);
  if (!thread) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  res.json(thread);
});

// Generate AI summary for a thread
router.post('/threads/:id/summarize', async (req, res) => {
  const thread = getThread(req.params.id);
  if (!thread) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }

  const threadContext = thread.messages
    .map((m) => `From: ${m.from_name} <${m.from}>\nDate: ${m.date}\nBody: ${m.body}`)
    .join('\n\n---\n\n');

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Analyze this email thread and provide:
1. A concise 2-sentence executive summary.
2. 2 to 3 bulleted actionable next steps.

Email Thread Subject: ${thread.subject}
${threadContext}`;

      const resp = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      const text = resp.text || '';
      thread.ai_summary = text;
      res.json({ summary: text });
      return;
    }
  } catch (err) {
    console.error('Email summarize error:', err);
  }

  // Fallback summary
  const summary = `Key takeaway: Discussion regarding ${thread.subject} involving ${thread.messages.length} message(s). Follow-up required.`;
  thread.ai_summary = summary;
  res.json({ summary });
});

// Generate AI draft reply
router.post('/threads/:id/draft-reply', async (req, res) => {
  const thread = getThread(req.params.id);
  if (!thread) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }

  const { instructions = 'Respond politely and concisely agreeing to the request.' } = req.body;
  const lastMsg = thread.messages[thread.messages.length - 1];

  let draftBody = '';
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are helping draft a professional email reply.
Original message from ${lastMsg.from_name}:
"${lastMsg.body}"

User instructions for reply: "${instructions}"

Output ONLY the email body text. Do not include markdown code fences or headers. Sign off naturally.`;

      const resp = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });
      draftBody = resp.text || '';
    }
  } catch (err) {
    console.error('Draft generation error:', err);
  }

  if (!draftBody) {
    draftBody = `Hi ${lastMsg.from_name.split(' ')[0]},\n\nThank you for reaching out. Regarding your note on "${thread.subject}", I have reviewed the details and we are aligned.\n\nLet's coordinate on next steps shortly.\n\nBest regards,\n${req.user!.display_name}`;
  }

  const draft = createDraft(req.user!.id, {
    threadId: thread.id,
    recipient: lastMsg.from,
    subject: thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`,
    body: draftBody.trim(),
  });

  res.json(draft);
});

// List drafts
router.get('/drafts', (req, res) => {
  const userId = req.user!.id;
  const drafts = Array.from(db.emailDrafts.values())
    .filter((d) => d.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(drafts);
});

// Update draft
router.patch('/drafts/:id', (req, res) => {
  try {
    const updated = updateDraft(req.user!.id, req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// CRITICAL EXPLICIT APPROVAL & SEND ENDPOINT
router.post('/drafts/:id/send', (req, res) => {
  const { confirmed } = req.body;
  if (!confirmed) {
    res.status(400).json({
      error: 'Security Policy: Explicit user confirmation (confirmed: true) is strictly required to send email.',
    });
    return;
  }

  const result = approveAndSendDraft(req.user!.id, req.params.id, true);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ success: true, draft: result.draft });
});

// Discard draft
router.delete('/drafts/:id', (req, res) => {
  const draft = db.emailDrafts.get(req.params.id);
  if (!draft || draft.user_id !== req.user!.id) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  draft.status = 'discarded';
  db.emailDrafts.delete(draft.id);
  res.json({ success: true });
});

export default router;
