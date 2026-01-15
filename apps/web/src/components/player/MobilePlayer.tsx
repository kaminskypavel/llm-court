"use client";

import {
	Check,
	ChevronLeft,
	FastForward,
	Pause,
	Play,
	Rewind,
} from "lucide-react";
import { formatTime } from "@/lib/player/durations";
import type { ValidatedDebateOutput } from "@/lib/player/schema";
import type { StepTiming } from "@/lib/player/types";
import { DynamicCourtroomCanvas } from "./DynamicCanvas";

type MobilePlayerProps = {
	debate: ValidatedDebateOutput | null;
	currentStep: StepTiming | null;
	steps: StepTiming[];
	currentStepIndex: number;
	currentTimeMs: number;
	totalDurationMs: number;
	isPlaying: boolean;
	canPlay: boolean;
	playbackSpeed: number;
	backgroundIndex: number;
	onPlay: () => void;
	onPause: () => void;
	onSeek: (timeMs: number) => void;
	onSpeedChange: (speed: number) => void;
	onStepForward: () => void;
	onStepBackward: () => void;
	onJumpToStart: () => void;
	onJumpToEnd: () => void;
	onReset: () => void;
};

// Color palette for speakers (same as desktop)
const SPEAKER_COLORS: Record<string, string> = {
	"claude-advocate": "text-blue-400",
	"gpt-skeptic": "text-red-400",
	"gemini-pragmatist": "text-emerald-400",
	"llama-contrarian": "text-amber-400",
	"judge-opus": "text-purple-400",
	"judge-gpt4": "text-pink-400",
	"judge-gemini": "text-violet-400",
	System: "text-gray-400",
};

function getSpeakerColor(speaker: string): string {
	if (SPEAKER_COLORS[speaker]) return SPEAKER_COLORS[speaker];
	const colors = [
		"text-cyan-400",
		"text-orange-400",
		"text-lime-400",
		"text-rose-400",
	];
	let hash = 0;
	for (const char of speaker) hash = (hash * 31 + char.charCodeAt(0)) % 1000;
	return colors[hash % colors.length];
}

export function MobilePlayer({
	debate,
	currentStep,
	steps,
	currentStepIndex,
	currentTimeMs,
	totalDurationMs,
	isPlaying,
	canPlay,
	playbackSpeed,
	backgroundIndex,
	onPlay,
	onPause,
	onSeek,
	onSpeedChange,
	onStepForward,
	onStepBackward,
}: MobilePlayerProps) {
	if (!debate) {
		return (
			<div className="flex h-full items-center justify-center p-4">
				<p className="text-muted-foreground text-sm">No debate loaded</p>
			</div>
		);
	}

	const progressPercent =
		totalDurationMs > 0 ? (currentTimeMs / totalDurationMs) * 100 : 0;

	return (
		<div className="flex h-full flex-col bg-background">
			{/* Header */}
			<div className="flex items-center gap-3 border-b px-4 py-3">
				<ChevronLeft className="h-6 w-6 text-primary" />
				<h1 className="font-semibold">Courtroom Simulator</h1>
			</div>

			{/* Content area - scrollable */}
			<div className="min-h-0 flex-1 overflow-y-auto">
				{/* Topic and badges */}
				<div className="px-4 pt-4 pb-3">
					<h2 className="mb-3 font-bold text-xl leading-tight">
						{debate.session.topic}
					</h2>
					<div className="flex flex-wrap gap-2">
						<span className="rounded-full bg-muted px-3 py-1 text-sm">
							{debate.agentDebate.rounds.length} rounds
						</span>
						<span className="rounded-full bg-muted px-3 py-1 text-sm">
							{steps.length} steps
						</span>
						{debate.session.phase === "concluded" && (
							<span className="flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-sm text-white">
								<Check className="h-3 w-3" />
								Consensus Reached
							</span>
						)}
					</div>
				</div>

				{/* Canvas */}
				<div className="mx-4 aspect-video overflow-hidden rounded-xl bg-[#1a1208]">
					<DynamicCourtroomCanvas
						currentStep={currentStep}
						debate={debate}
						backgroundIndex={backgroundIndex}
					/>
				</div>

				{/* Live Transcript */}
				<div className="px-4 pt-4">
					<h3 className="mb-3 font-bold text-lg">Live Transcript</h3>
					<div className="space-y-4 pb-4">
						{steps.slice(0, currentStepIndex + 5).map((step, index) => {
							const s = step.step;
							const speaker =
								s.type === "AGENT_SPEAK"
									? s.agentId
									: s.type === "JUDGE_EVALUATE"
										? s.judgeId
										: null;
							const text =
								s.type === "AGENT_SPEAK" || s.type === "JUDGE_EVALUATE"
									? s.text
									: null;
							if (!speaker || !text) return null;

							const isActive = index === currentStepIndex;
							const speakerColor = getSpeakerColor(speaker);

							return (
								<button
									key={`${step.startMs}-${index}`}
									type="button"
									onClick={() => onSeek(step.startMs)}
									className={`w-full text-left ${isActive ? "opacity-100" : "opacity-70"}`}
								>
									<p className="leading-relaxed">
										<span className={`font-bold ${speakerColor}`}>
											{speaker}
										</span>
										<span className="text-muted-foreground">
											{" "}
											({formatTime(step.startMs)}):
										</span>{" "}
										<span className="line-clamp-2">{text}</span>
									</p>
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{/* Bottom controls - fixed */}
			<div className="shrink-0 border-t bg-card px-4 py-3">
				{/* Progress bar with times */}
				<div className="mb-3 flex items-center gap-3">
					<span className="min-w-[40px] font-mono text-muted-foreground text-xs">
						{formatTime(currentTimeMs)}
					</span>
					<div className="relative flex-1">
						<input
							type="range"
							min={0}
							max={totalDurationMs || 100}
							value={currentTimeMs}
							onChange={(e) => onSeek(Number(e.target.value))}
							className="relative z-10 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-20 [&::-webkit-slider-thumb]:mt-[-3px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
							aria-label="Playback progress"
						/>
						<div
							className="pointer-events-none absolute top-0 left-0 h-1.5 rounded-full bg-muted-foreground/50"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
					<span className="min-w-[40px] text-right font-mono text-muted-foreground text-xs">
						{formatTime(totalDurationMs)}
					</span>
				</div>

				{/* Playback controls */}
				<div className="flex items-center justify-center gap-4">
					<button
						type="button"
						onClick={onStepBackward}
						disabled={!canPlay}
						className="p-2 text-foreground disabled:opacity-50"
					>
						<Rewind className="h-6 w-6" />
					</button>
					<button
						type="button"
						onClick={isPlaying ? onPause : onPlay}
						disabled={!canPlay}
						className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-50"
					>
						{isPlaying ? (
							<Pause className="h-6 w-6" />
						) : (
							<Play className="ml-0.5 h-6 w-6" />
						)}
					</button>
					<button
						type="button"
						onClick={onStepForward}
						disabled={!canPlay}
						className="p-2 text-foreground disabled:opacity-50"
					>
						<FastForward className="h-6 w-6" />
					</button>
					{/* Speed controls */}
					<div className="ml-2 flex items-center gap-1 rounded-md border border-border p-1">
						{[0.5, 1, 1.5, 2].map((speed) => (
							<button
								key={speed}
								type="button"
								onClick={() => onSpeedChange(speed)}
								className={`rounded px-2 py-1 font-mono text-xs ${
									playbackSpeed === speed
										? "bg-foreground text-background"
										: "text-muted-foreground"
								}`}
							>
								{speed}x
							</button>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
