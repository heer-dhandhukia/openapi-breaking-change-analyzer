import type { LlmClient, LlmResponse } from "./types.js";

/** Test double: returns canned responses in order, repeating the last one if called more times than provided. */
export class MockLlmClient implements LlmClient {
  #responses: LlmResponse[];
  #calls = 0;

  constructor(responses: LlmResponse[]) {
    if (responses.length === 0) {
      throw new Error("MockLlmClient needs at least one response");
    }
    this.#responses = responses;
  }

  get callCount(): number {
    return this.#calls;
  }

  async requestPatch(): Promise<LlmResponse> {
    const response = this.#responses[Math.min(this.#calls, this.#responses.length - 1)]!;
    this.#calls++;
    return response;
  }
}
