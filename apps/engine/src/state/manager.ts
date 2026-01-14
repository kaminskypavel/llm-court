/**
 * LLM Court - State Manager
 */

import { ENGINE_VERSION } from "@llm-court/shared/constants";
import { InvalidStateTransitionError } from "@llm-court/shared/errors";
import type {
	DebateConfig,
	DebatePhase,
	DebateSession,
	FinalVerdict,
	JudgeRoundResult,
	RoundResult,
	SessionMetadata,
} from "@llm-court/shared/types";
import { generateSessionId } from "../utils.js";

// Valid state transitions
const VALID_TRANSITIONS: Record<DebatePhase, DebatePhase[]> = {
	init: ["agent_debate"],
	agent_debate: ["consensus_reached", "judge_evaluation", "deadlock"],
	judge_evaluation: ["consensus_reached", "deadlock"],
	consensus_reached: [],
	deadlock: [],
};

export type StateManagerOptions = {
	config: DebateConfig;
	sessionId?: string;
	initialPhase?: DebatePhase;
	agentRounds?: RoundResult[];
	judgeRounds?: JudgeRoundResult[];
};

/**
 * State manager for a debate session
 */
export class StateManager {
	private _session: DebateSession;

	constructor(options: StateManagerOptions) {
		const { config, sessionId, initialPhase, agentRounds, judgeRounds } =
			options;

		this._session = {
			id: sessionId ?? generateSessionId(),
			topic: config.topic,
			initialQuery: config.initialQuery ?? null,
			phase: initialPhase ?? "init",
			config,
			agentRounds: agentRounds ?? [],
			judgeRounds: judgeRounds ?? [],
			finalVerdict: null,
			metadata: {
				engineVersion: ENGINE_VERSION,
				startedAt: new Date().toISOString(),
				completedAt: null,
				totalTokens: 0,
				totalCostUsd: 0,
				pricingKnown: false,
				checkpointPath: null,
				totalRetries: 0,
				totalErrors: 0,
			},
		};
	}

	get session(): DebateSession {
		return this._session;
	}

	get phase(): DebatePhase {
		return this._session.phase;
	}

	get sessionId(): string {
		return this._session.id;
	}

	get metadata(): SessionMetadata {
		return this._session.metadata;
	}

	/**
	 * Transition to a new phase
	 */
	transitionTo(newPhase: DebatePhase): void {
		const validNextPhases = VALID_TRANSITIONS[this._session.phase];

		if (!validNextPhases?.includes(newPhase)) {
			throw new InvalidStateTransitionError(this._session.phase, newPhase);
		}

		this._session.phase = newPhase;

		// Set completion time for terminal states
		if (newPhase === "consensus_reached" || newPhase === "deadlock") {
			this._session.metadata.completedAt = new Date().toISOString();
		}
	}

	/**
	 * Add an agent round result
	 */
	addAgentRound(round: RoundResult): void {
		this._session.agentRounds.push(round);
		this.updateMetadataFromRound(round);
	}

	/**
	 * Add a judge round result
	 */
	addJudgeRound(round: JudgeRoundResult): void {
		this._session.judgeRounds.push(round);
		this.updateMetadataFromJudgeRound(round);
	}

	/**
	 * Set the final verdict
	 */
	setFinalVerdict(verdict: FinalVerdict): void {
		this._session.finalVerdict = verdict;
	}

	/**
	 * Update metadata from an agent round
	 */
	private updateMetadataFromRound(round: RoundResult): void {
		for (const response of round.responses) {
			this._session.metadata.totalTokens += response.tokenUsage.total;

			if (response.status === "error") {
				this._session.metadata.totalErrors += 1;
			}
		}
	}

	/**
	 * Update metadata from a judge round
	 */
	private updateMetadataFromJudgeRound(round: JudgeRoundResult): void {
		for (const evaluation of round.evaluations) {
			this._session.metadata.totalTokens += evaluation.tokenUsage.total;

			if (evaluation.status === "error") {
				this._session.metadata.totalErrors += 1;
			}
		}
	}

	/**
	 * Increment retry counter
	 */
	incrementRetries(): void {
		this._session.metadata.totalRetries += 1;
	}

	/**
	 * Set checkpoint path
	 */
	setCheckpointPath(path: string): void {
		this._session.metadata.checkpointPath = path;
	}

	/**
	 * Check if in terminal state
	 */
	isTerminal(): boolean {
		return (
			this._session.phase === "consensus_reached" ||
			this._session.phase === "deadlock"
		);
	}

	/**
	 * Get current agent round number
	 */
	getCurrentAgentRound(): number {
		return this._session.agentRounds.length + 1;
	}

	/**
	 * Get current judge round number
	 */
	getCurrentJudgeRound(): number {
		return this._session.judgeRounds.length + 1;
	}

	/**
	 * Get the last agent round result
	 */
	getLastAgentRound(): RoundResult | undefined {
		return this._session.agentRounds.at(-1);
	}

	/**
	 * Get the last judge round result
	 */
	getLastJudgeRound(): JudgeRoundResult | undefined {
		return this._session.judgeRounds.at(-1);
	}
}
