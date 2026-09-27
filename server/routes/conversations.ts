import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware.js';
import { randomUUID } from 'crypto';
import type { Conversation, ChatMessage, ProviderId } from '../../shared/types.js';
import { searchKnowledgeBase } from '../rag.js';
import { performWebSearch } from '../search.js';
import { routeChatStream } from '../providers/index.js';

const router = Router();
router.use(authMiddleware);

// List own conversations
router.get('/', (req, res) => {
  const userId = req.user!.id;
  const list = Array.from(db.conversations.values())
    .filter((c) => c.user_id === userId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  res.json(list);
});

// Create new conversation
router.post('/', (req, res) => {
  const userId = req.user!.id;
  const { title = 'New Conversation' } = req.body;

  const conv: Conversation = {
    id: 'conv_' + randomUUID().slice(0, 8),
    user_id: userId,
    title,
    archived: false,
    pinned: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_count: 0,
    last_model: 'Gemini 3.8 Flash',
  };

  db.conversations.set(conv.id, conv);
  db.messages.set(conv.id, []);
  res.json(conv);
});

// Read own conversation with messages
router.get('/:id', (req, res) => {
  const userId = req.user!.id;
  const conv = db.conversations.get(req.params.id);

  if (!conv || conv.user_id !== userId) {
    res.status(404).json({ error: 'Conversation not found or access denied' });
    return;
  }

  const msgs = db.messages.get(conv.id) || [];
  res.json({ conversation: conv, messages: msgs });
});

// Update conversation
router.patch('/:id', (req, res) => {
  const userId = req.user!.id;
  const conv = db.conversations.get(req.params.id);

  if (!conv || conv.user_id !== userId) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const { title, archived, pinned } = req.body;
  if (title !== undefined) conv.title = title;
  if (archived !== undefined) conv.archived = Boolean(archived);
  if (pinned !== undefined) conv.pinned = Boolean(pinned);
  conv.updated_at = new Date().toISOString();

  db.conversations.set(conv.id, conv);
  res.json(conv);
});

// Delete conversation
router.delete('/:id', (req, res) => {
  const userId = req.user!.id;
  const conv = db.conversations.get(req.params.id);

  if (!conv || conv.user_id !== userId) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  db.conversations.delete(conv.id);
  db.messages.delete(conv.id);
  res.json({ success: true });
});

// Submit message and stream SSE response with atomic quota reservation and settlement
router.post('/:id/messages', async (req, res) => {
  const userId = req.user!.id;
  const convId = req.params.id;
  const conv = db.conversations.get(convId);

  if (!conv || conv.user_id !== userId) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const {
    provider = 'google',
    model = 'gemini-3.8-flash',
    content,
    options = {},
  } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ error: 'Message content cannot be empty' });
    return;
  }

  // 1. Find model in registry to get pricing
  const modelInfo = Array.from(db.models.values()).find(
    (m) => m.model_key === model || m.id === model
  ) || db.models.get('google-gemini-3.8-flash')!;

  // 2. Estimate worst-case cost for pre-flight reservation
  const estimatedInputTokens = Math.max(20, Math.ceil(content.length / 4) + 200);
  const estimatedOutputTokens = options.maxOutputTokens || 2048;
  const estimatedInputCost = Math.ceil((estimatedInputTokens * modelInfo.input_price_per_million) / 1_000_000);
  const estimatedOutputCost = Math.ceil((estimatedOutputTokens * modelInfo.output_price_per_million) / 1_000_000);
  const totalEstimatedMicroUsd = Math.max(50, estimatedInputCost + estimatedOutputCost);

  // 3. Atomically Reserve Quota
  const reservationResult = db.reserveQuota(
    userId,
    provider as ProviderId,
    modelInfo.model_key,
    totalEstimatedMicroUsd
  );

  if (!reservationResult.success || !reservationResult.reservationId) {
    res.status(402).json({
      error: reservationResult.reason || 'Quota reservation rejected.',
      code: 'QUOTA_EXCEEDED',
    });
    return;
  }

  const reservationId = reservationResult.reservationId;

  // 4. Save User Message
  const userMsgId = 'msg_' + randomUUID().slice(0, 8);
  const userMsg: ChatMessage = {
    id: userMsgId,
    conversation_id: convId,
    user_id: userId,
    role: 'user',
    content: content.trim(),
    status: 'completed',
    created_at: new Date().toISOString(),
  };

  const currentMsgs = db.messages.get(convId) || [];
  currentMsgs.push(userMsg);
  db.messages.set(convId, currentMsgs);

  // 5. RAG Retrieval if enabled or relevant
  let retrievedContext: string | undefined = undefined;
  let citations: any[] | undefined = undefined;
  if (options.collectionIds?.length > 0 || options.useKnowledgeBase) {
    const ragResult = searchKnowledgeBase(userId, content, options.collectionIds);
    if (ragResult.citations.length > 0) {
      retrievedContext = ragResult.context;
      citations = ragResult.citations;
    }
  }

  // 6. Web Search if enabled
  let searchResults: any[] | undefined = undefined;
  if (options.webSearch) {
    searchResults = await performWebSearch(content);
  }

  // 7. Prepare Assistant Message placeholder
  const assistantMsgId = 'msg_' + randomUUID().slice(0, 8);
  const assistantMsg: ChatMessage = {
    id: assistantMsgId,
    conversation_id: convId,
    user_id: userId,
    role: 'assistant',
    content: '',
    provider: provider as ProviderId,
    model_key: modelInfo.model_key,
    model_name: modelInfo.display_name,
    status: 'streaming',
    citations,
    search_results: searchResults,
    created_at: new Date().toISOString(),
  };

  // Setup SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('message_start', {
    messageId: assistantMsgId,
    provider,
    model: modelInfo.model_key,
    modelName: modelInfo.display_name,
    citations,
    searchResults,
  });

  // Assemble prior message history for context
  const historyForProvider = currentMsgs.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let accumulatedContent = '';
  let finalInputTokens = estimatedInputTokens;
  let finalOutputTokens = 0;

  try {
    const stream = routeChatStream({
      requestId: reservationId,
      userId,
      provider: provider as ProviderId,
      model: modelInfo.model_key,
      messages: historyForProvider,
      maxOutputTokens: options.maxOutputTokens || 4096,
      retrievedContext,
      citations,
      webSearchResults: searchResults,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'delta' && chunk.delta) {
        accumulatedContent += chunk.delta;
        sendEvent('text_delta', { delta: chunk.delta });
      } else if (chunk.type === 'done') {
        finalInputTokens = chunk.inputTokens || finalInputTokens;
        finalOutputTokens = chunk.outputTokens || Math.ceil(accumulatedContent.length / 4);
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'Provider stream failed');
      }
    }

    // 8. Calculate actual cost and settle quota
    const actualInputCost = Math.ceil((finalInputTokens * modelInfo.input_price_per_million) / 1_000_000);
    const actualOutputCost = Math.ceil((finalOutputTokens * modelInfo.output_price_per_million) / 1_000_000);
    const actualMicroUsd = Math.max(10, actualInputCost + actualOutputCost);

    db.settleQuota(reservationId, actualMicroUsd, finalInputTokens, finalOutputTokens);

    assistantMsg.content = accumulatedContent;
    assistantMsg.status = 'completed';
    assistantMsg.input_tokens = finalInputTokens;
    assistantMsg.output_tokens = finalOutputTokens;
    assistantMsg.cost_micro_usd = actualMicroUsd;

    currentMsgs.push(assistantMsg);
    db.messages.set(convId, currentMsgs);

    conv.updated_at = new Date().toISOString();
    conv.message_count = currentMsgs.length;
    conv.last_model = modelInfo.display_name;

    // Generate smart title if conversation is new and still has default title
    if (conv.title === 'New Conversation' && currentMsgs.length <= 2) {
      conv.title = content.length > 36 ? content.slice(0, 36) + '...' : content;
    }
    db.conversations.set(convId, conv);

    sendEvent('usage', {
      inputTokens: finalInputTokens,
      outputTokens: finalOutputTokens,
      costMicroUsd: actualMicroUsd,
      formattedCost: `$${(actualMicroUsd / 1_000_000).toFixed(5)}`,
    });

    sendEvent('message_done', { message: assistantMsg });
    res.end();
  } catch (err: any) {
    console.error('Conversation stream error:', err);
    db.releaseQuota(reservationId);

    assistantMsg.status = 'failed';
    assistantMsg.content = accumulatedContent || `Request could not be completed: ${err.message || 'Unknown error'}`;
    currentMsgs.push(assistantMsg);
    db.messages.set(convId, currentMsgs);

    sendEvent('error', { error: err.message || 'Stream processing failed' });
    res.end();
  }
});

export default router;
