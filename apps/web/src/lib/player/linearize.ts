/**
 * Debate Player - Linearization
 * Converts hierarchical DebateOutput to flat PlaybackStep[] timeline
 * Based on spec v2.5.0 section 5.1
 */

import type { DebateOutput, Vote } from "@llm-court/shared";
import { calculateStepDuration } from "./durations";
import type { PlaybackStep, StepTiming } from "./types";

/**
 * Convert agent response status from shared types to player types
 */
function mapStatus(status: "ok" | "error"): "success" | "error" {
	return status === "ok" ? "success" : "error";
}

/**
 * Linearize DebateOutput into PlaybackStep array
 *
 * Step generation rules:
 * - Each round yields ROUND_START → N AGENT_SPEAK → VOTE_TALLY → CONSENSUS_CHECK
 * - If judge panel enabled and consensus not reached: JUDGE_START → M JUDGE_EVALUATE → FINAL_VERDICT
 * - If consensus reached: skip judge steps and go to FINAL_VERDICT
 */
export function debateToSteps(debate: DebateOutput): PlaybackStep[] {
	const steps: PlaybackStep[] = [];

	// Process agent rounds
	for (const round of debate.agentDebate.rounds) {
		// ROUND_START
		steps.push({
			type: "ROUND_START",
			round: round.roundNumber,
			candidateText: round.candidatePositionText,
		});

		// AGENT_SPEAK for each response
		for (const response of round.responses) {
			steps.push({
				type: "AGENT_SPEAK",
				round: round.roundNumber,
				agentId: response.agentId,
				positionId: response.positionId,
				text: response.positionText || response.reasoning || "",
				vote: response.vote as Vote,
				confidence: response.confidence,
				status: mapStatus(response.status),
				error: response.error ?? undefined,
			});
		}

		// VOTE_TALLY
		steps.push({
			type: "VOTE_TALLY",
			round: round.roundNumber,
			tally: round.voteTally,
		});

		// CONSENSUS_CHECK
		steps.push({
			type: "CONSENSUS_CHECK",
			round: round.roundNumber,
			reached: round.consensusReached,
			positionText: round.consensusPositionText,
			positionId: round.consensusPositionId,
		});
	}

	// Process judge rounds if panel is enabled
	if (debate.judgePanel.enabled && debate.judgePanel.rounds.length > 0) {
		for (const judgeRound of debate.judgePanel.rounds) {
			// JUDGE_START
			steps.push({
				type: "JUDGE_START",
				round: judgeRound.roundNumber,
			});

			// JUDGE_EVALUATE for each evaluation
			for (const evaluation of judgeRound.evaluations) {
				steps.push({
					type: "JUDGE_EVALUATE",
					round: judgeRound.roundNumber,
					judgeId: evaluation.judgeId,
					selectedPositionId: evaluation.selectedPositionId,
					confidence: evaluation.confidence,
					text: evaluation.reasoning || "",
					status: mapStatus(evaluation.status),
					error: evaluation.error ?? undefined,
				});
			}
		}
	}

	// FINAL_VERDICT
	steps.push({
		type: "FINAL_VERDICT",
		positionText: debate.finalVerdict.positionText || null,
		positionId: debate.finalVerdict.positionId || null,
		source: debate.finalVerdict.source,
		confidence: debate.finalVerdict.confidence,
	});

	return steps;
}

/**
 * Compute timing information for each step
 */
export function computeStepTimings(steps: PlaybackStep[]): StepTiming[] {
	let currentMs = 0;

	return steps.map((step) => {
		const durationMs = calculateStepDuration(step);
		const timing: StepTiming = {
			step,
			startMs: currentMs,
			durationMs,
		};
		currentMs += durationMs;
		return timing;
	});
}

/**
 * Get total duration from step timings
 */
export function getTotalDuration(timings: StepTiming[]): number {
	if (timings.length === 0) return 0;
	const last = timings[timings.length - 1];
	return last.startMs + last.durationMs;
}

/**
 * Find step index at a given time (binary search)
 */
export function getStepIndexAtTime(
	timings: StepTiming[],
	timeMs: number,
): number {
	if (timings.length === 0) return 0;

	// Binary search for the step containing timeMs
	let low = 0;
	let high = timings.length - 1;

	while (low < high) {
		const mid = Math.floor((low + high + 1) / 2);
		if (timings[mid].startMs <= timeMs) {
			low = mid;
		} else {
			high = mid - 1;
		}
	}

	return low;
}

/**
 * Get the current step at a given time
 */
export function getCurrentStep(
	timings: StepTiming[],
	timeMs: number,
): StepTiming | null {
	if (timings.length === 0) return null;
	const index = getStepIndexAtTime(timings, timeMs);
	return timings[index];
}

/**
 * Get progress within current step (0-1)
 */
export function getStepProgress(timing: StepTiming, timeMs: number): number {
	const elapsed = timeMs - timing.startMs;
	return Math.min(1, Math.max(0, elapsed / timing.durationMs));
}
