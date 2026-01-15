"use client";

import DOMPurify from "dompurify";
import { memo, useCallback, useEffect, useRef } from "react";
import useMeasure from "react-use-measure";
import {
	FixedSizeList as List,
	type ListChildComponentProps,
} from "react-window";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/player/durations";
import type { StepTiming } from "@/lib/player/types";
import { cn } from "@/lib/utils";

type TranscriptPanelProps = {
	steps: StepTiming[];
	currentStepIndex: number;
	onStepClick: (index: number) => void;
};

const ITEM_HEIGHT = 80; // Height of each transcript item

// Sanitize text content from LLM
function sanitizeText(text: string): string {
	return DOMPurify.sanitize(text, {
		ALLOWED_TAGS: [], // Strip all HTML tags
		ALLOWED_ATTR: [],
	});
}

// Get display info for a step
function getStepDisplayInfo(step: StepTiming["step"]) {
	switch (step.type) {
		case "AGENT_SPEAK":
			return {
				label: step.agentId,
				badge: step.vote,
				badgeVariant:
					step.vote === "yes"
						? ("default" as const)
						: step.vote === "no"
							? ("destructive" as const)
							: ("secondary" as const),
				text: step.text,
				icon: "💬",
			};
		case "JUDGE_EVALUATE":
			return {
				label: step.judgeId,
				badge: `${(step.confidence * 100).toFixed(0)}%`,
				badgeVariant: "secondary" as const,
				text: step.text,
				icon: "⚖️",
			};
		case "ROUND_START":
			return {
				label: `Round ${step.round}`,
				badge: null,
				badgeVariant: "outline" as const,
				text: step.candidateText || "Starting round...",
				icon: "🔔",
			};
		case "VOTE_TALLY":
			return {
				label: "Vote Tally",
				badge: step.tally.supermajorityReached ? "Majority" : "No Majority",
				badgeVariant: step.tally.supermajorityReached
					? ("default" as const)
					: ("secondary" as const),
				text: `Yes: ${step.tally.yes}, No: ${step.tally.no}, Abstain: ${step.tally.abstain}`,
				icon: "📊",
			};
		case "CONSENSUS_CHECK":
			return {
				label: "Consensus Check",
				badge: step.reached ? "Reached" : "Not Reached",
				badgeVariant: step.reached
					? ("default" as const)
					: ("secondary" as const),
				text: step.positionText || "Checking consensus...",
				icon: "🤝",
			};
		case "JUDGE_START":
			return {
				label: `Judge Round ${step.round}`,
				badge: null,
				badgeVariant: "outline" as const,
				text: "Starting judge evaluation...",
				icon: "👨‍⚖️",
			};
		case "FINAL_VERDICT":
			return {
				label: "Final Verdict",
				badge: step.source.replace(/_/g, " "),
				badgeVariant: "default" as const,
				text: step.positionText || "No verdict text",
				icon: "🏛️",
			};
		default:
			return {
				label: "Unknown",
				badge: null,
				badgeVariant: "outline" as const,
				text: "",
				icon: "❓",
			};
	}
}

// Memoized row component for react-window
const TranscriptRow = memo(function TranscriptRow({
	index,
	style,
	data,
}: ListChildComponentProps<{
	steps: StepTiming[];
	currentStepIndex: number;
	onStepClick: (index: number) => void;
}>) {
	const { steps, currentStepIndex, onStepClick } = data;
	const stepTiming = steps[index];
	const { step, startMs } = stepTiming;
	const info = getStepDisplayInfo(step);
	const isActive = index === currentStepIndex;
	const isPast = index < currentStepIndex;

	return (
		<button
			type="button"
			style={style}
			className={cn(
				"w-full cursor-pointer border-b px-3 py-2 text-left transition-colors hover:bg-muted/50",
				isActive && "border-l-2 border-l-primary bg-primary/10",
				isPast && "opacity-60",
			)}
			onClick={() => onStepClick(index)}
		>
			<div className="flex items-start gap-2">
				<span className="text-base">{info.icon}</span>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="truncate font-medium text-sm">{info.label}</span>
						{info.badge && (
							<Badge variant={info.badgeVariant} className="text-xs">
								{info.badge}
							</Badge>
						)}
						<span className="ml-auto shrink-0 text-muted-foreground text-xs">
							{formatTime(startMs)}
						</span>
					</div>
					<p className="line-clamp-2 text-muted-foreground text-xs">
						{sanitizeText(info.text).slice(0, 150)}
						{info.text.length > 150 && "..."}
					</p>
				</div>
			</div>
		</button>
	);
});

export function TranscriptPanel({
	steps,
	currentStepIndex,
	onStepClick,
}: TranscriptPanelProps) {
	const [measureRef, bounds] = useMeasure();
	const listRef = useRef<List>(null);

	// Auto-scroll to current step
	useEffect(() => {
		if (listRef.current && currentStepIndex >= 0) {
			listRef.current.scrollToItem(currentStepIndex, "smart");
		}
	}, [currentStepIndex]);

	// Memoize item data
	const itemData = useCallback(
		() => ({
			steps,
			currentStepIndex,
			onStepClick,
		}),
		[steps, currentStepIndex, onStepClick],
	)();

	if (steps.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-4">
				<p className="text-muted-foreground text-sm">No transcript available</p>
			</div>
		);
	}

	return (
		<div ref={measureRef} className="h-full">
			{bounds.height > 0 && (
				<List
					ref={listRef}
					height={bounds.height}
					width={bounds.width || 300}
					itemCount={steps.length}
					itemSize={ITEM_HEIGHT}
					itemData={itemData}
					overscanCount={5}
				>
					{TranscriptRow}
				</List>
			)}
		</div>
	);
}
