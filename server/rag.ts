import { randomUUID } from 'crypto';
import { db } from './db.js';
import type { Citation, Document, DocumentChunk } from '../shared/types.js';

export function chunkText(text: string, chunkSize: number = 800, overlap: number = 100): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let index = 0;

  while (index < words.length) {
    const chunkWords = words.slice(index, index + chunkSize);
    chunks.push(chunkWords.join(' '));
    index += chunkSize - overlap;
  }

  return chunks.length > 0 ? chunks : [text];
}

export function searchKnowledgeBase(userId: string, query: string, collectionIds?: string[], limit: number = 4): { context: string; citations: Citation[] } {
  const queryLower = query.toLowerCase();
  const queryKeywords = queryLower.split(/\W+/).filter((w) => w.length > 2);

  const matchedChunks: { chunk: DocumentChunk; doc: Document; score: number }[] = [];

  for (const chunk of db.chunks) {
    const doc = db.documents.get(chunk.document_id);
    if (!doc || doc.status !== 'ready') continue;

    // Filter by collection if specified
    if (collectionIds && collectionIds.length > 0) {
      const inCollection = doc.collection_ids.some((c) => collectionIds.includes(c));
      if (!inCollection) continue;
    }

    // Keyword scoring + semantic word overlap
    const contentLower = chunk.content.toLowerCase();
    let score = 0;

    for (const kw of queryKeywords) {
      if (contentLower.includes(kw)) {
        score += 1.5;
      }
      if (doc.filename.toLowerCase().includes(kw)) {
        score += 2.0;
      }
    }

    // Direct phrase matching bonus
    if (contentLower.includes(queryLower)) {
      score += 4.0;
    }

    if (score > 0) {
      matchedChunks.push({ chunk, doc, score });
    }
  }

  // Sort by score descending
  matchedChunks.sort((a, b) => b.score - a.score);
  const topMatches = matchedChunks.slice(0, limit);

  if (topMatches.length === 0) {
    // If no explicit match, pick the most relevant engineering or spec doc if user asks a general question
    const defaultDocs = Array.from(db.documents.values()).slice(0, 2);
    for (const doc of defaultDocs) {
      const c = db.chunks.find((ch) => ch.document_id === doc.id);
      if (c) {
        topMatches.push({ chunk: c, doc, score: 0.5 });
      }
    }
  }

  const citations: Citation[] = topMatches.map((m) => ({
    document_id: m.doc.id,
    document_name: m.doc.filename,
    chunk_index: m.chunk.chunk_index,
    snippet: m.chunk.content.slice(0, 240) + '...',
    score: Math.min(1.0, Number((m.score / 6).toFixed(2))),
  }));

  const context = topMatches
    .map(
      (m, idx) =>
        `[Passage ${idx + 1} | Source: "${m.doc.filename}", Page: ${m.chunk.page_number || 1}]\n${m.chunk.content}`
    )
    .join('\n\n---\n\n');

  return { context, citations };
}
