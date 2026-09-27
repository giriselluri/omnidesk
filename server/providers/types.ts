import type { ProviderId, Citation, SearchResult } from '../../shared/types.js';

export interface ProviderMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamChatRequest {
  requestId: string;
  userId: string;
  provider: ProviderId;
  model: string;
  messages: ProviderMessage[];
  maxOutputTokens: number;
  retrievedContext?: string;
  citations?: Citation[];
  webSearchResults?: SearchResult[];
}

export interface StreamChunk {
  type: 'delta' | 'done' | 'error';
  delta?: string;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}
