/**
 * LLM Court - Core Types
 * Version: 2.3.0
 */

// === Enums (as const objects for better type inference) ===

export const DebatePhase = {
	INIT: "init",
	AGENT_DEBATE: "agent_debate",
	JUDGE_EVALUATION: "judge_evaluation",
	CONSENSUS_REACHED: "consensus_reached",
	DEADLOCK: "deadlock",
} as const;
export type DebatePhase = (typeof DebatePhase)[keyof typeof DebatePhase];

export const Vote = {
	YES: "yes",
	NO: "no",
	ABSTAIN: "abstain",
} as const;
export type Vote = (typeof Vote)[keyof typeof Vote];

export const ContextTopology = {
	FULL_HISTORY: "full_history",
	LAST_ROUND: "last_round",
	LAST_ROUND_WITH_SELF: "last_round_with_self",
	SUMMARY: "summary",
} as const;
export type ContextTopology =
	(typeof ContextTopology)[keyof typeof ContextTopology];

export const Provider = {
	OPENAI: "openai",
	ANTHROPIC: "anthropic",
	GOOGLE: "google",
	CLI: "cli",
	CODEX: "codex",
	GEMINI_CLI: "gemini-cli",
} as const;
export type Provider = (typeof Provider)[keyof typeof Provider];

export const ChatTemplate = {
	CHATML: "chatml",
	LLAMA3: "llama3",
	GEMMA: "gemma",
} as const;
export type ChatTemplate = (typeof ChatTemplate)[keyof typeof ChatTemplate];

// === Agent Types ===

export type AgentId = string;
export type JudgeId = string;
export type PositionId = string | null; // 12-char hex or null for errors
export type SessionId = string; // UUIDv7

export type TokenUsage = {
	prompt: number;
	completion: number;
	total: number;
	estimated: boolean;
};

export type AgentResponse = {
	agentId: AgentId;
	round: number;
	positionId: PositionId;
	positionText: string;
	reasoning: string;
	vote: Vote;
	confidence: number; // 0.0-1.0
	tokenUsage: TokenUsage;
	latencyMs: number;
	status: "ok" | "error";
	error: string | null;
};

// === Round Types ===

export type VoteTally = {
	yes: number;
	no: number;
	abstain: number;
	total: number;
	eligible: number; // Responses with status=ok
	votingTotal: number; // yes + no (from eligible)
	supermajorityThreshold: number;
	supermajorityReached: boolean;
};

export type RoundResult = {
	roundNumber: number;
	candidatePositionId: PositionId;
	candidatePositionText: string | null;
	responses: AgentResponse[];
	consensusReached: boolean;
	consensusPositionId: PositionId;
	consensusPositionText: string | null;
	voteTally: VoteTally;
	timestamp: string; // ISO-8601
};

// === Judge Types ===

export type JudgeEvaluation = {
	judgeId: JudgeId;
	round: number;
	selectedPositionId: PositionId;
	scoresByPositionId: Record<string, number>; // 0-100
	reasoning: string;
	confidence: number;
	tokenUsage: TokenUsage;
	latencyMs: number;
	status: "ok" | "error";
	error: string | null;
};

export type JudgeRoundResult = {
	roundNumber: number;
	positionIds: string[];
	evaluations: JudgeEvaluation[];
	consensusReached: boolean;
	consensusPositionId: PositionId;
	avgConfidence: number;
	timestamp: string;
};

export type JudgePanelResult = {
	rounds: JudgeRoundResult[];
	consensusPositionId: string;
	consensusPositionText: string;
	consensusConfidence: number;
	dissents: JudgeId[];
};

export type JudgeConsensusResult = {
	reached: boolean;
	positionId: PositionId;
	positionText: string | null;
	confidence: number;
	dissents: JudgeId[];
};

// === Session Types ===

export type FinalVerdict = {
	positionId: string;
	positionText: string;
	confidence: number;
	source: "agent_consensus" | "judge_consensus" | "deadlock";
};

export type SessionMetadata = {
	engineVersion: string;
	startedAt: string;
	completedAt: string | null;
	totalTokens: number;
	totalCostUsd: number;
	pricingKnown: boolean;
	checkpointPath: string | null;
	totalRetries: number;
	totalErrors: number;
};

export type DebateSession = {
	id: SessionId;
	topic: string;
	initialQuery: string | null;
	phase: DebatePhase;
	config: DebateConfig;
	agentRounds: RoundResult[];
	judgeRounds: JudgeRoundResult[];
	finalVerdict: FinalVerdict | null;
	metadata: SessionMetadata;
};

// === Configuration Types ===

export type ModelConfig = {
	provider: Provider;
	model: string;
	apiKeyEnv?: string;
	cliPath?: string;
	cliArgs?: string[]; // Supports {{PROMPT}}, {{MAX_TOKENS}}, {{TEMPERATURE}}
	chatTemplate?: ChatTemplate;
	// Codex-specific options
	reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
	enableSearch?: boolean;
};

export type AgentConfig = {
	id: AgentId;
	model: ModelConfig;
	systemPrompt?: string;
	temperature?: number; // 0-2, default: 0.7
};

export type JudgeConfig = {
	id: JudgeId;
	model: ModelConfig;
	systemPrompt?: string;
	temperature?: number; // 0-2, default: 0.3
};

export type TimeoutConfig = {
	modelMs: number; // default: 120000
	roundMs: number; // default: 300000
	sessionMs: number; // default: 1200000
};

export type RetryConfig = {
	maxAttempts: number; // default: 2
	baseDelayMs: number; // default: 1000
	maxDelayMs: number; // default: 8000
};

export type ConcurrencyConfig = {
	maxConcurrentRequests: number; // default: 4
};

export type LimitConfig = {
	maxTokensPerResponse: number; // default: 2048
	maxTotalTokens: number; // default: 200000
	maxTotalCostUsd: number; // default: 25
	maxContextTokens: number; // default: 12000
};

export type DebateConfig = {
	topic: string;
	initialQuery?: string;
	agents: AgentConfig[];
	judges: JudgeConfig[];
	judgePanelEnabled: boolean; // default: true
	maxAgentRounds: number; // default: 4, range: 1-10
	maxJudgeRounds: number; // default: 3, range: 1-5
	consensusThreshold: number; // default: 0.67, range: 0.5-1.0
	judgeConsensusThreshold: number; // default: 0.6, range: 0.5-1.0
	judgeMinConfidence: number; // default: 0.7, range: 0.0-1.0
	judgePositionsScope: "all_rounds" | "last_round"; // default: 'all_rounds'
	contextTopology: ContextTopology;
	checkpointDir: string | null;
	timeouts: TimeoutConfig;
	retries: RetryConfig;
	concurrency: ConcurrencyConfig;
	limits: LimitConfig;
	deterministicMode: boolean; // default: false
	allowExternalPaths: boolean; // default: false
};

// === Consensus Detection ===

export type ConsensusResult = {
	reached: boolean;
	positionId: PositionId;
	positionText: string | null;
	voteTally: VoteTally;
	method: "unanimous" | "supermajority" | "none";
};

// === Output Types ===

export type DebateOutput = {
	version: "2.3.0";
	session: {
		id: string;
		topic: string;
		initialQuery: string | null;
		phase: DebatePhase;
		startedAt: string;
		completedAt: string | null;
		totalTokens: number;
		totalCostUsd: number;
		pricingKnown: boolean;
		engineVersion: string;
		totalRetries: number;
		totalErrors: number;
	};
	agentDebate: {
		rounds: RoundResult[];
		finalPositionId: string | null;
		finalPositionText: string | null;
	};
	judgePanel: {
		enabled: boolean;
		rounds: JudgeRoundResult[];
		final: {
			consensusPositionId: string;
			consensusPositionText: string;
			consensusConfidence: number;
			dissents: string[];
		} | null;
	};
	finalVerdict: FinalVerdict;
};

// === Checkpoint Types ===

export type CheckpointIntegrity = {
	sha256: string;
	hmac: string | null;
};

export type Checkpoint = {
	version: "2.3.0";
	engineVersion: string;
	sessionId: string;
	timestamp: string;
	phase: DebatePhase;
	config: DebateConfig;
	configHash: string;
	agentRounds: RoundResult[];
	judgeRounds: JudgeRoundResult[];
	integrity: CheckpointIntegrity;
};

// === Default API Key Environment Variables ===

export const DEFAULT_API_KEY_ENV: Record<string, string> = {
	openai: "OPENAI_API_KEY",
	anthropic: "ANTHROPIC_API_KEY",
	google: "GOOGLE_API_KEY",
};
