# @llm-court/engine

Debate orchestration engine for LLM Court. Runs multi-agent debates with optional judge panel for consensus.

## Quick Start

```bash
# Run a debate
bun run apps/engine/src/cli.ts debate -c examples/local-cli-debate.json

# Save output to file
bun run apps/engine/src/cli.ts debate -c examples/local-cli-debate.json -o output.json

# Enable debug logging
bun run apps/engine/src/cli.ts debate -c examples/local-cli-debate.json --debug

# Validate config only
bun run apps/engine/src/cli.ts validate examples/local-cli-debate.json
```

## Running with Local LLMs

### Codex CLI (ChatGPT Pro subscription)

1. Install Codex CLI:
```bash
npm install -g @openai/codex
codex login
```

2. Configure agent with `codex` provider:
```json
{
  "id": "codex-agent",
  "model": {
    "provider": "codex",
    "model": "o4-mini",
    "cliPath": "/opt/homebrew/bin/codex",
    "reasoningEffort": "high"
  },
  "systemPrompt": "You are a thoughtful debater."
}
```

**Codex Options:**
- `reasoningEffort`: `"minimal"` | `"low"` | `"medium"` | `"high"` | `"xhigh"`
- `enableSearch`: `true` to enable web search

### Gemini CLI

1. Install Gemini CLI:
```bash
npm install -g @anthropic/gemini-cli
gemini auth
```

2. Configure agent with `gemini-cli` provider:
```json
{
  "id": "gemini-agent",
  "model": {
    "provider": "gemini-cli",
    "model": "gemini-2.5-pro",
    "cliPath": "/opt/homebrew/bin/gemini"
  },
  "systemPrompt": "You advocate for pragmatic solutions."
}
```

### Generic CLI Adapter

For other local models (llama.cpp, ollama, etc.), use the generic `cli` provider:

```json
{
  "id": "local-agent",
  "model": {
    "provider": "cli",
    "model": "llama3",
    "cliPath": "/usr/local/bin/ollama",
    "cliArgs": ["run", "llama3", "{{PROMPT}}"],
    "chatTemplate": "llama3"
  }
}
```

**Chat Templates:**
- `chatml` - ChatML format (OpenAI-style)
- `llama3` - Llama 3 format
- `gemma` - Gemma format

**Template Tokens:**
- `{{PROMPT}}` - Full formatted prompt
- `{{MAX_TOKENS}}` - Max response tokens
- `{{TEMPERATURE}}` - Temperature setting

## Configuration Reference

### Minimal Config

```json
{
  "topic": "Is Rust better than Go for systems programming?",
  "agents": [
    {
      "id": "rust-advocate",
      "model": { "provider": "codex", "model": "o4-mini", "cliPath": "/opt/homebrew/bin/codex" },
      "systemPrompt": "You advocate for Rust."
    },
    {
      "id": "go-advocate",
      "model": { "provider": "gemini-cli", "model": "gemini-2.5-pro", "cliPath": "/opt/homebrew/bin/gemini" },
      "systemPrompt": "You advocate for Go."
    }
  ],
  "judges": [],
  "judgePanelEnabled": false,
  "maxAgentRounds": 3
}
```

### Full Config with Judge Panel

```json
{
  "topic": "Which database should we use for our new service?",
  "initialQuery": "Consider scalability, operational complexity, and team expertise.",
  "agents": [
    { "id": "postgres-fan", "model": {...}, "systemPrompt": "You advocate for PostgreSQL." },
    { "id": "mongo-fan", "model": {...}, "systemPrompt": "You advocate for MongoDB." },
    { "id": "pragmatist", "model": {...}, "systemPrompt": "You evaluate based on trade-offs." }
  ],
  "judges": [
    { "id": "judge-1", "model": {...} },
    { "id": "judge-2", "model": {...} },
    { "id": "judge-3", "model": {...} }
  ],
  "judgePanelEnabled": true,
  "maxAgentRounds": 4,
  "maxJudgeRounds": 3,
  "consensusThreshold": 0.67,
  "judgeConsensusThreshold": 0.6,
  "contextTopology": "last_round_with_self"
}
```

## Environment Variables

For API-based providers, set the appropriate API keys:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."
```

## Output

The debate outputs JSON with:
- `session`: Metadata (id, topic, phase, tokens, cost)
- `agentDebate.rounds`: Each round's responses and votes
- `judgePanel.rounds`: Judge evaluations (if enabled)
- `finalVerdict`: Winner position with confidence

Exit codes:
- `0`: Consensus reached
- `1`: Error
- `2`: Deadlock (no consensus)
