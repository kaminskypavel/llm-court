/**
 * LLM Court - AI SDK Adapter
 * Supports OpenAI, Anthropic, Google via Vercel AI SDK
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { ModelError, ModelTimeoutError } from "@llm-court/shared/errors";
import type { ModelConfig, Provider } from "@llm-court/shared/types";
import { DEFAULT_API_KEY_ENV } from "@llm-court/shared/types";
import type { LanguageModel } from "ai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import type {
	ModelAdapter,
	ModelCallOptions,
	ModelCallResult,
} from "./interface.js";

const createModelInstance = (config: ModelConfig): LanguageModel => {
	const provider = config.provider as Exclude<Provider, "cli">;
	const apiKeyEnv = config.apiKeyEnv ?? DEFAULT_API_KEY_ENV[provider];
	const apiKey = apiKeyEnv ? process.env[apiKeyEnv] : undefined;

	if (!apiKey) {
		throw new ModelError(
			`API key not found in environment variable ${apiKeyEnv}`,
			provider,
			config.model,
			false,
		);
	}

	switch (provider) {
		case "openai": {
			const openai = createOpenAI({ apiKey });
			return openai(config.model);
		}
		case "anthropic": {
			const anthropic = createAnthropic({ apiKey });
			return anthropic(config.model);
		}
		case "google": {
			const google = createGoogleGenerativeAI({ apiKey });
			return google(config.model);
		}
		default:
			throw new ModelError(
				`Unsupported provider: ${provider}`,
				provider,
				config.model,
				false,
			);
	}
};

export const createAISDKAdapter = (config: ModelConfig): ModelAdapter => {
	const model = createModelInstance(config);

	return {
		provider: config.provider,
		model: config.model,

		async call(options: ModelCallOptions): Promise<ModelCallResult> {
			const startTime = Date.now();

			try {
				// Use structured output if schema provided
				if (options.schema && options.schema instanceof z.ZodType) {
					const result = await generateObject({
						model,
						schema: options.schema,
						system: options.systemPrompt,
						prompt: options.userPrompt,
						maxTokens: options.maxTokens,
						temperature: options.temperature,
						abortSignal: AbortSignal.timeout(options.timeoutMs),
					});

					const latencyMs = Date.now() - startTime;

					return {
						content: JSON.stringify(result.object),
						tokenUsage: {
							prompt: result.usage?.promptTokens ?? 0,
							completion: result.usage?.completionTokens ?? 0,
							total:
								(result.usage?.promptTokens ?? 0) +
								(result.usage?.completionTokens ?? 0),
							estimated: false,
						},
						latencyMs,
						rawResponse: result,
					};
				}

				// Text generation without structured output
				const result = await generateText({
					model,
					system: options.systemPrompt,
					prompt: options.userPrompt,
					maxTokens: options.maxTokens,
					temperature: options.temperature,
					abortSignal: AbortSignal.timeout(options.timeoutMs),
				});

				const latencyMs = Date.now() - startTime;

				return {
					content: result.text,
					tokenUsage: {
						prompt: result.usage?.promptTokens ?? 0,
						completion: result.usage?.completionTokens ?? 0,
						total:
							(result.usage?.promptTokens ?? 0) +
							(result.usage?.completionTokens ?? 0),
						estimated: false,
					},
					latencyMs,
					rawResponse: result,
				};
			} catch (error) {
				const latencyMs = Date.now() - startTime;

				if (error instanceof Error) {
					// Check for timeout
					if (
						error.name === "AbortError" ||
						error.message.includes("timeout")
					) {
						throw new ModelTimeoutError(
							config.provider,
							config.model,
							options.timeoutMs,
						);
					}

					// Check for rate limit
					if (
						error.message.includes("rate limit") ||
						error.message.includes("429") ||
						error.message.includes("quota")
					) {
						throw new ModelError(
							`Rate limit exceeded: ${error.message}`,
							config.provider,
							config.model,
							true,
							{ latencyMs },
						);
					}
				}

				throw new ModelError(
					`Model call failed: ${error instanceof Error ? error.message : String(error)}`,
					config.provider,
					config.model,
					false,
					{ latencyMs },
				);
			}
		},
	};
};
