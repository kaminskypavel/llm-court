/**
 * LLM Court - Model Adapter Interface
 */

import type { ModelConfig, TokenUsage } from "@llm-court/shared/types";

export type ModelCallOptions = {
	systemPrompt: string;
	userPrompt: string;
	maxTokens: number;
	temperature: number;
	timeoutMs: number;
	schema?: unknown; // Zod schema for structured output
};

export type ModelCallResult = {
	content: string;
	tokenUsage: TokenUsage;
	latencyMs: number;
	rawResponse?: unknown;
};

export type ModelAdapter = {
	readonly provider: string;
	readonly model: string;
	call(options: ModelCallOptions): Promise<ModelCallResult>;
};

export type ModelAdapterFactory = (config: ModelConfig) => ModelAdapter;
