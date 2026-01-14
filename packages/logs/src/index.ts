/**
 * @llm-court/logs
 *
 * A lightweight, pretty-printing logger that works on both client and server.
 * Supports scoped loggers, log levels, and conditional enabling.
 *
 * Usage:
 *   import { logger } from '@llm-court/logs';
 *
 *   // Global logger
 *   logger.info('Hello world');
 *   logger.debug('Debug message');
 *
 *   // Scoped logger
 *   const log = logger.scope('DebateEngine');
 *   log.info('Starting debate');
 *   log.error('Model call failed', error);
 *
 * Enable logging:
 *   - Server: Set DEBUG=* or DEBUG=DebateEngine,JudgePanel
 *   - Client: Set localStorage.debug = '*' or 'DebateEngine,JudgePanel'
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

type LoggerOptions = {
	level?: LogLevel;
	enabled?: boolean;
};

// Log level priority (higher = more important)
const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

type ColorPair = { ansi: string; css: string };

// Colors for different log levels (ANSI for server, CSS for browser)
const LEVEL_COLORS: Record<LogLevel, ColorPair> = {
	debug: { ansi: "\x1b[36m", css: "color: #6bb3d9" }, // Cyan
	info: { ansi: "\x1b[32m", css: "color: #6bbf6b" }, // Green
	warn: { ansi: "\x1b[33m", css: "color: #d9a76b" }, // Yellow
	error: { ansi: "\x1b[31m", css: "color: #d96b6b" }, // Red
};

// Scope colors for visual distinction (cycles through these)
const SCOPE_COLORS: ColorPair[] = [
	{ ansi: "\x1b[35m", css: "color: #b36bd9" }, // Magenta
	{ ansi: "\x1b[34m", css: "color: #6b8fd9" }, // Blue
	{ ansi: "\x1b[33m", css: "color: #d9c86b" }, // Yellow
	{ ansi: "\x1b[36m", css: "color: #6bd9c8" }, // Cyan
	{ ansi: "\x1b[32m", css: "color: #8fd96b" }, // Light Green
	{ ansi: "\x1b[91m", css: "color: #ff6b8a" }, // Light Red
];

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

// Check if we're in a browser environment
// Use globalThis to avoid TS errors in Node-only compilation
const isBrowser =
	typeof globalThis !== "undefined" &&
	"window" in globalThis &&
	typeof (globalThis as { window?: unknown }).window !== "undefined";

// Check if we're in a Node.js environment (has process.env)
const hasProcessEnv =
	typeof process !== "undefined" && process.env !== undefined;

// Get enabled scopes from environment or localStorage
function getEnabledScopes(): Set<string> | "*" {
	let debugValue: string | null | undefined;

	if (isBrowser) {
		try {
			debugValue = localStorage.getItem("debug");
		} catch {
			// localStorage not available
		}
	} else if (hasProcessEnv) {
		debugValue = process.env.DEBUG;
	}

	if (!debugValue) {
		// In development, default to all enabled
		if (hasProcessEnv && process.env.NODE_ENV === "development") {
			return "*";
		}
		// In CF Workers or unknown env, default to all enabled for debugging
		if (!hasProcessEnv) {
			return "*";
		}
		return new Set();
	}

	if (debugValue === "*" || debugValue === "true") {
		return "*";
	}

	return new Set(debugValue.split(",").map((s) => s.trim()));
}

// Cache for scope colors
const scopeColorCache = new Map<string, ColorPair>();
let colorIndex = 0;

function getScopeColor(scope: string): ColorPair {
	const cached = scopeColorCache.get(scope);
	if (cached) {
		return cached;
	}

	// biome-ignore lint/style/noNonNullAssertion: SCOPE_COLORS is a static array
	const color = SCOPE_COLORS[colorIndex % SCOPE_COLORS.length]!;
	scopeColorCache.set(scope, color);
	colorIndex += 1;
	return color;
}

function formatTimestamp(): string {
	const now = new Date();
	const hours = now.getHours().toString().padStart(2, "0");
	const minutes = now.getMinutes().toString().padStart(2, "0");
	const seconds = now.getSeconds().toString().padStart(2, "0");
	const ms = now.getMilliseconds().toString().padStart(3, "0");
	return `${hours}:${minutes}:${seconds}.${ms}`;
}

function isEnabled(scope: string | null): boolean {
	const enabledScopes = getEnabledScopes();

	if (enabledScopes === "*") {
		return true;
	}

	if (scope === null) {
		// Global logger - enabled if any scope is enabled
		return enabledScopes.size > 0;
	}

	return enabledScopes.has(scope);
}

function getConsoleFn(level: LogLevel): (...args: unknown[]) => void {
	switch (level) {
		case "error":
			return console.error;
		case "warn":
			return console.warn;
		case "debug":
			return console.debug;
		default:
			return console.log;
	}
}

function logToBrowser(
	level: LogLevel,
	levelColor: ColorPair,
	scopeName: string | null,
	scopeColor: ColorPair | null,
	timestamp: string,
	message: string,
	args: unknown[],
): void {
	const levelLabel = level.toUpperCase().padEnd(5);
	const parts: string[] = [];
	const styles: string[] = [];

	// Timestamp
	parts.push(`%c${timestamp}`);
	styles.push("color: #888");

	// Level
	parts.push(` %c${levelLabel}`);
	styles.push(`${levelColor.css}; font-weight: bold`);

	// Scope
	if (scopeName && scopeColor) {
		parts.push(` %c[${scopeName}]`);
		styles.push(`${scopeColor.css}; font-weight: bold`);
	}

	// Message
	parts.push(` %c${message}`);
	styles.push("color: inherit");

	const consoleFn = getConsoleFn(level);
	consoleFn(parts.join(""), ...styles, ...args);
}

function logToServer(
	level: LogLevel,
	levelColor: ColorPair,
	scopeName: string | null,
	scopeColor: ColorPair | null,
	timestamp: string,
	message: string,
	args: unknown[],
): void {
	const levelLabel = level.toUpperCase().padEnd(5);
	const scopePart =
		scopeName && scopeColor
			? ` ${BOLD}${scopeColor.ansi}[${scopeName}]${RESET}`
			: "";

	const prefix = `${DIM}${timestamp}${RESET} ${BOLD}${levelColor.ansi}${levelLabel}${RESET}${scopePart}`;

	const consoleFn = getConsoleFn(level);
	consoleFn(prefix, message, ...args);
}

class ScopedLogger {
	private readonly scopeName: string | null;
	private readonly minLevel: LogLevel;

	constructor(scopeName: string | null, options: LoggerOptions = {}) {
		this.scopeName = scopeName;
		this.minLevel = options.level ?? "debug";
	}

	private shouldLog(level: LogLevel): boolean {
		if (!isEnabled(this.scopeName)) {
			return false;
		}
		return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
	}

	private log(level: LogLevel, message: string, ...args: unknown[]): void {
		if (!this.shouldLog(level)) {
			return;
		}

		const timestamp = formatTimestamp();
		const levelColor = LEVEL_COLORS[level];
		const scopeColor = this.scopeName ? getScopeColor(this.scopeName) : null;

		if (isBrowser) {
			logToBrowser(
				level,
				levelColor,
				this.scopeName,
				scopeColor,
				timestamp,
				message,
				args,
			);
		} else {
			logToServer(
				level,
				levelColor,
				this.scopeName,
				scopeColor,
				timestamp,
				message,
				args,
			);
		}
	}

	debug(message: string, ...args: unknown[]): void {
		this.log("debug", message, ...args);
	}

	info(message: string, ...args: unknown[]): void {
		this.log("info", message, ...args);
	}

	warn(message: string, ...args: unknown[]): void {
		this.log("warn", message, ...args);
	}

	error(message: string, ...args: unknown[]): void {
		this.log("error", message, ...args);
	}
}

class Logger extends ScopedLogger {
	constructor(options: LoggerOptions = {}) {
		super(null, options);
	}

	/**
	 * Create a scoped logger with a namespace prefix.
	 * The scope is used to filter logs and visually distinguish them.
	 *
	 * @example
	 * const log = logger.scope('PlayerSync');
	 * log.info('Connected to channel');
	 */
	scope(name: string, options: LoggerOptions = {}): ScopedLogger {
		return new ScopedLogger(name, options);
	}

	/**
	 * Enable debug logging for specific scopes.
	 * Can be called at runtime to enable logging dynamically.
	 *
	 * @param scopes - Comma-separated list of scopes, or '*' for all
	 *
	 * @example
	 * logger.enable('PlayerSync,Cast');
	 * logger.enable('*');
	 */
	enable(scopes: string): void {
		if (isBrowser) {
			try {
				localStorage.setItem("debug", scopes);
			} catch {
				// localStorage not available
			}
		} else if (hasProcessEnv) {
			process.env.DEBUG = scopes;
		}
	}

	/**
	 * Disable all debug logging.
	 */
	disable(): void {
		if (isBrowser) {
			try {
				localStorage.removeItem("debug");
			} catch {
				// localStorage not available
			}
		} else if (hasProcessEnv) {
			process.env.DEBUG = "";
		}
	}
}

// Export a singleton instance
export const logger = new Logger();

// Export types and classes for advanced usage
export { Logger, ScopedLogger };
export type { LoggerOptions };
