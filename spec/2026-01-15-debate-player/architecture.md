# LLM Court Debate Player – Architecture Diagrams v2.5.0

This document provides visual architecture diagrams for the Debate Player component.

## 1. System Context Diagram

```mermaid
C4Context
    title System Context - Debate Player (Client-Only)

    Person(user, "User", "Views and interacts with debate replays")

    System_Boundary(llmcourt, "LLM Court") {
        System(player, "Debate Player", "2D animated courtroom visualization")
        System(engine, "Debate Engine", "Orchestrates multi-agent debates")
    }

    System_Ext(urls, "External HTTPS URLs", "Hosts debate JSON files")

    Rel(user, player, "Views debates via browser")
    Rel(engine, user, "Exports debate JSON")
    Rel(player, urls, "Fetches debate JSON (CORS)")
```

## 2. Component Architecture

```mermaid
graph TB
    subgraph "Next.js App (apps/web)"
        subgraph "Player Page"
            PAGE["/player"]
            XSTATE[(XState Machine)]
            CLOCK[Clock Actor]
            REFS[TimeRef + SpeedRef]
        end

        subgraph "React Components"
            PLAYER[DebatePlayer]
            CANVAS[CourtroomCanvas]
            TIMELINE[Timeline]
            INFO[InfoPanel]
            SPEECH[SpeechBubble]
            TRANSCRIPT[TranscriptPanel]
            DROPZONE[DebateDropZone]
        end

        subgraph "PixiJS Layer"
            STAGE[Stage]
            AGENTS[AgentSprites]
            JUDGES[JudgeSprites]
            BG[Background]
        end

        subgraph "Data Sources"
            FILE[File Upload]
            URL[URL Parameter]
            LOCAL[localStorage]
        end
    end

    subgraph "Assets"
        ASSETS[/sprites/manifest.json]
    end

    FILE --> DROPZONE
    URL --> PAGE
    LOCAL --> PAGE

    PAGE --> XSTATE
    XSTATE --> CLOCK
    CLOCK --> REFS
    REFS --> CANVAS

    PAGE --> PLAYER
    PLAYER --> CANVAS
    PLAYER --> TIMELINE
    PLAYER --> INFO
    PLAYER --> TRANSCRIPT

    CANVAS --> STAGE
    STAGE --> AGENTS
    STAGE --> JUDGES
    STAGE --> BG
    CANVAS --> SPEECH

    CANVAS -.-> ASSETS
```

## 3. Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Page as PlayerPage
    participant Machine as XState Machine
    participant Clock as Clock Actor
    participant Canvas as CourtroomCanvas

    User->>Page: Load via file/URL/localStorage

    Page->>Page: Validate with Zod
    Page->>Page: debateToSteps()
    Page->>Page: computeStepTimings()

    Page->>Machine: LOAD { data }
    Machine->>Machine: validateAndPrepare()
    Machine-->>Page: Ready state

    User->>Machine: PLAY
    Machine->>Clock: Invoke clock actor

    loop Animation Frame (60fps)
        Clock->>Clock: Calculate delta * speed
        Clock->>Clock: Update timeRef

        alt Step changed
            Clock->>Machine: STEP_CHANGED { index }
            Machine-->>Page: Re-render InfoPanel
        end
    end

    User->>Machine: PAUSE
    Machine->>Clock: Stop actor
    Clock->>Machine: SYNC_TIME { timeMs }
    Machine->>Machine: Update context.currentTimeMs

    User->>Machine: SEEK { timeMs }
    Machine->>Machine: Update context + timeRef
```

## 4. PlaybackStep Linearization

```mermaid
flowchart LR
    subgraph Input
        DO[DebateOutput]
        ROUNDS[Rounds Array]
        RESP[Agent Responses]
    end

    subgraph "debateToSteps()"
        ITER[Iterate Rounds]
        EXTRACT[Extract Events]
        FLAT[Flatten to Array]
    end

    subgraph Output
        STEPS[PlaybackStep Array]
        R_START[ROUND_START]
        A_SPEAK[AGENT_SPEAK]
        V_TALLY[VOTE_TALLY]
        C_CHECK[CONSENSUS_CHECK]
        J_START[JUDGE_START]
        J_EVAL[JUDGE_EVALUATE]
        F_VERDICT[FINAL_VERDICT]
    end

    DO --> ROUNDS
    ROUNDS --> RESP

    ROUNDS --> ITER
    RESP --> EXTRACT
    ITER --> FLAT
    EXTRACT --> FLAT

    FLAT --> STEPS
    STEPS --> R_START
    STEPS --> A_SPEAK
    STEPS --> V_TALLY
    STEPS --> C_CHECK
    STEPS --> J_START
    STEPS --> J_EVAL
    STEPS --> F_VERDICT
```

## 5. XState State Machine

```mermaid
stateDiagram-v2
    [*] --> empty: Initial

    empty --> loading: LOAD
    loading --> ready: Validation success
    loading --> error: Validation failed

    ready --> playing: PLAY (guard: hasSteps)
    playing --> paused: PAUSE
    paused --> playing: PLAY

    playing --> ready: PLAYBACK_END

    ready --> ready: SEEK, SET_SPEED, SELECT_AGENT
    playing --> playing: SEEK, SET_SPEED, STEP_CHANGED
    paused --> paused: SEEK, SET_SPEED, SYNC_TIME

    ready --> empty: RESET
    playing --> empty: RESET
    paused --> empty: RESET
    error --> empty: RESET

    ready --> loading: LOAD (new file)
    paused --> loading: LOAD
    error --> loading: LOAD

    note right of playing
        Clock Actor runs here
        - Updates timeRef at 60fps
        - Emits STEP_CHANGED when step boundary crossed
        - Emits SYNC_TIME on cleanup
    end note
```

## 6. Component Hierarchy

```mermaid
graph TD
    APP[Next.js App]
    APP --> LAYOUT[RootLayout]
    LAYOUT --> PAGE[PlayerPage]

    PAGE --> PLAYER[DebatePlayer]

    PLAYER --> HEADER[Header]
    PLAYER --> MAIN[Main Content]
    PLAYER --> CONTROLS[PlaybackControls]

    MAIN --> CANVAS_WRAPPER[Canvas Wrapper]
    MAIN --> SIDEBAR[Sidebar]

    CANVAS_WRAPPER --> PIXI[PixiJS Stage]
    CANVAS_WRAPPER --> OVERLAY[HTML Overlay]

    PIXI --> BG[Background Sprite]
    PIXI --> BENCH[Judge Bench]
    PIXI --> PODIUMS[Podiums]
    PIXI --> JUDGES[Judge Sprites]
    PIXI --> ADVOCATES[Advocate Sprites]

    OVERLAY --> BUBBLES[Speech Bubbles]

    SIDEBAR --> INFO[InfoPanel]
    SIDEBAR --> TIMELINE[Timeline]

    CONTROLS --> PLAY_BTN[Play/Pause]
    CONTROLS --> SPEED_BTN[Speed Selector]
    CONTROLS --> SCRUBBER[Timeline Scrubber]

    INFO --> ROUND_INFO[Round Info]
    INFO --> VOTE_VIZ[Vote Visualization]
    INFO --> AGENT_DETAIL[Agent Details]
```

## 7. Data Loading Flow

```mermaid
sequenceDiagram
    participant User
    participant Page as PlayerPage
    participant Loader as Data Loader
    participant Zod as Zod Validator

    alt File Upload
        User->>Page: Drop/Select JSON file
        Page->>Loader: handleFileUpload(file)
        Loader->>Loader: Check size ≤ 5MB
        Loader->>Loader: file.text()
        Loader->>Loader: JSON.parse()
    else URL Parameter
        User->>Page: Navigate to /player?url=...
        Page->>Loader: handleUrlLoad(url)
        Loader->>Loader: Validate URL protocol
        Loader->>Loader: Stream fetch with 5MB limit
        Loader->>Loader: JSON.parse()
    else localStorage
        User->>Page: Select from recent list
        Page->>Page: Read from localStorage
        Page->>Loader: Load full JSON from original source
    end

    Loader->>Zod: parse(json)
    alt Valid
        Zod-->>Page: DebateOutput
        Page->>Page: Save to recent list
        Page->>Page: Machine.send({ type: 'LOAD' })
    else Invalid
        Zod-->>Page: ZodError
        Page->>Page: Show structured error UI
    end
```

## 8. Playback Clock Timing

```mermaid
gantt
    title Example Debate Timeline (3 rounds, 2 agents)
    dateFormat X
    axisFormat %s

    section Round 1
    ROUND_START      :r1_start, 0, 2000
    Agent 1 speaks   :a1_r1, after r1_start, 5000
    Agent 2 speaks   :a2_r1, after a1_r1, 4500
    Vote Tally       :v1, after a2_r1, 3000
    Consensus Check  :c1, after v1, 2500

    section Round 2
    ROUND_START      :r2_start, after c1, 2000
    Agent 1 speaks   :a1_r2, after r2_start, 6000
    Agent 2 speaks   :a2_r2, after a1_r2, 5500
    Vote Tally       :v2, after a2_r2, 3000
    Consensus Check  :c2, after v2, 2500

    section Verdict
    Final Verdict    :verdict, after c2, 4000
```

## 9. Error Handling Flow

```mermaid
flowchart TD
    START[Load Debate JSON]

    START --> SOURCE{Source Type}
    SOURCE -->|File| FILE_CHECK{File ≤ 5MB?}
    SOURCE -->|URL| URL_CHECK{Valid HTTPS?}

    FILE_CHECK -->|No| FILE_ERR[ERR_FILE_TOO_LARGE]
    FILE_CHECK -->|Yes| PARSE

    URL_CHECK -->|No| URL_ERR[ERR_URL_PROTOCOL]
    URL_CHECK -->|Yes| STREAM[Stream with limit]

    STREAM -->|Timeout| TIMEOUT_ERR[ERR_FETCH_TIMEOUT]
    STREAM -->|Too large| SIZE_ERR[ERR_RESPONSE_TOO_LARGE]
    STREAM -->|CORS/Network| FETCH_ERR[ERR_FETCH_FAILED]
    STREAM -->|Success| PARSE

    PARSE{Parse JSON} -->|Fail| PARSE_ERR[ERR_JSON_INVALID]
    PARSE -->|Success| VALIDATE

    VALIDATE{Zod Validate} -->|Fail| VAL_ERR[ERR_SCHEMA_INVALID]
    VALIDATE -->|Success| LINEAR[Linearize to Steps]

    LINEAR --> LOAD_ASSETS[Load Sprite Assets]

    LOAD_ASSETS --> WEBGL{WebGL Available?}
    WEBGL -->|Yes| PIXI[Initialize PixiJS]
    WEBGL -->|No| FALLBACK[Use Transcript-First Mode]

    PIXI --> READY[Ready for Playback]
    FALLBACK --> READY

    FILE_ERR --> ERROR_UI[Display LoadError]
    URL_ERR --> ERROR_UI
    TIMEOUT_ERR --> ERROR_UI
    SIZE_ERR --> ERROR_UI
    FETCH_ERR --> ERROR_UI
    PARSE_ERR --> ERROR_UI
    VAL_ERR --> ERROR_UI
```

## 10. Two-Tier Update Architecture

```mermaid
flowchart TB
    subgraph "High Frequency (60fps)"
        RAF[requestAnimationFrame]
        CLOCK[Clock Actor Loop]
        TIMEREF[TimeRef.currentTimeMs]
        CANVAS[PixiJS Canvas]
        SCRUBBER[Timeline Scrubber]
    end

    subgraph "Low Frequency (~1-5 Hz)"
        XSTATE[XState Machine]
        CONTEXT[context.currentStepIndex]
        INFO[InfoPanel]
        TRANSCRIPT[TranscriptPanel]
        ARIA[AriaLiveAnnouncer]
    end

    RAF --> CLOCK
    CLOCK --> TIMEREF
    TIMEREF --> CANVAS
    TIMEREF --> SCRUBBER

    CLOCK -->|STEP_CHANGED| XSTATE
    CLOCK -->|SYNC_TIME| XSTATE
    XSTATE --> CONTEXT
    CONTEXT --> INFO
    CONTEXT --> TRANSCRIPT
    CONTEXT --> ARIA
```

## 11. Sprite Animation States

```mermaid
stateDiagram-v2
    [*] --> Idle: Initial

    state Advocate {
        Idle --> Thinking: ROUND_START
        Thinking --> Speaking: AGENT_SPEAK (this agent)
        Speaking --> Idle: Speech complete
        Idle --> Idle: AGENT_SPEAK (other agent)
        Speaking --> Error: status === 'error'
        Error --> Idle: Next step
    }

    state Judge {
        JudgeIdle --> Voting: JUDGE_EVALUATE (this judge)
        Voting --> JudgeIdle: Vote revealed
        Voting --> JudgeError: status === 'error'
        JudgeError --> JudgeIdle: Next step
    }

    note right of Advocate
        Speaking includes:
        - Speech bubble appears
        - Typewriter text effect
        - Vote indicator animation
        - Confidence bar fill
    end note
```

## 12. Security Architecture (Client-Only)

```mermaid
flowchart TB
    subgraph "Input Validation"
        FILE_SIZE[File Size ≤ 5MB]
        STREAM_LIMIT[Streaming Byte Limit]
        URL_PROTOCOL[HTTPS Only]
        ZOD[Zod Schema Validation]
    end

    subgraph "Content Security"
        DOMPURIFY[DOMPurify Sanitization]
        CSP[Content Security Policy]
        TRUNCATE[Text Truncation 10KB]
    end

    subgraph "Browser Security"
        CORS[CORS Policy Enforcement]
        SAME_ORIGIN[Same-Origin for localStorage]
    end

    CLIENT[User Browser] --> FILE_SIZE
    CLIENT --> URL_PROTOCOL
    URL_PROTOCOL --> CORS
    CORS --> STREAM_LIMIT

    FILE_SIZE --> ZOD
    STREAM_LIMIT --> ZOD

    ZOD --> DOMPURIFY
    DOMPURIFY --> TRUNCATE
    TRUNCATE --> CSP
    CSP --> RENDER[Safe Rendering]
```

## 13. Responsive Layout Architecture

```mermaid
flowchart TB
    subgraph "≥1024px (Desktop)"
        DESKTOP_CANVAS[PixiJS Canvas]
        DESKTOP_SIDE[Sidebar: Info + Timeline]
        DESKTOP_CONTROLS[Playback Controls]
        DESKTOP_CANVAS --- DESKTOP_SIDE
        DESKTOP_SIDE --- DESKTOP_CONTROLS
    end

    subgraph "768-1023px (Tablet)"
        TABLET_CANVAS[PixiJS Canvas - Stacked]
        TABLET_INFO[Info Panel Below]
        TABLET_CONTROLS[Playback Controls]
        TABLET_CANVAS --- TABLET_INFO
        TABLET_INFO --- TABLET_CONTROLS
    end

    subgraph "<768px (Mobile)"
        MOBILE_HEADER[Header]
        MOBILE_TRANSCRIPT[Virtualized Transcript]
        MOBILE_SCRUBBER[Simple Scrubber]
        MOBILE_CONTROLS[Play/Pause]
        MOBILE_HEADER --- MOBILE_TRANSCRIPT
        MOBILE_TRANSCRIPT --- MOBILE_SCRUBBER
        MOBILE_SCRUBBER --- MOBILE_CONTROLS
    end

    note right of MOBILE_TRANSCRIPT
        No PixiJS on mobile
        Text-only transcript-first mode
        Uses react-window virtualization
    end note
```

---

## Implementation Notes

### Diagram Legend

| Symbol | Meaning |
|--------|---------|
| Rectangle | Component/Service |
| Cylinder | State Store |
| Diamond | Decision point |
| Parallelogram | Input/Output |
| Rounded Rectangle | Process |

### Mermaid Rendering

These diagrams use [Mermaid](https://mermaid.js.org/) syntax. To view:
- GitHub renders them natively in markdown preview
- VS Code with Mermaid extension
- [Mermaid Live Editor](https://mermaid.live/)

### Related Documents

- [0-spec.md](./0-spec.md) - Full technical specification v2.5.0
- [packages/shared/src/types.ts](/packages/shared/src/types.ts) - TypeScript types
- [apps/engine/README.md](/apps/engine/README.md) - Debate engine docs

### Key Architecture Changes (v2.5.0)

1. **No Database**: Removed PostgreSQL; debates loaded via file upload, URL, or localStorage
2. **XState over Zustand**: Finite state machine for explicit state transitions
3. **Clock Actor Pattern**: Callback actor for 60fps updates with ref-based time sync
4. **Streaming Fetch**: Safe URL loading with byte-limit enforcement
5. **Mobile-First Transcript**: No PixiJS on mobile; virtualized text view
