/**
 * LLM Court - Checkpoint Management
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ENGINE_VERSION, SPEC_VERSION } from "@llm-court/shared/constants";
import {
	CheckpointError,
	CheckpointIntegrityError,
	CheckpointVersionError,
} from "@llm-court/shared/errors";
import { CheckpointSchema } from "@llm-court/shared/schemas";
import type {
	Checkpoint,
	DebateConfig,
	DebatePhase,
	JudgeRoundResult,
	RoundResult,
} from "@llm-court/shared/types";
import { canonicalizeJson, hmacSha256, sha256 } from "../utils.js";

const HMAC_KEY_ENV = "LLM_COURT_CHECKPOINT_HMAC_KEY";

export type CheckpointData = {
	sessionId: string;
	phase: DebatePhase;
	config: DebateConfig;
	agentRounds: RoundResult[];
	judgeRounds: JudgeRoundResult[];
};

/**
 * Save a checkpoint to disk
 */
export const saveCheckpoint = async (
	path: string,
	data: CheckpointData,
): Promise<void> => {
	// Calculate config hash
	const configHash = sha256(canonicalizeJson(data.config));

	// Build checkpoint without integrity
	const checkpoint: Omit<Checkpoint, "integrity"> = {
		version: SPEC_VERSION,
		engineVersion: ENGINE_VERSION,
		sessionId: data.sessionId,
		timestamp: new Date().toISOString(),
		phase: data.phase,
		config: data.config,
		configHash,
		agentRounds: data.agentRounds,
		judgeRounds: data.judgeRounds,
	};

	// Calculate integrity
	const contentHash = sha256(canonicalizeJson(checkpoint));
	const hmacKey = process.env[HMAC_KEY_ENV];
	const hmac = hmacKey ? hmacSha256(contentHash, hmacKey) : null;

	const fullCheckpoint: Checkpoint = {
		...checkpoint,
		integrity: {
			sha256: contentHash,
			hmac,
		},
	};

	// Ensure directory exists
	await mkdir(dirname(path), { recursive: true });

	// Write checkpoint
	const json = JSON.stringify(fullCheckpoint, null, 2);
	await writeFile(path, json, "utf-8");
};

/**
 * Load and verify a checkpoint from disk
 */
export const loadCheckpoint = async (path: string): Promise<CheckpointData> => {
	let content: string;

	try {
		content = await readFile(path, "utf-8");
	} catch (error) {
		throw new CheckpointError(`Failed to read checkpoint: ${error}`);
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse(content);
	} catch (error) {
		throw new CheckpointError(`Failed to parse checkpoint JSON: ${error}`);
	}

	// Validate schema
	const validated = CheckpointSchema.safeParse(parsed);

	if (!validated.success) {
		throw new CheckpointError(
			`Invalid checkpoint schema: ${validated.error.issues.map((e: { message: string }) => e.message).join(", ")}`,
		);
	}

	const checkpoint = validated.data;

	// Check version
	if (checkpoint.version !== SPEC_VERSION) {
		throw new CheckpointVersionError(checkpoint.version, SPEC_VERSION);
	}

	// Verify integrity
	const { integrity, ...rest } = checkpoint;
	const expectedHash = sha256(canonicalizeJson(rest));

	if (integrity.sha256 !== expectedHash) {
		throw new CheckpointIntegrityError(
			`Checkpoint integrity check failed: expected ${expectedHash}, got ${integrity.sha256}`,
		);
	}

	// Verify HMAC if key is set
	const hmacKey = process.env[HMAC_KEY_ENV];

	if (hmacKey && integrity.hmac) {
		const expectedHmac = hmacSha256(integrity.sha256, hmacKey);

		if (integrity.hmac !== expectedHmac) {
			throw new CheckpointIntegrityError("Checkpoint HMAC verification failed");
		}
	}

	return {
		sessionId: checkpoint.sessionId,
		phase: checkpoint.phase,
		config: checkpoint.config,
		agentRounds: checkpoint.agentRounds,
		judgeRounds: checkpoint.judgeRounds,
	};
};

/**
 * Get checkpoint path for a session
 */
export const getCheckpointPath = (
	checkpointDir: string,
	sessionId: string,
): string => {
	return resolve(checkpointDir, `${sessionId}.checkpoint.json`);
};
