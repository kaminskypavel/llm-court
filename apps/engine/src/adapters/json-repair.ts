/**
 * LLM Court - JSON Repair
 * Attempts to fix common JSON formatting issues in LLM outputs
 */

/**
 * Attempt to repair malformed JSON
 */
export const repairJson = (raw: string): string => {
	let text = raw.trim();

	// Remove markdown code blocks
	text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

	// Try to extract JSON from surrounding text
	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (jsonMatch) {
		text = jsonMatch[0];
	}

	// Fix common issues

	// 1. Remove trailing commas before closing brackets
	text = text.replace(/,(\s*[}\]])/g, "$1");

	// 2. Add missing quotes around unquoted keys
	text = text.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

	// 3. Replace single quotes with double quotes (careful with apostrophes)
	// Only replace single quotes that are clearly string delimiters
	text = text.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

	// 4. Fix escaped single quotes
	text = text.replace(/\\'/g, "'");

	// 5. Remove control characters except newlines and tabs
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally removing control chars
	text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

	// 6. Fix unescaped newlines in strings (replace with \n)
	// This is tricky - we need to be inside a string
	text = fixUnescapedNewlines(text);

	return text;
};

/**
 * Fix unescaped newlines inside JSON strings
 */
const fixUnescapedNewlines = (text: string): string => {
	let result = "";
	let inString = false;
	let isEscaped = false;

	for (let i = 0; i < text.length; i++) {
		const char = text.charAt(i);

		if (isEscaped) {
			result += char;
			isEscaped = false;
			continue;
		}

		if (char === "\\") {
			result += char;
			isEscaped = true;
			continue;
		}

		if (char === '"') {
			inString = !inString;
			result += char;
			continue;
		}

		if (inString && char === "\n") {
			result += "\\n";
			continue;
		}

		if (inString && char === "\r") {
			// Skip carriage returns in strings
			continue;
		}

		result += char;
	}

	return result;
};

/**
 * Try to parse JSON, applying repair if needed
 */
export const parseJsonWithRepair = <T>(
	raw: string,
	allowRepair = true,
):
	| { success: true; data: T }
	| { success: false; error: string; raw: string } => {
	// First try parsing as-is
	try {
		const data = JSON.parse(raw) as T;
		return { success: true, data };
	} catch {
		// If repair not allowed, fail immediately
		if (!allowRepair) {
			return { success: false, error: "Invalid JSON", raw };
		}
	}

	// Try repair
	try {
		const repaired = repairJson(raw);
		const data = JSON.parse(repaired) as T;
		return { success: true, data };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to parse JSON",
			raw,
		};
	}
};
