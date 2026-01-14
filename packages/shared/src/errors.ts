/**
 * LLM Court - Custom Errors
 * Version: 2.3.0
 */

export class LLMCourtError extends Error {
	readonly code: string;
	readonly details?: Record<string, unknown>;

	constructor(
		code: string,
		message: string,
		details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "LLMCourtError";
		this.code = code;
		this.details = details;
		Error.captureStackTrace?.(this, this.constructor);
	}
}

// Configuration errors
export class ConfigValidationError extends LLMCourtError {
	constructor(message: string, details?: Record<string, unknown>) {
		super("CONFIG_VALIDATION_ERROR", message, details);
		this.name = "ConfigValidationError";
	}
}

export class ConfigLoadError extends LLMCourtError {
	constructor(message: string, details?: Record<string, unknown>) {
		super("CONFIG_LOAD_ERROR", message, details);
		this.name = "ConfigLoadError";
	}
}

// Model adapter errors
export class ModelError extends LLMCourtError {
	readonly provider: string;
	readonly model: string;
	readonly retryable: boolean;

	constructor(
		message: string,
		provider: string,
		model: string,
		retryable: boolean,
		details?: Record<string, unknown>,
	) {
		super("MODEL_ERROR", message, { ...details, provider, model });
		this.name = "ModelError";
		this.provider = provider;
		this.model = model;
		this.retryable = retryable;
	}
}

export class ModelTimeoutError extends ModelError {
	constructor(provider: string, model: string, timeoutMs: number) {
		super(`Model call timed out after ${timeoutMs}ms`, provider, model, true, {
			timeoutMs,
		});
		this.name = "ModelTimeoutError";
	}
}

export class ModelRateLimitError extends ModelError {
	readonly retryAfterMs?: number;

	constructor(provider: string, model: string, retryAfterMs?: number) {
		super("Rate limit exceeded", provider, model, true, { retryAfterMs });
		this.name = "ModelRateLimitError";
		this.retryAfterMs = retryAfterMs;
	}
}

export class ModelParseError extends ModelError {
	readonly rawOutput: string;

	constructor(
		provider: string,
		model: string,
		rawOutput: string,
		message?: string,
	) {
		super(
			message ?? "Failed to parse model response as valid JSON",
			provider,
			model,
			true,
			{
				rawOutput: rawOutput.slice(0, 1000),
			},
		);
		this.name = "ModelParseError";
		this.rawOutput = rawOutput;
	}
}

export class ModelSchemaError extends ModelError {
	readonly validationErrors: unknown[];

	constructor(provider: string, model: string, validationErrors: unknown[]) {
		super(
			"Model response did not match expected schema",
			provider,
			model,
			false,
			{
				validationErrors,
			},
		);
		this.name = "ModelSchemaError";
		this.validationErrors = validationErrors;
	}
}

// Checkpoint errors
export class CheckpointError extends LLMCourtError {
	constructor(message: string, details?: Record<string, unknown>) {
		super("CHECKPOINT_ERROR", message, details);
		this.name = "CheckpointError";
	}
}

export class CheckpointIntegrityError extends CheckpointError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, { ...details, type: "integrity" });
		this.name = "CheckpointIntegrityError";
	}
}

export class CheckpointVersionError extends CheckpointError {
	readonly foundVersion: string;
	readonly expectedVersion: string;

	constructor(foundVersion: string, expectedVersion: string) {
		super(
			`Checkpoint version mismatch: found ${foundVersion}, expected ${expectedVersion}`,
			{
				foundVersion,
				expectedVersion,
			},
		);
		this.name = "CheckpointVersionError";
		this.foundVersion = foundVersion;
		this.expectedVersion = expectedVersion;
	}
}

// Limit errors
export class LimitExceededError extends LLMCourtError {
	readonly limitType: "tokens" | "cost" | "time";
	readonly current: number;
	readonly max: number;

	constructor(
		limitType: "tokens" | "cost" | "time",
		current: number,
		max: number,
	) {
		const unit =
			limitType === "cost" ? "USD" : limitType === "time" ? "ms" : "tokens";
		super(
			"LIMIT_EXCEEDED",
			`${limitType} limit exceeded: ${current} / ${max} ${unit}`,
			{
				limitType,
				current,
				max,
			},
		);
		this.name = "LimitExceededError";
		this.limitType = limitType;
		this.current = current;
		this.max = max;
	}
}

// State machine errors
export class InvalidStateTransitionError extends LLMCourtError {
	readonly fromPhase: string;
	readonly toPhase: string;

	constructor(fromPhase: string, toPhase: string) {
		super(
			"INVALID_STATE_TRANSITION",
			`Invalid state transition: ${fromPhase} -> ${toPhase}`,
			{ fromPhase, toPhase },
		);
		this.name = "InvalidStateTransitionError";
		this.fromPhase = fromPhase;
		this.toPhase = toPhase;
	}
}

// CLI adapter errors
export class CLIAdapterError extends LLMCourtError {
	readonly cliPath: string;
	readonly exitCode?: number;
	readonly stderr?: string;

	constructor(
		message: string,
		cliPath: string,
		exitCode?: number,
		stderr?: string,
		details?: Record<string, unknown>,
	) {
		super("CLI_ADAPTER_ERROR", message, {
			...details,
			cliPath,
			exitCode,
			stderr,
		});
		this.name = "CLIAdapterError";
		this.cliPath = cliPath;
		this.exitCode = exitCode;
		this.stderr = stderr;
	}
}

export class CLIOutputTooLargeError extends CLIAdapterError {
	readonly bytes: number;
	readonly maxBytes: number;

	constructor(cliPath: string, bytes: number, maxBytes: number) {
		super(
			`CLI output exceeds limit: ${bytes} bytes > ${maxBytes} bytes`,
			cliPath,
			undefined,
			undefined,
			{
				bytes,
				maxBytes,
			},
		);
		this.name = "CLIOutputTooLargeError";
		this.bytes = bytes;
		this.maxBytes = maxBytes;
	}
}

// Consensus errors
export class ConsensusError extends LLMCourtError {
	constructor(message: string, details?: Record<string, unknown>) {
		super("CONSENSUS_ERROR", message, details);
		this.name = "ConsensusError";
	}
}

export class InsufficientAgentsError extends ConsensusError {
	readonly eligible: number;
	readonly required: number;

	constructor(eligible: number, required: number) {
		super(`Insufficient eligible agents: ${eligible} < ${required}`, {
			eligible,
			required,
		});
		this.name = "InsufficientAgentsError";
		this.eligible = eligible;
		this.required = required;
	}
}

// Security errors
export class SecurityError extends LLMCourtError {
	constructor(message: string, details?: Record<string, unknown>) {
		super("SECURITY_ERROR", message, details);
		this.name = "SecurityError";
	}
}

export class PathTraversalError extends SecurityError {
	readonly path: string;

	constructor(path: string) {
		super(`Path traversal attempt detected: ${path}`, { path });
		this.name = "PathTraversalError";
		this.path = path;
	}
}
