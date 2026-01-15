"use client";

import {
	AlertCircle,
	Coins,
	Loader2,
	MessageSquare,
	ScrollText,
	Zap,
} from "lucide-react";
import { useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
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
import { saveToRecent } from "@/lib/player/storage";
import { AriaLiveAnnouncer } from "./AriaLiveAnnouncer";
import { CollapsibleSidebar } from "./CollapsibleSidebar";
import { DebateDropZone } from "./DebateDropZone";
import { DynamicCourtroomCanvas } from "./DynamicCanvas";
import { MobilePlayer } from "./MobilePlayer";
import { PlaybackControls } from "./PlaybackControls";
import { RecentDebates } from "./RecentDebates";
import { SpeechBubble } from "./SpeechBubble";
import { Timeline } from "./Timeline";
import { TranscriptPanel } from "./TranscriptPanel";

type DebatePlayerProps = {
	initialUrl?: string;
};

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
			// Skip if user is typing in an input
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
				return;
			}

			switch (e.key) {
				case " ": // Space - play/pause
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
			<div className="flex h-full flex-col gap-6 p-6">
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

	// Ready/Playing/Paused state - show player
	// Mobile: transcript-first layout
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

	// Desktop/Tablet: Full player layout
	return (
		<>
			<AriaLiveAnnouncer
				currentStep={currentStep}
				isPlaying={isPlaying}
				playbackSpeed={context.playbackSpeed}
			/>
			<div className="flex h-full flex-col">
				{/* Header with key stats */}
				<header className="flex items-start justify-between gap-4 border-b px-4 py-3">
					<div className="min-w-0 flex-1">
						<h1 className="truncate font-semibold text-lg">
							{context.debate?.session.topic ?? "Debate Player"}
						</h1>
						<div className="mt-1 flex flex-wrap items-center gap-2">
							{context.debate && (
								<>
									<Badge variant="outline" className="text-xs">
										{context.debate.agentDebate.rounds.length} rounds
									</Badge>
									<Badge variant="outline" className="text-xs">
										{context.steps.length} steps
									</Badge>
									<Badge
										variant={
											context.debate.session.phase === "consensus_reached"
												? "default"
												: context.debate.session.phase === "deadlock"
													? "destructive"
													: "secondary"
										}
										className="text-xs"
									>
										{context.debate.session.phase.replace(/_/g, " ")}
									</Badge>
								</>
							)}
						</div>
					</div>
					{/* Quick stats */}
					{context.debate && (
						<div className="flex shrink-0 items-center gap-3 text-muted-foreground text-xs">
							<span className="flex items-center gap-1">
								<Zap className="h-3 w-3" />
								{context.debate.session.totalTokens.toLocaleString()}
							</span>
							<span className="flex items-center gap-1">
								<Coins className="h-3 w-3" />$
								{context.debate.session.totalCostUsd.toFixed(2)}
							</span>
						</div>
					)}
				</header>

				{/* Main content area with collapsible sidebars */}
				<div className="flex min-h-0 flex-1 overflow-hidden">
					{/* Center: Canvas + Bottom sidebar */}
					<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
						{/* Canvas area - takes remaining space */}
						<div className="relative min-h-[200px] flex-1 overflow-hidden">
							<DynamicCourtroomCanvas
								currentStep={currentStep}
								debate={context.debate}
							/>
						</div>

						{/* Bottom collapsible sidebar: Speech + Verdict */}
						<CollapsibleSidebar
							title="Current Speech"
							icon={<MessageSquare className="h-4 w-4" />}
							position="bottom"
							height="h-56"
							badge={
								currentStep?.step.type === "AGENT_SPEAK"
									? currentStep.step.agentId
									: currentStep?.step.type === "JUDGE_EVALUATE"
										? currentStep.step.judgeId
										: undefined
							}
						>
							<div className="flex h-full flex-col overflow-hidden p-3">
								<div className="flex-1 overflow-auto">
									<SpeechBubble
										currentStep={currentStep}
										isPlaying={isPlaying}
									/>
								</div>
								{/* Final verdict banner (when reached) */}
								{context.debate?.finalVerdict && (
									<Card className="mt-2 shrink-0 border-primary/50 bg-primary/5 p-2">
										<div className="flex items-start gap-2">
											<Badge variant="default" className="shrink-0 text-xs">
												{context.debate.finalVerdict.source.replace(/_/g, " ")}
											</Badge>
											<div className="min-w-0 flex-1">
												<p className="line-clamp-1 text-xs">
													{context.debate.finalVerdict.positionText}
												</p>
											</div>
										</div>
									</Card>
								)}
							</div>
						</CollapsibleSidebar>
					</div>

					{/* Right collapsible sidebar: Transcript */}
					<CollapsibleSidebar
						title="Transcript"
						icon={<ScrollText className="h-4 w-4" />}
						position="right"
						width="w-80"
						badge={context.steps.length}
						className="hidden lg:flex"
					>
						<TranscriptPanel
							steps={context.steps}
							currentStepIndex={context.currentStepIndex}
							onStepClick={(index) => {
								const step = context.steps[index];
								if (step) {
									seek(step.startMs);
								}
							}}
						/>
					</CollapsibleSidebar>
				</div>

				{/* Controls */}
				<div className="border-t p-4">
					<div className="space-y-4">
						<Timeline
							steps={context.steps}
							currentStepIndex={context.currentStepIndex}
							currentTimeMs={currentTimeMs}
							totalDurationMs={context.totalDurationMs}
							onSeek={seek}
						/>
						<PlaybackControls
							isPlaying={isPlaying}
							playbackSpeed={context.playbackSpeed}
							disabled={!canPlay}
							onPlay={play}
							onPause={pause}
							onStepForward={stepForward}
							onStepBackward={stepBackward}
							onJumpToStart={jumpToStart}
							onJumpToEnd={jumpToEnd}
							onSpeedChange={setSpeed}
							onReset={reset}
						/>
					</div>
				</div>
			</div>
		</>
	);
}
