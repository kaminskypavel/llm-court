"use client";

import { Clock, Info, MessageSquare, Scale, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatTime } from "@/lib/player/durations";
import type { ValidatedDebateOutput } from "@/lib/player/schema";
import type { StepTiming, VoteTally } from "@/lib/player/types";
import { CollapsiblePanel } from "./CollapsiblePanel";

type InfoPanelProps = {
	debate: ValidatedDebateOutput | null;
	currentStep: StepTiming | null;
	currentTimeMs: number;
	totalDurationMs: number;
	currentStepIndex: number;
	totalSteps: number;
};

function VoteTallyDisplay({ tally }: { tally: VoteTally }) {
	const total = tally.yes + tally.no + tally.abstain;
	if (total === 0) return null;

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between text-sm">
				<span>Yes</span>
				<span className="font-medium text-green-600">{tally.yes}</span>
			</div>
			<Progress
				value={(tally.yes / total) * 100}
				className="h-2 bg-muted [&>div]:bg-green-600"
			/>

			<div className="flex items-center justify-between text-sm">
				<span>No</span>
				<span className="font-medium text-red-600">{tally.no}</span>
			</div>
			<Progress
				value={(tally.no / total) * 100}
				className="h-2 bg-muted [&>div]:bg-red-600"
			/>

			{tally.abstain > 0 && (
				<>
					<div className="flex items-center justify-between text-sm">
						<span>Abstain</span>
						<span className="font-medium text-muted-foreground">
							{tally.abstain}
						</span>
					</div>
					<Progress
						value={(tally.abstain / total) * 100}
						className="h-2 bg-muted [&>div]:bg-gray-400"
					/>
				</>
			)}

			{tally.supermajorityReached && (
				<Badge variant="secondary" className="mt-2 w-full justify-center">
					Supermajority Reached
				</Badge>
			)}
		</div>
	);
}

export function InfoPanel({
	debate,
	currentStep,
	currentTimeMs,
	totalDurationMs,
	currentStepIndex,
	totalSteps,
}: InfoPanelProps) {
	if (!debate) {
		return (
			<CollapsiblePanel
				title="Debate Info"
				icon={<Info className="h-4 w-4" />}
				className="h-full"
			>
				<div className="flex h-full items-center justify-center p-4">
					<p className="text-muted-foreground text-sm">No debate loaded</p>
				</div>
			</CollapsiblePanel>
		);
	}

	const step = currentStep?.step;

	return (
		<CollapsiblePanel
			title="Debate Info"
			icon={<Info className="h-4 w-4" />}
			className="h-full"
			contentClassName="overflow-y-auto"
		>
			<div className="space-y-4 p-3">
				{/* Time & Progress */}
				<div className="space-y-2">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<Clock className="h-3 w-3" />
						<span>Progress</span>
					</div>
					<div className="flex items-center justify-between text-sm">
						<span>{formatTime(currentTimeMs)}</span>
						<span className="text-muted-foreground">
							{formatTime(totalDurationMs)}
						</span>
					</div>
					<Progress
						value={(currentTimeMs / totalDurationMs) * 100}
						className="h-1.5"
					/>
					<p className="text-muted-foreground text-xs">
						Step {currentStepIndex + 1} of {totalSteps}
					</p>
				</div>

				{/* Current Step */}
				{step && (
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-muted-foreground text-xs">
							<MessageSquare className="h-3 w-3" />
							<span>Current Step</span>
						</div>
						<Badge variant="outline" className="w-fit">
							{step.type.replace(/_/g, " ")}
						</Badge>

						{step.type === "AGENT_SPEAK" && (
							<div className="space-y-1 text-sm">
								<p>
									<span className="text-muted-foreground">Agent:</span>{" "}
									{step.agentId}
								</p>
								<p>
									<span className="text-muted-foreground">Vote:</span>{" "}
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
								</p>
								<p>
									<span className="text-muted-foreground">Confidence:</span>{" "}
									{(step.confidence * 100).toFixed(0)}%
								</p>
							</div>
						)}

						{step.type === "JUDGE_EVALUATE" && (
							<div className="space-y-1 text-sm">
								<p>
									<span className="text-muted-foreground">Judge:</span>{" "}
									{step.judgeId}
								</p>
								<p>
									<span className="text-muted-foreground">Confidence:</span>{" "}
									{(step.confidence * 100).toFixed(0)}%
								</p>
							</div>
						)}

						{step.type === "ROUND_START" && (
							<p className="text-sm">
								<span className="text-muted-foreground">Round:</span>{" "}
								{step.round}
							</p>
						)}

						{step.type === "VOTE_TALLY" && (
							<VoteTallyDisplay tally={step.tally} />
						)}

						{step.type === "FINAL_VERDICT" && (
							<div className="space-y-2 text-sm">
								<p>
									<span className="text-muted-foreground">Source:</span>{" "}
									<Badge variant="secondary">
										{step.source.replace(/_/g, " ")}
									</Badge>
								</p>
								<p>
									<span className="text-muted-foreground">Confidence:</span>{" "}
									{(step.confidence * 100).toFixed(0)}%
								</p>
								{step.positionText && (
									<p className="line-clamp-3 text-xs">{step.positionText}</p>
								)}
							</div>
						)}
					</div>
				)}

				{/* Session Stats */}
				<div className="space-y-2">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<Scale className="h-3 w-3" />
						<span>Session</span>
					</div>
					<div className="grid grid-cols-2 gap-2 text-sm">
						<div>
							<p className="text-muted-foreground text-xs">Phase</p>
							<Badge variant="outline" className="mt-1">
								{debate.session.phase.replace(/_/g, " ")}
							</Badge>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Rounds</p>
							<p className="font-medium">{debate.agentDebate.rounds.length}</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Tokens</p>
							<p className="font-medium">
								{debate.session.totalTokens.toLocaleString()}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Cost</p>
							<p className="font-medium">
								${debate.session.totalCostUsd.toFixed(2)}
							</p>
						</div>
					</div>
				</div>

				{/* Final Verdict */}
				{debate.finalVerdict && (
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-muted-foreground text-xs">
							<Users className="h-3 w-3" />
							<span>Final Verdict</span>
						</div>
						<div className="space-y-1 rounded-md bg-muted/50 p-2 text-sm">
							<Badge
								variant={
									debate.finalVerdict.source === "agent_consensus"
										? "default"
										: debate.finalVerdict.source === "judge_consensus"
											? "secondary"
											: "destructive"
								}
							>
								{debate.finalVerdict.source.replace(/_/g, " ")}
							</Badge>
							<p className="line-clamp-4 text-xs">
								{debate.finalVerdict.positionText}
							</p>
						</div>
					</div>
				)}
			</div>
		</CollapsiblePanel>
	);
}
