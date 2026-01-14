/**
 * LLM Court - Codex CLI Adapter
 * Uses `codex exec --json --full-auto` mode
 */

import { spawn } from "node:child_process";
import { CLIAdapterError, ModelTimeoutError } from "@llm-court/shared/errors";
import type { ModelConfig } from "@llm-court/shared/types";
import { estimateTokenCount } from "../utils.js";
import type {
	ModelAdapter,
	ModelCallOptions,
	ModelCallResult,
} from "./interface.js";

// CodexConfig is now just ModelConfig since it includes the Codex-specific fields
export type CodexConfig = ModelConfig;

export const createCodexAdapter = (config: CodexConfig): ModelAdapter => {
	const codexPath = config.cliPath ?? "codex";
	const reasoningEffort = config.reasoningEffort ?? "high";

	return {
		provider: "codex",
		model: config.model,

		async call(options: ModelCallOptions): Promise<ModelCallResult> {
			const startTime = Date.now();

			// Combine system and user prompts
			const fullPrompt = `SYSTEM INSTRUCTIONS:
${options.systemPrompt}

USER REQUEST:
${options.userPrompt}`;

			// Build command args
			const args = [
				"exec",
				"--json",
				"--full-auto",
				"--model",
				config.model,
				"-c",
				`model_reasoning_effort="${reasoningEffort}"`,
			];

			if (config.enableSearch) {
				args.push("--search");
			}

			args.push(fullPrompt);

			return new Promise((resolve, reject) => {
				const proc = spawn(codexPath, args, {
					stdio: ["pipe", "pipe", "pipe"],
					shell: false,
					timeout: options.timeoutMs,
				});

				let stdout = "";
				let stderr = "";

				proc.stdout.on("data", (chunk: Buffer) => {
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
							new ModelTimeoutError("codex", config.model, options.timeoutMs),
						);
					} else {
						reject(
							new CLIAdapterError(
								`Failed to spawn Codex CLI: ${err.message}`,
								codexPath,
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
								`Codex CLI exited with code ${code}`,
								codexPath,
								code ?? undefined,
								stderr,
								{ latencyMs },
							),
						);
						return;
					}

					// Parse JSONL output to extract agent message
					let responseText = "";
					let inputTokens = 0;
					let outputTokens = 0;

					for (const line of stdout.trim().split("\n")) {
						if (!line.trim()) continue;
						try {
							const event = JSON.parse(line);

							if (event.type === "item.completed") {
								const item = event.item;
								if (item?.type === "agent_message") {
									responseText = item.text ?? "";
								}
							}

							if (event.type === "turn.completed") {
								const usage = event.usage;
								inputTokens = usage?.input_tokens ?? 0;
								outputTokens = usage?.output_tokens ?? 0;
							}
						} catch {
							// Skip non-JSON lines
						}
					}

					if (!responseText) {
						reject(
							new CLIAdapterError(
								"No agent message found in Codex output",
								codexPath,
								code ?? undefined,
								stderr,
								{ latencyMs, stdout: stdout.slice(0, 500) },
							),
						);
						return;
					}

					resolve({
						content: responseText,
						tokenUsage: {
							prompt: inputTokens || estimateTokenCount(fullPrompt),
							completion: outputTokens || estimateTokenCount(responseText),
							total:
								(inputTokens || estimateTokenCount(fullPrompt)) +
								(outputTokens || estimateTokenCount(responseText)),
							estimated: inputTokens === 0,
						},
						latencyMs,
					});
				});

				proc.stdin.end();
			});
		},
	};
};
