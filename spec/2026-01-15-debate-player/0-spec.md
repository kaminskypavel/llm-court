---
title: "LLM Court Debate Player - Technical Specification"
type: tech
created: 2026-01-15
version: 2.5.0
rounds: 6
models:
  - codex/gpt-5.2-codex
  - gemini-cli/gemini-3-pro-preview
status: implemented
implemented: 2026-01-15
---

# LLM Court Debate Player – Technical Specification v2.5.0

## 1. Overview / Context

Debate Player is a client-side, 2D animated visualization for LLM Court debate sessions. It consumes a validated `DebateOutput` JSON and renders an interactive courtroom timeline with deterministic playback. It runs in `apps/web` as a Next.js page and uses PixiJS for rendering with an HTML overlay for text. No server-side persistence is required; limited client-side persistence is used for "recent" metadata.

### 1.1 Goals
- Deterministic playback of debate steps with scrubbing and speed controls
- Visual display of rounds, agent responses, vote tallies, and final verdict
- Accessible transcript (visible and screen-reader friendly via `react-window` virtualization)
- Operate fully in-browser with optional URL fetch for loading data
- PixiJS 2D canvas with DOM text overlay

### 1.2 Non-Goals
- Real-time streaming or incremental updates (batch JSON only)
- Audio/voice synthesis, video export
- Editing or authoring debates
- Backend storage or authentication (client-only state)
- Mobile-first experience (desktop-first; transcript-first fallback on <768px)

## 2. System Architecture

### 2.1 Data Flow

1. Load `DebateOutput` via file, URL, or local selection
2. Validate with Zod and normalize (versioned migration if needed)
3. Linearize into `PlaybackStep[]`
4. Compute `StepTiming[]` (integer ms)
5. Feed steps to state machine + clock for playback
6. Render Pixi canvas (sprites) + DOM overlay (speech bubbles, transcript)

### 2.2 Determinism and Visibility Handling

**Trust boundary:** All debate JSON is untrusted input. The UI must never execute or interpret it as HTML/JS beyond a strictly sanitized subset.

**Visibility changes:**
- Playback must pause when `document.visibilityState === 'hidden'`
- On visibility change to hidden, clock actor stops and sends `SYNC_TIME`
- On return to visible, playback stays paused until user resumes

```typescript
// In useEffect within DebatePlayer
useEffect(() => {
  const handleVisibility = () => {
    if (document.visibilityState === 'hidden' && isPlaying) {
      send({ type: 'PAUSE' });
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, [isPlaying, send]);
```

### 2.3 Render Model Contract

- **Domain:** `DebateOutput`, `PlaybackStep`, `StepTiming`
- **Render model:** `RenderFrame` containing sprite states, positions, and overlay text
- Rendering uses a pure function: `steps + currentTimeMs -> RenderFrame`

```typescript
interface RenderFrame {
  sprites: Array<{
    id: string;
    x: number;
    y: number;
    state: 'idle' | 'speaking' | 'highlighted' | 'error';
    z: number; // Z-order for sprite layering
  }>;
  bubbles: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    kind: 'speech' | 'error';
  }>;
  highlights: { agentId?: string; round?: number };
}

// Coordinate system: 1920x1080 virtual units, scaled to fit container
// DOM overlay uses same transform matrix for alignment
```

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Next.js Web App                               │
│                         (apps/web)                                   │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DebatePlayerPage                                │
│                      (/app/player)                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Input Methods:                                                      │
│  - File upload (drag & drop or file picker)                          │
│  - URL parameter (?url=https://...)                                  │
│  - localStorage (recent debates list)                                │
│                                                                      │
│  Processing:                                                         │
│  - Validate against DebateOutputSchema (Zod)                         │
│  - Linearize to PlaybackStep[] via debateToSteps()                   │
│  - Initialize XState machine + Clock Actor                           │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌──────────────────┐   ┌────────────────────┐   ┌──────────────────────┐
│  CourtroomScene  │   │     Timeline       │   │     InfoPanel        │
│  (PixiJS Canvas) │   │     (React)        │   │     (React)          │
├──────────────────┤   ├────────────────────┤   ├──────────────────────┤
│ - Sprite render  │   │ - Scrubber (int ms)│   │ - Current step       │
│ - Animations     │   │ - Step markers     │   │ - Agent responses    │
│ - Ref subscribed │   │ - Jump to step     │   │ - Vote tally         │
│   to clock       │   │ - Keyboard nav     │   │ - Position details   │
└──────────────────┘   └────────────────────┘   └──────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    HTML Overlay (React Portal)                        │
│  - SpeechBubble components (positioned via CSS transform)             │
│  - Text sanitized with DOMPurify                                      │
│  - Accessible transcript panel (aria-live + virtualized list)         │
└──────────────────────────────────────────────────────────────────────┘
```

## 3. Technology Stack

### 3.1 Selected: PixiJS v7 + @pixi/react + XState

**Rationale:**
- **PixiJS**: Lightweight 2D rendering (~300KB), WebGL with canvas fallback
- **@pixi/react**: Clean React integration
- **XState**: Finite state machine prevents impossible states, explicit transitions
- **react-window**: For virtualizing the transcript list without data loss

**Dependencies:**
```json
{
  "dependencies": {
    "pixi.js": "^7.3.2",
    "@pixi/react": "^7.1.1",
    "gsap": "^3.12.5",
    "xstate": "^5.9.1",
    "@xstate/react": "^4.1.0",
    "dompurify": "^3.0.8",
    "zod": "^3.22.4",
    "react-window": "^1.8.10",
    "react-use-measure": "^2.1.1",
    "@llm-court/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/dompurify": "^3.0.5",
    "@types/react-window": "^1.8.8"
  }
}
```

**Note:** Version pinning is critical—`@pixi/react` v7.x is only compatible with `pixi.js` v7.x, not v8.

## 4. API Design (Client Interfaces)

Even without a backend, we define interface contracts for each input path.

### 4.1 URL Query Contract

Endpoint: `/player?url=<encodedUrl>`
- `url` must be `encodeURIComponent` of a full HTTPS URL or `http://localhost/...`
- Maximum length: 2048 chars (reject longer with `ERR_URL_TOO_LONG`)

**Errors:**
| Code | Description | User Message |
|------|-------------|--------------|
| `ERR_URL_INVALID` | Cannot parse URL | "Invalid URL." |
| `ERR_URL_PROTOCOL` | Not HTTPS/localhost | "Only HTTPS URLs are allowed." |
| `ERR_URL_TOO_LONG` | Exceeds 2048 chars | "URL too long." |
| `ERR_FETCH_FAILED` | Network error | "Failed to fetch debate file." |
| `ERR_RESPONSE_TOO_LARGE` | Content > 5MB | "File too large (max 5MB)." |
| `ERR_JSON_INVALID` | JSON parse failed | "Invalid JSON file." |
| `ERR_SCHEMA_INVALID` | Zod validation failed | "Debate JSON does not match expected schema." |

### 4.2 File Upload Contract

- MIME: `application/json` OR `.json` extension
- Max size: 5 MiB

**Errors:**
| Code | Description | User Message |
|------|-------------|--------------|
| `ERR_FILE_TOO_LARGE` | File > 5MB | "File too large (max 5MB)." |
| `ERR_FILE_TYPE` | Wrong MIME/extension | "Please upload a JSON file." |
| `ERR_JSON_INVALID` | JSON parse failed | "Invalid JSON file." |
| `ERR_SCHEMA_INVALID` | Zod validation failed | "Debate JSON does not match expected schema." |

### 4.3 localStorage Contract

Key: `llm-court-recent-debates`

Schema (direct array, no wrapper):
```json
[
  {
    "id": "uuid",
    "topic": "string",
    "loadedAt": "ISO-8601",
    "source": "file|url",
    "sourceName": "string"
  }
]
```

Max entries: 5

**Errors:**
| Code | Description | User Message |
|------|-------------|--------------|
| `ERR_STORAGE_QUOTA` | localStorage full | (Silently prune and retry) |

### 4.4 Error Payload Type

All loading errors use a structured error object:

```typescript
interface LoadError {
  code: string;          // Error code (e.g., 'ERR_URL_INVALID')
  message: string;       // User-safe message
  detail?: string;       // Technical detail (logged, not shown)
  source: 'url' | 'file' | 'storage';
}

function toLoadError(error: unknown, source: LoadError['source']): LoadError {
  if (error instanceof z.ZodError) {
    return {
      code: 'ERR_SCHEMA_INVALID',
      message: 'Debate JSON does not match expected schema.',
      detail: error.errors.map(e => e.message).join('; '),
      source,
    };
  }
  // ... handle other error types
}
```

## 5. Data Models

### 5.1 Linearized Playback Model

The hierarchical `DebateOutput` (Rounds → Responses) is flattened into atomic `PlaybackStep` events for deterministic playback:

```typescript
type Vote = 'yes' | 'no' | 'abstain';
type VerdictSource = 'agent_consensus' | 'judge_consensus' | 'deadlock';

type PlaybackStep =
  | { type: 'ROUND_START'; round: number; candidateText: string | null }
  | { type: 'AGENT_SPEAK'; round: number; agentId: string; positionId: string | null; text: string; vote: Vote; confidence: number; status: 'success' | 'error'; error?: string }
  | { type: 'VOTE_TALLY'; round: number; tally: VoteTally }
  | { type: 'CONSENSUS_CHECK'; round: number; reached: boolean; positionText: string | null; positionId: string | null }
  | { type: 'JUDGE_START'; round: number }
  | { type: 'JUDGE_EVALUATE'; round: number; judgeId: string; selectedPositionId: string | null; confidence: number; text: string; status: 'success' | 'error'; error?: string }
  | { type: 'FINAL_VERDICT'; positionText: string | null; positionId: string | null; source: VerdictSource; confidence: number };

interface StepTiming {
  step: PlaybackStep;
  startMs: number;  // Integer milliseconds from debate start
  durationMs: number;  // Integer duration
}
```

**Step generation rules:**
- Each round yields `ROUND_START` → N `AGENT_SPEAK` → `VOTE_TALLY` → `CONSENSUS_CHECK`
- If judge panel enabled and consensus not reached: `JUDGE_START` → M `JUDGE_EVALUATE` → `FINAL_VERDICT`
- If consensus reached: skip judge steps and go to `FINAL_VERDICT`
- `JUDGE_EVALUATE.text` is populated from `JudgeResponse.reasoning` (for display in speech bubbles)

### 5.2 Duration Calculation

All times are **integer milliseconds**. Durations are clamped to `[1500ms, 12000ms]`:

```typescript
const MIN_DURATION_MS = 1500;
const MAX_DURATION_MS = 12000;
const MS_PER_CHAR = 20; // ~250 WPM at 5 chars/word

function clampDuration(ms: number): number {
  return Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, ms));
}

const DURATIONS = {
  ROUND_START: 2000,
  AGENT_SPEAK: (charCount: number) => clampDuration(2000 + charCount * MS_PER_CHAR),
  VOTE_TALLY: 3000,
  CONSENSUS_CHECK: 2500,
  JUDGE_START: 1500,
  JUDGE_EVALUATE: (charCount: number) => clampDuration(1500 + charCount * MS_PER_CHAR),
  FINAL_VERDICT: 4000,
} as const;

function computeStepTimings(steps: PlaybackStep[]): StepTiming[] {
  let currentMs = 0;
  return steps.map(step => {
    const durationMs = calculateDuration(step);
    const timing: StepTiming = { step, startMs: currentMs, durationMs };
    currentMs += durationMs;
    return timing;
  });
}
```

### 5.3 Zod Schema Validation (Strict)

**Key invariants:**
- All rounds must have strictly increasing `roundNumber`
- Each round's `responses` must include unique `agentId`s
- `voteTally.total` must equal `yes + no + abstain`
- `voteTally.votingTotal` <= `voteTally.eligible`
- `tokenUsage.total` >= `prompt + completion`
- `finalVerdict.positionId` must exist in the set of all position IDs
- `session.completedAt` >= `session.startedAt`
- If `judgePanel.enabled === true`, `judgePanel.rounds.length >= 1`
- If `finalVerdict.source === 'judge_consensus'`, `judgePanel.final` must not be null

```typescript
import { z } from 'zod';

const VoteSchema = z.enum(['yes', 'no', 'abstain']);
const VerdictSourceSchema = z.enum(['agent_consensus', 'judge_consensus', 'deadlock']);

const ParticipantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(['advocate', 'judge', 'moderator']),
  avatarId: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const AgentResponseSchema = z.object({
  agentId: z.string().min(1).max(100),
  round: z.number().int().positive(),
  positionId: z.string().nullable(),
  positionText: z.string().max(10000),
  reasoning: z.string().max(50000),
  vote: VoteSchema,
  confidence: z.number().min(0).max(1),
  tokenUsage: z.object({
    prompt: z.number().int().nonnegative(),
    completion: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    estimated: z.boolean(),
  }),
  latencyMs: z.number().int().nonnegative(),
  status: z.enum(['success', 'error']),
  error: z.string().max(1000).optional(),
});

const VoteTallySchema = z.object({
  yes: z.number().int().nonnegative(),
  no: z.number().int().nonnegative(),
  abstain: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  eligible: z.number().int().nonnegative(),
  votingTotal: z.number().int().nonnegative(),
  supermajorityThreshold: z.number().min(0).max(1),
  supermajorityReached: z.boolean(),
});

const JudgeResponseSchema = z.object({
  judgeId: z.string().min(1).max(100),
  round: z.number().int().positive(),
  selectedPositionId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(20000).optional(),
  status: z.enum(['success', 'error']),
  error: z.string().max(1000).optional(),
});

const JudgeRoundSchema = z.object({
  roundNumber: z.number().int().positive(),
  responses: z.array(JudgeResponseSchema).min(1).max(20),
  timestamp: z.string().datetime(),
});

const RoundResultSchema = z.object({
  roundNumber: z.number().int().positive(),
  candidatePositionId: z.string().nullable(),
  candidatePositionText: z.string().max(10000).nullable(),
  responses: z.array(AgentResponseSchema).min(1).max(20),
  consensusReached: z.boolean(),
  consensusPositionId: z.string().nullable(),
  consensusPositionText: z.string().max(10000).nullable(),
  voteTally: VoteTallySchema,
  timestamp: z.string().datetime(),
});

const DebateOutputSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  session: z.object({
    id: z.string().uuid(),
    topic: z.string().min(1).max(1000),
    initialQuery: z.string().max(5000).optional(),
    participants: z.array(ParticipantSchema).optional(),
    phase: z.enum(['init', 'agent_debate', 'judge_evaluation', 'consensus_reached', 'deadlock']),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    totalTokens: z.number().int().nonnegative(),
    totalCostUsd: z.number().nonnegative(),
    pricingKnown: z.boolean(),
    engineVersion: z.string().max(50),
    totalRetries: z.number().int().nonnegative(),
    totalErrors: z.number().int().nonnegative(),
  }),
  agentDebate: z.object({
    rounds: z.array(RoundResultSchema).min(1).max(50),
    finalPositionId: z.string().nullable(),
    finalPositionText: z.string().max(10000).nullable(),
  }),
  judgePanel: z.object({
    enabled: z.boolean(),
    rounds: z.array(JudgeRoundSchema).max(50),
    final: JudgeResponseSchema.nullable(),
  }),
  finalVerdict: z.object({
    // CRITICAL: positionId/positionText are nullable for 'deadlock' verdicts
    positionId: z.string().nullable(),
    positionText: z.string().max(10000).nullable(),
    confidence: z.number().min(0).max(1),
    source: VerdictSourceSchema,
  }),
}).superRefine((data, ctx) => {
  // Deadlock validation: if source is deadlock, positionId must be null/empty
  if (data.finalVerdict.source === 'deadlock') {
    if (data.finalVerdict.positionId && data.finalVerdict.positionId.trim() !== '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Deadlock verdict should not have positionId' });
    }
  } else {
    // Non-deadlock: positionId is required
    if (!data.finalVerdict.positionId || data.finalVerdict.positionId.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Non-deadlock verdict must have positionId' });
    }
  }
  // Round ordering
  const rounds = data.agentDebate.rounds;
  for (let i = 1; i < rounds.length; i++) {
    if (rounds[i].roundNumber <= rounds[i - 1].roundNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Round numbers must be strictly increasing' });
      break;
    }
  }

  // Unique agent per round and round match
  for (const round of rounds) {
    const seen = new Set<string>();
    for (const resp of round.responses) {
      if (resp.round !== round.roundNumber) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Response round mismatch' });
      }
      if (seen.has(resp.agentId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate agentId in round' });
      }
      seen.add(resp.agentId);
    }
  }

  // Vote tally invariants
  for (const round of rounds) {
    const t = round.voteTally;
    if (t.total !== t.yes + t.no + t.abstain) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vote tally total mismatch' });
    }
    if (t.votingTotal > t.eligible) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'votingTotal cannot exceed eligible' });
    }
  }

  // Token usage invariant
  for (const round of rounds) {
    for (const resp of round.responses) {
      if (resp.tokenUsage.total < resp.tokenUsage.prompt + resp.tokenUsage.completion) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Token usage total too small' });
      }
    }
  }

  // Final verdict position ID (only for non-deadlock)
  if (data.finalVerdict.source !== 'deadlock' && data.finalVerdict.positionId) {
    const positionIds = new Set<string>();
    for (const round of rounds) {
      if (round.candidatePositionId) positionIds.add(round.candidatePositionId);
      if (round.consensusPositionId) positionIds.add(round.consensusPositionId);
      for (const resp of round.responses) {
        if (resp.positionId) positionIds.add(resp.positionId);
      }
    }
    if (!positionIds.has(data.finalVerdict.positionId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'finalVerdict.positionId must reference an existing position' });
    }
  }

  // Session time ordering
  if (new Date(data.session.completedAt) < new Date(data.session.startedAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'completedAt must be >= startedAt' });
  }

  // Judge panel consistency
  if (data.judgePanel.enabled && data.judgePanel.rounds.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enabled judge panel must have at least one round' });
  }

  // Judge consensus requires final judge
  if (data.finalVerdict.source === 'judge_consensus' && !data.judgePanel.final) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Judge consensus verdict requires judgePanel.final' });
  }
});
```

## 6. State Management (XState)

### 6.1 Clock and Time Ref Contract

- `timeRef` and `speedRef` are passed to the machine via `input` during initialization
- Refs are stored in `context` for type-safe access (no monkey-patching)
- Clock actor updates `timeRef` and emits `STEP_CHANGED`
- Clock actor sends `SYNC_TIME` on cleanup (pause/end) to sync XState context
- **CRITICAL:** Speed must be read dynamically via ref, not captured at invoke time

```typescript
interface TimeRef { currentTimeMs: number; }
interface SpeedRef { currentSpeed: number; }

// Machine input type for ref initialization
type PlayerInput = {
  timeRef: React.MutableRefObject<TimeRef>;
  speedRef: React.MutableRefObject<SpeedRef>;
};
```

### 6.2 Player State Machine

```typescript
import { setup, assign, fromCallback, type ActorRefFrom } from 'xstate';

interface PlayerContext {
  debate: DebateOutput | null;
  steps: StepTiming[];
  currentStepIndex: number;
  currentTimeMs: number; // Guaranteed accurate when paused/stopped. See timeRef during playback.
  playbackSpeed: number;
  selectedAgentId: string | null;
  error: string | null;
  // Refs stored in context (non-serializable, but required for actor comms)
  timeRef: React.MutableRefObject<TimeRef>;
  speedRef: React.MutableRefObject<SpeedRef>;
}

type PlayerEvent =
  | { type: 'LOAD'; data: unknown }
  | { type: 'LOAD_SUCCESS'; debate: DebateOutput; steps: StepTiming[] }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SEEK'; timeMs: number }
  | { type: 'SYNC_TIME'; timeMs: number } // Sync XState context with ref on clock exit
  | { type: 'STEP_CHANGED'; index: number }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'SELECT_AGENT'; agentId: string | null }
  | { type: 'PLAYBACK_END' }
  | { type: 'RESET' };

// Clock as Callback Actor - XState v5 idiomatic pattern
// CRITICAL: Uses SpeedRef for dynamic speed changes (avoids stale closure bug)
const clockActor = fromCallback<PlayerEvent, { steps: StepTiming[]; speedRef: SpeedRef; timeRef: TimeRef }>(
  ({ sendBack, input }) => {
    let lastStepIndex = 0;
    let lastFrameTime = performance.now();
    let rafId: number | null = null;

    const { steps, speedRef, timeRef } = input;
    const totalDurationMs = steps.length > 0
      ? steps[steps.length - 1].startMs + steps[steps.length - 1].durationMs
      : 0;

    const findStepIndex = (timeMs: number): number => {
      for (let i = steps.length - 1; i >= 0; i--) {
        if (timeMs >= steps[i].startMs) return i;
      }
      return 0;
    };

    const loop = (now: number) => {
      const delta = now - lastFrameTime;
      lastFrameTime = now;

      // Read speed dynamically from ref (not captured at invoke time)
      const speed = speedRef.currentSpeed;
      const currentTimeMs = Math.min(timeRef.currentTimeMs + Math.round(delta * speed), totalDurationMs);

      // 1. Update shared ref (high frequency, no React re-renders)
      timeRef.currentTimeMs = currentTimeMs;

      // 2. Check for step change (low frequency)
      const newStepIndex = findStepIndex(currentTimeMs);
      if (newStepIndex !== lastStepIndex) {
        lastStepIndex = newStepIndex;
        sendBack({ type: 'STEP_CHANGED', index: newStepIndex });
      }

      // 3. Check for end
      if (currentTimeMs >= totalDurationMs) {
        sendBack({ type: 'PLAYBACK_END' });
        return;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    // Cleanup on actor stop - CRITICAL: sync final time back to context
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      sendBack({ type: 'SYNC_TIME', timeMs: timeRef.currentTimeMs });
    };
  }
);

// State machine helpers
function calculateStepIndex(steps: StepTiming[], timeMs: number): number {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (timeMs >= steps[i].startMs) return i;
  }
  return 0;
}

const playerMachine = setup({
  types: {
    context: {} as PlayerContext,
    events: {} as PlayerEvent,
    input: {} as PlayerInput,
  },
  actors: {
    clock: clockActor,
    validateAndPrepare: fromPromise(async ({ input }: { input: unknown }) => {
      const debate = DebateOutputSchema.parse(input);
      const steps = debateToSteps(debate);
      const timings = computeStepTimings(steps);
      return { debate, steps: timings };
    }),
  },
  guards: {
    hasSteps: ({ context }) => context.steps.length > 0,
  },
  actions: {
    assignDebate: assign({
      debate: ({ event }) => (event as any).debate,
      steps: ({ event }) => (event as any).steps,
      currentStepIndex: 0,
      currentTimeMs: 0,
      error: null,
    }),
    assignError: assign({
      error: ({ event }) => (event as any).error,
    }),
    assignStepIndex: assign({
      currentStepIndex: ({ event }) => (event as any).index,
    }),
    assignTime: assign({
      currentTimeMs: ({ event }) => (event as any).timeMs,
    }),
    assignTimeAndStep: assign({
      currentTimeMs: ({ event }) => (event as any).timeMs,
      currentStepIndex: ({ context, event }) =>
        calculateStepIndex(context.steps, (event as any).timeMs),
    }),
    assignSpeed: assign({
      playbackSpeed: ({ event }) => (event as any).speed,
    }),
    assignSelectedAgent: assign({
      selectedAgentId: ({ event }) => (event as any).agentId,
    }),
    resetContext: assign(({ context }) => ({
      debate: null,
      steps: [],
      currentStepIndex: 0,
      currentTimeMs: 0,
      error: null,
      // Preserve refs on reset
      timeRef: context.timeRef,
      speedRef: context.speedRef,
    })),
    // Ref sync actions - update mutable refs for clock actor
    updateSpeedRef: ({ context }) => {
      context.speedRef.current.currentSpeed = context.playbackSpeed;
    },
    updateTimeRef: ({ context, event }) => {
      context.timeRef.current.currentTimeMs = (event as any).timeMs;
    },
  },
}).createMachine({
  id: 'player',
  initial: 'empty',
  // Context factory function initializes from input
  context: ({ input }) => ({
    debate: null,
    steps: [],
    currentStepIndex: 0,
    currentTimeMs: 0,
    playbackSpeed: 1,
    selectedAgentId: null,
    error: null,
    timeRef: input.timeRef,
    speedRef: input.speedRef,
  }),
  states: {
    empty: {
      on: {
        LOAD: 'loading',
      },
    },
    loading: {
      invoke: {
        src: 'validateAndPrepare',
        input: ({ event }) => (event as any).data,
        onDone: {
          target: 'ready',
          actions: 'assignDebate',
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => (event as any).error.message,
          }),
        },
      },
    },
    ready: {
      on: {
        PLAY: { target: 'playing', guard: 'hasSteps' },
        SEEK: { actions: 'assignTimeAndStep' },
        SET_SPEED: { actions: 'assignSpeed' },
        SELECT_AGENT: { actions: 'assignSelectedAgent' },
        RESET: { target: 'empty', actions: 'resetContext' },
        LOAD: 'loading',
      },
    },
    playing: {
      invoke: {
        src: 'clock',
        // Clean input: refs come from context (no monkey-patching)
        input: ({ context }) => ({
          steps: context.steps,
          speedRef: context.speedRef.current,
          timeRef: context.timeRef.current,
        }),
      },
      on: {
        PAUSE: 'paused',
        SYNC_TIME: { actions: 'assignTime' },
        STEP_CHANGED: { actions: 'assignStepIndex' },
        SET_SPEED: { actions: ['assignSpeed', 'updateSpeedRef'] },
        // SEEK while playing: update both context AND timeRef
        SEEK: { actions: ['assignTimeAndStep', 'updateTimeRef'] },
        SELECT_AGENT: { actions: 'assignSelectedAgent' },
        PLAYBACK_END: 'ready',
        RESET: { target: 'empty', actions: 'resetContext' },
        LOAD: 'loading',
      },
    },
    paused: {
      on: {
        PLAY: { target: 'playing', guard: 'hasSteps' },
        SEEK: { actions: 'assignTimeAndStep' },
        SET_SPEED: { actions: ['assignSpeed', 'updateSpeedRef'] },
        SELECT_AGENT: { actions: 'assignSelectedAgent' },
        // CRITICAL: Handle SYNC_TIME in paused state (emitted during pause transition)
        SYNC_TIME: { actions: 'assignTime' },
        RESET: { target: 'empty', actions: 'resetContext' },
        LOAD: 'loading',
      },
    },
    error: {
      on: {
        RESET: { target: 'empty', actions: 'resetContext' },
        LOAD: 'loading',
      },
    },
  },
});
```

### 6.3 State Machine Visualization

```
┌─────────┐   LOAD    ┌─────────┐
│  empty  │──────────▶│ loading │
└─────────┘           └────┬────┘
     ▲                     │
     │ RESET          SUCCESS / ERROR
     │                     │
     │    ┌────────────────┴────────────────┐
     │    ▼                                 ▼
     │ ┌─────────┐  PLAY   ┌─────────┐  ┌───────┐
     └─│  ready  │────────▶│ playing │  │ error │
       └────┬────┘         └────┬────┘  └───┬───┘
            │                   │           │
            │ ◀─── PAUSE ───────┤           │
            │                   │           │
            │    ┌──────────────┘           │
            │    ▼                          │
            │ ┌────────┐                    │
            │ │ paused │                    │
            │ └────┬───┘                    │
            │      │                        │
            └──────┴────────────────────────┘
                        RESET
```

### 6.4 usePlayerMachine Hook

```typescript
/**
 * Hook that creates the player machine with refs for high-frequency sync.
 * Refs are passed via input and stored in context (type-safe, no monkey-patching).
 */
function usePlayerMachine() {
  const timeRef = useRef<TimeRef>({ currentTimeMs: 0 });
  const speedRef = useRef<SpeedRef>({ currentSpeed: 1 });

  // Pass refs via input - stored in context for clock actor access
  const [state, send] = useMachine(playerMachine, {
    input: { timeRef, speedRef },
  });

  // Sync speedRef when context.playbackSpeed changes (for ready/paused states)
  useEffect(() => {
    speedRef.current.currentSpeed = state.context.playbackSpeed;
  }, [state.context.playbackSpeed]);

  return { state, send, timeRef, speedRef };
}
```

## 7. High-Frequency Time Sync

### 7.1 Two-Tier Updates

| Frequency | Mechanism | Use Case |
|-----------|-----------|----------|
| 60fps | Shared ref + RAF | Timeline scrubber, PixiJS sprite positions |
| ~1-5 Hz | XState `STEP_CHANGED` / `SYNC_TIME` | Step transitions, InfoPanel, transcript |

### 7.2 usePlaybackTime Hook

```typescript
/**
 * High-frequency time access for smooth scrubber updates.
 * Uses a shared ref updated by the clock actor - no React re-renders.
 */
function usePlaybackTime(
  timeRef: React.MutableRefObject<TimeRef>,
  isPlaying: boolean
) {
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    if (!isPlaying) return; // Only animate when playing
    let rafId: number;
    const tick = () => {
      forceUpdate();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  return timeRef.current.currentTimeMs;
}
```

## 8. Data Loading

### 8.1 File Upload

```typescript
async function handleFileUpload(file: File): Promise<DebateOutput> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large (max 5MB)');
  }
  const text = await file.text();
  const json = JSON.parse(text);
  return DebateOutputSchema.parse(json);
}
```

### 8.2 URL Parameter (Safe Streaming)

We rely on browser CORS policies rather than an artificial allowlist. Users can load debates from any HTTPS server that allows cross-origin requests. **Uses streaming to enforce size limit** (Content-Length can be spoofed or missing).

```typescript
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

async function handleUrlLoad(urlParam: string): Promise<DebateOutput> {
  const url = decodeURIComponent(urlParam);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error('Only HTTPS URLs allowed');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}. Ensure the server supports CORS.`);
    }

    // Stream response with hard byte limit (Content-Length can be spoofed/missing)
    const reader = response.body?.getReader();
    if (!reader) throw new Error('ReadableStream not supported');

    let receivedLength = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedLength += value.length;
      if (receivedLength > MAX_SIZE) {
        controller.abort();
        throw new Error('Response too large (max 5MB)');
      }
      chunks.push(value);
    }

    const combined = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      combined.set(chunk, position);
      position += chunk.length;
    }

    const text = new TextDecoder().decode(combined);
    const json = JSON.parse(text);
    return DebateOutputSchema.parse(json);
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### 8.3 localStorage Recent List

```typescript
const RECENT_KEY = 'llm-court-recent-debates';
const MAX_RECENT = 5;

interface RecentDebate {
  id: string;
  topic: string;
  loadedAt: string;
  source: 'file' | 'url';
  sourceName: string;
}

function saveToRecent(debate: DebateOutput, source: 'file' | 'url', sourceName: string): void {
  const recent = getRecentDebates();
  const entry: RecentDebate = {
    id: debate.session.id,
    topic: debate.session.topic,
    loadedAt: new Date().toISOString(),
    source,
    sourceName,
  };

  const filtered = recent.filter(r => r.id !== entry.id);
  const updated = [entry, ...filtered].slice(0, MAX_RECENT);

  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // Storage quota exceeded - prune and retry
    const pruned = updated.slice(0, 3);
    localStorage.setItem(RECENT_KEY, JSON.stringify(pruned));
  }
}

function getRecentDebates(): RecentDebate[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}
```

## 9. Security Considerations

### 9.1 Input Sanitization

All LLM-generated text is sanitized before rendering:

```typescript
import DOMPurify from 'dompurify';

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre', 'br'],
  ALLOWED_ATTR: [],
};

function sanitizeText(text: string): string {
  // Truncate to prevent DOM bloat
  const truncated = text.length > 10000 ? text.slice(0, 10000) + '...' : text;
  return DOMPurify.sanitize(truncated, DOMPURIFY_CONFIG);
}
```

### 9.2 URL Fetch Security

- **Threat: Malicious JSON** → Mitigation: Strict Zod parsing, schema validation
- **Threat: XSS via JSON** → Mitigation: DOMPurify before React render
- **Threat: SSRF** → Not applicable (client-side fetch)
- **Threat: Large response DoS** → Mitigation: Content-Length check, 5MB limit
- **CORS Policy** → Browser enforces; user must ensure server allows cross-origin

### 9.3 Content Security Policy

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'", // PixiJS WebGL shaders
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https:", // Allow HTTPS fetches (CORS protects)
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];
```

## 10. Asset Management

### 10.1 Asset Manifest Schema

```typescript
const AssetManifestSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  generatedAt: z.string().datetime().optional(),
  assets: z.record(
    z.string().regex(/^[a-z0-9-]+$/),
    z.string().regex(/^[a-z0-9-]+\.[a-f0-9]{8}\.(png|jpg|webp)$/)
  ),
});

type AssetManifest = z.infer<typeof AssetManifestSchema>;
```

### 10.2 Agent Sprite Resolution

Three-tier resolution using `participants` metadata:

```typescript
function resolveAgentSprite(
  agentId: string,
  participants: Participant[] | undefined,
  manifest: AssetManifest
): string {
  // 1. Check participants metadata
  const participant = participants?.find(p => p.id === agentId);
  if (participant?.avatarId && manifest.assets[participant.avatarId]) {
    return manifest.assets[participant.avatarId];
  }

  // 2. Name match
  const nameKey = agentId.toLowerCase().replace(/[^a-z0-9]/g, '-');
  if (manifest.assets[nameKey]) return manifest.assets[nameKey];

  // 3. Deterministic hash fallback
  const defaultSprites = ['advocate-idle', 'advocate-speaking'];
  const hash = agentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return manifest.assets[defaultSprites[hash % defaultSprites.length]] ?? manifest.assets['advocate-idle'];
}
```

## 11. Component Architecture

### 11.1 File Structure

```
apps/web/src/
├── app/
│   └── player/
│       └── page.tsx
├── components/
│   └── player/
│       ├── DebatePlayer.tsx
│       ├── DebateDropZone.tsx
│       ├── RecentDebates.tsx
│       ├── CourtroomCanvas.tsx
│       ├── MobilePlayer.tsx
│       ├── Timeline.tsx
│       ├── InfoPanel.tsx
│       ├── SpeechBubble.tsx
│       ├── AgentSprite.tsx
│       ├── JudgeSprite.tsx
│       ├── VoteTally.tsx
│       ├── TranscriptPanel.tsx
│       ├── AriaLiveAnnouncer.tsx
│       └── PlaybackControls.tsx
├── lib/
│   └── player/
│       ├── machine.ts
│       ├── linearize.ts
│       ├── durations.ts
│       └── schema.ts
├── hooks/
│   ├── usePlayerMachine.ts
│   └── usePlaybackTime.ts
└── public/
    └── sprites/
        ├── manifest.json
        └── *.png
```

### 11.2 Responsive Breakpoints

| Breakpoint | Layout | Rendering |
|------------|--------|-----------|
| ≥1024px | Full layout: Canvas + Timeline + InfoPanel | PixiJS WebGL |
| 768-1023px | Stacked: Canvas top, sidebar bottom | PixiJS WebGL |
| <768px | **Transcript-First Mode** | No PixiJS; text + scrubbing |

**Mobile Player (<768px):**

```tsx
function MobilePlayer({ steps, currentIndex, isPlaying, onPlay, onPause, onSeek }: MobilePlayerProps) {
  return (
    <div className="flex flex-col h-screen">
      <header className="p-4 border-b">
        <h1 className="text-lg font-semibold">Debate Replay</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <TranscriptPanel steps={steps} currentIndex={currentIndex} />
      </div>
      <footer className="p-4 border-t space-y-2">
        <PlaybackControls isPlaying={isPlaying} onPlay={onPlay} onPause={onPause} />
        <SimpleScrubber steps={steps} currentIndex={currentIndex} onSeek={onSeek} />
      </footer>
    </div>
  );
}
```

## 12. Accessibility

### 12.1 Virtualized Transcript Panel

Uses `react-window` to render only visible entries. No hard cap on history length.

```tsx
import { FixedSizeList as List } from 'react-window';
import useMeasure from 'react-use-measure';

function TranscriptPanel({ steps, currentIndex }: TranscriptPanelProps) {
  const [ref, { height }] = useMeasure();
  const listRef = useRef<List>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(currentIndex, 'smart');
    }
  }, [currentIndex]);

  return (
    <div ref={ref} className="h-full w-full" role="log" aria-label="Debate transcript">
      <List
        ref={listRef}
        height={height || 400}
        itemCount={steps.length}
        itemSize={60}
        width="100%"
        itemData={{ steps, currentIndex }}
      >
        {TranscriptRow}
      </List>
    </div>
  );
}

function TranscriptRow({ index, style, data }: ListChildComponentProps) {
  const { steps, currentIndex } = data;
  const { step } = steps[index];
  const isCurrent = index === currentIndex;
  const isError = step.type === 'AGENT_SPEAK' && step.status === 'error';

  return (
    <div
      style={style}
      className={cn(
        'px-3 py-2 border-b',
        isCurrent && 'bg-blue-50',
        isError && 'bg-red-50'
      )}
    >
      {formatStep(step)}
      {isError && step.error && (
        <div className="text-red-600 text-xs">Error: {step.error}</div>
      )}
    </div>
  );
}
```

### 12.2 Aria-Live Announcer

```tsx
function AriaLiveAnnouncer({ currentStep }: { currentStep: PlaybackStep | null }) {
  const announcement = useMemo(() => {
    if (!currentStep) return '';
    return formatStepForScreenReader(currentStep);
  }, [currentStep]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
}
```

### 12.3 Keyboard Navigation

| Key | Action |
|-----|--------|
| Space | Play/Pause toggle |
| ← | Previous step |
| → | Next step |
| Home | Jump to start |
| End | Jump to end |
| 1/2/3 | Set speed 0.5x/1x/2x |

### 12.4 Error Step Visualization

```tsx
function SpeechBubble({ step, position }: SpeechBubbleProps) {
  const isError = step.type === 'AGENT_SPEAK' && step.status === 'error';

  return (
    <div
      className={cn(
        'absolute rounded-lg p-3 shadow-md max-w-xs',
        isError
          ? 'bg-red-50 border-2 border-red-400 text-red-900'
          : 'bg-white border border-gray-200'
      )}
      style={{ left: position.x, top: position.y }}
    >
      {isError ? (
        <>
          <div className="font-semibold text-red-700">Error</div>
          <div className="text-sm">{step.error ?? 'Unknown error'}</div>
        </>
      ) : (
        <TypewriterText text={sanitizeText(step.text)} />
      )}
    </div>
  );
}
```

## 13. Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial Load (LCP) | < 2.5s | Lighthouse (desktop, p75) |
| Frame Rate | ≥ 55 FPS | PixiJS ticker stats |
| Memory (Heap) | < 150MB | Chrome DevTools (p75) |
| Timeline Seek Latency | < 50ms | User-perceived |
| File Parse Time | < 400ms for 5MB | Performance.now() (mid-tier laptop) |

### 13.1 Performance Strategies

- Lazy load PixiJS only on player page (`dynamic()` with SSR disabled)
- Sprite sheets for animations (single HTTP request per character)
- Memoize `computeStepTimings()` result
- Use `requestAnimationFrame` exclusively (no `setInterval`)
- Content-hash assets for aggressive caching
- Transcript virtualization via `react-window`
- Shared ref for high-frequency time sync (no React re-renders at 60fps)

### 13.2 Memory Budget

| Component | Budget | Notes |
|-----------|--------|-------|
| PixiJS textures | 30MB | ~10-15 sprites at 2048x2048 |
| Debate JSON | 5MB | Enforced at load time |
| PlaybackStep[] | 10MB | ~50 rounds × 20 agents = 1000 steps |
| React fiber tree | 15MB | Main component tree |
| Buffer | 90MB | Headroom for GC, temporary allocations |
| **Total** | **150MB** | Target max heap |

## 14. Observability

### 14.1 Client-Side Metrics

| Metric | Description |
|--------|-------------|
| `load_time_ms` | Time from page load to ready state |
| `parse_time_ms` | Time to parse and validate JSON |
| `steps_count` | Number of playback steps generated |
| `asset_load_time_ms` | Time to load sprite assets |
| `fps_avg` | Average FPS during playback |

### 14.2 Structured Logging

```typescript
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  code: string;
  message: string;
  sessionId?: string;
  timestamp: string;
}
```

Logging is opt-in. No telemetry is sent by default.

## 15. Error Handling

| Error | Handling | User Message |
|-------|----------|--------------|
| Invalid JSON | Show Zod errors | "Debate JSON does not match expected schema." |
| Fetch error (CORS/404) | Show helpful message | "Could not load debate. Check URL accessibility." |
| WebGL failure | Fallback to mobile/text mode | "WebGL not supported; showing text view." |
| Asset 404 | Render placeholder with agent ID | (Internal, no user message) |

## 16. Testing Strategy

### 16.1 Unit Tests
- Zod schema invariants: round ordering, tally sums, token totals
- `debateToSteps` mapping for consensus vs judge flow
- Duration clamping and total duration
- URL validation and HTTPS enforcement

### 16.2 Integration Tests
- File upload and URL load
- Playback controls and seeking
- `SYNC_TIME` on pause and cleanup
- Transcript virtualization and auto-scroll

### 16.3 Security Tests
- XSS payloads sanitized and not executed
- Text truncation for DOM bloat prevention

### 16.4 Visual Regression
- Canvas layout at 1024, 1440, 1920
- Speech bubble positioning with long text

## 17. Deployment Strategy

### 17.1 Static Assets

- `manifest.json`: `cache-control: no-cache`
- Sprite images: `cache-control: public, max-age=31536000, immutable`
- Assets in `public/sprites` with content hash

### 17.2 Rollback

Revert to previous `manifest.json` and sprite bundle. No database migration required.

## 18. Migration Plan

- Accept `DebateOutput.version >= 2.0.0`
- If older version detected:
  - Attempt client-side migration via `migrateDebateOutput(oldVersion)` (optional)
  - If migration not implemented, reject with `ERR_SCHEMA_INVALID` and message: "Unsupported version."

## 19. Open Questions / Future Considerations

1. Should URL hash base64 loading be supported (max 64 KB)?
2. Should recent list store full JSON or metadata only?
3. Should we allow embedding the player via iframe?
4. Do we need a "Download JSON" button for debates loaded via URL?

---

## Implementation Notes

**Implemented: 2026-01-15**

### Files Created

#### Core Library (`apps/web/src/lib/player/`)
- `types.ts` - PlaybackStep, StepTiming, TimeRef, SpeedRef types
- `durations.ts` - Duration constants, clampDuration, step duration calculation
- `linearize.ts` - debateToSteps, computeStepTimings
- `schema.ts` - Zod validation with ValidatedDebateOutput type
- `machine.ts` - XState v5 state machine with clock callback actor
- `loader.ts` - File upload and URL loading with streaming support
- `storage.ts` - localStorage recent debates list

#### Hooks (`apps/web/src/hooks/`)
- `usePlayerMachine.ts` - Machine wrapper with refs for high-frequency sync
- `usePlaybackTime.ts` - RAF-based time polling (60fps)
- `useMediaQuery.ts` - Responsive breakpoint detection

#### Components (`apps/web/src/components/player/`)
- `DebatePlayer.tsx` - Main orchestrator with responsive layouts
- `DebateDropZone.tsx` - File upload + URL input
- `RecentDebates.tsx` - localStorage list UI
- `PlaybackControls.tsx` - Play/Pause/Speed controls
- `Timeline.tsx` - Scrubber with step markers
- `CourtroomCanvas.tsx` - PixiJS v7 canvas with GSAP animations
- `DynamicCanvas.tsx` - SSR-disabled wrapper for PixiJS
- `InfoPanel.tsx` - Current step details and session stats
- `TranscriptPanel.tsx` - Virtualized list with react-window
- `SpeechBubble.tsx` - Typing animation overlay
- `MobilePlayer.tsx` - Transcript-first mobile layout
- `AriaLiveAnnouncer.tsx` - Screen reader announcements

#### Assets (`apps/web/public/sprites/`)
- `manifest.json` - Asset manifest
- SVG sprites: courtroom-bg, agent-idle, agent-speaking, judge-idle, judge-speaking, podium

#### Page
- `apps/web/src/app/player/page.tsx` - Server component with suspense

### Technical Notes

1. **XState v5 Event Types**: Used inline `assign` in promise actor onDone/onError handlers for proper type inference
2. **PixiJS v7 API**: Uses constructor pattern `new PIXI.Application({...})` not async `app.init()`
3. **Zod v4**: Uses `error.issues` not `error.errors`
4. **Progress Component**: Native implementation without Radix UI (project uses @base-ui/react)
