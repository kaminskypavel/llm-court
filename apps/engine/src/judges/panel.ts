/**
 * LLM Court - Judge Panel
 */

import {
	DEFAULT_JUDGE_TEMPERATURE,
	DEFAULT_MAX_TOKENS_PER_RESPONSE,
} from "@llm-court/shared/constants";
import { JudgeEvaluationSchema } from "@llm-court/shared/schemas";
import type {
	DebateConfig,
	JudgeConfig,
	JudgeEvaluation,
	JudgeRoundResult,
	RoundResult,
} from "@llm-court/shared/types";
import pLimit from "p-limit";
import {
	getAdapter,
	parseJsonWithRepair,
	withRetry,
} from "../adapters/index.js";
import { createErrorJudgeResponse } from "../utils.js";
import { detectJudgeConsensus } from "./consensus.js";
import {
	buildJudgeEvaluationPrompt,
	buildJudgeSystemPrompt,
} from "./prompts.js";

export type JudgePanelOptions = {
	config: DebateConfig;
	onJudgeStart?: (judgeId: string, round: number) => void;
	onJudgeComplete?: (evaluation: JudgeEvaluation) => void;
	onJudgeError?: (judgeId: string, round: number, error: Error) => void;
	onRetry?: (judgeId: string, attempt: number, error: Error) => void;
};

export type JudgeRoundInput = {
	round: number;
	positions: Map<string, string>; // positionId -> positionText
	agentRounds: RoundResult[];
};

/**
 * Collect unique positions from agent debate rounds
 */
export const collectPositions = (
	rounds: RoundResult[],
	scope: "all_rounds" | "last_round",
): Map<string, string> => {
	const positions = new Map<string, string>();

	const roundsToProcess = scope === "last_round" ? rounds.slice(-1) : rounds;

	for (const round of roundsToProcess) {
		for (const response of round.responses) {
			if (
				response.status === "ok" &&
				response.positionId &&
				response.positionText
			) {
				// Only add if not already present (keep first occurrence)
				if (!positions.has(response.positionId)) {
					positions.set(response.positionId, response.positionText);
				}
			}
		}
	}

	return positions;
};

/**
 * Run a single judge evaluation round
 */
export const runJudgeRound = async (
	input: JudgeRoundInput,
	options: JudgePanelOptions,
): Promise<JudgeRoundResult> => {
	const { config, onJudgeStart, onJudgeComplete, onJudgeError } = options;
	const { round, positions, agentRounds } = input;

	const limit = pLimit(config.concurrency.maxConcurrentRequests);

	// Run all judges in parallel (with concurrency limit)
	const evaluationPromises = config.judges.map((judge) =>
		limit(() => runJudge(judge, round, positions, agentRounds, options)),
	);

	// Notify about judge starts
	for (const judge of config.judges) {
		onJudgeStart?.(judge.id, round);
	}

	const evaluations = await Promise.all(evaluationPromises);

	// Notify about completions
	for (const evaluation of evaluations) {
		if (evaluation.status === "ok") {
			onJudgeComplete?.(evaluation);
		} else {
			onJudgeError?.(
				evaluation.judgeId,
				round,
				new Error(evaluation.error ?? "Unknown error"),
			);
		}
	}

	// Check for consensus
	const consensusResult = detectJudgeConsensus(
		evaluations,
		positions,
		config.judgeConsensusThreshold,
		config.judgeMinConfidence,
	);

	// Build round result
	const result: JudgeRoundResult = {
		roundNumber: round,
		positionIds: Array.from(positions.keys()),
		evaluations,
		consensusReached: consensusResult.reached,
		consensusPositionId: consensusResult.positionId,
		avgConfidence: consensusResult.confidence,
		timestamp: new Date().toISOString(),
	};

	return result;
};

/**
 * Run a single judge evaluation
 */
const runJudge = async (
	judge: JudgeConfig,
	round: number,
	positions: Map<string, string>,
	agentRounds: RoundResult[],
	options: JudgePanelOptions,
): Promise<JudgeEvaluation> => {
	const { config, onRetry } = options;
	const startTime = Date.now();

	try {
		// Get adapter with retry wrapper
		const baseAdapter = getAdapter(judge.model);
		const adapter = withRetry(baseAdapter, {
			config: config.retries,
			deterministicMode: config.deterministicMode,
			onRetry: (attempt, error) => {
				onRetry?.(judge.id, attempt, error);
			},
		});

		// Build prompts
		const systemPrompt = buildJudgeSystemPrompt({
			judgeId: judge.id,
			topic: config.topic,
			initialQuery: config.initialQuery,
			systemPrompt: judge.systemPrompt,
			round,
			positions,
			agentRounds,
		});

		const userPrompt = buildJudgeEvaluationPrompt({
			judgeId: judge.id,
			topic: config.topic,
			initialQuery: config.initialQuery,
			systemPrompt: judge.systemPrompt,
			round,
			positions,
			agentRounds,
		});

		// Make model call
		const temperature = config.deterministicMode
			? 0
			: (judge.temperature ?? DEFAULT_JUDGE_TEMPERATURE);

		const result = await adapter.call({
			systemPrompt,
			userPrompt,
			maxTokens:
				config.limits.maxTokensPerResponse ?? DEFAULT_MAX_TOKENS_PER_RESPONSE,
			temperature,
			timeoutMs: config.timeouts.modelMs,
			schema: JudgeEvaluationSchema,
		});

		// Parse response
		const parseResult = parseJsonWithRepair<unknown>(
			result.content,
			!config.deterministicMode,
		);

		if (!parseResult.success) {
			return createErrorJudgeResponse(
				judge.id,
				round,
				`Failed to parse JSON: ${parseResult.error}`,
			);
		}

		// Validate against schema
		const validated = JudgeEvaluationSchema.safeParse(parseResult.data);

		if (!validated.success) {
			return createErrorJudgeResponse(
				judge.id,
				round,
				`Schema validation failed: ${validated.error.issues.map((e: { message: string }) => e.message).join(", ")}`,
			);
		}

		const data = validated.data;

		return {
			judgeId: judge.id,
			round,
			selectedPositionId: data.selectedPositionId,
			scoresByPositionId: data.scoresByPositionId,
			reasoning: data.reasoning,
			confidence: data.confidence,
			tokenUsage: result.tokenUsage,
			latencyMs: result.latencyMs,
			status: "ok",
			error: null,
		};
	} catch (error) {
		const latencyMs = Date.now() - startTime;
		return {
			...createErrorJudgeResponse(
				judge.id,
				round,
				error instanceof Error ? error.message : String(error),
			),
			latencyMs,
		};
	}
};
