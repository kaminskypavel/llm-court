/**
 * LLM Court - Debate Engine
 */

import {
	DEFAULT_AGENT_TEMPERATURE,
	DEFAULT_MAX_TOKENS_PER_RESPONSE,
} from "@llm-court/shared/constants";
import { AgentResponseSchema } from "@llm-court/shared/schemas";
import type {
	AgentConfig,
	AgentResponse,
	DebateConfig,
	RoundResult,
} from "@llm-court/shared/types";
import pLimit from "p-limit";
import {
	getAdapter,
	parseJsonWithRepair,
	withRetry,
} from "../adapters/index.js";
import { createErrorAgentResponse, generatePositionId } from "../utils.js";
import { detectAgentConsensus, selectNextCandidate } from "./consensus.js";
import {
	buildAgentSystemPrompt,
	buildDebateRoundPrompt,
	buildRound1Prompt,
} from "./prompts.js";

export type DebateEngineOptions = {
	config: DebateConfig;
	onAgentStart?: (agentId: string, round: number) => void;
	onAgentComplete?: (response: AgentResponse) => void;
	onAgentError?: (agentId: string, round: number, error: Error) => void;
	onRetry?: (agentId: string, attempt: number, error: Error) => void;
};

export type DebateRoundInput = {
	round: number;
	candidatePositionId: string | null;
	candidatePositionText: string | null;
	history: RoundResult[];
};

/**
 * Run a single debate round
 */
export const runDebateRound = async (
	input: DebateRoundInput,
	options: DebateEngineOptions,
): Promise<RoundResult> => {
	const { config, onAgentStart, onAgentComplete, onAgentError } = options;
	const { round, candidatePositionId, candidatePositionText, history } = input;

	const limit = pLimit(config.concurrency.maxConcurrentRequests);

	// Run all agents in parallel (with concurrency limit)
	const responsePromises = config.agents.map((agent) =>
		limit(() =>
			runAgent(
				agent,
				round,
				candidatePositionId,
				candidatePositionText,
				history,
				options,
			),
		),
	);

	// Notify about agent starts
	for (const agent of config.agents) {
		onAgentStart?.(agent.id, round);
	}

	const responses = await Promise.all(responsePromises);

	// Notify about completions
	for (const response of responses) {
		if (response.status === "ok") {
			onAgentComplete?.(response);
		} else {
			onAgentError?.(
				response.agentId,
				round,
				new Error(response.error ?? "Unknown error"),
			);
		}
	}

	// Check for consensus
	const consensusResult = detectAgentConsensus(
		responses,
		candidatePositionId,
		config.consensusThreshold,
	);

	// Build round result
	const result: RoundResult = {
		roundNumber: round,
		candidatePositionId,
		candidatePositionText,
		responses,
		consensusReached: consensusResult.reached,
		consensusPositionId: consensusResult.positionId,
		consensusPositionText: consensusResult.positionText,
		voteTally: consensusResult.voteTally,
		timestamp: new Date().toISOString(),
	};

	return result;
};

/**
 * Run a single agent for a round
 */
const runAgent = async (
	agent: AgentConfig,
	round: number,
	candidatePositionId: string | null,
	candidatePositionText: string | null,
	history: RoundResult[],
	options: DebateEngineOptions,
): Promise<AgentResponse> => {
	const { config, onRetry } = options;
	const startTime = Date.now();

	try {
		// Get adapter with retry wrapper
		const baseAdapter = getAdapter(agent.model);
		const adapter = withRetry(baseAdapter, {
			config: config.retries,
			deterministicMode: config.deterministicMode,
			onRetry: (attempt, error, _delayMs) => {
				onRetry?.(agent.id, attempt, error);
			},
		});

		// Build prompts
		const systemPrompt = buildAgentSystemPrompt({
			agentId: agent.id,
			topic: config.topic,
			initialQuery: config.initialQuery,
			systemPrompt: agent.systemPrompt,
			round,
			candidatePositionId,
			candidatePositionText,
			history,
			contextTopology: config.contextTopology,
			maxContextTokens: config.limits.maxContextTokens,
		});

		const userPrompt =
			round === 1
				? buildRound1Prompt()
				: buildDebateRoundPrompt({
						agentId: agent.id,
						topic: config.topic,
						initialQuery: config.initialQuery,
						systemPrompt: agent.systemPrompt,
						round,
						candidatePositionId,
						candidatePositionText,
						history,
						contextTopology: config.contextTopology,
						maxContextTokens: config.limits.maxContextTokens,
					});

		// Make model call
		const temperature = config.deterministicMode
			? 0
			: (agent.temperature ?? DEFAULT_AGENT_TEMPERATURE);

		const result = await adapter.call({
			systemPrompt,
			userPrompt,
			maxTokens:
				config.limits.maxTokensPerResponse ?? DEFAULT_MAX_TOKENS_PER_RESPONSE,
			temperature,
			timeoutMs: config.timeouts.modelMs,
			schema: AgentResponseSchema,
		});

		// Parse response
		const parseResult = parseJsonWithRepair<unknown>(
			result.content,
			!config.deterministicMode,
		);

		if (!parseResult.success) {
			return createErrorAgentResponse(
				agent.id,
				round,
				`Failed to parse JSON: ${parseResult.error}`,
			);
		}

		// Validate against schema
		const validated = AgentResponseSchema.safeParse(parseResult.data);

		if (!validated.success) {
			return createErrorAgentResponse(
				agent.id,
				round,
				`Schema validation failed: ${validated.error.issues.map((e: { message: string }) => e.message).join(", ")}`,
			);
		}

		const data = validated.data;

		// Calculate position ID
		let positionId: string | null = null;
		let positionText = "";

		if (data.vote === "yes" && data.targetPositionId) {
			// Yes vote: use target position ID
			positionId = data.targetPositionId;
			positionText = candidatePositionText ?? "";
		} else if (data.vote === "no" && data.newPositionText) {
			// No vote: generate new position ID
			positionText = data.newPositionText;
			positionId = generatePositionId(positionText);
		} else if (data.vote === "abstain" && data.newPositionText) {
			// Abstain with new position (round 1)
			positionText = data.newPositionText;
			positionId = generatePositionId(positionText);
		}

		return {
			agentId: agent.id,
			round,
			positionId,
			positionText,
			reasoning: data.reasoning,
			vote: data.vote,
			confidence: data.confidence,
			tokenUsage: result.tokenUsage,
			latencyMs: result.latencyMs,
			status: "ok",
			error: null,
		};
	} catch (error) {
		const latencyMs = Date.now() - startTime;
		return {
			...createErrorAgentResponse(
				agent.id,
				round,
				error instanceof Error ? error.message : String(error),
			),
			latencyMs,
		};
	}
};

/**
 * Get the next candidate for a new round
 */
export const getNextCandidate = (
	lastRound: RoundResult,
): { positionId: string; positionText: string } | null => {
	const candidate = selectNextCandidate(lastRound.responses);

	if (!candidate) {
		return null;
	}

	return {
		positionId: candidate.positionId,
		positionText: candidate.positionText,
	};
};
