/**
 * LLM Court - Gemini CLI Adapter
 * Uses `gemini -m <model> -y` mode with stdin prompt
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

export const createGeminiCLIAdapter = (config: ModelConfig): ModelAdapter => {
	const geminiPath = config.cliPath ?? "gemini";

	return {
		provider: "gemini-cli",
		model: config.model,

		async call(options: ModelCallOptions): Promise<ModelCallResult> {
			const startTime = Date.now();

			// Combine system and user prompts
			const fullPrompt = `SYSTEM INSTRUCTIONS:
${options.systemPrompt}

USER REQUEST:
${options.userPrompt}`;

			// Build command args
			const args = ["-m", config.model, "-y"]; // -y for auto-approve (yolo mode)

			return new Promise((resolve, reject) => {
				const proc = spawn(geminiPath, args, {
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
							new ModelTimeoutError(
								"gemini-cli",
								config.model,
								options.timeoutMs,
							),
						);
					} else {
						reject(
							new CLIAdapterError(
								`Failed to spawn Gemini CLI: ${err.message}`,
								geminiPath,
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
								`Gemini CLI exited with code ${code}`,
								geminiPath,
								code ?? undefined,
								stderr,
								{ latencyMs },
							),
						);
						return;
					}

					// Filter noise from gemini CLI output
					const lines = stdout.split("\n");
					const skipPrefixes = [
						"Loaded cached",
						"Server ",
						"Loading extension",
					];
					const filtered = lines.filter(
						(line) => !skipPrefixes.some((prefix) => line.startsWith(prefix)),
					);
					const responseText = filtered.join("\n").trim();

					if (!responseText) {
						reject(
							new CLIAdapterError(
								"No response from Gemini CLI",
								geminiPath,
								code ?? undefined,
								stderr,
								{ latencyMs },
							),
						);
						return;
					}

					// Estimate tokens (Gemini CLI doesn't report usage)
					const promptTokens = estimateTokenCount(fullPrompt);
					const completionTokens = estimateTokenCount(responseText);

					resolve({
						content: responseText,
						tokenUsage: {
							prompt: promptTokens,
							completion: completionTokens,
							total: promptTokens + completionTokens,
							estimated: true,
						},
						latencyMs,
					});
				});

				// Write prompt to stdin
				proc.stdin.write(fullPrompt, "utf-8");
				proc.stdin.end();
			});
		},
	};
};
