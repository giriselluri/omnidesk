import type { StreamChatRequest, StreamChunk } from './types.js';

export async function* streamAnthropic(req: StreamChatRequest, apiKey?: string): AsyncGenerator<StreamChunk> {
  if (!apiKey) {
    yield {
      type: 'delta',
      delta: `### [Claude ${req.model} Response]\n\n*Note: Shared Anthropic API key is not currently configured in the OmniDesk vault. Below is an simulated output for testing multi-model switching.*\n\n`,
    };

    const simulatedText = `I am responding as **Claude 3.7 Sonnet / Claude 3.5 Haiku**.

In OmniDesk, Anthropic models feature:
1. **Extended Thinking & Nuance**: Claude models excel at synthesis, deep code architecture, and legal/policy document analysis.
2. **Context Window**: 200,000 tokens of context capability.
3. **Enterprise Guardrails**: Your conversation history has been preserved seamlessly when switching from other models.
${req.retrievedContext ? '\n**Retrieved RAG Sources Detected**: Context has been infused into this response.' : ''}

*Workspace owners can activate live Anthropic Claude API calls anytime in **Admin Settings > Shared Provider Credentials**.*`;

    const words = simulatedText.split(' ');
    for (const w of words) {
      yield { type: 'delta', delta: w + ' ' };
      await new Promise((r) => setTimeout(r, 20));
    }

    yield {
      type: 'done',
      inputTokens: 140,
      outputTokens: 210,
    };
    return;
  }

  // Live Anthropic Call
  try {
    const system = req.retrievedContext
      ? `You are Claude in OmniDesk. Ground your answer in this context when appropriate:\n${req.retrievedContext}`
      : 'You are Claude in OmniDesk.';

    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: req.model || 'claude-3-7-sonnet',
        system,
        messages,
        max_tokens: req.maxOutputTokens || 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      yield {
        type: 'error',
        error: (errJson as any)?.error?.message || `Anthropic API returned status ${response.status}`,
      };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response stream from Anthropic' };
      return;
    }

    const decoder = new TextDecoder();
    let totalOutput = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunkStr = decoder.decode(value, { stream: true });
      const lines = chunkStr.split('\n').filter((l) => l.startsWith('data: '));
      for (const line of lines) {
        const dataStr = line.slice(6).trim();
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            totalOutput += parsed.delta.text;
            yield { type: 'delta', delta: parsed.delta.text };
          }
        } catch {
          // ignore
        }
      }
    }

    yield {
      type: 'done',
      inputTokens: Math.max(20, Math.ceil(JSON.stringify(messages).length / 4)),
      outputTokens: Math.max(10, Math.ceil(totalOutput.length / 4)),
    };
  } catch (err: any) {
    yield { type: 'error', error: err.message || 'Anthropic connection error' };
  }
}
