import { GoogleGenAI } from '@google/genai';
import type { StreamChatRequest, StreamChunk } from './types.js';

export async function* streamGemini(req: StreamChatRequest): AsyncGenerator<StreamChunk> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    yield {
      type: 'error',
      error: 'GEMINI_API_KEY is not set in environment.',
    };
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = req.model || 'gemini-3.8-flash';

  // Build system instruction and contents
  let systemInstruction = `You are OmniDesk AI, a premier multi-model enterprise assistant. Provide high-quality, direct, well-formatted Markdown responses.`;

  if (req.retrievedContext) {
    systemInstruction += `\n\n[RETRIEVED KNOWLEDGE BASE CONTEXT]\n${req.retrievedContext}\n\nGround your answer in this context when relevant and mention document sources.`;
  }

  if (req.webSearchResults && req.webSearchResults.length > 0) {
    systemInstruction += `\n\n[LIVE WEB SEARCH RESULTS]\n` +
      req.webSearchResults.map((s, idx) => `[Source ${idx + 1}] ${s.title} (${s.url})\n${s.snippet}`).join('\n\n') +
      `\n\nSynthesize information from these verified web sources and reference them.`;
  }

  // Map messages to Gemini format
  const contents = req.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  let fullResponseText = '';
  let inputTokens = Math.max(15, Math.ceil(contents.reduce((acc, c) => acc + (c.parts[0]?.text?.length || 0), 0) / 4) + 50);

  try {
    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: req.maxOutputTokens || 4096,
      },
    });

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        fullResponseText += text;
        yield {
          type: 'delta',
          delta: text,
        };
      }
    }

    const outputTokens = Math.max(10, Math.ceil(fullResponseText.length / 4));
    yield {
      type: 'done',
      inputTokens,
      outputTokens,
    };
  } catch (err: any) {
    console.error('Gemini Stream Error:', err);
    yield {
      type: 'error',
      error: err.message || 'Failed to generate response from Gemini API',
    };
  }
}
