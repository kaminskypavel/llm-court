"use client";

import {
	ChevronsLeft,
	ChevronsRight,
	Pause,
	Play,
	RotateCcw,
	SkipBack,
	SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;
const SPEEDS: PlaybackSpeed[] = [0.5, 1, 1.5, 2];

type PlaybackControlsProps = {
	isPlaying: boolean;
	playbackSpeed: number;
	disabled?: boolean;
	onPlay: () => void;
	onPause: () => void;
	onStepForward: () => void;
	onStepBackward: () => void;
	onJumpToStart: () => void;
	onJumpToEnd: () => void;
	onSpeedChange: (speed: number) => void;
	onReset: () => void;
};

export function PlaybackControls({
	isPlaying,
	playbackSpeed,
	disabled = false,
	onPlay,
	onPause,
	onStepForward,
	onStepBackward,
	onJumpToStart,
	onJumpToEnd,
	onSpeedChange,
	onReset,
}: PlaybackControlsProps) {
	return (
		<div className="flex items-center gap-2">
			{/* Jump to start */}
			<Button
				variant="ghost"
				size="icon"
				onClick={onJumpToStart}
				disabled={disabled}
				aria-label="Jump to start"
				title="Jump to start (Home)"
			>
				<ChevronsLeft className="h-4 w-4" />
			</Button>

			{/* Previous step */}
			<Button
				variant="ghost"
				size="icon"
				onClick={onStepBackward}
				disabled={disabled}
				aria-label="Previous step"
				title="Previous step (Shift+Left)"
			>
				<SkipBack className="h-4 w-4" />
			</Button>

			{/* Play/Pause */}
			<Button
				variant="default"
				size="icon"
				onClick={isPlaying ? onPause : onPlay}
				disabled={disabled}
				aria-label={isPlaying ? "Pause" : "Play"}
				title={isPlaying ? "Pause (Space)" : "Play (Space)"}
			>
				{isPlaying ? (
					<Pause className="h-4 w-4" />
				) : (
					<Play className="h-4 w-4" />
				)}
			</Button>

			{/* Next step */}
			<Button
				variant="ghost"
				size="icon"
				onClick={onStepForward}
				disabled={disabled}
				aria-label="Next step"
				title="Next step (Shift+Right)"
			>
				<SkipForward className="h-4 w-4" />
			</Button>

			{/* Jump to end */}
			<Button
				variant="ghost"
				size="icon"
				onClick={onJumpToEnd}
				disabled={disabled}
				aria-label="Jump to end"
				title="Jump to end (End)"
			>
				<ChevronsRight className="h-4 w-4" />
			</Button>

			{/* Speed controls */}
			<div className="ml-4 flex items-center gap-1">
				{SPEEDS.map((speed) => (
					<Button
						key={speed}
						variant={playbackSpeed === speed ? "secondary" : "ghost"}
						size="sm"
						onClick={() => onSpeedChange(speed)}
						disabled={disabled}
						className={cn(
							"min-w-[3rem] text-xs",
							playbackSpeed === speed && "font-medium",
						)}
					>
						{speed}x
					</Button>
				))}
			</div>

			{/* Reset */}
			<Button
				variant="ghost"
				size="icon"
				onClick={onReset}
				className="ml-auto"
				aria-label="Reset player"
				title="Reset player"
			>
				<RotateCcw className="h-4 w-4" />
			</Button>
		</div>
	);
}
