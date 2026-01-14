/**
 * LLM Court - Constants
 * Version: 2.3.0
 */

export const ENGINE_VERSION = "2.3.0";
export const SPEC_VERSION = "2.3.0";

// Position ID generation
export const POSITION_ID_LENGTH = 12;
export const POSITION_TEXT_MAX_LENGTH = 4000;
export const REASONING_MAX_LENGTH = 8000;

// Default configuration values
export const DEFAULT_AGENT_TEMPERATURE = 0.7;
export const DEFAULT_JUDGE_TEMPERATURE = 0.3;
export const DEFAULT_CONSENSUS_THRESHOLD = 0.67;
export const DEFAULT_JUDGE_CONSENSUS_THRESHOLD = 0.6;
export const DEFAULT_JUDGE_MIN_CONFIDENCE = 0.7;
export const DEFAULT_MAX_AGENT_ROUNDS = 4;
export const DEFAULT_MAX_JUDGE_ROUNDS = 3;

// Timeout defaults (milliseconds)
export const DEFAULT_MODEL_TIMEOUT_MS = 120000;
export const DEFAULT_ROUND_TIMEOUT_MS = 300000;
export const DEFAULT_SESSION_TIMEOUT_MS = 1200000;

// Retry defaults
export const DEFAULT_MAX_RETRY_ATTEMPTS = 2;
export const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
export const DEFAULT_RETRY_MAX_DELAY_MS = 8000;

// Concurrency defaults
export const DEFAULT_MAX_CONCURRENT_REQUESTS = 4;

// Token limits
export const DEFAULT_MAX_TOKENS_PER_RESPONSE = 2048;
export const DEFAULT_MAX_TOTAL_TOKENS = 200000;
export const DEFAULT_MAX_CONTEXT_TOKENS = 12000;
export const DEFAULT_MAX_COST_USD = 25;

// CLI adapter limits
export const CLI_MAX_STDIN_BYTES = 2 * 1024 * 1024; // 2MB
export const CLI_MAX_STDOUT_BYTES = 10 * 1024 * 1024; // 10MB

// Exit codes
export const EXIT_CODE_SUCCESS = 0;
export const EXIT_CODE_ERROR = 1;
export const EXIT_CODE_DEADLOCK = 2;

// Template tokens for CLI adapters
export const CLI_TEMPLATE_TOKENS = {
	PROMPT: "{{PROMPT}}",
	MAX_TOKENS: "{{MAX_TOKENS}}",
	TEMPERATURE: "{{TEMPERATURE}}",
} as const;

// Model pricing (USD per 1M tokens) - estimates, may not be accurate
export const MODEL_PRICING: Record<string, { input: number; output: number }> =
	{
		// OpenAI
		"gpt-4o": { input: 2.5, output: 10.0 },
		"gpt-4o-mini": { input: 0.15, output: 0.6 },
		"gpt-4-turbo": { input: 10.0, output: 30.0 },
		o1: { input: 15.0, output: 60.0 },
		"o1-mini": { input: 3.0, output: 12.0 },

		// Anthropic
		"claude-3-5-sonnet-latest": { input: 3.0, output: 15.0 },
		"claude-3-5-haiku-latest": { input: 0.8, output: 4.0 },
		"claude-3-opus-latest": { input: 15.0, output: 75.0 },
		"claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
		"claude-opus-4-20250514": { input: 15.0, output: 75.0 },

		// Google
		"gemini-2.0-flash": { input: 0.075, output: 0.3 },
		"gemini-1.5-pro": { input: 1.25, output: 5.0 },
		"gemini-1.5-flash": { input: 0.075, output: 0.3 },
	};

// Log event types
export const LogEvents = {
	SESSION_START: "session_start",
	SESSION_END: "session_end",
	ROUND_START: "round_start",
	ROUND_END: "round_end",
	MODEL_CALL: "model_call",
	MODEL_RESPONSE: "model_response",
	MODEL_ERROR: "model_error",
	MODEL_RETRY: "model_retry",
	CONSENSUS_CHECK: "consensus_check",
	CONSENSUS_REACHED: "consensus_reached",
	CHECKPOINT_SAVE: "checkpoint_save",
	CHECKPOINT_LOAD: "checkpoint_load",
	JUDGE_PHASE_START: "judge_phase_start",
	JUDGE_PHASE_END: "judge_phase_end",
	LIMIT_WARNING: "limit_warning",
	LIMIT_EXCEEDED: "limit_exceeded",
} as const;
