export type Role = 'owner' | 'member';

export type UserStatus = 'invited' | 'active' | 'disabled';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  status: UserStatus;
  avatar_url?: string;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  token_hash: string;
  invite_code: string;
  expires_at: string;
  accepted_at?: string;
  created_by: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
}

export type ProviderId = 'google' | 'openai' | 'anthropic' | 'xai';

export interface ModelCapabilities {
  vision: boolean;
  web_search: boolean;
  reasoning: boolean;
  streaming: boolean;
  tools: boolean;
}

export interface ModelInfo {
  id: string;
  provider: ProviderId;
  model_key: string;
  display_name: string;
  description: string;
  enabled: boolean;
  context_limit: number;
  max_output_tokens: number;
  input_price_per_million: number; // in micro-USD (e.g. 150000 = $0.15)
  output_price_per_million: number; // in micro-USD (e.g. 600000 = $0.60)
  capabilities: ModelCapabilities;
  badge?: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  archived: boolean;
  pinned?: boolean;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_model?: string;
}

export interface Citation {
  document_id: string;
  document_name: string;
  chunk_index: number;
  snippet: string;
  score: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: ProviderId;
  model_key?: string;
  model_name?: string;
  status: 'pending' | 'streaming' | 'completed' | 'failed';
  input_tokens?: number;
  output_tokens?: number;
  cost_micro_usd?: number;
  citations?: Citation[];
  search_results?: SearchResult[];
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  status: 'uploaded' | 'processing' | 'ready' | 'failed';
  chunk_count: number;
  collection_ids: string[];
  created_at: string;
  summary?: string;
}

export interface DocumentCollection {
  id: string;
  user_id: string;
  name: string;
  description: string;
  color?: string;
  document_count: number;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  user_id: string;
  chunk_index: number;
  content: string;
  page_number?: number;
  metadata?: Record<string, any>;
}

export interface EmailMessage {
  id: string;
  from: string;
  from_name: string;
  to: string;
  date: string;
  body: string;
}

export interface EmailThread {
  id: string;
  snippet: string;
  subject: string;
  from: string;
  from_name: string;
  date: string;
  unread: boolean;
  messages: EmailMessage[];
  ai_summary?: string;
  action_items?: string[];
}

export interface EmailDraft {
  id: string;
  user_id: string;
  thread_id?: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'draft' | 'approved' | 'sent' | 'discarded';
  created_at: string;
  updated_at?: string;
  sent_at?: string;
}

export interface QuotaPolicy {
  id: string;
  user_id: string | null; // null = default member policy
  provider?: ProviderId;
  limit_micro_usd: number;
  max_request_micro_usd: number;
  max_concurrent: number;
  effective_from: string;
  enabled: boolean;
}

export interface BudgetConfig {
  group_monthly_budget_micro_usd: number;
  member_monthly_allowance_micro_usd: number;
  max_request_micro_usd: number;
  max_concurrent_requests: number;
  enforce_strict_budget: boolean;
}

export interface UsageSummary {
  user_id: string;
  current_month_micro_usd: number;
  limit_micro_usd: number;
  remaining_micro_usd: number;
  group_monthly_budget_micro_usd: number;
  group_current_month_micro_usd: number;
  total_tokens: number;
  request_count: number;
  provider_breakdown: Record<ProviderId, { micro_usd: number; tokens: number; requests: number }>;
}

export interface UsageEvent {
  id: string;
  request_id: string;
  user_id: string;
  user_email?: string;
  provider: ProviderId;
  model_key: string;
  input_tokens: number;
  output_tokens: number;
  actual_micro_usd: number;
  status: 'estimated' | 'reconciled' | 'failed';
  created_at: string;
}

export interface ProviderCredential {
  id: string;
  provider: ProviderId;
  label: string;
  status: 'active' | 'disabled' | 'unconfigured';
  masked_key: string;
  has_key: boolean;
  last_tested?: string;
  created_at: string;
  rotated_at?: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, any>;
  ip_hash: string;
  created_at: string;
}

// Harness Arena & Comparison Types
export interface ArenaResultItem {
  modelId: string;
  modelName: string;
  provider: ProviderId;
  output: string;
  latencyMs: number;
  tokens: number;
  status: 'pending' | 'streaming' | 'completed' | 'error';
  error?: string;
}

export interface ArenaComparison {
  id: string;
  prompt: string;
  systemPrompt?: string;
  isBlind: boolean;
  modelIds: string[];
  results: Record<string, ArenaResultItem>;
  votedWinnerModelId?: string;
  created_at: string;
}

export interface LeaderboardEntry {
  modelId: string;
  modelName: string;
  provider: ProviderId;
  eloRating: number;
  winRate: number;
  wins: number;
  matches: number;
  avgLatencyMs: number;
  speedRank: number;
}

export interface EvalTestCase {
  id: string;
  name: string;
  prompt: string;
  assertionType: 'contains' | 'json_valid' | 'latency_less_than' | 'regex' | 'length_greater_than';
  assertionValue: string;
}

export interface EvalSuite {
  id: string;
  name: string;
  category: string;
  description: string;
  testCases: EvalTestCase[];
}

export interface EvalTestCaseResult {
  testCaseId: string;
  testCaseName: string;
  passed: boolean;
  latencyMs: number;
  actualOutput: string;
  reason?: string;
}

export interface EvalModelSummary {
  modelId: string;
  modelName: string;
  provider: ProviderId;
  passedCount: number;
  totalCount: number;
  passRate: number;
  avgLatencyMs: number;
  results: EvalTestCaseResult[];
}

export interface EvalRunReport {
  suiteId: string;
  suiteName: string;
  timestamp: string;
  summaries: EvalModelSummary[];
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  category: 'Coding' | 'Reasoning' | 'RAG Extraction' | 'Evaluation' | 'General';
  systemPrompt: string;
  userPromptTemplate: string;
  sampleVariables: Record<string, string>;
}

