/**
 * Debate Player - Type Definitions
 * Based on spec v2.5.0
 */

import type { VoteTally, Vote as VoteType } from "@llm-court/shared";

// Re-export for convenience
export type { VoteTally };

export type Vote = VoteType;
export type VerdictSource = "agent_consensus" | "judge_consensus" | "deadlock";
export type StepStatus = "success" | "error";

/**
 * Linearized playback step - atomic event for timeline playback
 */
export type PlaybackStep =
	| {
			type: "ROUND_START";
			round: number;
			candidateText: string | null;
	  }
	| {
			type: "AGENT_SPEAK";
			round: number;
			agentId: string;
			positionId: string | null;
			text: string;
			vote: Vote;
			confidence: number;
			status: StepStatus;
			error?: string;
	  }
	| {
			type: "VOTE_TALLY";
			round: number;
			tally: VoteTally;
	  }
	| {
			type: "CONSENSUS_CHECK";
			round: number;
			reached: boolean;
			positionText: string | null;
			positionId: string | null;
	  }
	| {
			type: "JUDGE_START";
			round: number;
	  }
	| {
			type: "JUDGE_EVALUATE";
			round: number;
			judgeId: string;
			selectedPositionId: string | null;
			confidence: number;
			text: string;
			status: StepStatus;
			error?: string;
	  }
	| {
			type: "FINAL_VERDICT";
			positionText: string | null;
			positionId: string | null;
			source: VerdictSource;
			confidence: number;
	  };

/**
 * Step with computed timing information
 */
export type StepTiming = {
	step: PlaybackStep;
	startMs: number; // Integer milliseconds from debate start
	durationMs: number; // Integer duration
};

/**
 * Mutable ref for high-frequency time updates (60fps)
 * Updated by clock actor, read by canvas/scrubber
 */
export type TimeRef = {
	currentTimeMs: number;
};

/**
 * Mutable ref for playback speed
 * Allows dynamic speed changes without recreating clock actor
 */
export type SpeedRef = {
	currentSpeed: number;
};

/**
 * Input for XState machine initialization
 */
export type PlayerInput = {
	timeRef: React.MutableRefObject<TimeRef>;
	speedRef: React.MutableRefObject<SpeedRef>;
};

/**
 * Error codes for data loading
 */
export const LoadErrorCode = {
	URL_INVALID: "ERR_URL_INVALID",
	URL_PROTOCOL: "ERR_URL_PROTOCOL",
	URL_TOO_LONG: "ERR_URL_TOO_LONG",
	FETCH_FAILED: "ERR_FETCH_FAILED",
	FETCH_TIMEOUT: "ERR_FETCH_TIMEOUT",
	RESPONSE_TOO_LARGE: "ERR_RESPONSE_TOO_LARGE",
	FILE_TOO_LARGE: "ERR_FILE_TOO_LARGE",
	FILE_TYPE: "ERR_FILE_TYPE",
	JSON_INVALID: "ERR_JSON_INVALID",
	SCHEMA_INVALID: "ERR_SCHEMA_INVALID",
	STORAGE_QUOTA: "ERR_STORAGE_QUOTA",
} as const;

export type LoadErrorCode = (typeof LoadErrorCode)[keyof typeof LoadErrorCode];

/**
 * Structured error for data loading operations
 */
export type LoadError = {
	code: LoadErrorCode;
	message: string;
	detail?: string;
	source: "url" | "file" | "storage";
};

/**
 * Recent debate entry for localStorage
 */
export type RecentDebate = {
	id: string;
	topic: string;
	loadedAt: string; // ISO-8601
	source: "file" | "url";
	sourceName: string;
};

/**
 * Render frame for canvas - pure function output
 */
export type SpriteState = "idle" | "speaking" | "highlighted" | "error";

export type RenderSprite = {
	id: string;
	x: number;
	y: number;
	state: SpriteState;
	z: number;
};

export type RenderBubble = {
	id: string;
	text: string;
	x: number;
	y: number;
	kind: "speech" | "error";
};

export type RenderFrame = {
	sprites: RenderSprite[];
	bubbles: RenderBubble[];
	highlights: {
		agentId?: string;
		round?: number;
	};
};
