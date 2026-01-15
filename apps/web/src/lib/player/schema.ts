/**
 * Debate Player - Zod Schema Validation
 * Extended validation for player-specific constraints
 * Based on spec v2.5.0 section 5.3
 */

import { z } from "zod";

// Vote and verdict source enums
export const VoteSchema = z.enum(["yes", "no", "abstain"]);
export const VerdictSourceSchema = z.enum([
	"agent_consensus",
	"judge_consensus",
	"deadlock",
]);

// Token usage
const TokenUsageSchema = z.object({
	prompt: z.number().int().nonnegative(),
	completion: z.number().int().nonnegative(),
	total: z.number().int().nonnegative(),
	estimated: z.boolean(),
});

// Agent response
const AgentResponseSchema = z.object({
	agentId: z.string().min(1).max(100),
	round: z.number().int().positive(),
	positionId: z.string().nullable(),
	positionText: z.string().max(10000),
	reasoning: z.string().max(50000),
	vote: VoteSchema,
	confidence: z.number().min(0).max(1),
	tokenUsage: TokenUsageSchema,
	latencyMs: z.number().int().nonnegative(),
	status: z.enum(["ok", "error"]),
	error: z.string().max(1000).nullable(),
});

// Vote tally
const VoteTallySchema = z.object({
	yes: z.number().int().nonnegative(),
	no: z.number().int().nonnegative(),
	abstain: z.number().int().nonnegative(),
	total: z.number().int().nonnegative(),
	eligible: z.number().int().nonnegative(),
	votingTotal: z.number().int().nonnegative(),
	supermajorityThreshold: z.number().min(0).max(1),
	supermajorityReached: z.boolean(),
});

// Round result
const RoundResultSchema = z.object({
	roundNumber: z.number().int().positive(),
	candidatePositionId: z.string().nullable(),
	candidatePositionText: z.string().max(10000).nullable(),
	responses: z.array(AgentResponseSchema).min(1).max(20),
	consensusReached: z.boolean(),
	consensusPositionId: z.string().nullable(),
	consensusPositionText: z.string().max(10000).nullable(),
	voteTally: VoteTallySchema,
	timestamp: z.string().datetime(),
});

// Judge evaluation
const JudgeEvaluationSchema = z.object({
	judgeId: z.string().min(1).max(100),
	round: z.number().int().positive(),
	selectedPositionId: z.string().nullable(),
	scoresByPositionId: z.record(z.string(), z.number()).optional(),
	reasoning: z.string().max(20000).optional(),
	confidence: z.number().min(0).max(1),
	tokenUsage: TokenUsageSchema.optional(),
	latencyMs: z.number().int().nonnegative().optional(),
	status: z.enum(["ok", "error"]),
	error: z.string().max(1000).nullable(),
});

// Judge round
const JudgeRoundResultSchema = z.object({
	roundNumber: z.number().int().positive(),
	positionIds: z.array(z.string()).optional(),
	evaluations: z.array(JudgeEvaluationSchema).min(1).max(20),
	consensusReached: z.boolean().optional(),
	consensusPositionId: z.string().nullable().optional(),
	avgConfidence: z.number().min(0).max(1).optional(),
	timestamp: z.string().datetime(),
});

// Final verdict
const FinalVerdictSchema = z.object({
	positionId: z.string().nullable(),
	positionText: z.string().max(10000).nullable(),
	confidence: z.number().min(0).max(1),
	source: VerdictSourceSchema,
});

/**
 * Main DebateOutput schema with comprehensive validation
 */
export const DebateOutputSchema = z
	.object({
		version: z.string().regex(/^\d+\.\d+\.\d+$/),
		session: z.object({
			id: z.string().uuid(),
			topic: z.string().min(1).max(1000),
			initialQuery: z.string().max(5000).nullable().optional(),
			phase: z.enum([
				"init",
				"agent_debate",
				"judge_evaluation",
				"consensus_reached",
				"deadlock",
			]),
			startedAt: z.string().datetime(),
			completedAt: z.string().datetime().nullable(),
			totalTokens: z.number().int().nonnegative(),
			totalCostUsd: z.number().nonnegative(),
			pricingKnown: z.boolean(),
			engineVersion: z.string().max(50),
			totalRetries: z.number().int().nonnegative(),
			totalErrors: z.number().int().nonnegative(),
		}),
		agentDebate: z.object({
			rounds: z.array(RoundResultSchema).min(1).max(50),
			finalPositionId: z.string().nullable(),
			finalPositionText: z.string().max(10000).nullable(),
		}),
		judgePanel: z.object({
			enabled: z.boolean(),
			rounds: z.array(JudgeRoundResultSchema).max(50),
			final: z
				.object({
					consensusPositionId: z.string(),
					consensusPositionText: z.string(),
					consensusConfidence: z.number().min(0).max(1),
					dissents: z.array(z.string()),
				})
				.nullable(),
		}),
		finalVerdict: FinalVerdictSchema,
	})
	.superRefine((data, ctx) => {
		// Deadlock validation
		if (data.finalVerdict.source === "deadlock") {
			if (
				data.finalVerdict.positionId &&
				data.finalVerdict.positionId.trim() !== ""
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Deadlock verdict should not have positionId",
					path: ["finalVerdict", "positionId"],
				});
			}
		} else {
			// Non-deadlock: positionId is required
			if (
				!data.finalVerdict.positionId ||
				data.finalVerdict.positionId.trim() === ""
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Non-deadlock verdict must have positionId",
					path: ["finalVerdict", "positionId"],
				});
			}
		}

		// Round ordering
		const rounds = data.agentDebate.rounds;
		for (let i = 1; i < rounds.length; i++) {
			if (rounds[i].roundNumber <= rounds[i - 1].roundNumber) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Round numbers must be strictly increasing",
					path: ["agentDebate", "rounds", i, "roundNumber"],
				});
				break;
			}
		}

		// Unique agent per round and round match
		for (let i = 0; i < rounds.length; i++) {
			const round = rounds[i];
			const seen = new Set<string>();
			for (const resp of round.responses) {
				if (resp.round !== round.roundNumber) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Response round mismatch",
						path: ["agentDebate", "rounds", i, "responses"],
					});
				}
				if (seen.has(resp.agentId)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Duplicate agentId in round",
						path: ["agentDebate", "rounds", i, "responses"],
					});
				}
				seen.add(resp.agentId);
			}
		}

		// Vote tally invariants
		for (let i = 0; i < rounds.length; i++) {
			const t = rounds[i].voteTally;
			if (t.total !== t.yes + t.no + t.abstain) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Vote tally total mismatch",
					path: ["agentDebate", "rounds", i, "voteTally", "total"],
				});
			}
			if (t.votingTotal > t.eligible) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "votingTotal cannot exceed eligible",
					path: ["agentDebate", "rounds", i, "voteTally", "votingTotal"],
				});
			}
		}

		// Token usage invariant
		for (let i = 0; i < rounds.length; i++) {
			for (const resp of rounds[i].responses) {
				if (
					resp.tokenUsage.total <
					resp.tokenUsage.prompt + resp.tokenUsage.completion
				) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Token usage total too small",
						path: ["agentDebate", "rounds", i, "responses"],
					});
				}
			}
		}

		// Session time ordering
		if (data.session.completedAt) {
			if (
				new Date(data.session.completedAt) < new Date(data.session.startedAt)
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "completedAt must be >= startedAt",
					path: ["session", "completedAt"],
				});
			}
		}

		// Judge panel consistency
		if (data.judgePanel.enabled && data.judgePanel.rounds.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Enabled judge panel must have at least one round",
				path: ["judgePanel", "rounds"],
			});
		}

		// Judge consensus requires final judge
		if (
			data.finalVerdict.source === "judge_consensus" &&
			!data.judgePanel.final
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Judge consensus verdict requires judgePanel.final",
				path: ["judgePanel", "final"],
			});
		}
	});

export type ValidatedDebateOutput = z.infer<typeof DebateOutputSchema>;
