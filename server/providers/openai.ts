import type { StreamChatRequest, StreamChunk } from './types.js';

export async function* streamOpenAI(req: StreamChatRequest, apiKey?: string): AsyncGenerator<StreamChunk> {
  if (!apiKey) {
    // If no key configured, give structured multi-model response indicating simulated response & how to configure key in admin vault
    yield {
      type: 'delta',
      delta: `### [OpenAI ${req.model} Response]\n\n*Note: Shared OpenAI API key is not currently configured in the OmniDesk vault by the owner. Below is an simulated output for testing multi-model switching.*\n\n`,
    };

    const simulatedText = `Hello! I am answering as **${req.model}**.

Here is how OpenAI models integrate into OmniDesk:
- **Model Switching**: OmniDesk maintains your unified context thread, meaning you can jump between GPT-4o, Claude 3.7 Sonnet, and Gemini 3.8 Flash seamlessly.
- **Quota Tracking**: In OmniDesk, GPT-4o is tracked at $2.50/1M input tokens and $10.00/1M output tokens in integer micro-USD.
- **RAG & Citations**: ${req.retrievedContext ? 'Retrieved knowledge base documents were detected and processed.' : 'You can attach documents or query knowledge collections anytime.'}

*To activate live OpenAI GPT calls, the workspace owner can paste an OpenAI API key in **Admin Settings > Shared Provider Credentials**.*`;

    // Stream word by word
    const words = simulatedText.split(' ');
    for (const w of words) {
      yield { type: 'delta', delta: w + ' ' };
      await new Promise((r) => setTimeout(r, 20));
    }

    yield {
      type: 'done',
      inputTokens: 120,
      outputTokens: 180,
    };
    return;
  }

  // Live OpenAI Streaming Call
  try {
    const messages = [
      ...(req.retrievedContext
        ? [{ role: 'system', content: `[KNOWLEDGE BASE CONTEXT]\n${req.retrievedContext}` }]
        : []),
      ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: req.model || 'gpt-4o',
        messages,
        max_tokens: req.maxOutputTokens || 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      yield {
        type: 'error',
        error: (errJson as any)?.error?.message || `OpenAI API returned status ${response.status}`,
      };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response stream from OpenAI' };
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
          // ignore chunk parse errors
        }
      }
    }

    yield {
      type: 'done',
      inputTokens: Math.max(20, Math.ceil(JSON.stringify(messages).length / 4)),
      outputTokens: Math.max(10, Math.ceil(totalOutput.length / 4)),
    };
  } catch (err: any) {
    yield { type: 'error', error: err.message || 'OpenAI network error' };
  }
}
