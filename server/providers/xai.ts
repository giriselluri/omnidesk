import type { StreamChatRequest, StreamChunk } from './types.js';

export async function* streamXAI(req: StreamChatRequest, apiKey?: string): AsyncGenerator<StreamChunk> {
  if (!apiKey) {
    yield {
      type: 'delta',
      delta: `### [xAI ${req.model} Response]\n\n*Note: Shared xAI API key is not currently configured in the OmniDesk vault. Below is an simulated output for testing multi-model switching.*\n\n`,
    };

    const simulatedText = `I am responding as **Grok 2 by xAI**.

Highlights of Grok integration in OmniDesk:
- **Direct & Unfiltered Reasoning**: Direct clarity on technical topics, system modeling, and data pipelines.
- **Micro-USD Accounting**: Grok 2 is tracked at $2.00/1M input and $10.00/1M output tokens against your user allowance.
- **Provider Switching**: You can switch between Grok, Gemini, Claude, and GPT in this same chat thread effortlessly.

*Workspace owners can activate live xAI Grok API calls anytime in **Admin Settings > Shared Provider Credentials**.*`;

    const words = simulatedText.split(' ');
    for (const w of words) {
      yield { type: 'delta', delta: w + ' ' };
      await new Promise((r) => setTimeout(r, 20));
    }

    yield {
      type: 'done',
      inputTokens: 110,
      outputTokens: 160,
    };
    return;
  }

  // Live xAI call
  try {
    const messages = [
      ...(req.retrievedContext
        ? [{ role: 'system', content: `[KNOWLEDGE BASE CONTEXT]\n${req.retrievedContext}` }]
        : []),
      ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: req.model || 'grok-2-1212',
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      yield {
        type: 'error',
        error: (errJson as any)?.error?.message || `xAI API returned status ${response.status}`,
      };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response stream from xAI' };
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
        if (dataStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            totalOutput += delta;
            yield { type: 'delta', delta };
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
    yield { type: 'error', error: err.message || 'xAI connection error' };
  }
}
