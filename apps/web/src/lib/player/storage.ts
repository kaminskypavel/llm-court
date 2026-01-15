/**
 * Debate Player - localStorage Management
 * Handles recent debates list
 * Based on spec v2.5.0 section 4.3, 8.3
 */

import type { ValidatedDebateOutput } from "./schema";
import type { RecentDebate } from "./types";

const RECENT_KEY = "llm-court-recent-debates";
const MAX_RECENT = 5;

/**
 * Get list of recent debates from localStorage
 */
export function getRecentDebates(): RecentDebate[] {
	if (typeof window === "undefined") return [];

	try {
		const stored = localStorage.getItem(RECENT_KEY);
		if (!stored) return [];

		const parsed = JSON.parse(stored);
		if (!Array.isArray(parsed)) return [];

		// Validate each entry has required fields
		return parsed.filter(
			(item): item is RecentDebate =>
				typeof item === "object" &&
				item !== null &&
				typeof item.id === "string" &&
				typeof item.topic === "string" &&
				typeof item.loadedAt === "string" &&
				(item.source === "file" || item.source === "url") &&
				typeof item.sourceName === "string",
		);
	} catch {
		return [];
	}
}

/**
 * Save a debate to the recent list
 */
export function saveToRecent(
	debate: ValidatedDebateOutput,
	source: "file" | "url",
	sourceName: string,
): void {
	if (typeof window === "undefined") return;

	const recent = getRecentDebates();

	const entry: RecentDebate = {
		id: debate.session.id,
		topic: debate.session.topic,
		loadedAt: new Date().toISOString(),
		source,
		sourceName,
	};

	// Remove existing entry with same ID and add new one at front
	const filtered = recent.filter((r) => r.id !== entry.id);
	const updated = [entry, ...filtered].slice(0, MAX_RECENT);

	try {
		localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
	} catch {
		// Storage quota exceeded - prune and retry
		try {
			const pruned = updated.slice(0, 3);
			localStorage.setItem(RECENT_KEY, JSON.stringify(pruned));
		} catch {
			// Still failing, give up silently
		}
	}
}

/**
 * Remove a debate from the recent list
 */
export function removeFromRecent(id: string): void {
	if (typeof window === "undefined") return;

	const recent = getRecentDebates();
	const filtered = recent.filter((r) => r.id !== id);

	try {
		localStorage.setItem(RECENT_KEY, JSON.stringify(filtered));
	} catch {
		// Ignore storage errors
	}
}

/**
 * Clear all recent debates
 */
export function clearRecentDebates(): void {
	if (typeof window === "undefined") return;

	try {
		localStorage.removeItem(RECENT_KEY);
	} catch {
		// Ignore storage errors
	}
}
