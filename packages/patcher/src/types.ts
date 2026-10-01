import type { Impact } from "@blast/impact";

export interface PatchRequest {
  /** Absolute path to the file being patched. */
  file: string;
  /** All `exact` Impacts touching this file (one file may be hit by several changes). */
  impacts: Impact[];
  fileContent: string;
  /** Extra type context (e.g. the frontend's own generated API types) to include in the prompt. */
  relevantTypes?: string;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmResponse {
  /** A unified diff, extracted from the model's response text. */
  diff: string;
  usage: LlmUsage;
}

export interface LlmClient {
  requestPatch(prompt: string): Promise<LlmResponse>;
}

export type VerifyStatus = "pass" | "fail";

export interface VerifyResult {
  status: VerifyStatus;
  /** Combined stdout/stderr, fed back to the model on retry and included in logs on failure. */
  output: string;
}

export type PatchOutcome = "verified" | "needs-human";

export interface PatchAttempt {
  /** 1-based. */
  attempt: number;
  diff: string;
  verify: VerifyResult;
}

export interface PatchRunResult {
  file: string;
  outcome: PatchOutcome;
  attempts: PatchAttempt[];
  /** Summed across every attempt for this file. */
  usage: LlmUsage;
  costUsd: number;
  durationMs: number;
}
