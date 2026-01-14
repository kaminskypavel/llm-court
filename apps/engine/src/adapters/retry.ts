/**
 * LLM Court - Retry Logic
 */

import {
	DEFAULT_MAX_RETRY_ATTEMPTS,
	DEFAULT_RETRY_BASE_DELAY_MS,
	DEFAULT_RETRY_MAX_DELAY_MS,
} from "@llm-court/shared/constants";
import { ModelError, ModelRateLimitError } from "@llm-court/shared/errors";
import type { RetryConfig } from "@llm-court/shared/types";
import { calculateBackoff, sleep } from "../utils.js";
import type {
	ModelAdapter,
	ModelCallOptions,
	ModelCallResult,
} from "./interface.js";

export type RetryOptions = {
	config: RetryConfig;
	deterministicMode: boolean;
	onRetry?: (attempt: number, error: Error, delayMs: number) => void;
};

/**
 * Wrap an adapter with retry logic
 */
export const withRetry = (
	adapter: ModelAdapter,
	retryOptions: RetryOptions,
): ModelAdapter => {
	const { config, deterministicMode, onRetry } = retryOptions;

	const maxAttempts = deterministicMode
		? 0
		: (config.maxAttempts ?? DEFAULT_MAX_RETRY_ATTEMPTS);
	const baseDelayMs = config.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
	const maxDelayMs = config.maxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS;

	return {
		provider: adapter.provider,
		model: adapter.model,

		async call(options: ModelCallOptions): Promise<ModelCallResult> {
			let lastError: Error | null = null;

			for (let attempt = 0; attempt <= maxAttempts; attempt++) {
				try {
					return await adapter.call(options);
				} catch (error) {
					if (!(error instanceof Error)) {
						throw error;
					}

					lastError = error;

					// Check if error is retryable
					const isRetryable =
						error instanceof ModelError ? error.retryable : false;

					if (!isRetryable || attempt >= maxAttempts) {
						throw error;
					}

					// Calculate delay
					let delayMs = calculateBackoff(
						attempt,
						baseDelayMs,
						maxDelayMs,
						!deterministicMode,
					);

					// Use retry-after hint if available
					if (error instanceof ModelRateLimitError && error.retryAfterMs) {
						delayMs = Math.max(delayMs, error.retryAfterMs);
					}

					// Notify about retry
					onRetry?.(attempt + 1, error, delayMs);

					// Wait before retry
					await sleep(delayMs);
				}
			}

			// Should never reach here, but TypeScript needs this
			throw lastError ?? new Error("Unexpected retry loop exit");
		},
	};
};
