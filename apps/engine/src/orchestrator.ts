/**
 * LLM Court - Debate Orchestrator
 * Main entry point for running debates
 */

import { writeFile } from "node:fs/promises";
import { logger as baseLogger } from "@llm-court/logs";
import { SPEC_VERSION } from "@llm-court/shared/constants";
import type { DebateConfig, DebateOutput } from "@llm-court/shared/types";
import { getNextCandidate, runDebateRound } from "./debate/engine.js";
import { collectPositions, runJudgeRound } from "./judges/panel.js";
import {
	getCheckpointPath,
	loadCheckpoint,
	saveCheckpoint,
} from "./state/checkpoint.js";
import { StateManager } from "./state/manager.js";

export type RunDebateOptions = {
	outputPath?: string;
	resumeFrom?: string;
	jsonLogs?: boolean;
	debug?: boolean;
	force?: boolean;
};

type Logger = {
	info: (event: string, data?: Record<string, unknown>) => void;
	warn: (event: string, data?: Record<string, unknown>) => void;
	error: (event: string, data?: Record<string, unknown>) => void;
	debug: (event: string, data?: Record<string, unknown>) => void;
};

const createLogger = (
	sessionId: string,
	jsonLogs: boolean,
	debugEnabled: boolean,
): Logger => {
	// Create scoped loggers for different components
	const debateLog = baseLogger.scope("Debate");
	const agentLog = baseLogger.scope("Agent");
	const judgeLog = baseLogger.scope("Judge");

	const log = (
		level: string,
		event: string,
		data?: Record<string, unknown>,
	) => {
		if (jsonLogs) {
			// JSON mode for machine processing
			console.error(
				JSON.stringify({
					ts: new Date().toISOString(),
					level,
					sessionId,
					event,
					...data,
				}),
			);
		} else {
			// Pretty mode using scoped logger
			const dataStr = data ? ` ${JSON.stringify(data)}` : "";
			if (event.startsWith("agent_")) {
				if (level === "warn") agentLog.warn(`${event}${dataStr}`);
				else if (level === "error") agentLog.error(`${event}${dataStr}`);
				else if (level === "debug" && debugEnabled)
					agentLog.debug(`${event}${dataStr}`);
				else if (level === "info") agentLog.info(`${event}${dataStr}`);
			} else if (event.startsWith("judge_")) {
				if (level === "warn") judgeLog.warn(`${event}${dataStr}`);
				else if (level === "error") judgeLog.error(`${event}${dataStr}`);
				else if (level === "debug" && debugEnabled)
					judgeLog.debug(`${event}${dataStr}`);
				else if (level === "info") judgeLog.info(`${event}${dataStr}`);
			} else {
				if (level === "warn") debateLog.warn(`${event}${dataStr}`);
				else if (level === "error") debateLog.error(`${event}${dataStr}`);
				else if (level === "debug" && debugEnabled)
					debateLog.debug(`${event}${dataStr}`);
				else if (level === "info") debateLog.info(`${event}${dataStr}`);
			}
		}
	};

	return {
		info: (event, data) => log("info", event, data),
		warn: (event, data) => log("warn", event, data),
		error: (event, data) => log("error", event, data),
		debug: (event, data) => {
			if (debugEnabled) log("debug", event, data);
		},
	};
};

/**
 * Run a complete debate session
 */
export const runDebate = async (
	config: DebateConfig,
	options: RunDebateOptions = {},
): Promise<DebateOutput> => {
	const {
		outputPath,
		resumeFrom,
		jsonLogs = false,
		debug: debugEnabled = false,
	} = options;

	// Initialize or restore state
	let stateManager: StateManager;

	if (resumeFrom) {
		const checkpointData = await loadCheckpoint(resumeFrom);
		stateManager = new StateManager({
			config: checkpointData.config,
			sessionId: checkpointData.sessionId,
			initialPhase: checkpointData.phase,
			agentRounds: checkpointData.agentRounds,
			judgeRounds: checkpointData.judgeRounds,
		});
	} else {
		stateManager = new StateManager({ config });
	}

	const logger = createLogger(stateManager.sessionId, jsonLogs, debugEnabled);

	logger.info("session_start", {
		topic: config.topic,
		agents: config.agents.length,
		judges: config.judges.length,
		judgePanelEnabled: config.judgePanelEnabled,
	});

	// Transition to agent debate if starting fresh
	if (stateManager.phase === "init") {
		stateManager.transitionTo("agent_debate");
	}

	// === AGENT DEBATE PHASE ===
	if (stateManager.phase === "agent_debate") {
		await runAgentDebatePhase(stateManager, config, logger);
	}

	// === JUDGE EVALUATION PHASE ===
	if (stateManager.phase === "judge_evaluation") {
		await runJudgeEvaluationPhase(stateManager, config, logger);
	}

	// Build output
	const output = buildOutput(stateManager);

	// Write output if path specified
	if (outputPath) {
		await writeFile(outputPath, JSON.stringify(output, null, 2), "utf-8");
		logger.info("output_written", { path: outputPath });
	}

	logger.info("session_end", {
		phase: stateManager.phase,
		totalRounds:
			stateManager.session.agentRounds.length +
			stateManager.session.judgeRounds.length,
		totalTokens: stateManager.metadata.totalTokens,
		totalErrors: stateManager.metadata.totalErrors,
	});

	return output;
};

/**
 * Run the agent debate phase
 */
const runAgentDebatePhase = async (
	stateManager: StateManager,
	config: DebateConfig,
	logger: Logger,
): Promise<void> => {
	while (
		stateManager.phase === "agent_debate" &&
		stateManager.getCurrentAgentRound() <= config.maxAgentRounds
	) {
		const round = stateManager.getCurrentAgentRound();

		logger.info("round_start", { round, phase: "agent_debate" });

		// Get candidate from previous round
		const lastRound = stateManager.getLastAgentRound();
		const candidate =
			round === 1
				? { positionId: null, positionText: null }
				: lastRound
					? (getNextCandidate(lastRound) ?? {
							positionId: null,
							positionText: null,
						})
					: { positionId: null, positionText: null };

		// Run the round
		const roundResult = await runDebateRound(
			{
				round,
				candidatePositionId: candidate.positionId,
				candidatePositionText: candidate.positionText,
				history: stateManager.session.agentRounds,
			},
			{
				config,
				onAgentStart: (agentId, r) =>
					logger.debug("agent_start", { agentId, round: r }),
				onAgentComplete: (response) =>
					logger.debug("agent_complete", {
						agentId: response.agentId,
						vote: response.vote,
						confidence: response.confidence,
					}),
				onAgentError: (agentId, r, error) =>
					logger.warn("agent_error", {
						agentId,
						round: r,
						error: error.message,
					}),
				onRetry: (agentId, attempt, error) => {
					stateManager.incrementRetries();
					logger.warn("agent_retry", {
						agentId,
						attempt,
						error: error.message,
					});
				},
			},
		);

		stateManager.addAgentRound(roundResult);

		logger.info("round_end", {
			round,
			consensusReached: roundResult.consensusReached,
			voteTally: roundResult.voteTally,
		});

		// Save checkpoint if configured
		if (config.checkpointDir) {
			const checkpointPath = getCheckpointPath(
				config.checkpointDir,
				stateManager.sessionId,
			);
			await saveCheckpoint(checkpointPath, {
				sessionId: stateManager.sessionId,
				phase: stateManager.phase,
				config,
				agentRounds: stateManager.session.agentRounds,
				judgeRounds: stateManager.session.judgeRounds,
			});
			stateManager.setCheckpointPath(checkpointPath);
		}

		// Check if consensus reached
		if (
			roundResult.consensusReached &&
			roundResult.consensusPositionId &&
			roundResult.consensusPositionText
		) {
			stateManager.transitionTo("consensus_reached");
			stateManager.setFinalVerdict({
				positionId: roundResult.consensusPositionId,
				positionText: roundResult.consensusPositionText,
				confidence:
					roundResult.responses
						.filter((r) => r.vote === "yes")
						.reduce((sum, r) => sum + r.confidence, 0) /
					roundResult.responses.filter((r) => r.vote === "yes").length,
				source: "agent_consensus",
			});
			return;
		}
	}

	// Max agent rounds reached without consensus
	// Decide whether to go to judge evaluation or deadlock
	const positions = collectPositions(
		stateManager.session.agentRounds,
		config.judgePositionsScope,
	);

	if (
		config.judgePanelEnabled &&
		positions.size >= 2 &&
		config.judges.length >= 3
	) {
		logger.info("entering_judge_phase", { positions: positions.size });
		stateManager.transitionTo("judge_evaluation");
	} else {
		logger.info("deadlock", {
			reason: !config.judgePanelEnabled
				? "judge_panel_disabled"
				: positions.size < 2
					? "insufficient_positions"
					: "insufficient_judges",
		});
		stateManager.transitionTo("deadlock");

		// Set deadlock verdict with best position
		const lastRound = stateManager.getLastAgentRound();
		if (lastRound) {
			const candidate = getNextCandidate(lastRound);
			if (candidate) {
				stateManager.setFinalVerdict({
					positionId: candidate.positionId,
					positionText: candidate.positionText,
					confidence: 0,
					source: "deadlock",
				});
			}
		}
	}
};

/**
 * Run the judge evaluation phase
 */
const runJudgeEvaluationPhase = async (
	stateManager: StateManager,
	config: DebateConfig,
	logger: Logger,
): Promise<void> => {
	const positions = collectPositions(
		stateManager.session.agentRounds,
		config.judgePositionsScope,
	);

	while (
		stateManager.phase === "judge_evaluation" &&
		stateManager.getCurrentJudgeRound() <= config.maxJudgeRounds
	) {
		const round = stateManager.getCurrentJudgeRound();

		logger.info("round_start", { round, phase: "judge_evaluation" });

		// Run the judge round
		const roundResult = await runJudgeRound(
			{
				round,
				positions,
				agentRounds: stateManager.session.agentRounds,
			},
			{
				config,
				onJudgeStart: (judgeId, r) =>
					logger.debug("judge_start", { judgeId, round: r }),
				onJudgeComplete: (evaluation) =>
					logger.debug("judge_complete", {
						judgeId: evaluation.judgeId,
						selectedPositionId: evaluation.selectedPositionId,
						confidence: evaluation.confidence,
					}),
				onJudgeError: (judgeId, r, error) =>
					logger.warn("judge_error", {
						judgeId,
						round: r,
						error: error.message,
					}),
				onRetry: (judgeId, attempt, error) => {
					stateManager.incrementRetries();
					logger.warn("judge_retry", {
						judgeId,
						attempt,
						error: error.message,
					});
				},
			},
		);

		stateManager.addJudgeRound(roundResult);

		logger.info("round_end", {
			round,
			consensusReached: roundResult.consensusReached,
			avgConfidence: roundResult.avgConfidence,
		});

		// Save checkpoint if configured
		if (config.checkpointDir) {
			const checkpointPath = getCheckpointPath(
				config.checkpointDir,
				stateManager.sessionId,
			);
			await saveCheckpoint(checkpointPath, {
				sessionId: stateManager.sessionId,
				phase: stateManager.phase,
				config,
				agentRounds: stateManager.session.agentRounds,
				judgeRounds: stateManager.session.judgeRounds,
			});
		}

		// Check if consensus reached
		if (roundResult.consensusReached && roundResult.consensusPositionId) {
			stateManager.transitionTo("consensus_reached");
			stateManager.setFinalVerdict({
				positionId: roundResult.consensusPositionId,
				positionText: positions.get(roundResult.consensusPositionId) ?? "",
				confidence: roundResult.avgConfidence,
				source: "judge_consensus",
			});
			return;
		}
	}

	// Max judge rounds reached without consensus - deadlock
	logger.info("deadlock", { reason: "judge_max_rounds" });
	stateManager.transitionTo("deadlock");

	// Set deadlock verdict with best judge position
	const lastJudgeRound = stateManager.getLastJudgeRound();
	if (lastJudgeRound?.consensusPositionId) {
		stateManager.setFinalVerdict({
			positionId: lastJudgeRound.consensusPositionId,
			positionText: positions.get(lastJudgeRound.consensusPositionId) ?? "",
			confidence: lastJudgeRound.avgConfidence,
			source: "deadlock",
		});
	}
};

/**
 * Build the final output
 */
const buildOutput = (stateManager: StateManager): DebateOutput => {
	const session = stateManager.session;
	const lastAgentRound = stateManager.getLastAgentRound();

	return {
		version: SPEC_VERSION,
		session: {
			id: session.id,
			topic: session.topic,
			initialQuery: session.initialQuery,
			phase: session.phase,
			startedAt: session.metadata.startedAt,
			completedAt: session.metadata.completedAt,
			totalTokens: session.metadata.totalTokens,
			totalCostUsd: session.metadata.totalCostUsd,
			pricingKnown: session.metadata.pricingKnown,
			engineVersion: session.metadata.engineVersion,
			totalRetries: session.metadata.totalRetries,
			totalErrors: session.metadata.totalErrors,
		},
		agentDebate: {
			rounds: session.agentRounds,
			finalPositionId: lastAgentRound?.consensusPositionId ?? null,
			finalPositionText: lastAgentRound?.consensusPositionText ?? null,
		},
		judgePanel: {
			enabled: session.config.judgePanelEnabled,
			rounds: session.judgeRounds,
			final:
				session.judgeRounds.length > 0
					? {
							consensusPositionId: session.finalVerdict?.positionId ?? "",
							consensusPositionText: session.finalVerdict?.positionText ?? "",
							consensusConfidence: session.finalVerdict?.confidence ?? 0,
							dissents: [],
						}
					: null,
		},
		finalVerdict: session.finalVerdict ?? {
			positionId: "",
			positionText: "",
			confidence: 0,
			source: "deadlock",
		},
	};
};
