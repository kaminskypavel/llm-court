/**
 * LLM Court - Judge Consensus Detection
 */

import {
	DEFAULT_JUDGE_CONSENSUS_THRESHOLD,
	DEFAULT_JUDGE_MIN_CONFIDENCE,
} from "@llm-court/shared/constants";
import type {
	JudgeConsensusResult,
	JudgeEvaluation,
} from "@llm-court/shared/types";

/**
 * Detect if judge consensus has been reached
 *
 * Consensus requires:
 * 1. Majority of judges agree on a position (>= threshold)
 * 2. Average confidence of agreeing judges >= minConfidence
 */
export const detectJudgeConsensus = (
	evaluations: JudgeEvaluation[],
	positions: Map<string, string>,
	majorityThreshold: number = DEFAULT_JUDGE_CONSENSUS_THRESHOLD,
	minConfidence: number = DEFAULT_JUDGE_MIN_CONFIDENCE,
): JudgeConsensusResult => {
	const eligible = evaluations.filter(
		(e): e is JudgeEvaluation & { selectedPositionId: string } =>
			e.status === "ok" && e.selectedPositionId !== null,
	);

	if (eligible.length === 0) {
		return {
			reached: false,
			positionId: null,
			positionText: null,
			confidence: 0,
			dissents: [],
		};
	}

	const requiredVotes = Math.ceil(eligible.length * majorityThreshold);

	// Count votes per position
	const votes = new Map<string, number>();
	for (const e of eligible) {
		const posId = e.selectedPositionId;
		votes.set(posId, (votes.get(posId) ?? 0) + 1);
	}

	// Find winner with deterministic tie-breaking
	// Sort by positionId for determinism before finding winner
	const sortedVotes = Array.from(votes.entries()).sort((a, b) =>
		a[0].localeCompare(b[0]),
	);

	let winnerId: string | null = null;
	let maxVotes = 0;

	for (const [id, count] of sortedVotes) {
		if (count > maxVotes) {
			maxVotes = count;
			winnerId = id;
		}
	}

	// Handle ties by average confidence
	const tiedPositions = sortedVotes.filter(([_, count]) => count === maxVotes);

	if (tiedPositions.length > 1) {
		let bestAvgConf = -1;

		// Iterate in sorted order for determinism
		for (const [posId] of tiedPositions) {
			const evals = eligible.filter((e) => e.selectedPositionId === posId);
			const avgConf =
				evals.reduce((sum, e) => sum + e.confidence, 0) / evals.length;

			if (avgConf > bestAvgConf) {
				bestAvgConf = avgConf;
				winnerId = posId;
			}
		}
	}

	// Check if majority threshold met
	if (!winnerId || maxVotes < requiredVotes) {
		return {
			reached: false,
			positionId: winnerId,
			positionText: winnerId ? (positions.get(winnerId) ?? null) : null,
			confidence: 0,
			dissents: eligible.map((e) => e.judgeId),
		};
	}

	// Calculate average confidence of winning judges
	const winningEvals = eligible.filter(
		(e) => e.selectedPositionId === winnerId,
	);
	const avgConfidence =
		winningEvals.reduce((sum, e) => sum + e.confidence, 0) /
		winningEvals.length;

	// Check confidence threshold
	if (avgConfidence < minConfidence) {
		return {
			reached: false,
			positionId: winnerId,
			positionText: positions.get(winnerId) ?? null,
			confidence: avgConfidence,
			dissents: eligible
				.filter((e) => e.selectedPositionId !== winnerId)
				.map((e) => e.judgeId),
		};
	}

	// Consensus reached!
	return {
		reached: true,
		positionId: winnerId,
		positionText: positions.get(winnerId) ?? null,
		confidence: avgConfidence,
		dissents: eligible
			.filter((e) => e.selectedPositionId !== winnerId)
			.map((e) => e.judgeId),
	};
};
