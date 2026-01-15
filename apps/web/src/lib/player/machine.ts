/**
 * Debate Player - XState State Machine
 * Core playback state management with clock callback actor
 * Based on spec v2.5.0 section 6
 */

import type { DebateOutput } from "@llm-court/shared";
import { assign, fromCallback, fromPromise, setup } from "xstate";
import {
	computeStepTimings,
	debateToSteps,
	getTotalDuration,
} from "./linearize";
import { DebateOutputSchema, type ValidatedDebateOutput } from "./schema";
import type { PlayerInput, SpeedRef, StepTiming, TimeRef } from "./types";

// === Context Type ===

export type PlayerContext = {
	debate: ValidatedDebateOutput | null;
	steps: StepTiming[];
	currentStepIndex: number;
	currentTimeMs: number; // Accurate when paused/stopped; see timeRef during playback
	playbackSpeed: number;
	selectedAgentId: string | null;
	error: string | null;
	totalDurationMs: number;
	// Refs stored in context for clock actor access
	timeRef: React.MutableRefObject<TimeRef> | null;
	speedRef: React.MutableRefObject<SpeedRef> | null;
};

// === Event Types ===

export type PlayerEvent =
	| { type: "LOAD"; data: unknown }
	| { type: "LOAD_SUCCESS"; debate: ValidatedDebateOutput; steps: StepTiming[] }
	| { type: "LOAD_ERROR"; error: string }
	| { type: "PLAY" }
	| { type: "PAUSE" }
	| { type: "SEEK"; timeMs: number }
	| { type: "SYNC_TIME"; timeMs: number }
	| { type: "STEP_CHANGED"; index: number }
	| { type: "SET_SPEED"; speed: number }
	| { type: "SELECT_AGENT"; agentId: string | null }
	| { type: "PLAYBACK_END" }
	| { type: "RESET" };

// === Clock Actor ===

type ClockInput = {
	steps: StepTiming[];
	speedRef: SpeedRef;
	timeRef: TimeRef;
	totalDurationMs: number;
};

type ClockEvent =
	| { type: "STEP_CHANGED"; index: number }
	| { type: "PLAYBACK_END" }
	| { type: "SYNC_TIME"; timeMs: number };

/**
 * Clock as Callback Actor - XState v5 idiomatic pattern
 * Updates timeRef at 60fps and emits STEP_CHANGED when step boundary crossed
 * CRITICAL: Uses SpeedRef for dynamic speed changes (avoids stale closure bug)
 */
const clockActor = fromCallback<ClockEvent, ClockInput>(
	({ sendBack, input }) => {
		const { steps, speedRef, timeRef, totalDurationMs } = input;

		let lastStepIndex = 0;
		let lastFrameTime = performance.now();
		let rafId: number | null = null;

		// Find step index at a given time
		const findStepIndex = (timeMs: number): number => {
			for (let i = steps.length - 1; i >= 0; i--) {
				if (timeMs >= steps[i].startMs) return i;
			}
			return 0;
		};

		// Initialize lastStepIndex from current time
		lastStepIndex = findStepIndex(timeRef.currentTimeMs);

		const loop = (now: number) => {
			const delta = now - lastFrameTime;
			lastFrameTime = now;

			// Read speed dynamically from ref (not captured at invoke time)
			const speed = speedRef.currentSpeed;
			const currentTimeMs = Math.min(
				timeRef.currentTimeMs + Math.round(delta * speed),
				totalDurationMs,
			);

			// 1. Update shared ref (high frequency, no React re-renders)
			timeRef.currentTimeMs = currentTimeMs;

			// 2. Check for step change (low frequency)
			const newStepIndex = findStepIndex(currentTimeMs);
			if (newStepIndex !== lastStepIndex) {
				lastStepIndex = newStepIndex;
				sendBack({ type: "STEP_CHANGED", index: newStepIndex });
			}

			// 3. Check for end
			if (currentTimeMs >= totalDurationMs) {
				sendBack({ type: "PLAYBACK_END" });
				return;
			}

			rafId = requestAnimationFrame(loop);
		};

		rafId = requestAnimationFrame(loop);

		// Cleanup on actor stop - CRITICAL: sync final time back to context
		return () => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}
			sendBack({ type: "SYNC_TIME", timeMs: timeRef.currentTimeMs });
		};
	},
);

// === Validation Actor ===

const validateAndPrepareActor = fromPromise<
	{ debate: ValidatedDebateOutput; steps: StepTiming[] },
	unknown
>(async ({ input }) => {
	const debate = DebateOutputSchema.parse(input);
	const rawSteps = debateToSteps(debate as DebateOutput);
	const steps = computeStepTimings(rawSteps);
	return { debate, steps };
});

// === Helper Functions ===

function calculateStepIndex(steps: StepTiming[], timeMs: number): number {
	for (let i = steps.length - 1; i >= 0; i--) {
		if (timeMs >= steps[i].startMs) return i;
	}
	return 0;
}

// === State Machine ===

export const playerMachine = setup({
	types: {
		context: {} as PlayerContext,
		events: {} as PlayerEvent,
		input: {} as PlayerInput | undefined,
	},
	actors: {
		clock: clockActor,
		validateAndPrepare: validateAndPrepareActor,
	},
	guards: {
		hasSteps: ({ context }) => context.steps.length > 0,
		isAtEnd: ({ context }) => context.currentTimeMs >= context.totalDurationMs,
	},
	actions: {
		assignStepIndex: assign(({ event }) => {
			const e = event as { type: "STEP_CHANGED"; index: number };
			return {
				currentStepIndex: e.index,
			};
		}),
		assignTime: assign(({ event }) => {
			const e = event as { type: "SYNC_TIME"; timeMs: number };
			return {
				currentTimeMs: e.timeMs,
			};
		}),
		assignTimeAndStep: assign(({ context, event }) => {
			const e = event as { type: "SEEK"; timeMs: number };
			const clampedTime = Math.max(
				0,
				Math.min(e.timeMs, context.totalDurationMs),
			);
			return {
				currentTimeMs: clampedTime,
				currentStepIndex: calculateStepIndex(context.steps, clampedTime),
			};
		}),
		assignSpeed: assign(({ event }) => {
			const e = event as { type: "SET_SPEED"; speed: number };
			return {
				playbackSpeed: e.speed,
			};
		}),
		assignSelectedAgent: assign(({ event }) => {
			const e = event as { type: "SELECT_AGENT"; agentId: string | null };
			return {
				selectedAgentId: e.agentId,
			};
		}),
		resetContext: assign(({ context }) => ({
			debate: null,
			steps: [],
			currentStepIndex: 0,
			currentTimeMs: 0,
			totalDurationMs: 0,
			error: null,
			// Preserve refs on reset
			timeRef: context.timeRef,
			speedRef: context.speedRef,
		})),
		// Ref sync actions - update mutable refs for clock actor
		updateSpeedRef: ({ context }) => {
			if (context.speedRef) {
				context.speedRef.current.currentSpeed = context.playbackSpeed;
			}
		},
		updateTimeRef: ({ context, event }) => {
			if (context.timeRef) {
				const e = event as { type: "SEEK"; timeMs: number };
				context.timeRef.current.currentTimeMs = Math.max(
					0,
					Math.min(e.timeMs, context.totalDurationMs),
				);
			}
		},
		syncTimeRefFromContext: ({ context }) => {
			if (context.timeRef) {
				context.timeRef.current.currentTimeMs = context.currentTimeMs;
			}
		},
	},
}).createMachine({
	id: "player",
	initial: "empty",
	context: ({ input }) => ({
		debate: null,
		steps: [],
		currentStepIndex: 0,
		currentTimeMs: 0,
		playbackSpeed: 1,
		selectedAgentId: null,
		error: null,
		totalDurationMs: 0,
		timeRef: input?.timeRef ?? null,
		speedRef: input?.speedRef ?? null,
	}),
	states: {
		empty: {
			on: {
				LOAD: "loading",
			},
		},
		loading: {
			invoke: {
				id: "validateAndPrepare",
				src: "validateAndPrepare",
				input: ({ event }: { event: PlayerEvent }) =>
					(event as { type: "LOAD"; data: unknown }).data,
				onDone: {
					target: "ready",
					actions: assign(({ event }) => ({
						debate: event.output.debate,
						steps: event.output.steps,
						currentStepIndex: 0,
						currentTimeMs: 0,
						totalDurationMs: getTotalDuration(event.output.steps),
						error: null,
					})),
				},
				onError: {
					target: "error",
					actions: assign(({ event }) => ({
						error:
							event.error instanceof Error
								? event.error.message
								: "Failed to load debate",
					})),
				},
			},
		},
		ready: {
			entry: "syncTimeRefFromContext",
			on: {
				PLAY: { target: "playing", guard: "hasSteps" },
				SEEK: { actions: ["assignTimeAndStep", "syncTimeRefFromContext"] },
				SET_SPEED: { actions: ["assignSpeed", "updateSpeedRef"] },
				SELECT_AGENT: { actions: "assignSelectedAgent" },
				RESET: { target: "empty", actions: "resetContext" },
				LOAD: "loading",
			},
		},
		playing: {
			invoke: {
				src: "clock",
				input: ({ context }) => ({
					steps: context.steps,
					speedRef: context.speedRef?.current ?? { currentSpeed: 1 },
					timeRef: context.timeRef?.current ?? { currentTimeMs: 0 },
					totalDurationMs: context.totalDurationMs,
				}),
			},
			on: {
				PAUSE: "paused",
				SYNC_TIME: { actions: "assignTime" },
				STEP_CHANGED: { actions: "assignStepIndex" },
				SET_SPEED: { actions: ["assignSpeed", "updateSpeedRef"] },
				SEEK: { actions: ["assignTimeAndStep", "updateTimeRef"] },
				SELECT_AGENT: { actions: "assignSelectedAgent" },
				PLAYBACK_END: "ready",
				RESET: { target: "empty", actions: "resetContext" },
				LOAD: "loading",
			},
		},
		paused: {
			entry: "syncTimeRefFromContext",
			on: {
				PLAY: { target: "playing", guard: "hasSteps" },
				SEEK: { actions: ["assignTimeAndStep", "syncTimeRefFromContext"] },
				SET_SPEED: { actions: ["assignSpeed", "updateSpeedRef"] },
				SELECT_AGENT: { actions: "assignSelectedAgent" },
				// CRITICAL: Handle SYNC_TIME in paused state (emitted during pause transition)
				SYNC_TIME: { actions: "assignTime" },
				RESET: { target: "empty", actions: "resetContext" },
				LOAD: "loading",
			},
		},
		error: {
			on: {
				RESET: { target: "empty", actions: "resetContext" },
				LOAD: "loading",
			},
		},
	},
});

export type PlayerMachineType = typeof playerMachine;
