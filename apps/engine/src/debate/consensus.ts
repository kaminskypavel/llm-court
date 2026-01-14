/**
 * LLM Court - Consensus Detection
 */

import { DEFAULT_CONSENSUS_THRESHOLD } from "@llm-court/shared/constants";
import type {
	AgentResponse,
	ConsensusResult,
	PositionId,
	VoteTally,
} from "@llm-court/shared/types";

/**
 * Detect if agent consensus has been reached
 */
export const detectAgentConsensus = (
	responses: AgentResponse[],
	candidatePositionId: PositionId,
	threshold: number = DEFAULT_CONSENSUS_THRESHOLD,
): ConsensusResult => {
	const eligible = responses.filter((r) => r.status === "ok");

	// Count votes - yes votes must match the candidate position ID
	const yesVotes = eligible.filter(
		(r) => r.vote === "yes" && r.positionId === candidatePositionId,
	).length;
	const noVotes = eligible.filter((r) => r.vote === "no").length;
	const abstainVotes = eligible.filter((r) => r.vote === "abstain").length;

	const tally: VoteTally = {
		yes: yesVotes,
		no: noVotes,
		abstain: abstainVotes,
		total: responses.length,
		eligible: eligible.length,
		votingTotal: yesVotes + noVotes, // Exclude abstains from denominator
		supermajorityThreshold: 0,
		supermajorityReached: false,
	};

	// No consensus possible if no candidate or no voting participants
	if (candidatePositionId === null || tally.votingTotal === 0) {
		return {
			reached: false,
			positionId: null,
			positionText: null,
			voteTally: tally,
			method: "none",
		};
	}

	// Calculate supermajority threshold
	tally.supermajorityThreshold = Math.ceil(tally.votingTotal * threshold);

	// Check if yes votes meet threshold
	if (yesVotes >= tally.supermajorityThreshold) {
		// Find the position text from a yes voter
		const candidateText = eligible.find(
			(r) => r.vote === "yes" && r.positionId === candidatePositionId,
		)?.positionText;

		// Determine if unanimous or supermajority
		const isUnanimous = yesVotes === tally.votingTotal;

		return {
			reached: true,
			positionId: candidatePositionId,
			positionText: candidateText ?? null,
			voteTally: { ...tally, supermajorityReached: true },
			method: isUnanimous ? "unanimous" : "supermajority",
		};
	}

	return {
		reached: false,
		positionId: null,
		positionText: null,
		voteTally: tally,
		method: "none",
	};
};

/**
 * Position with support score for candidate selection
 */
export type PositionScore = {
	positionId: string;
	positionText: string;
	supportScore: number; // Sum of confidence
	supporterCount: number;
	avgConfidence: number;
};

/**
 * Select the next candidate position based on support scores
 * Uses SupportScore = Sum(Confidence) to favor broader support
 */
export const selectNextCandidate = (
	responses: AgentResponse[],
): PositionScore | null => {
	// Filter to responses with valid position IDs
	const eligible = responses.filter(
		(r): r is AgentResponse & { positionId: string } =>
			r.status === "ok" && r.vote !== "abstain" && r.positionId !== null,
	);

	if (eligible.length === 0) {
		return null;
	}

	// Group by position ID
	const byPosition = new Map<string, { text: string; confidences: number[] }>();

	for (const r of eligible) {
		const posId = r.positionId;
		const existing = byPosition.get(posId);

		if (existing) {
			existing.confidences.push(r.confidence);
		} else {
			byPosition.set(posId, {
				text: r.positionText,
				confidences: [r.confidence],
			});
		}
	}

	// Calculate scores
	const scores: PositionScore[] = [];

	for (const [positionId, data] of byPosition.entries()) {
		const supportScore = data.confidences.reduce((sum, c) => sum + c, 0);
		const supporterCount = data.confidences.length;
		const avgConfidence = supportScore / supporterCount;

		scores.push({
			positionId,
			positionText: data.text,
			supportScore,
			supporterCount,
			avgConfidence,
		});
	}

	// Sort by: supportScore DESC, supporterCount DESC, positionId ASC (deterministic)
	scores.sort((a, b) => {
		if (b.supportScore !== a.supportScore) {
			return b.supportScore - a.supportScore;
		}
		if (b.supporterCount !== a.supporterCount) {
			return b.supporterCount - a.supporterCount;
		}
		return a.positionId.localeCompare(b.positionId);
	});

	return scores[0] ?? null;
};
