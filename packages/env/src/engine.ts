/**
 * LLM Court - Engine Environment Variables
 */

import { z } from "zod";

export const engineEnvSchema = z.object({
	// API Keys (optional - only needed if using those providers)
	OPENAI_API_KEY: z.string().optional(),
	ANTHROPIC_API_KEY: z.string().optional(),
	GOOGLE_API_KEY: z.string().optional(),

	// Optional HMAC key for checkpoint integrity
	LLM_COURT_CHECKPOINT_HMAC_KEY: z.string().optional(),
});

export type EngineEnv = z.infer<typeof engineEnvSchema>;
