/**
 * LLM Court - Zod Schemas
 * Version: 2.3.0
 */

import { z } from "zod";

// === Agent Response Schema (for structured output) ===

export const AgentResponseSchema = z
	.object({
		vote: z.enum(["yes", "no", "abstain"]),
		targetPositionId: z
			.string()
			.length(12)
			.optional()
			.describe("Required if vote=yes"),
		newPositionText: z
			.string()
			.min(1)
			.max(4000)
			.optional()
			.describe("Required if vote=no or round=1"),
		reasoning: z.string().min(1).max(8000).describe("Supporting argument"),
		confidence: z.number().min(0).max(1).describe("Confidence 0.0-1.0"),
	})
	.superRefine((data, ctx) => {
		if (data.vote === "yes" && !data.targetPositionId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "targetPositionId required when voting 'yes'",
				path: ["targetPositionId"],
			});
		}
		if (data.vote === "no" && !data.newPositionText) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "newPositionText required when voting 'no'",
				path: ["newPositionText"],
			});
		}
	});

export type AgentResponseInput = z.input<typeof AgentResponseSchema>;
export type AgentResponseOutput = z.output<typeof AgentResponseSchema>;

// === Judge Evaluation Schema ===

export const JudgeEvaluationSchema = z.object({
	selectedPositionId: z.string().length(12).describe("Position ID you support"),
	scoresByPositionId: z
		.record(z.string().length(12), z.number().int().min(0).max(100))
		.describe("Scores 0-100 for each position"),
	reasoning: z.string().min(1).max(8000),
	confidence: z.number().min(0).max(1),
});

export type JudgeEvaluationInput = z.input<typeof JudgeEvaluationSchema>;
export type JudgeEvaluationOutput = z.output<typeof JudgeEvaluationSchema>;

// === Token Usage Schema ===

export const TokenUsageSchema = z.object({
	prompt: z.number().int().min(0),
	completion: z.number().int().min(0),
	total: z.number().int().min(0),
	estimated: z.boolean(),
});

// === Vote Tally Schema ===

export const VoteTallySchema = z.object({
	yes: z.number().int().min(0),
	no: z.number().int().min(0),
	abstain: z.number().int().min(0),
	total: z.number().int().min(0),
	eligible: z.number().int().min(0),
	votingTotal: z.number().int().min(0),
	supermajorityThreshold: z.number().int().min(0),
	supermajorityReached: z.boolean(),
});

// === Full Agent Response Schema (internal) ===

export const FullAgentResponseSchema = z.object({
	agentId: z.string().min(1).max(64),
	round: z.number().int().min(1),
	positionId: z.string().length(12).nullable(),
	positionText: z.string().max(4000),
	reasoning: z.string().max(8000),
	vote: z.enum(["yes", "no", "abstain"]),
	confidence: z.number().min(0).max(1),
	tokenUsage: TokenUsageSchema,
	latencyMs: z.number().int().min(0),
	status: z.enum(["ok", "error"]),
	error: z.string().nullable(),
});

// === Round Result Schema ===

export const RoundResultSchema = z.object({
	roundNumber: z.number().int().min(1),
	candidatePositionId: z.string().length(12).nullable(),
	candidatePositionText: z.string().max(4000).nullable(),
	responses: z.array(FullAgentResponseSchema),
	consensusReached: z.boolean(),
	consensusPositionId: z.string().length(12).nullable(),
	consensusPositionText: z.string().max(4000).nullable(),
	voteTally: VoteTallySchema,
	timestamp: z.string().datetime(),
});

// === Full Judge Evaluation Schema (internal) ===

export const FullJudgeEvaluationSchema = z.object({
	judgeId: z.string().min(1).max(64),
	round: z.number().int().min(1),
	selectedPositionId: z.string().length(12).nullable(),
	scoresByPositionId: z.record(z.string(), z.number().int().min(0).max(100)),
	reasoning: z.string().max(8000),
	confidence: z.number().min(0).max(1),
	tokenUsage: TokenUsageSchema,
	latencyMs: z.number().int().min(0),
	status: z.enum(["ok", "error"]),
	error: z.string().nullable(),
});

// === Judge Round Result Schema ===

export const JudgeRoundResultSchema = z.object({
	roundNumber: z.number().int().min(1),
	positionIds: z.array(z.string().length(12)),
	evaluations: z.array(FullJudgeEvaluationSchema),
	consensusReached: z.boolean(),
	consensusPositionId: z.string().length(12).nullable(),
	avgConfidence: z.number().min(0).max(1),
	timestamp: z.string().datetime(),
});

// === Config Schemas ===

export const ModelConfigSchema = z
	.object({
		provider: z.enum([
			"openai",
			"anthropic",
			"google",
			"cli",
			"codex",
			"gemini-cli",
		]),
		model: z.string().min(1),
		apiKeyEnv: z.string().optional(),
		cliPath: z.string().optional(),
		cliArgs: z.array(z.string()).optional(),
		chatTemplate: z.enum(["chatml", "llama3", "gemma"]).optional(),
		// Codex-specific options
		reasoningEffort: z
			.enum(["minimal", "low", "medium", "high", "xhigh"])
			.optional(),
		enableSearch: z.boolean().optional(),
	})
	.refine(
		(data) =>
			data.provider !== "cli" || (!!data.cliPath && !!data.chatTemplate),
		{
			message: "CLI provider requires cliPath and chatTemplate",
		},
	)
	.refine((data) => data.provider !== "codex" || !!data.cliPath, {
		message: "Codex provider requires cliPath",
	})
	.refine((data) => data.provider !== "gemini-cli" || !!data.cliPath, {
		message: "Gemini CLI provider requires cliPath",
	});

export const AgentConfigSchema = z.object({
	id: z.string().min(1).max(64),
	model: ModelConfigSchema,
	systemPrompt: z.string().max(4000).optional(),
	temperature: z.number().min(0).max(2).optional(),
});

export const JudgeConfigSchema = z.object({
	id: z.string().min(1).max(64),
	model: ModelConfigSchema,
	systemPrompt: z.string().max(4000).optional(),
	temperature: z.number().min(0).max(2).optional(),
});

export const TimeoutConfigSchema = z.object({
	modelMs: z.number().int().min(1000).max(600000).default(120000),
	roundMs: z.number().int().min(10000).max(1800000).default(300000),
	sessionMs: z.number().int().min(60000).max(7200000).default(1200000),
});

export const RetryConfigSchema = z.object({
	maxAttempts: z.number().int().min(0).max(5).default(2),
	baseDelayMs: z.number().int().min(100).max(10000).default(1000),
	maxDelayMs: z.number().int().min(1000).max(60000).default(8000),
});

export const ConcurrencyConfigSchema = z.object({
	maxConcurrentRequests: z.number().int().min(1).max(20).default(4),
});

export const LimitConfigSchema = z.object({
	maxTokensPerResponse: z.number().int().min(256).max(16384).default(2048),
	maxTotalTokens: z.number().int().min(1000).max(1000000).default(200000),
	maxTotalCostUsd: z.number().min(0.01).max(1000).default(25),
	maxContextTokens: z.number().int().min(1000).max(128000).default(12000),
});

export const DebateConfigSchema = z
	.object({
		topic: z.string().min(1).max(1000),
		initialQuery: z.string().max(2000).optional(),
		agents: z.array(AgentConfigSchema).min(2).max(10),
		judges: z.array(JudgeConfigSchema).min(0).max(15),
		judgePanelEnabled: z.boolean().default(true),
		maxAgentRounds: z.number().int().min(1).max(10).default(4),
		maxJudgeRounds: z.number().int().min(1).max(5).default(3),
		consensusThreshold: z.number().min(0.5).max(1).default(0.67),
		judgeConsensusThreshold: z.number().min(0.5).max(1).default(0.6),
		judgeMinConfidence: z.number().min(0).max(1).default(0.7),
		judgePositionsScope: z
			.enum(["all_rounds", "last_round"])
			.default("all_rounds"),
		contextTopology: z
			.enum(["full_history", "last_round", "last_round_with_self", "summary"])
			.default("last_round_with_self"),
		checkpointDir: z.string().nullable().default(null),
		timeouts: TimeoutConfigSchema.optional().default({
			modelMs: 120000,
			roundMs: 300000,
			sessionMs: 1200000,
		}),
		retries: RetryConfigSchema.optional().default({
			maxAttempts: 2,
			baseDelayMs: 1000,
			maxDelayMs: 8000,
		}),
		concurrency: ConcurrencyConfigSchema.optional().default({
			maxConcurrentRequests: 4,
		}),
		limits: LimitConfigSchema.optional().default({
			maxTokensPerResponse: 2048,
			maxTotalTokens: 200000,
			maxTotalCostUsd: 25,
			maxContextTokens: 12000,
		}),
		deterministicMode: z.boolean().default(false),
		allowExternalPaths: z.boolean().default(false),
	})
	.refine((data) => !data.judgePanelEnabled || data.judges.length >= 3, {
		message: "Judge panel requires at least 3 judges when enabled",
	});

export type DebateConfigInput = z.input<typeof DebateConfigSchema>;
export type DebateConfigOutput = z.output<typeof DebateConfigSchema>;

// === Checkpoint Schema ===

export const CheckpointSchema = z.object({
	version: z.literal("2.3.0"),
	engineVersion: z.string(),
	sessionId: z.string(),
	timestamp: z.string().datetime(),
	phase: z.enum([
		"init",
		"agent_debate",
		"judge_evaluation",
		"consensus_reached",
		"deadlock",
	]),
	config: DebateConfigSchema,
	configHash: z.string().length(64),
	agentRounds: z.array(RoundResultSchema),
	judgeRounds: z.array(JudgeRoundResultSchema).default([]),
	integrity: z.object({
		sha256: z.string().length(64),
		hmac: z.string().length(64).nullable(),
	}),
});

// === Output Schema ===

export const FinalVerdictSchema = z.object({
	positionId: z.string().length(12),
	positionText: z.string().max(4000),
	confidence: z.number().min(0).max(1),
	source: z.enum(["agent_consensus", "judge_consensus", "deadlock"]),
});

export const DebateOutputSchema = z.object({
	version: z.literal("2.3.0"),
	session: z.object({
		id: z.string(),
		topic: z.string(),
		initialQuery: z.string().nullable(),
		phase: z.enum([
			"init",
			"agent_debate",
			"judge_evaluation",
			"consensus_reached",
			"deadlock",
		]),
		startedAt: z.string().datetime(),
		completedAt: z.string().datetime().nullable(),
		totalTokens: z.number(),
		totalCostUsd: z.number(),
		pricingKnown: z.boolean(),
		engineVersion: z.string(),
		totalRetries: z.number(),
		totalErrors: z.number(),
	}),
	agentDebate: z.object({
		rounds: z.array(RoundResultSchema),
		finalPositionId: z.string().nullable(),
		finalPositionText: z.string().nullable(),
	}),
	judgePanel: z.object({
		enabled: z.boolean(),
		rounds: z.array(JudgeRoundResultSchema),
		final: z
			.object({
				consensusPositionId: z.string(),
				consensusPositionText: z.string(),
				consensusConfidence: z.number(),
				dissents: z.array(z.string()),
			})
			.nullable(),
	}),
	finalVerdict: FinalVerdictSchema,
});

// === Error Output Schema ===

export const ErrorOutputSchema = z.object({
	error: z.literal(true),
	code: z.string(),
	message: z.string(),
	details: z.record(z.string(), z.unknown()).optional(),
	sessionId: z.string().optional(),
	phase: z
		.enum([
			"init",
			"agent_debate",
			"judge_evaluation",
			"consensus_reached",
			"deadlock",
		])
		.optional(),
	partialOutput: DebateOutputSchema.partial().optional(),
});
