import Anthropic from "@anthropic-ai/sdk";
import type { LlmClient, LlmResponse } from "./types.js";

const DEFAULT_MODEL = "claude-sonnet-5";

export interface AnthropicLlmClientOptions {
  apiKey?: string;
  model?: string;
}

/** Strips a ```diff/```patch fence if the model wrapped the diff despite being told not to. */
function extractDiff(text: string): string {
  const fenced = /```(?:diff|patch)?\n([\s\S]*?)```/.exec(text);
  return `${(fenced ? fenced[1]! : text).trim()}\n`;
}

export class AnthropicLlmClient implements LlmClient {
  #client: Anthropic;
  #model: string;

  constructor(options: AnthropicLlmClientOptions = {}) {
    this.#client = new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
    this.#model = options.model ?? process.env.BLAST_MODEL ?? DEFAULT_MODEL;
  }

  async requestPatch(prompt: string): Promise<LlmResponse> {
    const response = await this.#client.messages.create({
      model: this.#model,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      diff: extractDiff(text),
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }
}
