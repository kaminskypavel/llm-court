"use client";

import { Info, List } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatTime } from "@/lib/player/durations";
import type { ValidatedDebateOutput } from "@/lib/player/schema";
import type { StepTiming } from "@/lib/player/types";
import { cn } from "@/lib/utils";
import { PlaybackControls } from "./PlaybackControls";
import { TranscriptPanel } from "./TranscriptPanel";

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

type MobileTab = "transcript" | "info";

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
	onPlay,
	onPause,
	onSeek,
	onSpeedChange,
	onStepForward,
	onStepBackward,
	onJumpToStart,
	onJumpToEnd,
	onReset,
}: MobilePlayerProps) {
	const [activeTab, setActiveTab] = useState<MobileTab>("transcript");

	if (!debate) {
		return (
			<div className="flex h-full items-center justify-center p-4">
				<p className="text-muted-foreground text-sm">No debate loaded</p>
			</div>
		);
	}

	const step = currentStep?.step;

	return (
		<div className="flex h-full flex-col">
			{/* Header with current step summary */}
			<div className="border-b p-3">
				<div className="flex items-center justify-between">
					<h1 className="line-clamp-1 font-semibold text-base">
						{debate.session.topic}
					</h1>
					<span className="text-muted-foreground text-xs">
						{formatTime(currentTimeMs)} / {formatTime(totalDurationMs)}
					</span>
				</div>

				{/* Current step indicator */}
				{step && (
					<div className="mt-2 flex items-center gap-2">
						<Badge variant="outline" className="text-xs">
							{step.type.replace(/_/g, " ")}
						</Badge>
						{"agentId" in step && (
							<span className="truncate text-muted-foreground text-xs">
								{step.agentId}
							</span>
						)}
						{"judgeId" in step && (
							<span className="truncate text-muted-foreground text-xs">
								{step.judgeId}
							</span>
						)}
					</div>
				)}
			</div>

			{/* Tab switcher */}
			<div className="flex border-b">
				<button
					type="button"
					className={cn(
						"flex flex-1 items-center justify-center gap-2 py-3 text-sm transition-colors",
						activeTab === "transcript"
							? "border-primary border-b-2 font-medium"
							: "text-muted-foreground",
					)}
					onClick={() => setActiveTab("transcript")}
				>
					<List className="h-4 w-4" />
					Transcript
				</button>
				<button
					type="button"
					className={cn(
						"flex flex-1 items-center justify-center gap-2 py-3 text-sm transition-colors",
						activeTab === "info"
							? "border-primary border-b-2 font-medium"
							: "text-muted-foreground",
					)}
					onClick={() => setActiveTab("info")}
				>
					<Info className="h-4 w-4" />
					Details
				</button>
			</div>

			{/* Tab content */}
			<div className="min-h-0 flex-1 overflow-hidden">
				{activeTab === "transcript" && (
					<TranscriptPanel
						steps={steps}
						currentStepIndex={currentStepIndex}
						onStepClick={(index) => {
							const targetStep = steps[index];
							if (targetStep) {
								onSeek(targetStep.startMs);
							}
						}}
					/>
				)}

				{activeTab === "info" && (
					<div className="h-full overflow-y-auto p-4">
						{/* Current step details */}
						{step && (
							<Card className="mb-4 p-3">
								<h3 className="mb-2 font-medium text-sm">Current Step</h3>
								<div className="space-y-2 text-sm">
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground">Type</span>
										<Badge variant="outline">
											{step.type.replace(/_/g, " ")}
										</Badge>
									</div>

									{step.type === "AGENT_SPEAK" && (
										<>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Agent</span>
												<span>{step.agentId}</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Vote</span>
												<Badge
													variant={
														step.vote === "yes"
															? "default"
															: step.vote === "no"
																? "destructive"
																: "secondary"
													}
												>
													{step.vote}
												</Badge>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">
													Confidence
												</span>
												<span>{(step.confidence * 100).toFixed(0)}%</span>
											</div>
											<div className="mt-2 border-t pt-2">
												<p className="text-muted-foreground text-xs">
													Position
												</p>
												<p className="text-sm">{step.text.slice(0, 200)}...</p>
											</div>
										</>
									)}

									{step.type === "JUDGE_EVALUATE" && (
										<>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Judge</span>
												<span>{step.judgeId}</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">
													Confidence
												</span>
												<span>{(step.confidence * 100).toFixed(0)}%</span>
											</div>
											<div className="mt-2 border-t pt-2">
												<p className="text-muted-foreground text-xs">
													Evaluation
												</p>
												<p className="text-sm">{step.text.slice(0, 200)}...</p>
											</div>
										</>
									)}

									{step.type === "VOTE_TALLY" && (
										<>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Yes</span>
												<span className="text-green-600">{step.tally.yes}</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">No</span>
												<span className="text-red-600">{step.tally.no}</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Abstain</span>
												<span>{step.tally.abstain}</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">
													Supermajority
												</span>
												<Badge
													variant={
														step.tally.supermajorityReached
															? "default"
															: "secondary"
													}
												>
													{step.tally.supermajorityReached ? "Yes" : "No"}
												</Badge>
											</div>
										</>
									)}

									{step.type === "FINAL_VERDICT" && (
										<>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Source</span>
												<Badge variant="secondary">
													{step.source.replace(/_/g, " ")}
												</Badge>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">
													Confidence
												</span>
												<span>{(step.confidence * 100).toFixed(0)}%</span>
											</div>
											{step.positionText && (
												<div className="mt-2 border-t pt-2">
													<p className="text-muted-foreground text-xs">
														Verdict
													</p>
													<p className="text-sm">{step.positionText}</p>
												</div>
											)}
										</>
									)}
								</div>
							</Card>
						)}

						{/* Session info */}
						<Card className="p-3">
							<h3 className="mb-2 font-medium text-sm">Session Info</h3>
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<p className="text-muted-foreground text-xs">Phase</p>
									<Badge variant="outline" className="mt-1">
										{debate.session.phase.replace(/_/g, " ")}
									</Badge>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Rounds</p>
									<p className="font-medium">
										{debate.agentDebate.rounds.length}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Steps</p>
									<p className="font-medium">{steps.length}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Tokens</p>
									<p className="font-medium">
										{debate.session.totalTokens.toLocaleString()}
									</p>
								</div>
							</div>
						</Card>
					</div>
				)}
			</div>

			{/* Controls */}
			<div className="border-t p-3">
				<PlaybackControls
					isPlaying={isPlaying}
					playbackSpeed={playbackSpeed}
					disabled={!canPlay}
					onPlay={onPlay}
					onPause={onPause}
					onStepForward={onStepForward}
					onStepBackward={onStepBackward}
					onJumpToStart={onJumpToStart}
					onJumpToEnd={onJumpToEnd}
					onSpeedChange={onSpeedChange}
					onReset={onReset}
				/>
			</div>
		</div>
	);
}
