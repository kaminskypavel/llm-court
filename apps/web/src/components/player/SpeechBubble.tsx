"use client";

import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { StepTiming } from "@/lib/player/types";
import { cn } from "@/lib/utils";

type SpeechBubbleProps = {
	currentStep: StepTiming | null;
	isPlaying: boolean;
};

// Sanitize text content from LLM - very restrictive
function sanitizeText(text: string): string {
	return DOMPurify.sanitize(text, {
		ALLOWED_TAGS: [], // Strip all HTML
		ALLOWED_ATTR: [],
	});
}

// Typing animation hook
function useTypingAnimation(text: string, isPlaying: boolean, speed = 30) {
	const [displayText, setDisplayText] = useState("");

	useEffect(() => {
		if (!isPlaying) {
			setDisplayText(text);
			return;
		}

		setDisplayText("");
		let currentIndex = 0;
		const intervalId = setInterval(() => {
			if (currentIndex < text.length) {
				setDisplayText(text.slice(0, currentIndex + 1));
				currentIndex++;
			} else {
				clearInterval(intervalId);
			}
		}, speed);

		return () => clearInterval(intervalId);
	}, [text, isPlaying, speed]);

	return displayText;
}

export function SpeechBubble({ currentStep, isPlaying }: SpeechBubbleProps) {
	const step = currentStep?.step;

	// Get text content based on step type
	const getText = () => {
		if (!step) return "";

		switch (step.type) {
			case "AGENT_SPEAK":
				return step.text;
			case "JUDGE_EVALUATE":
				return step.text;
			case "ROUND_START":
				return step.candidateText || `Starting Round ${step.round}`;
			case "FINAL_VERDICT":
				return step.positionText || "Final verdict rendered";
			case "CONSENSUS_CHECK":
				return step.reached
					? `Consensus reached: ${step.positionText || "Agreement"}`
					: "No consensus yet";
			case "VOTE_TALLY":
				return `Votes: Yes ${step.tally.yes}, No ${step.tally.no}, Abstain ${step.tally.abstain}`;
			case "JUDGE_START":
				return `Starting judge evaluation for round ${step.round}`;
			default:
				return "";
		}
	};

	// Get speaker/source label
	const getLabel = () => {
		if (!step) return null;

		switch (step.type) {
			case "AGENT_SPEAK":
				return {
					text: step.agentId,
					variant: "default" as const,
					badge: step.vote,
				};
			case "JUDGE_EVALUATE":
				return {
					text: step.judgeId,
					variant: "secondary" as const,
					badge: null,
				};
			case "ROUND_START":
				return {
					text: `Round ${step.round}`,
					variant: "outline" as const,
					badge: null,
				};
			case "FINAL_VERDICT":
				return {
					text: "Verdict",
					variant: "default" as const,
					badge: step.source.replace(/_/g, " "),
				};
			default:
				return {
					text: step.type.replace(/_/g, " "),
					variant: "outline" as const,
					badge: null,
				};
		}
	};

	const rawText = getText();
	const sanitizedText = sanitizeText(rawText);
	const displayText = useTypingAnimation(sanitizedText, isPlaying);
	const label = getLabel();

	if (!step || !rawText) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
				No current speech
			</div>
		);
	}

	// Determine bubble style based on step type
	const isAgent = step.type === "AGENT_SPEAK";
	const isJudge = step.type === "JUDGE_EVALUATE";

	return (
		<div className="space-y-2">
			{/* Header */}
			{label && (
				<div className="flex items-center gap-2">
					<Badge variant={label.variant}>{label.text}</Badge>
					{label.badge && (
						<Badge
							variant={
								label.badge === "yes"
									? "default"
									: label.badge === "no"
										? "destructive"
										: "secondary"
							}
						>
							{label.badge}
						</Badge>
					)}
				</div>
			)}

			{/* Text content */}
			<p className="text-sm leading-relaxed">
				{displayText}
				{isPlaying && displayText.length < sanitizedText.length && (
					<span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-current" />
				)}
			</p>

			{/* Status indicator for agent steps */}
			{isAgent && step.status === "error" && step.error && (
				<p className="text-destructive text-xs">{step.error}</p>
			)}

			{/* Confidence indicator */}
			{(isAgent || isJudge) && "confidence" in step && (
				<div className="flex items-center gap-2">
					<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
						<div
							className={cn(
								"h-full transition-all",
								step.confidence >= 0.7
									? "bg-green-500"
									: step.confidence >= 0.4
										? "bg-yellow-500"
										: "bg-red-500",
							)}
							style={{ width: `${step.confidence * 100}%` }}
						/>
					</div>
					<span className="text-muted-foreground text-xs">
						{(step.confidence * 100).toFixed(0)}%
					</span>
				</div>
			)}
		</div>
	);
}
