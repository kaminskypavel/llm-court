/**
 * Debate Player - Data Loading
 * Handles file upload, URL fetch, and localStorage
 * Based on spec v2.5.0 sections 4.1-4.4, 8.1-8.3
 */

import { z } from "zod";
import { DebateOutputSchema, type ValidatedDebateOutput } from "./schema";
import { type LoadError, LoadErrorCode } from "./types";

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_URL_LENGTH = 2048;
const FETCH_TIMEOUT_MS = 30000;

/**
 * Create a LoadError from various error types
 */
export function toLoadError(
	error: unknown,
	source: LoadError["source"],
): LoadError {
	if (error instanceof z.ZodError) {
		return {
			code: LoadErrorCode.SCHEMA_INVALID,
			message: "Debate JSON does not match expected schema.",
			detail: error.issues
				.map((e) => `${e.path.join(".")}: ${e.message}`)
				.join("; "),
			source,
		};
	}

	if (error instanceof SyntaxError) {
		return {
			code: LoadErrorCode.JSON_INVALID,
			message: "Invalid JSON file.",
			detail: error.message,
			source,
		};
	}

	if (error instanceof Error) {
		// Check for known error codes in message
		if (error.message.includes("too large")) {
			return {
				code:
					source === "file"
						? LoadErrorCode.FILE_TOO_LARGE
						: LoadErrorCode.RESPONSE_TOO_LARGE,
				message: "File too large (max 5MB).",
				source,
			};
		}
		if (error.message.includes("timeout")) {
			return {
				code: LoadErrorCode.FETCH_TIMEOUT,
				message: "Request timed out.",
				source,
			};
		}

		return {
			code: LoadErrorCode.FETCH_FAILED,
			message: error.message,
			source,
		};
	}

	return {
		code: LoadErrorCode.FETCH_FAILED,
		message: "Unknown error occurred.",
		source,
	};
}

/**
 * Load and validate debate from a File
 */
export async function handleFileUpload(
	file: File,
): Promise<ValidatedDebateOutput> {
	// Size check
	if (file.size > MAX_FILE_SIZE) {
		throw new Error(
			`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 5MB)`,
		);
	}

	// Type check
	if (
		!file.type.includes("json") &&
		!file.name.toLowerCase().endsWith(".json")
	) {
		const error: LoadError = {
			code: LoadErrorCode.FILE_TYPE,
			message: "Please upload a JSON file.",
			source: "file",
		};
		throw error;
	}

	// Parse and validate
	const text = await file.text();
	const json = JSON.parse(text);
	return DebateOutputSchema.parse(json);
}

/**
 * Validate URL format and protocol
 * Returns the resolved URL string (handles relative URLs)
 */
function validateUrl(urlString: string): string {
	if (urlString.length > MAX_URL_LENGTH) {
		const error: LoadError = {
			code: LoadErrorCode.URL_TOO_LONG,
			message: "URL too long.",
			source: "url",
		};
		throw error;
	}

	// Handle relative URLs (starting with /)
	if (urlString.startsWith("/")) {
		// Relative URLs are same-origin, so they're safe
		return urlString;
	}

	let parsed: URL;
	try {
		parsed = new URL(urlString);
	} catch {
		const error: LoadError = {
			code: LoadErrorCode.URL_INVALID,
			message: "Invalid URL.",
			source: "url",
		};
		throw error;
	}

	// Only allow HTTPS or localhost for absolute URLs
	const isLocalhost =
		parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
	if (parsed.protocol !== "https:" && !isLocalhost) {
		const error: LoadError = {
			code: LoadErrorCode.URL_PROTOCOL,
			message: "Only HTTPS URLs are allowed.",
			source: "url",
		};
		throw error;
	}

	return parsed.href;
}

/**
 * Load and validate debate from URL with streaming size limit
 * Uses streaming to enforce size limit (Content-Length can be spoofed/missing)
 */
export async function handleUrlLoad(
	urlParam: string,
): Promise<ValidatedDebateOutput> {
	const decodedUrl = decodeURIComponent(urlParam);
	const url = validateUrl(decodedUrl);

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { Accept: "application/json" },
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch: ${response.status}. Ensure the server supports CORS.`,
			);
		}

		// Stream response with hard byte limit
		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error("ReadableStream not supported");
		}

		let receivedLength = 0;
		const chunks: Uint8Array[] = [];

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			receivedLength += value.length;
			if (receivedLength > MAX_FILE_SIZE) {
				controller.abort();
				throw new Error("Response too large (max 5MB)");
			}
			chunks.push(value);
		}

		// Combine chunks
		const combined = new Uint8Array(receivedLength);
		let position = 0;
		for (const chunk of chunks) {
			combined.set(chunk, position);
			position += chunk.length;
		}

		// Parse and validate
		const text = new TextDecoder().decode(combined);
		const json = JSON.parse(text);
		return DebateOutputSchema.parse(json);
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw new Error("Request timed out");
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Load debate from raw JSON data (for localStorage/dev mode)
 */
export function handleDataLoad(data: unknown): ValidatedDebateOutput {
	return DebateOutputSchema.parse(data);
}
