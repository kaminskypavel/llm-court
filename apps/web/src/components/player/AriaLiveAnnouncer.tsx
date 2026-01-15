"use client";

import { useEffect, useRef, useState } from "react";
import type { StepTiming } from "@/lib/player/types";

type AriaLiveAnnouncerProps = {
	currentStep: StepTiming | null;
	isPlaying: boolean;
	playbackSpeed: number;
};

// Generate announcement text for a step
function getStepAnnouncement(step: StepTiming["step"]): string {
	switch (step.type) {
		case "AGENT_SPEAK":
			return `Agent ${step.agentId} speaks. Vote: ${step.vote}. Confidence: ${(step.confidence * 100).toFixed(0)} percent.`;
		case "JUDGE_EVALUATE":
			return `Judge ${step.judgeId} evaluates. Confidence: ${(step.confidence * 100).toFixed(0)} percent.`;
		case "ROUND_START":
			return `Round ${step.round} starts.`;
		case "VOTE_TALLY":
			return `Vote tally: ${step.tally.yes} yes, ${step.tally.no} no, ${step.tally.abstain} abstain. ${step.tally.supermajorityReached ? "Supermajority reached." : "No supermajority."}`;
		case "CONSENSUS_CHECK":
			return step.reached
				? "Consensus reached."
				: "No consensus. Continuing debate.";
		case "JUDGE_START":
			return `Judge evaluation round ${step.round} starts.`;
		case "FINAL_VERDICT":
			return `Final verdict. Source: ${step.source.replace(/_/g, " ")}. Confidence: ${(step.confidence * 100).toFixed(0)} percent.`;
		default:
			return "Step changed.";
	}
}

/**
 * Accessible announcements for screen readers
 * Uses aria-live regions to announce step changes
 */
export function AriaLiveAnnouncer({
	currentStep,
	isPlaying,
	playbackSpeed,
}: AriaLiveAnnouncerProps) {
	const [announcement, setAnnouncement] = useState("");
	const prevStepRef = useRef<StepTiming | null>(null);

	// Announce step changes
	useEffect(() => {
		if (!currentStep || currentStep === prevStepRef.current) return;

		prevStepRef.current = currentStep;
		const text = getStepAnnouncement(currentStep.step);
		setAnnouncement(text);

		// Clear after announcement
		const timeout = setTimeout(() => setAnnouncement(""), 1000);
		return () => clearTimeout(timeout);
	}, [currentStep]);

	// Announce playback state changes
	useEffect(() => {
		if (isPlaying) {
			setAnnouncement(`Playback started at ${playbackSpeed}x speed.`);
		} else {
			setAnnouncement("Playback paused.");
		}

		const timeout = setTimeout(() => setAnnouncement(""), 500);
		return () => clearTimeout(timeout);
	}, [isPlaying, playbackSpeed]);

	return (
		<>
			{/* Polite announcements for step changes */}
			<output aria-live="polite" aria-atomic="true" className="sr-only">
				{announcement}
			</output>

			{/* Assertive announcements for errors */}
			<div
				role="alert"
				aria-live="assertive"
				aria-atomic="true"
				className="sr-only"
			>
				{currentStep?.step.type === "AGENT_SPEAK" &&
					currentStep.step.status === "error" &&
					`Error: ${currentStep.step.error}`}
			</div>
		</>
	);
}
