import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
	emptyStringAsUndefined: true,
	// Required for client-side env vars - empty since we have no client vars yet
	experimental__runtimeEnv: {},
});
