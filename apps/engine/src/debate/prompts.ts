/**
 * LLM Court - Debate Prompts
 */

import type {
	AgentResponse,
	ContextTopology,
	RoundResult,
} from "@llm-court/shared/types";

export type AgentPromptContext = {
	agentId: string;
	topic: string;
	initialQuery?: string;
	systemPrompt?: string;
	round: number;
	candidatePositionId: string | null;
	candidatePositionText: string | null;
	history: RoundResult[];
	contextTopology: ContextTopology;
	maxContextTokens: number;
};

/**
 * Build the system prompt for an agent
 */
export const buildAgentSystemPrompt = (ctx: AgentPromptContext): string => {
	const roleDescription =
		ctx.systemPrompt ?? "a thoughtful and analytical AI assistant";

	return `You are ${ctx.agentId}, an AI agent participating in a formal debate.
Topic: ${ctx.topic}
${ctx.initialQuery ? `Question: ${ctx.initialQuery}` : ""}
Role Description: ${roleDescription}

You must output ONLY valid JSON matching this schema:
{
  "vote": "yes" | "no" | "abstain",
  "targetPositionId": string (12 chars, required if vote=yes),
  "newPositionText": string (required if vote=no or round=1),
  "reasoning": string (your supporting argument),
  "confidence": number (0.0-1.0)
}

Rules:
- If voting "yes", you MUST set targetPositionId to the candidate's position ID
- If voting "no", you MUST provide newPositionText with your alternative position
- If voting "abstain", you are uncertain and your vote won't count toward consensus
- Your reasoning should explain WHY you hold this position`;
};

/**
 * Build the user prompt for round 1 (initialization)
 */
export const buildRound1Prompt = (): string => {
	return `This is Round 1 - initialization phase.

Analyze the topic and propose an initial position.
You must:
1. Vote "abstain" (required for round 1)
2. Provide "newPositionText" with your initial position (max 4000 chars)
3. Explain your reasoning
4. Rate your confidence (0.0-1.0)`;
};

/**
 * Build the user prompt for debate rounds (round >= 2)
 */
export const buildDebateRoundPrompt = (ctx: AgentPromptContext): string => {
	const historyText = formatHistory(ctx);

	return `This is Round ${ctx.round} of the debate.

Current Candidate Position ID: "${ctx.candidatePositionId}"
Current Candidate Text:
"${ctx.candidatePositionText}"

${historyText ? `Previous arguments:\n${historyText}\n\n` : ""}Evaluate the candidate position and decide:

- Vote "yes" if you AGREE with the candidate position
  - Set "targetPositionId" to "${ctx.candidatePositionId}"
  - Provide reasoning explaining why you agree

- Vote "no" if you DISAGREE with the candidate position
  - Provide "newPositionText" with your alternative position
  - Explain why your position is better

- Vote "abstain" if you are genuinely uncertain
  - Your vote won't count toward consensus`;
};

/**
 * Format history based on context topology
 */
const formatHistory = (ctx: AgentPromptContext): string => {
	if (ctx.history.length === 0) {
		return "";
	}

	let rounds: RoundResult[];

	switch (ctx.contextTopology) {
		case "full_history":
			rounds = ctx.history;
			break;

		case "last_round":
			rounds = ctx.history.slice(-1);
			break;

		case "last_round_with_self": {
			const lastRound = ctx.history.at(-1);
			if (!lastRound) return "";

			// Include last round + this agent's history from all rounds
			const selfHistory = ctx.history.flatMap((r) =>
				r.responses.filter((resp) => resp.agentId === ctx.agentId),
			);

			// Combine: self history + last round (excluding self to avoid duplicates)
			const lastRoundOthers = lastRound.responses.filter(
				(r) => r.agentId !== ctx.agentId,
			);

			return formatResponses(
				[...selfHistory, ...lastRoundOthers],
				ctx.maxContextTokens,
			);
		}

		case "summary":
			// TODO: Implement summary generation
			rounds = ctx.history.slice(-1);
			break;

		default:
			rounds = ctx.history.slice(-1);
	}

	const allResponses = rounds.flatMap((r) => r.responses);
	return formatResponses(allResponses, ctx.maxContextTokens);
};

/**
 * Format responses into text with truncation
 */
const formatResponses = (
	responses: AgentResponse[],
	maxTokens: number,
): string => {
	const formatted = responses
		.filter((r) => r.status === "ok")
		.map((r) => {
			return `[${r.agentId}] (${r.vote}, confidence: ${r.confidence.toFixed(2)})
Position: ${r.positionText || "(supports candidate)"}
Reasoning: ${r.reasoning}`;
		});

	// Simple truncation: estimate ~4 chars per token
	const maxChars = maxTokens * 4;
	let result = formatted.join("\n\n");

	if (result.length > maxChars) {
		// Truncate middle, keep first and last
		const half = Math.floor(maxChars / 2);
		result =
			result.slice(0, half) +
			"\n\n[... truncated ...]\n\n" +
			result.slice(-half);
	}

	return result;
};
