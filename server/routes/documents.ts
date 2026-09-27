import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware.js';
import { randomUUID } from 'crypto';
import type { Document, DocumentCollection, DocumentChunk } from '../../shared/types.js';
import { chunkText, searchKnowledgeBase } from '../rag.js';

const router = Router();
router.use(authMiddleware);

// --- Collections ---
router.get('/collections', (req, res) => {
  const userId = req.user!.id;
  const list = Array.from(db.collections.values()).filter(
    (c) => c.user_id === userId || c.user_id === 'usr_owner_giri'
  );
  res.json(list);
});

router.post('/collections', (req, res) => {
  const { name, description = '', color = 'blue' } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Collection name is required' });
    return;
  }

  const col: DocumentCollection = {
    id: 'col_' + randomUUID().slice(0, 8),
    user_id: req.user!.id,
    name: name.trim(),
    description: description.trim(),
    color,
    document_count: 0,
    created_at: new Date().toISOString(),
  };

  db.collections.set(col.id, col);
  db.logAudit(req.user!.id, 'kb.collection_created', 'collection', col.id, { name: col.name });
  res.json(col);
});

router.delete('/collections/:id', (req, res) => {
  const col = db.collections.get(req.params.id);
  if (!col) {
    res.status(404).json({ error: 'Collection not found' });
    return;
  }
  db.collections.delete(col.id);
  res.json({ success: true });
});

// --- Documents ---
router.get('/', (req, res) => {
  const userId = req.user!.id;
  const list = Array.from(db.documents.values()).filter(
    (d) => d.user_id === userId || d.user_id === 'usr_owner_giri'
  );
  res.json(list);
});

router.post('/', (req, res) => {
  const { filename, content, mime_type = 'text/plain', collection_ids = [] } = req.body;
  if (!filename || !content) {
    res.status(400).json({ error: 'Filename and content are required' });
    return;
  }

  const docId = 'doc_' + randomUUID().slice(0, 8);
  const chunks = chunkText(content, 750, 100);

  const doc: Document = {
    id: docId,
    user_id: req.user!.id,
    filename: filename.trim(),
    mime_type,
    file_size_bytes: Buffer.byteLength(content, 'utf-8'),
    status: 'ready',
    chunk_count: chunks.length,
    collection_ids: Array.isArray(collection_ids) ? collection_ids : [],
    created_at: new Date().toISOString(),
    summary: content.slice(0, 200) + '...',
  };

  db.documents.set(docId, doc);

  // Store chunks
  chunks.forEach((chunkStr, idx) => {
    const chunkObj: DocumentChunk = {
      id: 'chk_' + randomUUID().slice(0, 8),
      document_id: docId,
      user_id: req.user!.id,
      chunk_index: idx,
      content: chunkStr,
      page_number: idx + 1,
    };
    db.chunks.push(chunkObj);
  });

  // Update collection counts
  for (const cId of doc.collection_ids) {
    const col = db.collections.get(cId);
    if (col) {
      col.document_count += 1;
      db.collections.set(cId, col);
    }
  }

  db.logAudit(req.user!.id, 'kb.document_uploaded', 'document', doc.id, {
    filename: doc.filename,
    chunk_count: doc.chunk_count,
  });

  res.json(doc);
});

router.delete('/:id', (req, res) => {
  const doc = db.documents.get(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  db.documents.delete(doc.id);
  db.chunks = db.chunks.filter((c) => c.document_id !== doc.id);

  // Decrease collection counts
  for (const cId of doc.collection_ids) {
    const col = db.collections.get(cId);
    if (col) {
      col.document_count = Math.max(0, col.document_count - 1);
      db.collections.set(cId, col);
    }
  }

  db.logAudit(req.user!.id, 'kb.document_deleted', 'document', doc.id, { filename: doc.filename });
  res.json({ success: true });
});

// Test retrieval
router.post('/retrieval/search', (req, res) => {
  const { query, collectionIds } = req.body;
  if (!query) {
    res.status(400).json({ error: 'Query is required' });
    return;
  }
  const result = searchKnowledgeBase(req.user!.id, query, collectionIds);
  res.json(result);
});

export default router;
