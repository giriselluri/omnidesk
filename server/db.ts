import { randomUUID } from 'crypto';
import type {
  User,
  Role,
  Invitation,
  ProviderId,
  ModelInfo,
  Conversation,
  ChatMessage,
  Document,
  DocumentCollection,
  DocumentChunk,
  EmailThread,
  EmailDraft,
  QuotaPolicy,
  BudgetConfig,
  UsageEvent,
  ProviderCredential,
  AuditLog,
} from '../shared/types.js';

// Model Registry with Free Edition allowances and token weights
export const DEFAULT_MODELS: ModelInfo[] = [
  {
    id: 'google-gemini-3.8-flash',
    provider: 'google',
    model_key: 'gemini-3.8-flash',
    display_name: 'Gemini 3.8 Flash',
    description: 'Fast, high-throughput multimodal intelligence (100% Free tier included)',
    enabled: true,
    context_limit: 1048576,
    max_output_tokens: 8192,
    input_price_per_million: 150000,
    output_price_per_million: 600000,
    capabilities: { vision: true, web_search: true, reasoning: true, streaming: true, tools: true },
    badge: 'Free Tier · Fast',
  },
  {
    id: 'google-gemini-flash-lite',
    provider: 'google',
    model_key: 'gemini-3.1-flash-lite',
    display_name: 'Gemini 3.1 Flash Lite',
    description: 'Ultra-lightweight, zero-cost rapid intelligence for instant queries',
    enabled: true,
    context_limit: 1048576,
    max_output_tokens: 8192,
    input_price_per_million: 75000,
    output_price_per_million: 300000,
    capabilities: { vision: true, web_search: true, reasoning: false, streaming: true, tools: true },
    badge: 'Free Tier · Lite',
  },
  {
    id: 'openai-gpt-4o-mini',
    provider: 'openai',
    model_key: 'gpt-4o-mini',
    display_name: 'GPT-4o mini',
    description: 'Efficient, fast lightweight model for low-latency tasks',
    enabled: true,
    context_limit: 128000,
    max_output_tokens: 4096,
    input_price_per_million: 150000,
    output_price_per_million: 600000,
    capabilities: { vision: true, web_search: true, reasoning: false, streaming: true, tools: true },
    badge: 'Free Allowance',
  },
  {
    id: 'openai-gpt-4o',
    provider: 'openai',
    model_key: 'gpt-4o',
    display_name: 'GPT-4o (Omni)',
    description: 'Versatile multimodal model from OpenAI with unified history',
    enabled: true,
    context_limit: 128000,
    max_output_tokens: 4096,
    input_price_per_million: 2500000,
    output_price_per_million: 10000000,
    capabilities: { vision: true, web_search: true, reasoning: false, streaming: true, tools: true },
    badge: 'Free Allowance',
  },
  {
    id: 'anthropic-claude-3-5-haiku',
    provider: 'anthropic',
    model_key: 'claude-3-5-haiku',
    display_name: 'Claude 3.5 Haiku',
    description: 'Ultra-fast Claude model for quick interactions and extraction',
    enabled: true,
    context_limit: 200000,
    max_output_tokens: 4096,
    input_price_per_million: 800000,
    output_price_per_million: 4000000,
    capabilities: { vision: true, web_search: true, reasoning: false, streaming: true, tools: true },
    badge: 'Free Allowance',
  },
  {
    id: 'anthropic-claude-3-7-sonnet',
    provider: 'anthropic',
    model_key: 'claude-3-7-sonnet',
    display_name: 'Claude 3.7 Sonnet',
    description: 'Hybrid reasoning and nuanced execution with extended thinking',
    enabled: true,
    context_limit: 200000,
    max_output_tokens: 8192,
    input_price_per_million: 3000000,
    output_price_per_million: 15000000,
    capabilities: { vision: true, web_search: true, reasoning: true, streaming: true, tools: true },
    badge: 'Free Allowance',
  },
  {
    id: 'xai-grok-2',
    provider: 'xai',
    model_key: 'grok-2-1212',
    display_name: 'Grok 2',
    description: 'Frontier model by xAI with real-time understanding',
    enabled: true,
    context_limit: 131072,
    max_output_tokens: 4096,
    input_price_per_million: 2000000,
    output_price_per_million: 10000000,
    capabilities: { vision: true, web_search: true, reasoning: false, streaming: true, tools: true },
    badge: 'Free Allowance',
  },
];

class Database {
  users: Map<string, User> = new Map();
  invitations: Map<string, Invitation> = new Map();
  models: Map<string, ModelInfo> = new Map();
  credentials: Map<ProviderId, { encryptedSecret: string; maskedKey: string; status: 'active' | 'disabled' | 'unconfigured'; lastTested?: string }> = new Map();
  budgetConfig: BudgetConfig = {
    group_monthly_budget_micro_usd: 50_000_000, // $50.00 USD
    member_monthly_allowance_micro_usd: 10_000_000, // $10.00 USD
    max_request_micro_usd: 500_000, // $0.50 USD
    max_concurrent_requests: 2,
    enforce_strict_budget: true,
  };
  userQuotaOverrides: Map<string, number> = new Map(); // userId -> micro_usd
  reservations: Map<string, { id: string; userId: string; provider: ProviderId; modelKey: string; reservedMicroUsd: number; status: 'active' | 'settled' | 'released'; expiresAt: number; createdAt: number }> = new Map();
  usageEvents: UsageEvent[] = [];
  conversations: Map<string, Conversation> = new Map();
  messages: Map<string, ChatMessage[]> = new Map(); // conversation_id -> messages
  documents: Map<string, Document> = new Map();
  collections: Map<string, DocumentCollection> = new Map();
  chunks: DocumentChunk[] = [];
  emailThreads: Map<string, EmailThread> = new Map();
  emailDrafts: Map<string, EmailDraft> = new Map();
  auditLogs: AuditLog[] = [];
  activeRequestsByUser: Map<string, number> = new Map();

  constructor() {
    this.seed();
  }

  private seed() {
    // 1. Models
    for (const m of DEFAULT_MODELS) {
      this.models.set(m.id, { ...m });
    }

    // 2. Default Owner & Members
    const owner: User = {
      id: 'usr_owner_giri',
      email: 'giri.s.elluri@gmail.com',
      display_name: 'Giri Elluri',
      role: 'owner',
      status: 'active',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    };
    this.users.set(owner.id, owner);

    const member1: User = {
      id: 'usr_member_alex',
      email: 'alex.rivera@example.com',
      display_name: 'Alex Rivera',
      role: 'member',
      status: 'active',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
      created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    };
    this.users.set(member1.id, member1);

    const member2: User = {
      id: 'usr_member_sarah',
      email: 'sarah.chen@example.com',
      display_name: 'Sarah Chen',
      role: 'member',
      status: 'active',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    };
    this.users.set(member2.id, member2);

    // 3. Provider Credentials Setup
    const geminiKey = process.env.GEMINI_API_KEY || '';
    this.credentials.set('google', {
      encryptedSecret: geminiKey ? `enc_${Buffer.from(geminiKey).toString('base64')}` : '',
      maskedKey: geminiKey ? `AIzaSy...${geminiKey.slice(-4)}` : 'AIzaSy...env',
      status: 'active',
      lastTested: new Date().toISOString(),
    });

    this.credentials.set('openai', {
      encryptedSecret: '',
      maskedKey: 'sk-proj-...89a2 (Ready to configure)',
      status: 'unconfigured',
    });

    this.credentials.set('anthropic', {
      encryptedSecret: '',
      maskedKey: 'sk-ant-...44fe (Ready to configure)',
      status: 'unconfigured',
    });

    this.credentials.set('xai', {
      encryptedSecret: '',
      maskedKey: 'xai-...12c9 (Ready to configure)',
      status: 'unconfigured',
    });

    // 4. Initial Invitations
    const invite1: Invitation = {
      id: 'inv_' + randomUUID().slice(0, 8),
      email: 'marcus.vance@example.com',
      role: 'member',
      token_hash: 'hash_marcus_vance',
      invite_code: 'INV-MARCUS-7821',
      expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
      created_by: owner.id,
      created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
      status: 'pending',
    };
    this.invitations.set(invite1.id, invite1);

    // 5. Seed Knowledge Base Collections & Documents
    const colEngineering: DocumentCollection = {
      id: 'col_engineering',
      user_id: owner.id,
      name: 'Engineering & Architecture',
      description: 'System specifications, micro-USD quota ledger design, and RAG pipelines',
      color: 'blue',
      document_count: 2,
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    };
    const colProduct: DocumentCollection = {
      id: 'col_product',
      user_id: owner.id,
      name: 'Product & Security Policies',
      description: 'Access control matrices, multi-tenant isolation, and budget ceilings',
      color: 'emerald',
      document_count: 1,
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    };
    this.collections.set(colEngineering.id, colEngineering);
    this.collections.set(colProduct.id, colProduct);

    const doc1: Document = {
      id: 'doc_omnidesk_spec',
      user_id: owner.id,
      filename: 'OmniDesk_System_Architecture_v1.0.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 428000,
      status: 'ready',
      chunk_count: 4,
      collection_ids: ['col_engineering'],
      created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
      summary: 'Architectural specification outlining atomic quota reservations, multi-provider model routing (OpenAI, Anthropic, Gemini, xAI), and zero-leak credential vault.',
    };

    const doc2: Document = {
      id: 'doc_rag_benchmark',
      user_id: owner.id,
      filename: 'RAG_Pipeline_Retrieval_Benchmarks.docx',
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      file_size_bytes: 284000,
      status: 'ready',
      chunk_count: 3,
      collection_ids: ['col_engineering'],
      created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
      summary: 'Empirical chunking and vector retrieval evaluation. 800-token chunks with 120-token overlap yielded 94.2% citation precision across technical manuals.',
    };

    const doc3: Document = {
      id: 'doc_security_compliance',
      user_id: owner.id,
      filename: 'Enterprise_AI_Security_And_Budget_Ceilings.md',
      mime_type: 'text/markdown',
      file_size_bytes: 92000,
      status: 'ready',
      chunk_count: 2,
      collection_ids: ['col_product'],
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      summary: 'Policy mandates: unauthenticated calls to paid provider endpoints are rejected at the edge. Monthly member ceilings default to $10.00 with group ceiling at $50.00.',
    };

    this.documents.set(doc1.id, doc1);
    this.documents.set(doc2.id, doc2);
    this.documents.set(doc3.id, doc3);

    // Chunks for RAG retrieval
    this.chunks.push(
      {
        id: 'chk_1',
        document_id: doc1.id,
        user_id: owner.id,
        chunk_index: 0,
        page_number: 1,
        content: `OmniDesk is a private multi-user AI workspace engineered for high-security multi-model collaboration. Key architectural pillars include:
1. Multi-Provider Router: Seamlessly switch models between Google Gemini 3.8 Flash, Gemini 3.1 Pro, OpenAI GPT-4o, Anthropic Claude 3.7 Sonnet, and xAI Grok within the exact same conversation thread while preserving full history context.
2. Shared Credential Vault: Owner securely stores API keys with AES-256 envelope encryption. Members never see or export secrets.
3. Atomic Quota Engine: Before any provider API call, a transaction reserves estimated cost in micro-USD against user monthly allowance ($10) and group budget ($50).`,
      },
      {
        id: 'chk_2',
        document_id: doc1.id,
        user_id: owner.id,
        chunk_index: 1,
        page_number: 2,
        content: `Reservation and Settlement Workflow in OmniDesk:
Step 1: Authenticate caller and estimate worst-case cost based on prompt token count + max output tokens limit using versioned pricing tables.
Step 2: Atomically reserve micro-USD in an in-memory lock / PostgreSQL transaction. If user exceeds $10 monthly allowance or group exceeds $50 budget, reject with HTTP 402/429.
Step 3: Call model provider stream.
Step 4: On stream completion, record exact token counts, calculate actual micro-USD, record append-only ledger event, and release unspent reservation.`,
      },
      {
        id: 'chk_3',
        document_id: doc2.id,
        user_id: owner.id,
        chunk_index: 0,
        page_number: 1,
        content: `RAG Retrieval Engineering in OmniDesk:
Documents are chunked into 700 to 1,000 tokens with 100-150 token sliding overlap. Text chunks are indexed for both dense vector similarity and BM25-style lexical keyword matching.
When a user prompt references documents or a collection, the retrieval engine scores chunks, selects the top 5 most relevant passages, and injects them as structured reference context.
Every response that utilizes retrieved passages renders interactive citation cards with document name, page number, and matched excerpt.`,
      },
      {
        id: 'chk_4',
        document_id: doc3.id,
        user_id: owner.id,
        chunk_index: 0,
        page_number: 1,
        content: `Security and Email Governance:
OmniDesk integrates with personal Gmail accounts via Google OAuth. To protect users from accidental or hallucinated email dispatch:
1. Untrusted emails and external docs are marked non-executable.
2. Draft generation: The assistant drafts summaries and replies as editable draft entities.
3. Explicit Approval Protocol: No automated or autonomous email sending is ever permitted. Sending requires an explicit user click on 'Approve & Send' with verified sender, recipient, subject, and body check.`,
      }
    );

    // 6. Pre-seeded Gmail Threads
    const thread1: EmailThread = {
      id: 'th_enterprise_review',
      subject: 'Quarterly AI Infrastructure Review & Model Budgets',
      snippet: 'Hi Giri, can we review the provider budget allocations for Q3? The engineering team is looking to expand Claude and Gemini usage...',
      from: 'elena.rostova@acmeventures.io',
      from_name: 'Elena Rostova',
      date: new Date(Date.now() - 2 * 3600000).toISOString(),
      unread: true,
      messages: [
        {
          id: 'msg_1',
          from: 'elena.rostova@acmeventures.io',
          from_name: 'Elena Rostova',
          to: 'giri.s.elluri@gmail.com',
          date: new Date(Date.now() - 2 * 3600000).toISOString(),
          body: `Hi Giri,\n\nI hope your week is off to a great start. I wanted to touch base regarding our team's AI workspace setup.\n\nOur researchers have been heavily utilizing Gemini 3.8 Flash and Claude 3.7 Sonnet for document synthesis. Currently, our per-member allowance is capped at $10.00/mo, and two senior engineers are nearing 85% of their cap.\n\nCould we increase the member allowance to $25.00/mo and raise the shared group ceiling from $50 to $150? Also, let me know if we can schedule a quick 15-minute sync on Thursday.\n\nBest,\nElena`,
        },
      ],
      ai_summary: 'Elena requests raising per-member AI allowance from $10 to $25/mo and group ceiling from $50 to $150 due to heavy research usage. Asks for a 15-minute sync this Thursday.',
      action_items: [
        'Review current group budget in Admin Settings',
        'Decide on raising member allowance to $25/mo',
        'Confirm or propose a time for 15-minute sync on Thursday',
      ],
    };

    const thread2: EmailThread = {
      id: 'th_vendor_pricing',
      subject: 'Anthropic & OpenAI API Rate Limit Tier Upgrade Approved',
      snippet: 'Congratulations! Your organization account has been promoted to Tier 3 throughput for Claude and GPT-4o APIs...',
      from: 'support@anthropic.com',
      from_name: 'Anthropic Cloud Operations',
      date: new Date(Date.now() - 26 * 3600000).toISOString(),
      unread: false,
      messages: [
        {
          id: 'msg_2',
          from: 'support@anthropic.com',
          from_name: 'Anthropic Cloud Operations',
          to: 'giri.s.elluri@gmail.com',
          date: new Date(Date.now() - 26 * 3600000).toISOString(),
          body: `Hello Giri,\n\nYour request for upgraded concurrency and token-per-minute (TPM) limits on your shared organization API key has been approved.\n\nTier: Scale Production Tier 3\nConcurrency: 50 requests/sec\nMax Input Tokens/Min: 2,000,000 TPM\n\nYour credentials remain unchanged and ready for deployment.\n\nRegards,\nAnthropic Developer Relations`,
        },
      ],
      ai_summary: 'Anthropic confirmed Tier 3 rate limit upgrade with 2,000,000 TPM and 50 concurrent requests/sec. API keys remain unchanged.',
      action_items: ['Verify high-concurrency requests in OmniDesk production testing'],
    };

    this.emailThreads.set(thread1.id, thread1);
    this.emailThreads.set(thread2.id, thread2);

    // 7. Seed Sample Conversations
    const conv1: Conversation = {
      id: 'conv_getting_started',
      user_id: owner.id,
      title: 'OmniDesk Multi-Model Overview',
      archived: false,
      pinned: true,
      created_at: new Date(Date.now() - 12 * 3600000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 3600000).toISOString(),
      message_count: 2,
      last_model: 'Gemini 3.8 Flash',
    };
    this.conversations.set(conv1.id, conv1);

    this.messages.set(conv1.id, [
      {
        id: 'msg_seed_1',
        conversation_id: conv1.id,
        user_id: owner.id,
        role: 'user',
        content: 'Explain how OmniDesk enforces shared API key security and atomic quota reservations.',
        status: 'completed',
        created_at: new Date(Date.now() - 12 * 3600000).toISOString(),
      },
      {
        id: 'msg_seed_2',
        conversation_id: conv1.id,
        user_id: owner.id,
        role: 'assistant',
        provider: 'google',
        model_key: 'gemini-3.8-flash',
        model_name: 'Gemini 3.8 Flash',
        content: `**OmniDesk** is a 100% Free Multi-Model AI Workspace with zero paid tiers or subscriptions:

### 1. 100% Free Workspace Architecture
- **Free Multi-Model Access**: Switch freely between Google Gemini (Gemini 3.8 Flash & Gemini 3.1 Flash Lite), Claude, GPT-4o mini, and Grok in this single thread with unified history.
- **Zero Paid Subscriptions**: There are no paid tiers, upgrade screens, paywalls, or credit card requirements. All accounts receive generous free monthly token allowances.

### 2. Fair-Share Credit & Quota Governance
- **Free Monthly AI Allowance**: Every member receives a generous monthly credit allowance (default 10,000,000 micro-credits) reset each calendar month.
- **Fair Multi-User Ceilings**: Shared workspace limits prevent excessive runaway loops while keeping the environment completely free for everyone.
- **Client Privacy**: Zero leak of credentials or personal document data.`,
        status: 'completed',
        input_tokens: 34,
        output_tokens: 280,
        cost_micro_usd: 173,
        created_at: new Date(Date.now() - 12 * 3600000 + 2000).toISOString(),
      },
    ]);

    // 8. Initial Usage Events
    this.usageEvents.push({
      id: 'use_' + randomUUID().slice(0, 8),
      request_id: randomUUID(),
      user_id: owner.id,
      user_email: owner.email,
      provider: 'google',
      model_key: 'gemini-3.8-flash',
      input_tokens: 34,
      output_tokens: 280,
      actual_micro_usd: 173,
      status: 'reconciled',
      created_at: new Date(Date.now() - 12 * 3600000).toISOString(),
    });

    // 9. Initial Audit Logs
    this.auditLogs.push(
      {
        id: 'aud_1',
        actor_user_id: owner.id,
        actor_email: owner.email,
        action: 'system.bootstrap',
        resource_type: 'workspace',
        resource_id: 'omnidesk-prod',
        metadata: { version: '1.0.0', default_owner: owner.email },
        ip_hash: '127.0.0.1_hash',
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
      {
        id: 'aud_2',
        actor_user_id: owner.id,
        actor_email: owner.email,
        action: 'provider.configured',
        resource_type: 'provider_credentials',
        resource_id: 'google',
        metadata: { provider: 'google', status: 'active' },
        ip_hash: '127.0.0.1_hash',
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      }
    );
  }

  // --- Atomic Quota Reservation & Settlement Methods ---

  reserveQuota(userId: string, provider: ProviderId, modelKey: string, estimatedMicroUsd: number): { success: boolean; reservationId?: string; reason?: string } {
    // 1. Check concurrency limits
    const currentActive = this.activeRequestsByUser.get(userId) || 0;
    if (currentActive >= this.budgetConfig.max_concurrent_requests) {
      return { success: false, reason: `Maximum concurrent requests limit (${this.budgetConfig.max_concurrent_requests}) reached. Please wait for previous stream to finish.` };
    }

    // 2. Check maximum request allowance
    if (estimatedMicroUsd > this.budgetConfig.max_request_micro_usd) {
      return { success: false, reason: `Estimated request cost ($${(estimatedMicroUsd / 1_000_000).toFixed(4)}) exceeds per-request maximum limit ($${(this.budgetConfig.max_request_micro_usd / 1_000_000).toFixed(2)}).` };
    }

    // 3. Calculate current monthly user usage + active reservations
    const userAllowance = this.userQuotaOverrides.get(userId) ?? this.budgetConfig.member_monthly_allowance_micro_usd;
    const userUsage = this.getUserCurrentMonthUsage(userId);
    const userActiveReserved = this.getUserActiveReserved(userId);

    if (userUsage + userActiveReserved + estimatedMicroUsd > userAllowance) {
      const remaining = Math.max(0, userAllowance - userUsage - userActiveReserved);
      return {
        success: false,
        reason: `Free monthly credits reached. Remaining: ${Math.round(remaining / 100).toLocaleString()} of ${Math.round(userAllowance / 100).toLocaleString()} free credits. Resets automatically on the 1st of the month.`,
      };
    }

    // 4. Check group budget
    const groupUsage = this.getGroupCurrentMonthUsage();
    const groupActiveReserved = this.getGroupActiveReserved();

    if (this.budgetConfig.enforce_strict_budget && (groupUsage + groupActiveReserved + estimatedMicroUsd > this.budgetConfig.group_monthly_budget_micro_usd)) {
      return { success: false, reason: 'Workspace free credit pool reached. Resets on the 1st of the month.' };
    }

    // 5. Create reservation
    const reservationId = 'res_' + randomUUID();
    this.reservations.set(reservationId, {
      id: reservationId,
      userId,
      provider,
      modelKey,
      reservedMicroUsd: estimatedMicroUsd,
      status: 'active',
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min expiry
      createdAt: Date.now(),
    });

    this.activeRequestsByUser.set(userId, currentActive + 1);
    return { success: true, reservationId };
  }

  settleQuota(reservationId: string, actualMicroUsd: number, inputTokens: number, outputTokens: number): void {
    const res = this.reservations.get(reservationId);
    if (!res || res.status !== 'active') return;

    res.status = 'settled';

    // Record append-only ledger entry
    const user = this.users.get(res.userId);
    this.usageEvents.push({
      id: 'use_' + randomUUID().slice(0, 8),
      request_id: reservationId,
      user_id: res.userId,
      user_email: user?.email,
      provider: res.provider,
      model_key: res.modelKey,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      actual_micro_usd: actualMicroUsd,
      status: 'reconciled',
      created_at: new Date().toISOString(),
    });

    const active = this.activeRequestsByUser.get(res.userId) || 1;
    this.activeRequestsByUser.set(res.userId, Math.max(0, active - 1));
  }

  releaseQuota(reservationId: string): void {
    const res = this.reservations.get(reservationId);
    if (!res || res.status !== 'active') return;

    res.status = 'released';
    const active = this.activeRequestsByUser.get(res.userId) || 1;
    this.activeRequestsByUser.set(res.userId, Math.max(0, active - 1));
  }

  getUserCurrentMonthUsage(userId: string): number {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();

    return this.usageEvents
      .filter((e) => e.user_id === userId && new Date(e.created_at).getTime() >= startOfMonth)
      .reduce((acc, curr) => acc + curr.actual_micro_usd, 0);
  }

  getUserActiveReserved(userId: string): number {
    let sum = 0;
    for (const res of this.reservations.values()) {
      if (res.userId === userId && res.status === 'active' && res.expiresAt > Date.now()) {
        sum += res.reservedMicroUsd;
      }
    }
    return sum;
  }

  getGroupCurrentMonthUsage(): number {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();

    return this.usageEvents
      .filter((e) => new Date(e.created_at).getTime() >= startOfMonth)
      .reduce((acc, curr) => acc + curr.actual_micro_usd, 0);
  }

  getGroupActiveReserved(): number {
    let sum = 0;
    for (const res of this.reservations.values()) {
      if (res.status === 'active' && res.expiresAt > Date.now()) {
        sum += res.reservedMicroUsd;
      }
    }
    return sum;
  }

  logAudit(actorUserId: string, action: string, resourceType: string, resourceId: string, metadata: Record<string, any> = {}): void {
    const actor = this.users.get(actorUserId);
    this.auditLogs.unshift({
      id: 'aud_' + randomUUID().slice(0, 8),
      actor_user_id: actorUserId,
      actor_email: actor?.email || 'unknown',
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata,
      ip_hash: 'req_ip_sha256',
      created_at: new Date().toISOString(),
    });
  }
}

export const db = new Database();
