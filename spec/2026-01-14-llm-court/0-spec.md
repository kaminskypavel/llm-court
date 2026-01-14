---
title: "LLM Court (Agora) Technical Specification"
type: tech
created: 2026-01-14
version: 2.3.0
rounds: 7
models:
  - codex/gpt-5.2-codex
  - gemini-cli/gemini-3-pro-preview
status: final
---

# LLM Court (Agora) – Technical Specification v2.3.0

## 1. Overview / Context

LLM Court orchestrates adversarial debates between multiple LLMs to reach a consolidated answer. It runs locally as a CLI and produces structured JSON output for visualization and audit. The system uses a two-phase process:

1. **Agent Debate Phase**: Up to N rounds of agent deliberation and voting on a candidate position.
2. **Judge Panel Phase**: If agents fail to converge, judges evaluate agent positions and vote on a final position.

### 1.1 Goals
- Orchestrate multi-agent debates with configurable topology and voting.
- Support API providers (OpenAI, Anthropic, Google) and generic CLI providers.
- Produce structured JSON output with complete audit trail.
- **Ensure robust consensus detection despite LLM generation noise.**
- Resume sessions from checkpoints without ambiguity.
- Handle transient model failures via configurable retries.
- Enforce strict resource limits (tokens, time, cost).

### 1.2 Non-Goals
- Distributed execution across machines.
- Real-time streaming UI (batch output only).
- Automated topology optimization (DIGRA - post-MVP).

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Entry Point                       │
│                     (apps/engine/src/cli.ts)                │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Debate Orchestrator                     │
│                 (apps/engine/src/orchestrator.ts)           │
├─────────────────────────────────────────────────────────────┤
│  - State machine: INIT → AGENT_DEBATE → JUDGE_EVALUATION    │
│  - Generates sessionId (UUIDv7)                             │
│  - Manages concurrency limits and timeouts                  │
│  - Persists checkpoints after each round                    │
└──────────────┬─────────────────────────────┬────────────────┘
               │                             │
               ▼                             ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│     Debate Engine        │   │       Judge Panel            │
│  (debate/engine.ts)      │   │    (judges/panel.ts)         │
├──────────────────────────┤   ├──────────────────────────────┤
│  - Prompt Construction   │   │  - Evaluation Prompts        │
│  - PARALLEL agent calls  │   │  - PARALLEL judge calls      │
│  - Position tracking     │   │  - Position scoring          │
│  - Vote aggregation      │   │  - Convergence detection     │
└──────────┬───────────────┘   └──────────────┬───────────────┘
           │                                   │
           └─────────────┬─────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Model Adapter Layer                       │
│              (adapters/registry.ts)                          │
├─────────────────────────────────────────────────────────────┤
│  - Automatic Retries (Exponential Backoff)                  │
│  - JSON Repair & Validation                                 │
│  - Timeout Enforcement                                      │
│  - Templated CLI Arguments                                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 State Machine (Explicit)

Allowed transitions:
- `init → agent_debate`
- `agent_debate → consensus_reached`
- `agent_debate → judge_evaluation`
- `judge_evaluation → consensus_reached`
- `judge_evaluation → deadlock`
- `agent_debate → deadlock` (if judge panel disabled or <2 positions)

Any other transition is invalid and aborts with exit code 1.

## 3. Core Concepts

### 3.1 Position Tracking

Positions are tracked via deterministic IDs to enable unambiguous consensus detection:

```typescript
// positionId = sha256(normalize(positionText)).slice(0, 12)
// normalize = trim, collapse whitespace, lowercase

export const generatePositionId = (text: string): string => {
  const normalized = text.trim().replace(/\s+/g, ' ').toLowerCase();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 12);
};
```

**Constraints:**
- `positionText` must be 1–4000 chars after trimming.
- `reasoning` must be 1–8000 chars after trimming.
- Error responses have `positionId = null` (not empty string).

### 3.2 Voting Semantics

Voting uses **ID-based referencing** to prevent false consensus failures from text variations:

- **Round 1**: No candidate exists. Agents must vote `abstain` and propose initial positions via `newPositionText`.
- **Rounds ≥2**: A `candidatePositionId` is computed from the previous round. Agents vote:
  - `yes`: Agrees with candidate. **Must output `targetPositionId` matching the candidate.** Text in reasoning is supporting argument, not position redefinition.
  - `no`: Disagrees. **Must supply `newPositionText`** with alternative position. New ID generated.
  - `abstain`: Uncertain. Position ignored for consensus.

### 3.3 Candidate Selection Strategy

After each round, the candidate for the next round is selected by:

1. **Filter**: Only responses where `status = ok` AND `vote ≠ abstain`
2. **Group**: Group by effective `positionId`
3. **Score**: Calculate `SupportScore = Sum(Confidence)` for each position
4. **Sort**:
   - Primary: `SupportScore` (descending)
   - Secondary: `Count(Supporters)` (descending)
   - Tertiary: Lexicographic `positionId` (ascending - for determinism)

This ensures positions with broader support win over single high-confidence outliers.

### 3.4 Prompt Architecture

#### System Prompt Structure
```text
You are {agentId}, an AI agent participating in a formal debate.
Topic: {topic}
{initialQuery ? "Question: " + initialQuery : ""}
Role Description: {systemPrompt}

You must output ONLY valid JSON matching this schema:
{schemaDescription}
```

#### Debate Phase Prompting

**Round 1 (Initialization):**
```text
Analyze the topic and propose an initial position.
You must provide 'newPositionText' with your position.
Vote must be 'abstain'.
```

**Round N (Debate):**
```text
Current Candidate Position ID: "{candidatePositionId}"
Current Candidate Text:
"{candidatePositionText}"

History of previous arguments:
{formattedHistory}

Evaluate the candidate position.
- Vote 'yes' if you agree. Set 'targetPositionId' to "{candidatePositionId}".
- Vote 'no' if you disagree. Provide 'newPositionText' with your alternative.
- Vote 'abstain' if uncertain.
```

#### Context Management

To prevent context overflow:
- **Token Budget**: `ModelContextLimit - SystemPrompt - ResponseReservation`
- **Max Context**: Configurable `limits.maxContextTokens` (default: 12000)
- **Truncation Strategy**: If history exceeds budget, drop middle rounds first, preserving Round 1 (initial positions) and Round N-1 (immediate context)

#### Context Topology Implementation
- `FULL_HISTORY`: All responses from rounds 1 to N-1 (subject to truncation)
- `LAST_ROUND`: Responses from round N-1 only
- `LAST_ROUND_WITH_SELF`: Round N-1 + this agent's history
- `SUMMARY`: (Future) LLM-generated summary

## 4. Core Types (packages/shared/src/types.ts)

```typescript
// === Enums ===
export const DebatePhase = {
  INIT: 'init',
  AGENT_DEBATE: 'agent_debate',
  JUDGE_EVALUATION: 'judge_evaluation',
  CONSENSUS_REACHED: 'consensus_reached',
  DEADLOCK: 'deadlock'
} as const;
export type DebatePhase = typeof DebatePhase[keyof typeof DebatePhase];

export const Vote = {
  YES: 'yes',
  NO: 'no',
  ABSTAIN: 'abstain'
} as const;
export type Vote = typeof Vote[keyof typeof Vote];

export const ContextTopology = {
  FULL_HISTORY: 'full_history',
  LAST_ROUND: 'last_round',
  LAST_ROUND_WITH_SELF: 'last_round_with_self',
  SUMMARY: 'summary'
} as const;
export type ContextTopology = typeof ContextTopology[keyof typeof ContextTopology];

// === Agent Types ===
export type AgentId = string;
export type PositionId = string | null; // 12-char hex or null for errors

export type AgentResponse = {
  agentId: AgentId;
  round: number;
  positionId: PositionId;
  positionText: string;
  reasoning: string;
  vote: Vote;
  confidence: number; // 0.0-1.0
  tokenUsage: TokenUsage;
  latencyMs: number;
  status: 'ok' | 'error';
  error: string | null;
};

export type TokenUsage = {
  prompt: number;
  completion: number;
  total: number;
  estimated: boolean;
};

// === Round Types ===
export type RoundResult = {
  roundNumber: number;
  candidatePositionId: PositionId;
  candidatePositionText: string | null;
  responses: AgentResponse[];
  consensusReached: boolean;
  consensusPositionId: PositionId;
  consensusPositionText: string | null;
  voteTally: VoteTally;
  timestamp: string; // ISO-8601
};

export type VoteTally = {
  yes: number;
  no: number;
  abstain: number;
  total: number;
  eligible: number;      // Responses with status=ok
  votingTotal: number;   // yes + no (from eligible)
  supermajorityThreshold: number;
  supermajorityReached: boolean;
};

// === Judge Types ===
export type JudgeId = string;

export type JudgeEvaluation = {
  judgeId: JudgeId;
  round: number;
  selectedPositionId: PositionId;
  scoresByPositionId: Record<string, number>; // 0-100
  reasoning: string;
  confidence: number;
  tokenUsage: TokenUsage;
  latencyMs: number;
  status: 'ok' | 'error';
  error: string | null;
};

export type JudgeRoundResult = {
  roundNumber: number;
  positionIds: string[];
  evaluations: JudgeEvaluation[];
  consensusReached: boolean;
  consensusPositionId: PositionId;
  avgConfidence: number;
  timestamp: string;
};

export type JudgePanelResult = {
  rounds: JudgeRoundResult[];
  consensusPositionId: string;
  consensusPositionText: string;
  consensusConfidence: number;
  dissents: JudgeId[];
};

export type JudgeConsensusResult = {
  reached: boolean;
  positionId: PositionId;
  positionText: string | null;
  confidence: number;
  dissents: JudgeId[];
};

// === Session ===
export type DebateSession = {
  id: string;
  topic: string;
  initialQuery: string | null;
  phase: DebatePhase;
  config: DebateConfig;
  agentRounds: RoundResult[];
  judgeRounds: JudgeRoundResult[];
  finalVerdict: FinalVerdict | null;
  metadata: SessionMetadata;
};

export type FinalVerdict = {
  positionId: string;
  positionText: string;
  confidence: number;
  source: 'agent_consensus' | 'judge_consensus' | 'deadlock';
};

export type SessionMetadata = {
  engineVersion: string;
  startedAt: string;
  completedAt: string | null;
  totalTokens: number;
  totalCostUsd: number;
  pricingKnown: boolean;
  checkpointPath: string | null;
  totalRetries: number;
  totalErrors: number;
};

// === Configuration ===
export type DebateConfig = {
  topic: string;
  initialQuery?: string;
  agents: AgentConfig[];
  judges: JudgeConfig[];
  judgePanelEnabled: boolean;         // default: true
  maxAgentRounds: number;             // default: 4, range: 1-10
  maxJudgeRounds: number;             // default: 3, range: 1-5
  consensusThreshold: number;         // default: 0.67, range: 0.5-1.0
  judgeConsensusThreshold: number;    // default: 0.6, range: 0.5-1.0
  judgeMinConfidence: number;         // default: 0.7, range: 0.0-1.0
  judgePositionsScope: 'all_rounds' | 'last_round'; // default: 'all_rounds'
  contextTopology: ContextTopology;
  checkpointDir: string | null;
  timeouts: TimeoutConfig;
  retries: RetryConfig;
  concurrency: ConcurrencyConfig;
  limits: LimitConfig;
  deterministicMode: boolean;         // default: false
  allowExternalPaths: boolean;        // default: false
};

export type AgentConfig = {
  id: AgentId;
  model: ModelConfig;
  systemPrompt?: string;
  temperature?: number; // 0-2, default: 0.7
};

export type JudgeConfig = {
  id: JudgeId;
  model: ModelConfig;
  systemPrompt?: string;
  temperature?: number; // 0-2, default: 0.3
};

export type ModelConfig = {
  provider: 'openai' | 'anthropic' | 'google' | 'cli';
  model: string;
  apiKeyEnv?: string;
  cliPath?: string;
  cliArgs?: string[];     // Supports {{PROMPT}}, {{MAX_TOKENS}}, {{TEMPERATURE}}
  chatTemplate?: 'chatml' | 'llama3' | 'gemma';
};

export type TimeoutConfig = {
  modelMs: number;   // default: 120000
  roundMs: number;   // default: 300000
  sessionMs: number; // default: 1200000
};

export type RetryConfig = {
  maxAttempts: number;   // default: 2
  baseDelayMs: number;   // default: 1000
  maxDelayMs: number;    // default: 8000
};

export type ConcurrencyConfig = {
  maxConcurrentRequests: number; // default: 4
};

export type LimitConfig = {
  maxTokensPerResponse: number;  // default: 2048
  maxTotalTokens: number;        // default: 200000
  maxTotalCostUsd: number;       // default: 25
  maxContextTokens: number;      // default: 12000
};

export const DEFAULT_API_KEY_ENV: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY'
};
```

## 5. JSON Schemas (packages/shared/src/schemas.ts)

```typescript
import { z } from 'zod';

// === Agent Response Schema (for structured output) ===
export const AgentResponseSchema = z.object({
  vote: z.enum(['yes', 'no', 'abstain']),
  targetPositionId: z.string().length(12).optional().describe('Required if vote=yes'),
  newPositionText: z.string().min(1).max(4000).optional().describe('Required if vote=no or round=1'),
  reasoning: z.string().min(1).max(8000).describe('Supporting argument'),
  confidence: z.number().min(0).max(1).describe('Confidence 0.0-1.0')
}).superRefine((data, ctx) => {
  if (data.vote === 'yes' && !data.targetPositionId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "targetPositionId required when voting 'yes'",
      path: ['targetPositionId']
    });
  }
  if (data.vote === 'no' && !data.newPositionText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "newPositionText required when voting 'no'",
      path: ['newPositionText']
    });
  }
});

// === Judge Evaluation Schema ===
export const JudgeEvaluationSchema = z.object({
  selectedPositionId: z.string().length(12).describe('Position ID you support'),
  scoresByPositionId: z.record(
    z.string().length(12),
    z.number().int().min(0).max(100)
  ).describe('Scores 0-100 for each position'),
  reasoning: z.string().min(1).max(8000),
  confidence: z.number().min(0).max(1)
});

// === Config Schema ===
export const ModelConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'cli']),
  model: z.string().min(1),
  apiKeyEnv: z.string().optional(),
  cliPath: z.string().optional(),
  cliArgs: z.array(z.string()).optional(),
  chatTemplate: z.enum(['chatml', 'llama3', 'gemma']).optional()
}).refine(
  data => data.provider !== 'cli' || (!!data.cliPath && !!data.chatTemplate),
  { message: 'CLI providers require cliPath and chatTemplate' }
);

export const DebateConfigSchema = z.object({
  topic: z.string().min(1).max(1000),
  initialQuery: z.string().max(2000).optional(),
  agents: z.array(z.object({
    id: z.string().min(1).max(64),
    model: ModelConfigSchema,
    systemPrompt: z.string().max(4000).optional(),
    temperature: z.number().min(0).max(2).optional()
  })).min(2).max(10),
  judges: z.array(z.object({
    id: z.string().min(1).max(64),
    model: ModelConfigSchema,
    systemPrompt: z.string().max(4000).optional(),
    temperature: z.number().min(0).max(2).optional()
  })).min(0).max(15),
  judgePanelEnabled: z.boolean().default(true),
  maxAgentRounds: z.number().int().min(1).max(10).default(4),
  maxJudgeRounds: z.number().int().min(1).max(5).default(3),
  consensusThreshold: z.number().min(0.5).max(1).default(0.67),
  judgeConsensusThreshold: z.number().min(0.5).max(1).default(0.6),
  judgeMinConfidence: z.number().min(0).max(1).default(0.7),
  judgePositionsScope: z.enum(['all_rounds', 'last_round']).default('all_rounds'),
  contextTopology: z.enum(['full_history', 'last_round', 'last_round_with_self', 'summary']).default('last_round_with_self'),
  checkpointDir: z.string().nullable().default(null),
  timeouts: z.object({
    modelMs: z.number().int().min(1000).max(600000).default(120000),
    roundMs: z.number().int().min(10000).max(1800000).default(300000),
    sessionMs: z.number().int().min(60000).max(7200000).default(1200000)
  }).default({}),
  retries: z.object({
    maxAttempts: z.number().int().min(0).max(5).default(2),
    baseDelayMs: z.number().int().min(100).max(10000).default(1000),
    maxDelayMs: z.number().int().min(1000).max(60000).default(8000)
  }).default({}),
  concurrency: z.object({
    maxConcurrentRequests: z.number().int().min(1).max(20).default(4)
  }).default({}),
  limits: z.object({
    maxTokensPerResponse: z.number().int().min(256).max(16384).default(2048),
    maxTotalTokens: z.number().int().min(1000).max(1000000).default(200000),
    maxTotalCostUsd: z.number().min(0.01).max(1000).default(25),
    maxContextTokens: z.number().int().min(1000).max(128000).default(12000)
  }).default({}),
  deterministicMode: z.boolean().default(false),
  allowExternalPaths: z.boolean().default(false)
}).refine(
  data => !data.judgePanelEnabled || data.judges.length >= 3,
  { message: 'Judge panel requires at least 3 judges when enabled' }
);

// === Checkpoint Schema ===
export const CheckpointSchema = z.object({
  version: z.literal('2.3.0'),
  engineVersion: z.string(),
  sessionId: z.string(),
  timestamp: z.string().datetime(),
  phase: z.enum(['init', 'agent_debate', 'judge_evaluation', 'consensus_reached', 'deadlock']),
  config: DebateConfigSchema,
  configHash: z.string().length(64),
  agentRounds: z.array(RoundResultSchema),
  judgeRounds: z.array(JudgeRoundResultSchema).default([]),
  integrity: z.object({
    sha256: z.string().length(64),
    hmac: z.string().length(64).nullable()
  })
});

// === Output Schema ===
export const DebateOutputSchema = z.object({
  version: z.literal('2.3.0'),
  session: z.object({
    id: z.string(),
    topic: z.string(),
    initialQuery: z.string().nullable(),
    phase: z.enum(['init', 'agent_debate', 'judge_evaluation', 'consensus_reached', 'deadlock']),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    totalTokens: z.number(),
    totalCostUsd: z.number(),
    pricingKnown: z.boolean(),
    engineVersion: z.string(),
    totalRetries: z.number(),
    totalErrors: z.number()
  }),
  agentDebate: z.object({
    rounds: z.array(RoundResultSchema),
    finalPositionId: z.string().nullable(),
    finalPositionText: z.string().nullable()
  }),
  judgePanel: z.object({
    enabled: z.boolean(),
    rounds: z.array(JudgeRoundResultSchema),
    final: z.object({
      consensusPositionId: z.string(),
      consensusPositionText: z.string(),
      consensusConfidence: z.number(),
      dissents: z.array(z.string())
    }).nullable()
  }),
  finalVerdict: z.object({
    positionId: z.string(),
    positionText: z.string(),
    confidence: z.number(),
    source: z.enum(['agent_consensus', 'judge_consensus', 'deadlock'])
  })
});
```

## 6. Consensus Detection

### 6.1 Agent Consensus (debate/consensus.ts)

```typescript
export const detectAgentConsensus = (
  responses: AgentResponse[],
  candidatePositionId: PositionId,
  threshold: number = 0.67
): ConsensusResult => {
  const eligible = responses.filter(r => r.status === 'ok');

  const tally: VoteTally = {
    yes: eligible.filter(r => r.vote === 'yes' && r.positionId === candidatePositionId).length,
    no: eligible.filter(r => r.vote === 'no').length,
    abstain: eligible.filter(r => r.vote === 'abstain').length,
    total: responses.length,
    eligible: eligible.length,
    votingTotal: 0,
    supermajorityThreshold: 0,
    supermajorityReached: false
  };

  tally.votingTotal = tally.yes + tally.no;

  if (candidatePositionId === null || tally.votingTotal === 0) {
    return { reached: false, positionId: null, positionText: null, voteTally: tally, method: 'none' };
  }

  tally.supermajorityThreshold = Math.ceil(tally.votingTotal * threshold);

  if (tally.yes >= tally.supermajorityThreshold) {
    const candidateText = eligible.find(r => r.positionId === candidatePositionId)?.positionText;
    return {
      reached: true,
      positionId: candidatePositionId,
      positionText: candidateText ?? null,
      voteTally: { ...tally, supermajorityReached: true },
      method: tally.yes === tally.votingTotal ? 'unanimous' : 'supermajority'
    };
  }

  return { reached: false, positionId: null, positionText: null, voteTally: tally, method: 'none' };
};
```

### 6.2 Judge Consensus (judges/consensus.ts)

```typescript
export const detectJudgeConsensus = (
  evaluations: JudgeEvaluation[],
  positions: Map<string, string>,
  majorityThreshold: number = 0.6,
  minConfidence: number = 0.7
): JudgeConsensusResult => {
  const eligible = evaluations.filter(e => e.status === 'ok');

  if (eligible.length === 0) {
    return { reached: false, positionId: null, positionText: null, confidence: 0, dissents: [] };
  }

  const requiredVotes = Math.ceil(eligible.length * majorityThreshold);

  // Count votes per position
  const votes = new Map<string, number>();
  for (const e of eligible) {
    votes.set(e.selectedPositionId!, (votes.get(e.selectedPositionId!) ?? 0) + 1);
  }

  // Find winner with deterministic tie-breaking
  let winnerId: string | null = null;
  let maxVotes = 0;

  // Sort by positionId for determinism before finding winner
  const sortedVotes = Array.from(votes.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  for (const [id, count] of sortedVotes) {
    if (count > maxVotes) {
      maxVotes = count;
      winnerId = id;
    }
  }

  // Tie-break by average confidence
  const tiedPositions = sortedVotes.filter(([_, c]) => c === maxVotes);

  if (tiedPositions.length > 1) {
    let bestAvgConf = -1;
    for (const [posId] of tiedPositions) {
      const evals = eligible.filter(e => e.selectedPositionId === posId);
      const avgConf = evals.reduce((sum, e) => sum + e.confidence, 0) / evals.length;
      if (avgConf > bestAvgConf) {
        bestAvgConf = avgConf;
        winnerId = posId;
      }
    }
  }

  if (!winnerId || maxVotes < requiredVotes) {
    return {
      reached: false,
      positionId: null,
      positionText: null,
      confidence: 0,
      dissents: eligible.map(e => e.judgeId)
    };
  }

  const winningEvals = eligible.filter(e => e.selectedPositionId === winnerId);
  const avgConfidence = winningEvals.reduce((sum, e) => sum + e.confidence, 0) / winningEvals.length;

  if (avgConfidence < minConfidence) {
    return {
      reached: false,
      positionId: winnerId,
      positionText: positions.get(winnerId) ?? null,
      confidence: avgConfidence,
      dissents: eligible.filter(e => e.selectedPositionId !== winnerId).map(e => e.judgeId)
    };
  }

  return {
    reached: true,
    positionId: winnerId,
    positionText: positions.get(winnerId) ?? null,
    confidence: avgConfidence,
    dissents: eligible.filter(e => e.selectedPositionId !== winnerId).map(e => e.judgeId)
  };
};
```

## 7. CLI Interface

### 7.1 Commands

```bash
llm-court debate --config <path> [--output <path>] [--resume <checkpoint>] [--dry-run] [--force] [--json-logs] [--debug] [--allow-external-paths]
llm-court validate <path>
llm-court migrate <checkpoint> [--output <path>]
llm-court --version
```

### 7.2 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Consensus reached |
| 1 | Error (validation, runtime, unrecoverable) |
| 2 | Deadlock (no consensus) |

### 7.3 CLI Provider Contract

For `provider: "cli"`, the adapter spawns `cliPath` with `cliArgs`. Supported tokens:
- `{{PROMPT}}` - replaced with full prompt text
- `{{MAX_TOKENS}}` - replaced with `limits.maxTokensPerResponse`
- `{{TEMPERATURE}}` - replaced with resolved temperature

If `{{PROMPT}}` is not present, prompt is written to stdin (UTF-8). The CLI tool must emit valid JSON matching the response schema. Non-zero exit codes are errors.

### 7.4 Deterministic Mode

When `deterministicMode=true`:
- All `temperature` forced to 0
- `retries.maxAttempts` forced to 0
- JSON repair disabled
- Retry jitter disabled

## 8. Error Handling

### 8.1 Error Categories

| Error | Exit | Recovery |
|-------|------|----------|
| Config validation | 1 | Fix config |
| Checkpoint load/integrity | 1 | Fix or remove |
| Model timeout/rate limit | Retry | Up to maxAttempts |
| Model parse error | Retry | JSON repair, then error |
| >50% agent failures | 1 or continue | Abort unless judges enabled with ≥2 positions |
| Cost/time limit | 1 | Partial output |

### 8.2 Error Response Format

```typescript
{
  status: 'error',
  error: 'Error message',
  vote: 'abstain',
  positionId: null,
  positionText: '',
  reasoning: '',
  confidence: 0
}
```

## 9. Security Considerations

1. **API Keys**: Environment variables only; never in config/logs/checkpoints
2. **CLI Paths**: Absolute paths; `spawn` with `shell: false`
3. **Path Validation**: All paths resolved within cwd (unless `--allow-external-paths`)
4. **CLI Adapter Limits**: Max stdout 10MB, stdin 2MB (to support 128k context)
5. **Checkpoint Integrity**: SHA-256 with canonical JSON; optional HMAC (`LLM_COURT_CHECKPOINT_HMAC_KEY`)
6. **Prompt Injection**: System prompts immutable; only orchestrator constructs

## 10. Performance Requirements

- **Model timeout**: 120s default (1s–600s)
- **Round timeout**: 5 minutes
- **Session timeout**: 20 minutes
- **Concurrency**: 4 parallel calls default
- **Context limit**: 12000 tokens default with truncation
- **Target**: 4 agents × 4 rounds < 10 minutes
- **Memory**: < 1GB

## 11. Observability

### 11.1 Structured Logs (--json-logs)

```json
{
  "ts": "ISO-8601",
  "level": "info|warn|error",
  "sessionId": "string",
  "round": "number",
  "agentId": "string",
  "event": "round_start|model_call|model_response|...",
  "latencyMs": "number",
  "tokenUsage": {...},
  "retryCount": "number",
  "error": "string"
}
```

### 11.2 Metrics (in output)

- `session.totalTokens`
- `session.totalCostUsd`
- `session.totalRetries`
- `session.totalErrors`

## 12. Deployment Strategy

### 12.1 Build
- Transpile TypeScript to ESM via `turbo build`
- Bundle with `tsup` for single entry point
- Add shebang

### 12.2 Distribution
```bash
npm install -g @llm-court/cli
llm-court debate --config ./debate.json
```

### 12.3 Requirements
- Node.js >= 18 (LTS)
- OS: macOS, Linux
- Memory: >= 512MB

## 13. Migration Plan

- Checkpoint version `2.3.0`
- `llm-court migrate <checkpoint>` converts older formats
- Old versions read-only; require migration to resume

## 14. Directory Structure

```
llm-court/
├── apps/
│   ├── engine/
│   │   ├── src/
│   │   │   ├── cli.ts
│   │   │   ├── orchestrator.ts
│   │   │   ├── debate/
│   │   │   │   ├── engine.ts
│   │   │   │   ├── prompts.ts
│   │   │   │   └── consensus.ts
│   │   │   ├── judges/
│   │   │   │   ├── panel.ts
│   │   │   │   └── consensus.ts
│   │   │   ├── adapters/
│   │   │   │   ├── interface.ts
│   │   │   │   ├── ai-sdk.ts
│   │   │   │   ├── cli-adapter.ts
│   │   │   │   ├── templates.ts
│   │   │   │   ├── json-repair.ts
│   │   │   │   ├── retry.ts
│   │   │   │   ├── pricing.ts
│   │   │   │   └── registry.ts
│   │   │   └── state/
│   │   │       ├── manager.ts
│   │   │       └── checkpoint.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── schemas.ts
│   │   │   ├── errors.ts
│   │   │   └── constants.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── env/
│   └── config/
├── package.json
├── turbo.json
└── tsconfig.json
```

## 15. Testing Strategy

### Unit Tests
- Position ID generation
- Consensus detection (ID-based voting)
- Candidate selection (SupportScore)
- JSON repair
- Context truncation

### Integration Tests
- Full debate with mock adapters
- Checkpoint save/restore
- CLI adapter limits
- State machine transitions

### E2E Tests
- Real providers (gated by env)

## 16. Open Questions

1. Streaming UI via WebSocket (post-MVP)
2. Position clustering via embeddings (v3.0)
3. Provider-specific rate limiting
