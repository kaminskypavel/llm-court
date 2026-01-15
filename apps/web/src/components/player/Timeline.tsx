"use client";

import { useCallback, useRef } from "react";
import { formatTime } from "@/lib/player/durations";
import type { StepTiming } from "@/lib/player/types";
import { cn } from "@/lib/utils";

type TimelineProps = {
	steps: StepTiming[];
	currentStepIndex: number;
	currentTimeMs: number;
	totalDurationMs: number;
	onSeek: (timeMs: number) => void;
};

export function Timeline({
	steps,
	currentStepIndex,
	currentTimeMs,
	totalDurationMs,
	onSeek,
}: TimelineProps) {
	const trackRef = useRef<HTMLDivElement>(null);

	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			if (!trackRef.current || totalDurationMs === 0) return;
			const rect = trackRef.current.getBoundingClientRect();
			const ratio = Math.max(
				0,
				Math.min(1, (e.clientX - rect.left) / rect.width),
			);
			onSeek(Math.round(ratio * totalDurationMs));
		},
		[totalDurationMs, onSeek],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (totalDurationMs === 0) return;

			const seekAmount = 5000; // 5 seconds
			switch (e.key) {
				case "ArrowLeft":
					e.preventDefault();
					onSeek(Math.max(0, currentTimeMs - seekAmount));
					break;
				case "ArrowRight":
					e.preventDefault();
					onSeek(Math.min(totalDurationMs, currentTimeMs + seekAmount));
					break;
				case "Home":
					e.preventDefault();
					onSeek(0);
					break;
				case "End":
					e.preventDefault();
					onSeek(totalDurationMs);
					break;
			}
		},
		[currentTimeMs, totalDurationMs, onSeek],
	);

	const progress =
		totalDurationMs > 0 ? (currentTimeMs / totalDurationMs) * 100 : 0;

	return (
		<div className="flex items-center gap-4">
			{/* Current time */}
			<span className="w-12 text-muted-foreground text-sm tabular-nums">
				{formatTime(currentTimeMs)}
			</span>

			{/* Track */}
			<div
				ref={trackRef}
				className="relative h-2 flex-1 cursor-pointer rounded-full bg-muted"
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				role="slider"
				aria-valuemin={0}
				aria-valuemax={totalDurationMs}
				aria-valuenow={currentTimeMs}
				aria-label="Playback position"
				tabIndex={0}
			>
				{/* Progress bar */}
				<div
					className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-75"
					style={{ width: `${progress}%` }}
				/>

				{/* Step markers */}
				{steps.map((stepTiming, idx) => {
					const position =
						totalDurationMs > 0
							? (stepTiming.startMs / totalDurationMs) * 100
							: 0;
					const isRoundMarker =
						stepTiming.step.type === "ROUND_START" ||
						stepTiming.step.type === "JUDGE_START";
					const isCurrent = idx === currentStepIndex;

					return (
						<div
							key={`${stepTiming.step.type}-${idx}`}
							className={cn(
								"absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full transition-colors",
								isCurrent
									? "bg-primary"
									: isRoundMarker
										? "bg-accent-foreground/50"
										: "bg-muted-foreground/30",
								isRoundMarker && "h-4",
							)}
							style={{ left: `${position}%` }}
							title={`${stepTiming.step.type}${
								"round" in stepTiming.step
									? ` (Round ${stepTiming.step.round})`
									: ""
							}`}
						/>
					);
				})}

				{/* Thumb */}
				<div
					className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
					style={{ left: `${progress}%` }}
				/>
			</div>

			{/* Total duration */}
			<span className="w-12 text-muted-foreground text-sm tabular-nums">
				{formatTime(totalDurationMs)}
			</span>
		</div>
	);
}
