"use client";

import {
	AlertCircle,
	Check,
	Clock,
	FastForward,
	List,
	Loader2,
	Palette,
	Pause,
	Play,
	Rewind,
	SkipBack,
	SkipForward,
	Volume2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { usePlaybackTime } from "@/hooks/usePlaybackTime";
import { usePlayerMachine } from "@/hooks/usePlayerMachine";
import {
	handleFileUpload,
	handleUrlLoad,
	toLoadError,
} from "@/lib/player/loader";
import type { ValidatedDebateOutput } from "@/lib/player/schema";
import { saveToRecent } from "@/lib/player/storage";
import type { StepTiming } from "@/lib/player/types";
import { AriaLiveAnnouncer } from "./AriaLiveAnnouncer";
import { COURTROOM_BG_COUNT } from "./CourtroomCanvas";
import { DebateDropZone } from "./DebateDropZone";
import { DynamicCourtroomCanvas } from "./DynamicCanvas";
import { MobilePlayer } from "./MobilePlayer";
import { RecentDebates } from "./RecentDebates";

type DebatePlayerProps = {
	initialUrl?: string;
};

// Format time as M:SS
function formatTime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function DebatePlayer({ initialUrl }: DebatePlayerProps) {
	const {
		state,
		context,
		currentStep,
		isPlaying,
		isLoading,
		hasError,
		canPlay,
		timeRef,
		play,
		pause,
		seek,
		setSpeed,
		loadData,
		reset,
		stepForward,
		stepBackward,
		jumpToStart,
		jumpToEnd,
	} = usePlayerMachine();

	// High-frequency time for smooth scrubber
	const currentTimeMs = usePlaybackTime(timeRef, isPlaying);

	// Courtroom background selection
	const [backgroundIndex, setBackgroundIndex] = useState(1);
	const cycleBackground = useCallback(() => {
		setBackgroundIndex((prev) => (prev % COURTROOM_BG_COUNT) + 1);
	}, []);

	// Responsive breakpoint
	const isMobile = useIsMobile();

	// Load from URL on mount
	useEffect(() => {
		if (initialUrl) {
			handleUrlLoad(initialUrl)
				.then((debate) => {
					loadData(debate);
					saveToRecent(debate, "url", initialUrl);
				})
				.catch((error) => {
					console.error("Failed to load debate:", toLoadError(error, "url"));
				});
		}
	}, [initialUrl, loadData]);

	// Handle file upload
	const handleFile = useCallback(
		async (file: File) => {
			try {
				const debate = await handleFileUpload(file);
				loadData(debate);
				saveToRecent(debate, "file", file.name);
			} catch (error) {
				console.error("Failed to load file:", error);
			}
		},
		[loadData],
	);

	// Handle URL load from input
	const handleUrl = useCallback(
		async (url: string) => {
			try {
				const debate = await handleUrlLoad(url);
				loadData(debate);
				saveToRecent(debate, "url", url);
			} catch (error) {
				console.error("Failed to load URL:", error);
			}
		},
		[loadData],
	);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
				return;
			}

			switch (e.key) {
				case " ":
					e.preventDefault();
					if (canPlay) {
						isPlaying ? pause() : play();
					}
					break;
				case "ArrowLeft":
					e.preventDefault();
					if (e.shiftKey) {
						stepBackward();
					} else {
						seek(Math.max(0, context.currentTimeMs - 5000));
					}
					break;
				case "ArrowRight":
					e.preventDefault();
					if (e.shiftKey) {
						stepForward();
					} else {
						seek(
							Math.min(context.totalDurationMs, context.currentTimeMs + 5000),
						);
					}
					break;
				case "ArrowUp":
					e.preventDefault();
					cycleSpeed(1);
					break;
				case "ArrowDown":
					e.preventDefault();
					cycleSpeed(-1);
					break;
				case "Home":
					e.preventDefault();
					jumpToStart();
					break;
				case "End":
					e.preventDefault();
					jumpToEnd();
					break;
			}
		};

		const cycleSpeed = (direction: 1 | -1) => {
			const speeds = [0.5, 1, 1.5, 2];
			const currentIndex = speeds.indexOf(context.playbackSpeed);
			const newIndex = Math.max(
				0,
				Math.min(speeds.length - 1, currentIndex + direction),
			);
			setSpeed(speeds[newIndex]);
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [
		isPlaying,
		canPlay,
		play,
		pause,
		seek,
		setSpeed,
		stepForward,
		stepBackward,
		jumpToStart,
		jumpToEnd,
		context.currentTimeMs,
		context.totalDurationMs,
		context.playbackSpeed,
	]);

	// Loading state
	if (isLoading) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				<p className="text-muted-foreground">Loading debate...</p>
			</div>
		);
	}

	// Empty state - show drop zone
	if (state === "empty") {
		return (
			<div className="mx-auto flex h-full max-w-3xl flex-col gap-6 p-6">
				<div className="text-center">
					<h1 className="font-bold text-2xl">Debate Player</h1>
					<p className="text-muted-foreground">
						Load a debate JSON file to watch the replay
					</p>
				</div>
				<DebateDropZone
					isLoading={false}
					onFileSelect={handleFile}
					onUrlSubmit={handleUrl}
				/>
				<RecentDebates onSelect={handleUrl} />
			</div>
		);
	}

	// Error state
	if (hasError) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 p-6">
				<Card className="max-w-md border-destructive p-6">
					<div className="flex items-start gap-4">
						<AlertCircle className="h-6 w-6 shrink-0 text-destructive" />
						<div className="flex-1">
							<h2 className="font-semibold text-destructive">
								Error Loading Debate
							</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								{context.error || "An unknown error occurred"}
							</p>
						</div>
					</div>
					<div className="mt-4 flex gap-2">
						<Button variant="outline" onClick={reset}>
							Try Again
						</Button>
					</div>
				</Card>
			</div>
		);
	}

	// Mobile layout
	if (isMobile) {
		return (
			<>
				<AriaLiveAnnouncer
					currentStep={currentStep}
					isPlaying={isPlaying}
					playbackSpeed={context.playbackSpeed}
				/>
				<MobilePlayer
					debate={context.debate}
					currentStep={currentStep}
					steps={context.steps}
					currentStepIndex={context.currentStepIndex}
					currentTimeMs={currentTimeMs}
					totalDurationMs={context.totalDurationMs}
					isPlaying={isPlaying}
					canPlay={canPlay}
					playbackSpeed={context.playbackSpeed}
					onPlay={play}
					onPause={pause}
					onSeek={seek}
					onSpeedChange={setSpeed}
					onStepForward={stepForward}
					onStepBackward={stepBackward}
					onJumpToStart={jumpToStart}
					onJumpToEnd={jumpToEnd}
					onReset={reset}
				/>
			</>
		);
	}

	// Desktop layout - new design
	const progressPercent =
		context.totalDurationMs > 0
			? (currentTimeMs / context.totalDurationMs) * 100
			: 0;

	return (
		<>
			<AriaLiveAnnouncer
				currentStep={currentStep}
				isPlaying={isPlaying}
				playbackSpeed={context.playbackSpeed}
			/>
			<div className="flex h-full flex-col bg-background">
				{/* Centered container */}
				<div className="mx-auto flex h-full w-full max-w-[1400px] flex-col px-6">
					{/* Header: Title + Badges */}
					<header className="shrink-0 pt-6 pb-4">
						<h1 className="font-bold text-3xl tracking-tight lg:text-4xl">
							{context.debate?.session.topic ?? "Debate Player"}
						</h1>
						<div className="mt-3 flex flex-wrap items-center gap-3">
							{context.debate && (
								<>
									<div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm">
										<Clock className="h-4 w-4 text-muted-foreground" />
										<span>
											{context.debate.agentDebate.rounds.length} rounds
										</span>
									</div>
									<div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm">
										<List className="h-4 w-4 text-muted-foreground" />
										<span>{context.steps.length} steps</span>
									</div>
									<div
										className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
											context.debate.session.phase === "consensus_reached"
												? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
												: context.debate.session.phase === "deadlock"
													? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
													: "bg-muted"
										}`}
									>
										<Check className="h-4 w-4" />
										<span>
											{context.debate.session.phase.replace(/_/g, " ")}
										</span>
									</div>
								</>
							)}
						</div>
					</header>

					{/* Main content: Two columns */}
					<div className="grid min-h-0 flex-1 gap-5 pb-4 lg:grid-cols-[1fr_420px]">
						{/* Left column: Canvas + Current Speech */}
						<div className="flex flex-col gap-4 overflow-hidden">
							{/* Canvas */}
							<div className="relative aspect-video overflow-hidden rounded-xl border-2 border-border/50 bg-[#1a1208] shadow-lg">
								<DynamicCourtroomCanvas
									currentStep={currentStep}
									debate={context.debate}
									backgroundIndex={backgroundIndex}
								/>
								{/* Background switcher */}
								<button
									type="button"
									onClick={cycleBackground}
									className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-2 font-medium text-white text-xs backdrop-blur-sm transition-colors hover:bg-black/90"
									title={`Courtroom style ${backgroundIndex}/${COURTROOM_BG_COUNT}`}
								>
									<Palette className="h-4 w-4" />
									{backgroundIndex}/{COURTROOM_BG_COUNT}
								</button>
								{/* Judge labels overlay */}
								{context.debate && (
									<div className="absolute top-3 left-1/2 flex -translate-x-1/2 gap-2">
										{getUniqueJudges(context.debate).map((judge) => (
											<span
												key={judge}
												className="rounded-lg bg-black/70 px-3 py-1.5 font-medium font-mono text-white text-xs backdrop-blur-sm"
											>
												{judge}
											</span>
										))}
									</div>
								)}
							</div>

							{/* Current Speech Panel */}
							<div className="shrink-0 rounded-xl border-2 border-border/50 bg-card p-5 shadow-sm">
								<div className="mb-4 flex items-center justify-between">
									<h2 className="font-semibold text-xl">Current Speech</h2>
									{context.debate?.finalVerdict && (
										<span className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm">
											Verdict
										</span>
									)}
								</div>
								<div className="min-h-[100px] text-base leading-relaxed">
									{currentStep ? (
										<SpeechContent step={currentStep} />
									) : (
										<p className="text-muted-foreground italic">
											No speech selected
										</p>
									)}
								</div>
							</div>
						</div>

						{/* Right column: Transcript */}
						<div className="flex flex-col overflow-hidden rounded-xl border-2 border-border/50 bg-card shadow-sm">
							<div className="shrink-0 border-b px-5 py-4">
								<h2 className="font-semibold text-xl">Transcript</h2>
							</div>
							<div className="flex-1 overflow-y-auto">
								<TranscriptList
									steps={context.steps}
									currentStepIndex={context.currentStepIndex}
									onStepClick={(index) => {
										const step = context.steps[index];
										if (step) seek(step.startMs);
									}}
								/>
							</div>
						</div>
					</div>

					{/* Bottom: Timeline + Controls */}
					<div className="shrink-0 border-border/50 border-t py-5">
						{/* Timeline with progress */}
						<div className="relative mb-5">
							<input
								type="range"
								min={0}
								max={context.totalDurationMs || 100}
								value={currentTimeMs}
								onChange={(e) => seek(Number(e.target.value))}
								className="relative z-10 h-2 w-full cursor-pointer appearance-none rounded-full bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-20 [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
								aria-label="Playback progress"
							/>
							<div
								className="pointer-events-none absolute top-0 left-0 h-2 rounded-full bg-primary transition-all"
								style={{ width: `${progressPercent}%` }}
							/>
						</div>

						{/* Controls row */}
						<div className="flex items-center justify-between">
							{/* Time display */}
							<div className="min-w-[100px] font-mono text-muted-foreground">
								{formatTime(currentTimeMs)} /{" "}
								{formatTime(context.totalDurationMs)}
							</div>

							{/* Playback controls */}
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={jumpToStart}
									disabled={!canPlay}
									className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
								>
									<SkipBack className="h-5 w-5" />
								</button>
								<button
									type="button"
									onClick={stepBackward}
									disabled={!canPlay}
									className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
								>
									<Rewind className="h-5 w-5" />
								</button>
								<button
									type="button"
									onClick={isPlaying ? pause : play}
									disabled={!canPlay}
									className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background transition-all hover:scale-105 disabled:opacity-50"
								>
									{isPlaying ? (
										<Pause className="h-7 w-7" />
									) : (
										<Play className="ml-1 h-7 w-7" />
									)}
								</button>
								<button
									type="button"
									onClick={stepForward}
									disabled={!canPlay}
									className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
								>
									<FastForward className="h-5 w-5" />
								</button>
								<button
									type="button"
									onClick={jumpToEnd}
									disabled={!canPlay}
									className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
								>
									<SkipForward className="h-5 w-5" />
								</button>
							</div>

							{/* Speed controls */}
							<div className="flex items-center gap-1 rounded-lg border border-border p-1">
								{[0.5, 1, 1.5, 2].map((speed) => (
									<button
										key={speed}
										type="button"
										onClick={() => setSpeed(speed)}
										className={`h-9 w-14 rounded-md font-mono text-sm transition-colors ${
											context.playbackSpeed === speed
												? "bg-foreground text-background"
												: "text-muted-foreground hover:bg-muted hover:text-foreground"
										}`}
									>
										{speed}x
									</button>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}

// Helper to get unique judges
function getUniqueJudges(debate: ValidatedDebateOutput): string[] {
	const judges = new Set<string>();
	for (const round of debate.judgePanel.rounds) {
		for (const evaluation of round.evaluations) {
			judges.add(evaluation.judgeId);
		}
	}
	return Array.from(judges);
}

// Speech content component
function SpeechContent({ step }: { step: StepTiming }) {
	if (step.step.type === "AGENT_SPEAK") {
		return <p className="text-foreground leading-relaxed">{step.step.text}</p>;
	}
	if (step.step.type === "JUDGE_EVALUATE") {
		return <p className="text-foreground leading-relaxed">{step.step.text}</p>;
	}
	return <p className="italic">System event</p>;
}

// Transcript list component
function TranscriptList({
	steps,
	currentStepIndex,
	onStepClick,
}: {
	steps: StepTiming[];
	currentStepIndex: number;
	onStepClick: (index: number) => void;
}) {
	return (
		<div>
			{steps.map((step, index) => {
				const isActive = index === currentStepIndex;
				const speaker =
					step.step.type === "AGENT_SPEAK"
						? step.step.agentId
						: step.step.type === "JUDGE_EVALUATE"
							? step.step.judgeId
							: "System";
				const confidence =
					step.step.type === "JUDGE_EVALUATE" ? step.step.confidence : null;
				const content =
					step.step.type === "AGENT_SPEAK"
						? step.step.text
						: step.step.type === "JUDGE_EVALUATE"
							? step.step.text
							: "";

				return (
					<button
						key={`${step.startMs}-${step.step.type}`}
						type="button"
						onClick={() => onStepClick(index)}
						className={`w-full border-border/50 border-b px-5 py-4 text-left transition-colors hover:bg-muted/50 ${
							isActive ? "bg-muted/80" : ""
						}`}
					>
						<div className="mb-2 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<Volume2 className="h-5 w-5 text-muted-foreground" />
								<span className="font-semibold">{speaker}</span>
								{confidence !== null && (
									<span className="rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground text-sm">
										{Math.round(confidence * 100)}%
									</span>
								)}
							</div>
							<span className="font-mono text-muted-foreground text-sm">
								{formatTime(step.startMs)}
							</span>
						</div>
						<p className="line-clamp-2 pl-8 text-muted-foreground">{content}</p>
					</button>
				);
			})}
		</div>
	);
}
