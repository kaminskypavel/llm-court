/**
 * LLM Court - CLI Adapter
 * Spawns local CLI tools (codex, gemini-cli, etc.)
 */

import { spawn } from "node:child_process";
import {
	CLI_MAX_STDIN_BYTES,
	CLI_MAX_STDOUT_BYTES,
	CLI_TEMPLATE_TOKENS,
} from "@llm-court/shared/constants";
import {
	CLIAdapterError,
	CLIOutputTooLargeError,
	ModelTimeoutError,
} from "@llm-court/shared/errors";
import type { ModelConfig } from "@llm-court/shared/types";
import { estimateTokenCount } from "../utils.js";
import type {
	ModelAdapter,
	ModelCallOptions,
	ModelCallResult,
} from "./interface.js";

const replaceTemplateTokens = (
	args: string[],
	prompt: string,
	maxTokens: number,
	temperature: number,
): { args: string[]; promptInArgs: boolean } => {
	let promptInArgs = false;
	const replaced = args.map((arg) => {
		let result = arg;
		if (result.includes(CLI_TEMPLATE_TOKENS.PROMPT)) {
			promptInArgs = true;
			result = result.replace(CLI_TEMPLATE_TOKENS.PROMPT, prompt);
		}
		result = result.replace(CLI_TEMPLATE_TOKENS.MAX_TOKENS, String(maxTokens));
		result = result.replace(
			CLI_TEMPLATE_TOKENS.TEMPERATURE,
			String(temperature),
		);
		return result;
	});
	return { args: replaced, promptInArgs };
};

export const createCLIAdapter = (config: ModelConfig): ModelAdapter => {
	if (!config.cliPath) {
		throw new CLIAdapterError("CLI path is required for CLI provider", "");
	}
	if (!config.chatTemplate) {
		throw new CLIAdapterError(
			"Chat template is required for CLI provider",
			config.cliPath,
		);
	}

	// Extract validated values to avoid non-null assertions in callbacks
	const cliPath = config.cliPath;
	const chatTemplate = config.chatTemplate;

	return {
		provider: "cli",
		model: config.model,

		async call(options: ModelCallOptions): Promise<ModelCallResult> {
			const startTime = Date.now();

			// Build the full prompt based on chat template
			const fullPrompt = buildPrompt(
				chatTemplate,
				options.systemPrompt,
				options.userPrompt,
			);

			// Check stdin size limit
			const promptBytes = Buffer.byteLength(fullPrompt, "utf-8");
			if (promptBytes > CLI_MAX_STDIN_BYTES) {
				throw new CLIOutputTooLargeError(
					cliPath,
					promptBytes,
					CLI_MAX_STDIN_BYTES,
				);
			}

			// Replace template tokens in args
			const cliArgs = config.cliArgs ?? [];
			const { args, promptInArgs } = replaceTemplateTokens(
				cliArgs,
				fullPrompt,
				options.maxTokens,
				options.temperature,
			);

			return new Promise((resolve, reject) => {
				const proc = spawn(cliPath, args, {
					stdio: ["pipe", "pipe", "pipe"],
					shell: false,
					timeout: options.timeoutMs,
				});

				let stdout = "";
				let stderr = "";
				let stdoutBytes = 0;

				proc.stdout.on("data", (chunk: Buffer) => {
					stdoutBytes += chunk.length;
					if (stdoutBytes > CLI_MAX_STDOUT_BYTES) {
						proc.kill();
						reject(
							new CLIOutputTooLargeError(
								cliPath,
								stdoutBytes,
								CLI_MAX_STDOUT_BYTES,
							),
						);
						return;
					}
					stdout += chunk.toString("utf-8");
				});

				proc.stderr.on("data", (chunk: Buffer) => {
					stderr += chunk.toString("utf-8");
				});

				proc.on("error", (err) => {
					const latencyMs = Date.now() - startTime;
					if (
						err.message.includes("ETIMEDOUT") ||
						err.message.includes("timeout")
					) {
						reject(
							new ModelTimeoutError("cli", config.model, options.timeoutMs),
						);
					} else {
						reject(
							new CLIAdapterError(
								`Failed to spawn CLI: ${err.message}`,
								cliPath,
								undefined,
								stderr,
								{ latencyMs },
							),
						);
					}
				});

				proc.on("close", (code) => {
					const latencyMs = Date.now() - startTime;

					if (code !== 0) {
						reject(
							new CLIAdapterError(
								`CLI exited with code ${code}`,
								cliPath,
								code ?? undefined,
								stderr,
								{ latencyMs },
							),
						);
						return;
					}

					// Estimate token usage from character counts
					const promptTokens = estimateTokenCount(fullPrompt);
					const completionTokens = estimateTokenCount(stdout);

					resolve({
						content: stdout.trim(),
						tokenUsage: {
							prompt: promptTokens,
							completion: completionTokens,
							total: promptTokens + completionTokens,
							estimated: true,
						},
						latencyMs,
					});
				});

				// Write prompt to stdin if not in args
				if (!promptInArgs) {
					proc.stdin.write(fullPrompt, "utf-8");
					proc.stdin.end();
				} else {
					proc.stdin.end();
				}
			});
		},
	};
};

/**
 * Build prompt using chat template format
 */
const buildPrompt = (
	template: string,
	system: string,
	user: string,
): string => {
	switch (template) {
		case "chatml":
			return `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n`;

		case "llama3":
			return `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${system}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${user}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`;

		case "gemma":
			return `<start_of_turn>user\n${system}\n\n${user}<end_of_turn>\n<start_of_turn>model\n`;

		default:
			// Fallback to simple concatenation
			return `${system}\n\n${user}`;
	}
};
