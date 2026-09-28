import { db } from '../db.js';
import type { StreamChatRequest, StreamChunk } from './types.js';
import { streamGemini } from './gemini.js';
import { streamOpenAI } from './openai.js';
import { streamXAI } from './xai.js';

export async function* routeChatStream(req: StreamChatRequest): AsyncGenerator<StreamChunk> {
  const provider = req.provider;
  const cred = db.credentials.get(provider);

  // Extract decrypted key if stored (in our db mock, encryptedSecret is base64 encoded with prefix 'enc_')
  let apiKey: string | undefined = undefined;
  if (cred?.encryptedSecret?.startsWith('enc_')) {
    try {
      apiKey = Buffer.from(cred.encryptedSecret.slice(4), 'base64').toString('utf-8');
    } catch {
      apiKey = undefined;
    }
  }

  // Fallback to environment variables if present
  if (!apiKey) {
    if (provider === 'google') apiKey = process.env.GEMINI_API_KEY;
    else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY;
    else if (provider === 'xai') apiKey = process.env.XAI_API_KEY;
  }

  switch (provider) {
    case 'google':
      yield* streamGemini(req);
      break;
    case 'openai':
      yield* streamOpenAI(req, apiKey);
      break;
    case 'xai':
      yield* streamXAI(req, apiKey);
      break;
    default:
      yield {
        type: 'error',
        error: `Unsupported provider: ${provider}`,
      };
  }
}
