/**
 * Debate Player - Duration Calculations
 * Based on spec v2.5.0 section 5.2
 */

import type { PlaybackStep } from "./types";

// Duration constants (milliseconds)
export const MIN_DURATION_MS = 1500;
export const MAX_DURATION_MS = 12000;
export const MS_PER_CHAR = 20; // ~250 WPM at 5 chars/word

/**
 * Clamp duration to valid range
 */
export function clampDuration(ms: number): number {
	return Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, ms));
}

/**
 * Base durations for each step type
 */
export const DURATIONS = {
	ROUND_START: 2000,
	VOTE_TALLY: 3000,
	CONSENSUS_CHECK: 2500,
	JUDGE_START: 1500,
	FINAL_VERDICT: 4000,
} as const;

/**
 * Calculate duration for text-based steps
 */
function textDuration(baseMs: number, charCount: number): number {
	return clampDuration(baseMs + charCount * MS_PER_CHAR);
}

/**
 * Calculate duration for a playback step
 */
export function calculateStepDuration(step: PlaybackStep): number {
	switch (step.type) {
		case "ROUND_START":
			return DURATIONS.ROUND_START;

		case "AGENT_SPEAK": {
			const charCount = step.text.length;
			return textDuration(2000, charCount);
		}

		case "VOTE_TALLY":
			return DURATIONS.VOTE_TALLY;

		case "CONSENSUS_CHECK":
			return DURATIONS.CONSENSUS_CHECK;

		case "JUDGE_START":
			return DURATIONS.JUDGE_START;

		case "JUDGE_EVALUATE": {
			const charCount = step.text.length;
			return textDuration(1500, charCount);
		}

		case "FINAL_VERDICT":
			return DURATIONS.FINAL_VERDICT;

		default:
			return MIN_DURATION_MS;
	}
}

/**
 * Format milliseconds as mm:ss
 */
export function formatTime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Format milliseconds as mm:ss.ms
 */
export function formatTimeWithMs(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	const millis = ms % 1000;
	return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}
