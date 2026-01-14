/**
 * LLM Court - Judge Prompts
 */

import type { RoundResult } from "@llm-court/shared/types";

export type JudgePromptContext = {
	judgeId: string;
	topic: string;
	initialQuery?: string;
	systemPrompt?: string;
	round: number;
	positions: Map<string, string>; // positionId -> positionText
	agentRounds: RoundResult[];
};

/**
 * Build the system prompt for a judge
 */
export const buildJudgeSystemPrompt = (ctx: JudgePromptContext): string => {
	const roleDescription =
		ctx.systemPrompt ?? "an impartial and analytical judge";

	const positionIds = Array.from(ctx.positions.keys());

	return `You are ${ctx.judgeId}, a judge evaluating positions in a formal debate.
Topic: ${ctx.topic}
${ctx.initialQuery ? `Question: ${ctx.initialQuery}` : ""}
Role Description: ${roleDescription}

You must output ONLY valid JSON matching this schema:
{
  "selectedPositionId": string (12 chars, the position ID you support),
  "scoresByPositionId": { [positionId: string]: number (0-100) },
  "reasoning": string (your evaluation),
  "confidence": number (0.0-1.0)
}

Position IDs to evaluate: ${positionIds.join(", ")}

Rules:
- You MUST select exactly one position by setting selectedPositionId
- You MUST score ALL positions in scoresByPositionId (0-100)
- Your reasoning should explain your evaluation criteria and decision`;
};

/**
 * Build the user prompt for judge evaluation
 */
export const buildJudgeEvaluationPrompt = (ctx: JudgePromptContext): string => {
	const positionsText = formatPositions(ctx.positions);
	const argumentsText = formatAgentArguments(ctx.agentRounds, ctx.positions);

	return `This is Judge Evaluation Round ${ctx.round}.

## Positions to Evaluate

${positionsText}

## Agent Arguments

${argumentsText}

## Your Task

1. Evaluate each position based on:
   - Logical coherence and reasoning quality
   - Evidence and support provided
   - Relevance to the original question
   - Completeness of the answer

2. Score each position from 0-100

3. Select the position you believe is most correct

4. Explain your reasoning`;
};

/**
 * Format positions for display
 */
const formatPositions = (positions: Map<string, string>): string => {
	const lines: string[] = [];

	for (const [id, text] of positions.entries()) {
		lines.push(`### Position ${id}\n${text}`);
	}

	return lines.join("\n\n");
};

/**
 * Format agent arguments from debate rounds
 */
const formatAgentArguments = (
	rounds: RoundResult[],
	positions: Map<string, string>,
): string => {
	const lines: string[] = [];

	// Collect arguments by position
	const argsByPosition = new Map<string, string[]>();

	for (const round of rounds) {
		for (const response of round.responses) {
			if (response.status !== "ok" || !response.positionId) continue;

			// Only include arguments for positions we're evaluating
			if (!positions.has(response.positionId)) continue;

			const args = argsByPosition.get(response.positionId) ?? [];
			args.push(
				`[${response.agentId}, Round ${response.round}]: ${response.reasoning}`,
			);
			argsByPosition.set(response.positionId, args);
		}
	}

	for (const [posId, args] of argsByPosition.entries()) {
		lines.push(`### Arguments for Position ${posId}`);
		lines.push(args.join("\n\n"));
	}

	return lines.join("\n\n");
};
