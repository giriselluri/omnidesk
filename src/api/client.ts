import type {
  User,
  Conversation,
  ChatMessage,
  ModelInfo,
  Document,
  DocumentCollection,
  EmailThread,
  EmailDraft,
  UsageSummary,
  UsageEvent,
  Invitation,
  AuditLog,
  ProviderId,
} from '../../shared/types.js';

const API_BASE = '/api/v1';

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error((errorData as any).error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth & Roles
  async getMe(): Promise<{ user: User; availableUsers: User[] }> {
    return fetchJSON('/auth/me');
  },
  async switchUser(userId: string): Promise<{ success: boolean; user: User }> {
    return fetchJSON('/auth/switch-user', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },
  async acceptInvite(inviteCode: string, displayName?: string): Promise<{ success: boolean; user: User }> {
    return fetchJSON('/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ inviteCode, displayName }),
    });
  },

  // Models & Providers
  async getModels(): Promise<ModelInfo[]> {
    return fetchJSON('/models');
  },
  async getProviders(): Promise<{ id: ProviderId; name: string; status: string; hasKey: boolean }[]> {
    return fetchJSON('/providers');
  },

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    return fetchJSON('/conversations');
  },
  async createConversation(title?: string): Promise<Conversation> {
    return fetchJSON('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },
  async getConversation(id: string): Promise<{ conversation: Conversation; messages: ChatMessage[] }> {
    return fetchJSON(`/conversations/${id}`);
  },
  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    return fetchJSON(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
  async deleteConversation(id: string): Promise<{ success: boolean }> {
    return fetchJSON(`/conversations/${id}`, {
      method: 'DELETE',
    });
  },

  // Stream Message via SSE
  async streamMessage(
    conversationId: string,
    payload: {
      provider: ProviderId;
      model: string;
      content: string;
      options?: {
        webSearch?: boolean;
        collectionIds?: string[];
        useKnowledgeBase?: boolean;
        maxOutputTokens?: number;
      };
    },
    callbacks: {
      onStart?: (data: any) => void;
      onDelta?: (delta: string) => void;
      onUsage?: (data: any) => void;
      onDone?: (message: ChatMessage) => void;
      onError?: (err: string) => void;
    }
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = (errJson as any).error || `Stream failed with status ${res.status}`;
      callbacks.onError?.(msg);
      throw new Error(msg);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No readable stream available');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          try {
            const data = JSON.parse(dataStr);
            if (currentEvent === 'message_start') {
              callbacks.onStart?.(data);
            } else if (currentEvent === 'text_delta') {
              callbacks.onDelta?.(data.delta);
            } else if (currentEvent === 'usage') {
              callbacks.onUsage?.(data);
            } else if (currentEvent === 'message_done') {
              callbacks.onDone?.(data.message);
            } else if (currentEvent === 'error') {
              callbacks.onError?.(data.error);
            }
          } catch {
            // ignore malformed JSON chunk
          }
        }
      }
    }
  },

  // Knowledge Base Documents & Collections
  async getDocuments(): Promise<Document[]> {
    return fetchJSON('/documents');
  },
  async uploadDocument(data: { filename: string; content: string; mime_type?: string; collection_ids?: string[] }): Promise<Document> {
    return fetchJSON('/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async deleteDocument(id: string): Promise<{ success: boolean }> {
    return fetchJSON(`/documents/${id}`, {
      method: 'DELETE',
    });
  },
  async getCollections(): Promise<DocumentCollection[]> {
    return fetchJSON('/documents/collections');
  },
  async createCollection(data: { name: string; description?: string; color?: string }): Promise<DocumentCollection> {
    return fetchJSON('/documents/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async deleteCollection(id: string): Promise<{ success: boolean }> {
    return fetchJSON(`/documents/collections/${id}`, {
      method: 'DELETE',
    });
  },

  // Gmail Assistant
  async getGmailThreads(query?: string): Promise<EmailThread[]> {
    return fetchJSON(`/gmail/threads${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  },
  async getGmailThread(id: string): Promise<EmailThread> {
    return fetchJSON(`/gmail/threads/${id}`);
  },
  async summarizeThread(id: string): Promise<{ summary: string }> {
    return fetchJSON(`/gmail/threads/${id}/summarize`, { method: 'POST' });
  },
  async draftReply(id: string, instructions?: string): Promise<EmailDraft> {
    return fetchJSON(`/gmail/threads/${id}/draft-reply`, {
      method: 'POST',
      body: JSON.stringify({ instructions }),
    });
  },
  async getDrafts(): Promise<EmailDraft[]> {
    return fetchJSON('/gmail/drafts');
  },
  async updateDraft(id: string, updates: Partial<EmailDraft>): Promise<EmailDraft> {
    return fetchJSON(`/gmail/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
  async sendDraft(id: string): Promise<{ success: boolean; draft: EmailDraft }> {
    return fetchJSON(`/gmail/drafts/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ confirmed: true }),
    });
  },
  async discardDraft(id: string): Promise<{ success: boolean }> {
    return fetchJSON(`/gmail/drafts/${id}`, {
      method: 'DELETE',
    });
  },

  // Usage & Quotas
  async getUsage(): Promise<UsageSummary> {
    return fetchJSON('/usage/me');
  },
  async getUsageHistory(): Promise<UsageEvent[]> {
    return fetchJSON('/usage/me/history');
  },

  // Admin APIs (Owner only)
  async getAdminInvitations(): Promise<Invitation[]> {
    return fetchJSON('/admin/invitations');
  },
  async createInvitation(email: string, role: string): Promise<Invitation> {
    return fetchJSON('/admin/invitations', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  },
  async revokeInvitation(id: string): Promise<{ success: boolean }> {
    return fetchJSON(`/admin/invitations/${id}`, {
      method: 'DELETE',
    });
  },
  async getAdminUsers(): Promise<User[]> {
    return fetchJSON('/admin/users');
  },
  async updateAdminUser(id: string, data: { status?: string; role?: string }): Promise<User> {
    return fetchJSON(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  async getAdminBudgets(): Promise<{ config: any; groupCurrentMonthMicroUsd: number; groupActiveReservedMicroUsd: number }> {
    return fetchJSON('/admin/budgets');
  },
  async updateAdminBudgets(data: any): Promise<any> {
    return fetchJSON('/admin/budgets', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async getAdminQuotas(): Promise<any[]> {
    return fetchJSON('/admin/quotas');
  },
  async updateAdminQuota(userId: string, allowanceMicroUsd: number | null): Promise<any> {
    return fetchJSON(`/admin/quotas/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ allowanceMicroUsd }),
    });
  },
  async getAdminProviders(): Promise<any[]> {
    return fetchJSON('/admin/providers');
  },
  async saveProviderCredential(provider: ProviderId, apiKey: string): Promise<any> {
    return fetchJSON(`/admin/providers/${provider}/credentials`, {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    });
  },
  async testProviderCredential(provider: ProviderId): Promise<{ success: boolean; message: string }> {
    return fetchJSON(`/admin/providers/${provider}/test`, {
      method: 'POST',
    });
  },
  async removeProviderCredential(provider: ProviderId): Promise<any> {
    return fetchJSON(`/admin/providers/${provider}/credentials`, {
      method: 'DELETE',
    });
  },
  async toggleModel(modelId: string, enabled: boolean): Promise<ModelInfo> {
    return fetchJSON(`/admin/models/${modelId}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  },
  async getAdminAuditLogs(): Promise<AuditLog[]> {
    return fetchJSON('/admin/audit-logs');
  },
  async getAdminUsageSummary(): Promise<any> {
    return fetchJSON('/admin/usage/summary');
  },

  // Harness Arena & Model Comparison
  async compareModels(data: {
    prompt: string;
    systemPrompt?: string;
    modelIds: string[];
    isBlind?: boolean;
  }): Promise<any> {
    return fetchJSON('/arena/compare', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async voteArenaWinner(comparisonId: string, winnerModelId: string): Promise<any> {
    return fetchJSON('/arena/vote', {
      method: 'POST',
      body: JSON.stringify({ comparisonId, winnerModelId }),
    });
  },
  async getLeaderboard(): Promise<any[]> {
    return fetchJSON('/arena/leaderboard');
  },

  // Automated Evals & Quality Gates
  async getEvalSuites(): Promise<any[]> {
    return fetchJSON('/evals/suites');
  },
  async runEvalSuite(suiteId: string, modelIds: string[]): Promise<any> {
    return fetchJSON('/evals/run', {
      method: 'POST',
      body: JSON.stringify({ suiteId, modelIds }),
    });
  },

  // Prompt Templates
  async getPromptTemplates(): Promise<any[]> {
    return fetchJSON('/evals/templates');
  },
};
