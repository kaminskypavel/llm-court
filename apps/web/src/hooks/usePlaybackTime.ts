"use client";

/**
 * usePlaybackTime - High-frequency time access for smooth scrubber updates
 * Uses RAF to read from timeRef without causing React re-renders at 60fps
 * Based on spec v2.5.0 section 7.2
 */

import { useEffect, useReducer, useRef } from "react";
import type { TimeRef } from "@/lib/player/types";

/**
 * Subscribe to playback time at 60fps for smooth UI updates
 * Only triggers React re-renders when subscribed, not on every tick
 */
export function usePlaybackTime(
	timeRef: React.MutableRefObject<TimeRef>,
	isPlaying: boolean,
): number {
	const [, forceUpdate] = useReducer((x) => x + 1, 0);
	const rafIdRef = useRef<number | null>(null);

	useEffect(() => {
		if (!isPlaying) {
			// When paused, just return current value without RAF
			return;
		}

		const tick = () => {
			forceUpdate();
			rafIdRef.current = requestAnimationFrame(tick);
		};

		rafIdRef.current = requestAnimationFrame(tick);

		return () => {
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
		};
	}, [isPlaying]);

	return timeRef.current.currentTimeMs;
}

/**
 * Lower frequency time subscription (e.g., every 100ms instead of 60fps)
 * Useful for less critical UI elements that don't need 60fps
 */
export function usePlaybackTimeThrottled(
	timeRef: React.MutableRefObject<TimeRef>,
	isPlaying: boolean,
	intervalMs = 100,
): number {
	const [, forceUpdate] = useReducer((x) => x + 1, 0);

	useEffect(() => {
		if (!isPlaying) {
			return;
		}

		const intervalId = setInterval(() => {
			forceUpdate();
		}, intervalMs);

		return () => {
			clearInterval(intervalId);
		};
	}, [isPlaying, intervalMs]);

	return timeRef.current.currentTimeMs;
}

/**
 * Get current time as percentage (0-100)
 */
export function usePlaybackProgress(
	timeRef: React.MutableRefObject<TimeRef>,
	totalDurationMs: number,
	isPlaying: boolean,
): number {
	const currentTimeMs = usePlaybackTime(timeRef, isPlaying);

	if (totalDurationMs === 0) return 0;
	return Math.min(100, (currentTimeMs / totalDurationMs) * 100);
}
