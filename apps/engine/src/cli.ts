#!/usr/bin/env bun

/**
 * LLM Court CLI
 * Version: 2.3.0
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	ConfigLoadError,
	ConfigValidationError,
	DebatePhase,
} from "@llm-court/shared";
import {
	ENGINE_VERSION,
	EXIT_CODE_DEADLOCK,
	EXIT_CODE_ERROR,
	EXIT_CODE_SUCCESS,
} from "@llm-court/shared/constants";
import { DebateConfigSchema } from "@llm-court/shared/schemas";
import { Command } from "commander";
import { runDebate } from "./orchestrator.js";

const program = new Command();

program
	.name("llm-court")
	.description("Orchestrate adversarial debates between multiple LLMs")
	.version(ENGINE_VERSION);

program
	.command("debate")
	.description("Run a debate session")
	.requiredOption(
		"-c, --config <path>",
		"Path to debate configuration JSON file",
	)
	.option("-o, --output <path>", "Output path for debate results JSON")
	.option("-r, --resume <checkpoint>", "Resume from checkpoint file")
	.option("--dry-run", "Validate config without running debate")
	.option("--force", "Force overwrite existing output file")
	.option("--json-logs", "Output structured JSON logs to stderr")
	.option("--debug", "Enable debug logging")
	.option(
		"--allow-external-paths",
		"Allow paths outside current working directory",
	)
	.action(async (options) => {
		try {
			// Load and parse config
			const configPath = resolve(process.cwd(), options.config);
			let configJson: unknown;

			try {
				const configText = await readFile(configPath, "utf-8");
				configJson = JSON.parse(configText);
			} catch (err) {
				throw new ConfigLoadError(
					`Failed to load config from ${configPath}: ${err}`,
				);
			}

			// Validate config
			const parseResult = DebateConfigSchema.safeParse(configJson);
			if (!parseResult.success) {
				throw new ConfigValidationError("Invalid debate configuration", {
					errors: parseResult.error.issues,
				});
			}

			const config = parseResult.data;

			// Apply CLI overrides
			if (options.allowExternalPaths) {
				config.allowExternalPaths = true;
			}

			// Dry run - just validate
			if (options.dryRun) {
				console.log("Configuration is valid.");
				console.log(`Topic: ${config.topic}`);
				console.log(`Agents: ${config.agents.length}`);
				console.log(`Judges: ${config.judges.length}`);
				console.log(`Judge panel enabled: ${config.judgePanelEnabled}`);
				process.exit(EXIT_CODE_SUCCESS);
			}

			// Run debate
			const result = await runDebate(config, {
				outputPath: options.output
					? resolve(process.cwd(), options.output)
					: undefined,
				resumeFrom: options.resume
					? resolve(process.cwd(), options.resume)
					: undefined,
				jsonLogs: options.jsonLogs,
				debug: options.debug,
				force: options.force,
			});

			// Output result
			console.log(JSON.stringify(result, null, 2));

			// Exit with appropriate code
			if (result.session.phase === DebatePhase.CONSENSUS_REACHED) {
				process.exit(EXIT_CODE_SUCCESS);
			} else if (result.session.phase === DebatePhase.DEADLOCK) {
				process.exit(EXIT_CODE_DEADLOCK);
			} else {
				process.exit(EXIT_CODE_ERROR);
			}
		} catch (error) {
			if (options.jsonLogs) {
				console.error(
					JSON.stringify({
						ts: new Date().toISOString(),
						level: "error",
						event: "fatal_error",
						error: error instanceof Error ? error.message : String(error),
						code:
							error instanceof ConfigValidationError
								? error.code
								: "UNKNOWN_ERROR",
					}),
				);
			} else {
				console.error(
					"Error:",
					error instanceof Error ? error.message : String(error),
				);
				if (options.debug && error instanceof Error) {
					console.error(error.stack);
				}
			}
			process.exit(EXIT_CODE_ERROR);
		}
	});

program
	.command("validate")
	.description("Validate a debate configuration file")
	.argument("<path>", "Path to configuration file")
	.action(async (path) => {
		try {
			const configPath = resolve(process.cwd(), path);
			const configText = await readFile(configPath, "utf-8");
			const configJson = JSON.parse(configText);

			const parseResult = DebateConfigSchema.safeParse(configJson);
			if (!parseResult.success) {
				console.error("Configuration is invalid:");
				for (const error of parseResult.error.issues) {
					console.error(`  - ${error.path.join(".")}: ${error.message}`);
				}
				process.exit(EXIT_CODE_ERROR);
			}

			console.log("Configuration is valid.");
			process.exit(EXIT_CODE_SUCCESS);
		} catch (error) {
			console.error(
				"Error:",
				error instanceof Error ? error.message : String(error),
			);
			process.exit(EXIT_CODE_ERROR);
		}
	});

program.parse();
