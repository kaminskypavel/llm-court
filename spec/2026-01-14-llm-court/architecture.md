# LLM Court (Agora) - Architecture Diagrams

> Generated from Technical Specification v2.3.0

## System Overview

```mermaid
flowchart TB
    subgraph CLI["CLI Entry Point"]
        A[llm-court debate]
        B[Config Loader]
        C[Checkpoint Manager]
    end

    subgraph Orchestrator["Debate Orchestrator"]
        D[State Machine]
        E[Session Manager]
        F[Resource Monitor]
    end

    subgraph Engine["Debate Engine"]
        G[Prompt Builder]
        H[Agent Pool]
        I[Vote Aggregator]
        J[Consensus Detector]
    end

    subgraph Judges["Judge Panel"]
        K[Evaluation Prompts]
        L[Judge Pool]
        M[Score Aggregator]
        N[Judge Consensus]
    end

    subgraph Adapters["Model Adapter Layer"]
        O[AI SDK Adapter]
        P[CLI Adapter]
        Q[Retry Logic]
        R[JSON Repair]
    end

    subgraph Providers["External Providers"]
        S[(OpenAI)]
        T[(Anthropic)]
        U[(Google)]
        V[Local CLI<br/>Codex/Gemini]
    end

    A --> B
    A --> C
    B --> D
    C --> D
    D --> E
    E --> F

    D --> G
    G --> H
    H --> I
    I --> J

    D --> K
    K --> L
    L --> M
    M --> N

    H --> O
    H --> P
    L --> O
    L --> P

    O --> Q
    P --> Q
    Q --> R

    O --> S
    O --> T
    O --> U
    P --> V
```

## State Machine

```mermaid
stateDiagram-v2
    [*] --> init

    init --> agent_debate: Start debate

    agent_debate --> consensus_reached: Supermajority YES votes
    agent_debate --> judge_evaluation: Max rounds reached<br/>AND judgePanelEnabled<br/>AND ≥2 positions
    agent_debate --> deadlock: Max rounds reached<br/>AND (not judgePanelEnabled<br/>OR <2 positions)
    agent_debate --> agent_debate: No consensus, continue

    judge_evaluation --> consensus_reached: Judge majority + confidence
    judge_evaluation --> deadlock: Max judge rounds reached
    judge_evaluation --> judge_evaluation: No consensus, continue

    consensus_reached --> [*]
    deadlock --> [*]

    note right of init: Load config, validate, create session
    note right of agent_debate: N agents debate in parallel
    note right of judge_evaluation: M judges evaluate positions
    note right of consensus_reached: Exit code 0
    note right of deadlock: Exit code 2
```

## Agent Debate Flow

```mermaid
sequenceDiagram
    participant O as Orchestrator
    participant E as Debate Engine
    participant A1 as Agent 1
    participant A2 as Agent 2
    participant An as Agent N
    participant C as Consensus Detector

    O->>E: Start Round 1

    par Parallel Agent Calls
        E->>A1: System + Debate Prompt
        E->>A2: System + Debate Prompt
        E->>An: System + Debate Prompt
    end

    Note over A1,An: Round 1: vote=abstain, propose positions

    A1-->>E: {vote: abstain, newPositionText, reasoning}
    A2-->>E: {vote: abstain, newPositionText, reasoning}
    An-->>E: {vote: abstain, newPositionText, reasoning}

    E->>E: Select candidate (highest SupportScore)
    E->>C: Check consensus
    C-->>E: Not reached (Round 1)

    O->>E: Start Round 2

    par Parallel Agent Calls
        E->>A1: Candidate + History
        E->>A2: Candidate + History
        E->>An: Candidate + History
    end

    Note over A1,An: Round N: vote yes/no/abstain

    A1-->>E: {vote: yes, targetPositionId}
    A2-->>E: {vote: yes, targetPositionId}
    An-->>E: {vote: no, newPositionText}

    E->>C: Check consensus
    C-->>E: Supermajority reached!

    E-->>O: ConsensusResult
```

## Judge Panel Flow

```mermaid
sequenceDiagram
    participant O as Orchestrator
    participant JP as Judge Panel
    participant J1 as Judge 1
    participant J2 as Judge 2
    participant Jn as Judge N
    participant JC as Judge Consensus

    O->>JP: Positions from agent debate

    JP->>JP: Collect unique positions

    par Parallel Judge Calls
        JP->>J1: Evaluate all positions
        JP->>J2: Evaluate all positions
        JP->>Jn: Evaluate all positions
    end

    J1-->>JP: {selectedPositionId, scores, confidence}
    J2-->>JP: {selectedPositionId, scores, confidence}
    Jn-->>JP: {selectedPositionId, scores, confidence}

    JP->>JC: Check consensus

    alt Majority + Confidence Met
        JC-->>JP: Consensus reached
        JP-->>O: Final verdict
    else Below Threshold
        JC-->>JP: No consensus
        JP->>JP: Continue to next round
    end
```

## Position Tracking & Voting

```mermaid
flowchart LR
    subgraph Round1["Round 1 - Initialization"]
        P1[Position A<br/>ID: abc123def456]
        P2[Position B<br/>ID: 789xyz012abc]
        P3[Position C<br/>ID: def456789xyz]
    end

    subgraph Selection["Candidate Selection"]
        S1[Calculate SupportScore<br/>= Sum of Confidence]
        S2[Sort by Score DESC]
        S3[Tie-break: Count DESC]
        S4[Tie-break: ID ASC]
    end

    subgraph Round2["Round 2 - Voting"]
        C[Candidate: Position A<br/>ID: abc123def456]
        V1[Agent 1: YES<br/>targetPositionId: abc123def456]
        V2[Agent 2: YES<br/>targetPositionId: abc123def456]
        V3[Agent 3: NO<br/>newPositionText: ...]
    end

    P1 --> S1
    P2 --> S1
    P3 --> S1
    S1 --> S2 --> S3 --> S4
    S4 --> C
    C --> V1
    C --> V2
    C --> V3
```

## Consensus Detection Algorithm

```mermaid
flowchart TD
    Start([Round Complete]) --> Filter[Filter eligible responses<br/>status = ok]

    Filter --> Count[Count votes]

    Count --> VotingTotal[votingTotal = yes + no<br/>Exclude abstains]

    VotingTotal --> Check{votingTotal > 0?}

    Check -->|No| NoConsensus[No Consensus<br/>Continue to next round]

    Check -->|Yes| Threshold[Calculate threshold<br/>= ceil(votingTotal × 0.67)]

    Threshold --> Compare{yes ≥ threshold?}

    Compare -->|No| NoConsensus

    Compare -->|Yes| Consensus[Consensus Reached!<br/>Return winning position]

    NoConsensus --> MaxRounds{Max rounds<br/>reached?}

    MaxRounds -->|No| NextRound[Next Round]
    MaxRounds -->|Yes| JudgeCheck{judgePanelEnabled<br/>AND ≥2 positions?}

    JudgeCheck -->|Yes| JudgePhase[Enter Judge Evaluation]
    JudgeCheck -->|No| Deadlock[Deadlock<br/>Exit code 2]
```

## Model Adapter Architecture

```mermaid
flowchart TB
    subgraph Interface["Adapter Interface"]
        I[ModelAdapter<br/>call(prompt): Response]
    end

    subgraph Registry["Adapter Registry"]
        R[getAdapter(config)]
    end

    subgraph Implementations["Implementations"]
        AI[AI SDK Adapter<br/>OpenAI, Anthropic, Google]
        CLI[CLI Adapter<br/>Local models via spawn]
    end

    subgraph Middleware["Middleware Layer"]
        RT[Retry Logic<br/>Exponential backoff]
        JR[JSON Repair<br/>Fix malformed output]
        TO[Timeout Enforcement]
    end

    subgraph Output["Response Processing"]
        V[Zod Validation]
        E[Error Normalization]
    end

    R --> AI
    R --> CLI

    AI --> RT
    CLI --> RT

    RT --> TO
    TO --> JR
    JR --> V
    V --> E

    E --> I

    style Interface fill:#e1f5fe
    style Middleware fill:#fff3e0
```

## CLI Provider Contract

```mermaid
sequenceDiagram
    participant A as CLI Adapter
    participant P as spawn(cliPath)
    participant M as Local Model

    A->>A: Replace tokens in cliArgs<br/>{{PROMPT}}, {{MAX_TOKENS}}, {{TEMPERATURE}}

    alt Prompt in args
        A->>P: spawn(cliPath, [args with prompt])
    else Prompt via stdin
        A->>P: spawn(cliPath, args)
        A->>P: write prompt to stdin
        A->>P: close stdin
    end

    P->>M: Execute model

    M-->>P: JSON response

    P-->>A: stdout (max 10MB)

    A->>A: Parse JSON
    A->>A: Validate against schema
    A->>A: Repair if needed

    alt Success
        A-->>A: Return AgentResponse
    else Parse Error
        A-->>A: Retry or error response
    end
```

## Checkpoint & Resume

```mermaid
flowchart TB
    subgraph Save["Checkpoint Save"]
        S1[After each round]
        S2[Canonicalize JSON<br/>Sort keys alphabetically]
        S3[Compute SHA-256]
        S4[Optional HMAC<br/>LLM_COURT_CHECKPOINT_HMAC_KEY]
        S5[Write to checkpointDir]
    end

    subgraph Resume["Checkpoint Resume"]
        R1[Load checkpoint file]
        R2[Verify integrity<br/>SHA-256 match]
        R3[Optional HMAC verify]
        R4[Validate schema v2.3.0]
        R5[Restore state machine]
        R6[Continue from last round]
    end

    S1 --> S2 --> S3 --> S4 --> S5

    R1 --> R2 --> R3 --> R4 --> R5 --> R6

    S5 -.->|checkpoint.json| R1
```

## Package Dependencies

```mermaid
flowchart TB
    subgraph Apps["apps/"]
        engine["@llm-court/engine<br/>(CLI + Orchestrator)"]
        web["@llm-court/web<br/>(Visualization)"]
    end

    subgraph Packages["packages/"]
        shared["@llm-court/shared<br/>(Types, Schemas, Constants)"]
        env["@llm-court/env<br/>(Env validation)"]
        config["@llm-court/config<br/>(TSConfig, ESLint)"]
    end

    subgraph External["External"]
        zod["zod"]
        aisdk["ai (Vercel AI SDK)"]
        commander["commander"]
    end

    engine --> shared
    engine --> env
    web --> shared

    shared --> zod
    engine --> aisdk
    engine --> commander
    engine --> zod

    style Apps fill:#e8f5e9
    style Packages fill:#e3f2fd
    style External fill:#fce4ec
```

## Error Handling Flow

```mermaid
flowchart TD
    Call[Model Call] --> Timeout{Timeout?}

    Timeout -->|Yes| Retry1{Retries left?}
    Timeout -->|No| Parse[Parse Response]

    Retry1 -->|Yes| Backoff1[Exponential Backoff]
    Retry1 -->|No| ErrorResp1[Error Response<br/>status: error]

    Backoff1 --> Call

    Parse --> Valid{Valid JSON?}

    Valid -->|No| Repair[JSON Repair]
    Valid -->|Yes| Schema[Schema Validation]

    Repair --> RepairValid{Repair successful?}

    RepairValid -->|Yes| Schema
    RepairValid -->|No| Retry2{Retries left?}

    Retry2 -->|Yes| Backoff2[Exponential Backoff]
    Retry2 -->|No| ErrorResp2[Error Response<br/>status: error]

    Backoff2 --> Call

    Schema --> SchemaValid{Schema valid?}

    SchemaValid -->|Yes| Success[Success Response<br/>status: ok]
    SchemaValid -->|No| ErrorResp3[Error Response<br/>status: error]
```

## Resource Limits

```mermaid
flowchart LR
    subgraph Limits["Configured Limits"]
        L1[Model Timeout<br/>120s default]
        L2[Round Timeout<br/>5 min default]
        L3[Session Timeout<br/>20 min default]
        L4[Max Tokens<br/>200k total]
        L5[Max Cost<br/>$25 USD]
        L6[Concurrency<br/>4 parallel]
    end

    subgraph Monitor["Resource Monitor"]
        M1[Track tokens per call]
        M2[Track cumulative cost]
        M3[Track elapsed time]
    end

    subgraph Actions["Enforcement"]
        A1[Abort on timeout]
        A2[Abort on cost limit]
        A3[Abort on token limit]
        A4[Partial output saved]
    end

    L1 --> M3
    L2 --> M3
    L3 --> M3
    L4 --> M1
    L5 --> M2

    M1 --> A3
    M2 --> A2
    M3 --> A1

    A1 --> A4
    A2 --> A4
    A3 --> A4
```
