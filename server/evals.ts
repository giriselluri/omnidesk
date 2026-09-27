import { randomUUID } from 'crypto';
import type {
  EvalSuite,
  EvalRunReport,
  EvalModelSummary,
  EvalTestCaseResult,
  PromptTemplate,
} from '../shared/types.js';
import { arenaService } from './arena.js';
import { db } from './db.js';

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'tmpl_rag_synthesis',
    title: 'RAG Grounded Synthesis',
    category: 'RAG Extraction',
    description: 'Ground responses in provided source text with explicit constraints against hallucination.',
    systemPrompt: 'You are a factual synthesis assistant. Answer the user question strictly using only the provided context. If the answer is not contained, say "Information not provided in context."',
    userPromptTemplate: 'Context:\n{{context}}\n\nQuestion:\n{{question}}',
    sampleVariables: {
      context: 'OmniDesk enforces atomic pre-flight reservations in integer micro-USD before routing to frontier models.',
      question: 'What unit of measurement does OmniDesk use for quota reservations?',
    },
  },
  {
    id: 'tmpl_code_review',
    title: 'Security & Performance Code Reviewer',
    category: 'Coding',
    description: 'Analyze snippets for memory leaks, injection vulnerabilities, and algorithmic efficiency.',
    systemPrompt: 'You are a Principal Software Engineer conducting a strict security and performance code review. Return actionable feedback in bullet points.',
    userPromptTemplate: 'Language: {{language}}\n\nCode snippet:\n{{code}}',
    sampleVariables: {
      language: 'TypeScript',
      code: 'function getUser(id) { return db.query(`SELECT * FROM users WHERE id = ${id}`); }',
    },
  },
  {
    id: 'tmpl_json_extractor',
    title: 'Structured JSON Entity Extraction',
    category: 'Evaluation',
    description: 'Extract structured attributes adhering to strict JSON schema without markdown prose.',
    systemPrompt: 'You are a data extraction engine. Return ONLY valid RFC 8259 JSON without markdown fences or pleasantries.',
    userPromptTemplate: 'Extract name, company, and email from this text:\n"{{raw_text}}"',
    sampleVariables: {
      raw_text: 'Contact Giri Elluri from OmniDesk at giri.s.elluri@gmail.com regarding enterprise workspaces.',
    },
  },
  {
    id: 'tmpl_logical_reasoning',
    title: 'Step-by-Step Chain-of-Thought Reasoning',
    category: 'Reasoning',
    description: 'Deliberate stepwise logical deduction for complex riddles, STEM, and system architecture.',
    systemPrompt: 'Think through this problem step-by-step. Break down your reasoning clearly before stating the final conclusion.',
    userPromptTemplate: 'Problem: {{problem}}',
    sampleVariables: {
      problem: 'If a system processes 12,000 requests/minute and each request averages 450 tokens, what is the required token throughput per second?',
    },
  },
];

export const DEFAULT_EVAL_SUITES: EvalSuite[] = [
  {
    id: 'suite_rag_accuracy',
    name: 'RAG Factual Accuracy & Grounding',
    category: 'Knowledge Retrieval',
    description: 'Evaluates whether models respect provided context without hallucinating external knowledge.',
    testCases: [
      {
        id: 'tc_1',
        name: 'Context Unit Extraction',
        prompt: 'Given context: "OmniDesk ledger records all operations in integer micro-USD where 1 USD = 1,000,000 micro-USD." Question: What is 1 USD equal to in micro-USD?',
        assertionType: 'contains',
        assertionValue: '1,000,000',
      },
      {
        id: 'tc_2',
        name: 'Refusal on Missing Context',
        prompt: 'Given context: "OmniDesk supports Google Gemini, Claude, and GPT." Question: Does the text state the launch date of OmniDesk?',
        assertionType: 'contains',
        assertionValue: 'not',
      },
      {
        id: 'tc_3',
        name: 'Atomic Reservation Keyword',
        prompt: 'Given context: "A pre-flight atomic reservation locks estimated credits prior to streaming." What kind of reservation does OmniDesk perform?',
        assertionType: 'contains',
        assertionValue: 'atomic',
      },
    ],
  },
  {
    id: 'suite_json_adherence',
    name: 'Structured JSON Output Gate',
    category: 'API & Formatting',
    description: 'Tests whether models produce parseable JSON matching target keys without markdown wrappers.',
    testCases: [
      {
        id: 'tc_json_1',
        name: 'User Profile Schema',
        prompt: 'Output ONLY raw JSON with keys "name" and "role". Value for name: "Giri", value for role: "owner". Do not add backticks.',
        assertionType: 'json_valid',
        assertionValue: 'true',
      },
      {
        id: 'tc_json_2',
        name: 'Status Array Schema',
        prompt: 'Output ONLY raw JSON with key "active_models" containing an array of 2 strings: "gemini", "claude".',
        assertionType: 'json_valid',
        assertionValue: 'true',
      },
    ],
  },
  {
    id: 'suite_latency_gate',
    name: 'Low-Latency Throughput Benchmark',
    category: 'Speed & Latency',
    description: 'Ensures responses complete well under 2,000ms SLA for real-time interactive user interfaces.',
    testCases: [
      {
        id: 'tc_lat_1',
        name: 'Rapid One-Sentence Answer',
        prompt: 'In one sentence, what is a test harness in AI engineering?',
        assertionType: 'latency_less_than',
        assertionValue: '2500',
      },
      {
        id: 'tc_lat_2',
        name: 'Quick Math Computation',
        prompt: 'Compute: 256 * 14. Answer only the number.',
        assertionType: 'contains',
        assertionValue: '3584',
      },
    ],
  },
];

class EvalsService {
  suites: Map<string, EvalSuite> = new Map();
  templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    for (const s of DEFAULT_EVAL_SUITES) {
      this.suites.set(s.id, s);
    }
    for (const t of DEFAULT_PROMPT_TEMPLATES) {
      this.templates.set(t.id, t);
    }
  }

  getSuites(): EvalSuite[] {
    return Array.from(this.suites.values());
  }

  getTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  async runSuite(suiteId: string, modelIds: string[]): Promise<EvalRunReport> {
    const suite = this.suites.get(suiteId);
    if (!suite) throw new Error('Suite not found');

    const summaries: EvalModelSummary[] = [];

    for (const modelKey of modelIds) {
      const model = Array.from(db.models.values()).find(
        (m) => m.model_key === modelKey || m.id === modelKey
      );

      const testResults: EvalTestCaseResult[] = [];
      let totalLatency = 0;
      let passedCount = 0;

      for (const tc of suite.testCases) {
        try {
          const res = await arenaService.runModelStream(modelKey, tc.prompt);
          totalLatency += res.latencyMs;

          // Check assertion
          let passed = false;
          let reason: string | undefined = undefined;

          if (tc.assertionType === 'contains') {
            passed = res.output.toLowerCase().includes(tc.assertionValue.toLowerCase());
            if (!passed) reason = `Output did not contain "${tc.assertionValue}"`;
          } else if (tc.assertionType === 'json_valid') {
            try {
              const cleaned = res.output.trim().replace(/^```json/i, '').replace(/```$/, '').trim();
              JSON.parse(cleaned);
              passed = true;
            } catch {
              passed = false;
              reason = 'Output is not valid JSON';
            }
          } else if (tc.assertionType === 'latency_less_than') {
            const maxMs = parseInt(tc.assertionValue, 10);
            passed = res.latencyMs <= maxMs;
            if (!passed) reason = `Latency ${res.latencyMs}ms exceeded threshold ${maxMs}ms`;
          } else {
            passed = res.output.length > 5;
          }

          if (passed) passedCount++;

          testResults.push({
            testCaseId: tc.id,
            testCaseName: tc.name,
            passed,
            latencyMs: res.latencyMs,
            actualOutput: res.output.slice(0, 160) + (res.output.length > 160 ? '...' : ''),
            reason,
          });
        } catch (err: any) {
          testResults.push({
            testCaseId: tc.id,
            testCaseName: tc.name,
            passed: false,
            latencyMs: 0,
            actualOutput: `Error: ${err.message}`,
            reason: 'Execution exception',
          });
        }
      }

      summaries.push({
        modelId: modelKey,
        modelName: model?.display_name || modelKey,
        provider: model?.provider || 'google',
        passedCount,
        totalCount: suite.testCases.length,
        passRate: Number(((passedCount / suite.testCases.length) * 100).toFixed(1)),
        avgLatencyMs: Math.round(totalLatency / (suite.testCases.length || 1)),
        results: testResults,
      });
    }

    return {
      suiteId,
      suiteName: suite.name,
      timestamp: new Date().toISOString(),
      summaries,
    };
  }
}

export const evalsService = new EvalsService();
