/**
 * LLM Court - Adapter Registry
 * Factory for creating model adapters
 */

import { ModelError } from "@llm-court/shared/errors";
import type { ModelConfig } from "@llm-court/shared/types";
import { createAISDKAdapter } from "./ai-sdk.js";
import { createCLIAdapter } from "./cli-adapter.js";
import { type CodexConfig, createCodexAdapter } from "./codex-adapter.js";
import { createGeminiCLIAdapter } from "./gemini-cli-adapter.js";
import type { ModelAdapter } from "./interface.js";

/**
 * Create a model adapter based on provider configuration
 */
export const createAdapter = (config: ModelConfig): ModelAdapter => {
	switch (config.provider) {
		case "openai":
		case "anthropic":
		case "google":
			return createAISDKAdapter(config);
		case "cli":
			return createCLIAdapter(config);
		case "codex":
			return createCodexAdapter(config as CodexConfig);
		case "gemini-cli":
			return createGeminiCLIAdapter(config);
		default:
			throw new ModelError(
				`Unknown provider: ${config.provider}`,
				config.provider,
				config.model,
				false,
			);
	}
};

/**
 * Cache of created adapters (keyed by provider+model+path)
 */
const adapterCache = new Map<string, ModelAdapter>();

/**
 * Get or create a cached adapter
 */
export const getAdapter = (config: ModelConfig): ModelAdapter => {
	const key = `${config.provider}:${config.model}:${config.cliPath ?? ""}`;

	let adapter = adapterCache.get(key);
	if (!adapter) {
		adapter = createAdapter(config);
		adapterCache.set(key, adapter);
	}

	return adapter;
};

/**
 * Clear the adapter cache
 */
export const clearAdapterCache = (): void => {
	adapterCache.clear();
};
