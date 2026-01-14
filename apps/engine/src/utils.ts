/**
 * LLM Court - Utility Functions
 */

import { createHash, createHmac } from "node:crypto";
import { POSITION_ID_LENGTH } from "@llm-court/shared/constants";
import { v7 as uuidv7 } from "uuid";

/**
 * Generate a deterministic position ID from text
 * Uses SHA-256 hash of normalized text, truncated to 12 characters
 */
export const generatePositionId = (text: string): string => {
	const normalized = text.trim().replace(/\s+/g, " ").toLowerCase();
	return createHash("sha256")
		.update(normalized)
		.digest("hex")
		.slice(0, POSITION_ID_LENGTH);
};

/**
 * Generate a session ID using UUIDv7 (time-ordered)
 */
export const generateSessionId = (): string => {
	return uuidv7();
};

/**
 * Calculate SHA-256 hash of data
 */
export const sha256 = (data: string): string => {
	return createHash("sha256").update(data).digest("hex");
};

/**
 * Calculate HMAC-SHA256
 */
export const hmacSha256 = (data: string, key: string): string => {
	return createHmac("sha256", key).update(data).digest("hex");
};

/**
 * Canonicalize JSON for deterministic hashing
 * Sorts object keys alphabetically
 */
export const canonicalizeJson = (obj: unknown): string => {
	return JSON.stringify(obj, (_, value) => {
		if (value && typeof value === "object" && !Array.isArray(value)) {
			return Object.keys(value)
				.sort()
				.reduce(
					(sorted, key) => {
						sorted[key] = value[key];
						return sorted;
					},
					{} as Record<string, unknown>,
				);
		}
		return value;
	});
};

/**
 * Sleep for specified milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Calculate exponential backoff delay with jitter
 */
export const calculateBackoff = (
	attempt: number,
	baseDelayMs: number,
	maxDelayMs: number,
	withJitter = true,
): number => {
	const exponentialDelay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
	if (!withJitter) {
		return exponentialDelay;
	}
	// Add jitter: 50-100% of calculated delay
	return exponentialDelay * (0.5 + Math.random() * 0.5);
};

/**
 * Estimate token count (rough approximation)
 * ~4 characters per token for English text
 */
export const estimateTokenCount = (text: string): number => {
	return Math.ceil(text.length / 4);
};

/**
 * Truncate text to fit within token budget
 */
export const truncateToTokenBudget = (
	text: string,
	maxTokens: number,
): string => {
	const maxChars = maxTokens * 4;
	if (text.length <= maxChars) {
		return text;
	}
	return `${text.slice(0, maxChars - 3)}...`;
};

/**
 * Format milliseconds as human-readable duration
 */
export const formatDuration = (ms: number): string => {
	if (ms < 1000) {
		return `${ms}ms`;
	}
	if (ms < 60000) {
		return `${(ms / 1000).toFixed(1)}s`;
	}
	const minutes = Math.floor(ms / 60000);
	const seconds = ((ms % 60000) / 1000).toFixed(0);
	return `${minutes}m ${seconds}s`;
};

/**
 * Format cost as USD string
 */
export const formatCost = (usd: number): string => {
	if (usd < 0.01) {
		return `$${usd.toFixed(4)}`;
	}
	return `$${usd.toFixed(2)}`;
};

/**
 * Create error response for agent
 */
export const createErrorAgentResponse = (
	agentId: string,
	round: number,
	error: string,
): {
	agentId: string;
	round: number;
	positionId: null;
	positionText: string;
	reasoning: string;
	vote: "abstain";
	confidence: number;
	tokenUsage: {
		prompt: number;
		completion: number;
		total: number;
		estimated: boolean;
	};
	latencyMs: number;
	status: "error";
	error: string;
} => ({
	agentId,
	round,
	positionId: null,
	positionText: "",
	reasoning: "",
	vote: "abstain",
	confidence: 0,
	tokenUsage: { prompt: 0, completion: 0, total: 0, estimated: true },
	latencyMs: 0,
	status: "error",
	error,
});

/**
 * Create error response for judge
 */
export const createErrorJudgeResponse = (
	judgeId: string,
	round: number,
	error: string,
): {
	judgeId: string;
	round: number;
	selectedPositionId: null;
	scoresByPositionId: Record<string, number>;
	reasoning: string;
	confidence: number;
	tokenUsage: {
		prompt: number;
		completion: number;
		total: number;
		estimated: boolean;
	};
	latencyMs: number;
	status: "error";
	error: string;
} => ({
	judgeId,
	round,
	selectedPositionId: null,
	scoresByPositionId: {},
	reasoning: "",
	confidence: 0,
	tokenUsage: { prompt: 0, completion: 0, total: 0, estimated: true },
	latencyMs: 0,
	status: "error",
	error,
});

/**
 * Check if position IDs match (handles null cases)
 */
export const positionIdsMatch = (
	a: string | null | undefined,
	b: string | null | undefined,
): boolean => {
	if (a === null || a === undefined || b === null || b === undefined) {
		return false;
	}
	return a === b;
};
