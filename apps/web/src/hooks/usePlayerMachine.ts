"use client";

/**
 * usePlayerMachine - React hook for the debate player state machine
 * Wraps XState machine and provides refs for high-frequency sync
 * Based on spec v2.5.0 section 6.4
 */

import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { playerMachine } from "@/lib/player/machine";
import type { SpeedRef, StepTiming, TimeRef } from "@/lib/player/types";

export type PlayerState =
	| "empty"
	| "loading"
	| "ready"
	| "playing"
	| "paused"
	| "error";

export function usePlayerMachine() {
	// Create refs for high-frequency time sync
	const timeRef = useRef<TimeRef>({ currentTimeMs: 0 });
	const speedRef = useRef<SpeedRef>({ currentSpeed: 1 });

	// Initialize machine with refs via input
	const [snapshot, send, actorRef] = useMachine(playerMachine, {
		input: { timeRef, speedRef },
	});

	// Sync speedRef when context.playbackSpeed changes
	useEffect(() => {
		speedRef.current.currentSpeed = snapshot.context.playbackSpeed;
	}, [snapshot.context.playbackSpeed]);

	// Derived state
	const state: PlayerState = useMemo(() => {
		if (snapshot.matches("empty")) return "empty";
		if (snapshot.matches("loading")) return "loading";
		if (snapshot.matches("ready")) return "ready";
		if (snapshot.matches("playing")) return "playing";
		if (snapshot.matches("paused")) return "paused";
		if (snapshot.matches("error")) return "error";
		return "empty";
	}, [snapshot]);

	const context = snapshot.context;

	const currentStep: StepTiming | null = useMemo(() => {
		if (context.steps.length === 0) return null;
		return context.steps[context.currentStepIndex] ?? null;
	}, [context.steps, context.currentStepIndex]);

	const isPlaying = state === "playing";
	const isLoading = state === "loading";
	const hasError = state === "error";
	const isReady =
		state === "ready" || state === "playing" || state === "paused";
	const canPlay = isReady && context.steps.length > 0;

	// Actions
	const play = useCallback(() => {
		send({ type: "PLAY" });
	}, [send]);

	const pause = useCallback(() => {
		send({ type: "PAUSE" });
	}, [send]);

	const seek = useCallback(
		(timeMs: number) => {
			send({ type: "SEEK", timeMs });
		},
		[send],
	);

	const setSpeed = useCallback(
		(speed: number) => {
			send({ type: "SET_SPEED", speed });
		},
		[send],
	);

	const loadData = useCallback(
		(data: unknown) => {
			send({ type: "LOAD", data });
		},
		[send],
	);

	const selectAgent = useCallback(
		(agentId: string | null) => {
			send({ type: "SELECT_AGENT", agentId });
		},
		[send],
	);

	const reset = useCallback(() => {
		send({ type: "RESET" });
	}, [send]);

	// Step navigation
	const stepForward = useCallback(() => {
		if (context.steps.length === 0) return;
		const nextIndex = Math.min(
			context.currentStepIndex + 1,
			context.steps.length - 1,
		);
		const nextTime = context.steps[nextIndex].startMs;
		seek(nextTime);
	}, [context.steps, context.currentStepIndex, seek]);

	const stepBackward = useCallback(() => {
		if (context.steps.length === 0) return;
		const prevIndex = Math.max(context.currentStepIndex - 1, 0);
		const prevTime = context.steps[prevIndex].startMs;
		seek(prevTime);
	}, [context.steps, context.currentStepIndex, seek]);

	const jumpToStart = useCallback(() => {
		seek(0);
	}, [seek]);

	const jumpToEnd = useCallback(() => {
		seek(context.totalDurationMs);
	}, [seek, context.totalDurationMs]);

	return {
		// State
		state,
		context,
		currentStep,
		isPlaying,
		isLoading,
		hasError,
		isReady,
		canPlay,

		// High-frequency access
		timeRef,
		speedRef,
		actorRef,

		// Actions
		play,
		pause,
		seek,
		setSpeed,
		loadData,
		selectAgent,
		reset,
		stepForward,
		stepBackward,
		jumpToStart,
		jumpToEnd,

		// Raw send for edge cases
		send,
	};
}

export type UsePlayerMachineReturn = ReturnType<typeof usePlayerMachine>;
