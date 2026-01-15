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

## CLI Reference

### `debate` Command

Run a debate session.

```bash
llm-court debate [options]
```

| Flag | Description |
|------|-------------|
| `-c, --config <path>` | **(Required)** Path to debate configuration JSON file |
| `-o, --output <path>` | Save debate results to JSON file |
| `-r, --resume <checkpoint>` | Resume from a checkpoint file |
| `--dry-run` | Validate config and show summary without running |
| `--force` | Overwrite existing output file |
| `--json-logs` | Output structured JSON logs to stderr (for machine parsing) |
| `--debug` | Enable verbose debug logging |
| `--allow-external-paths` | Allow file paths outside current working directory |

**Examples:**

```bash
# Basic run with output file
bun run apps/engine/src/cli.ts debate -c config.json -o results.json

# Debug mode with JSON logs for parsing
bun run apps/engine/src/cli.ts debate -c config.json --debug --json-logs 2>logs.jsonl

# Dry run to validate config
bun run apps/engine/src/cli.ts debate -c config.json --dry-run

# Resume from checkpoint
bun run apps/engine/src/cli.ts debate -c config.json -r checkpoints/session-123.json
```

### `validate` Command

Validate a configuration file without running.

```bash
llm-court validate <path>
```

**Example:**

```bash
bun run apps/engine/src/cli.ts validate examples/local-cli-debate.json
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DEBUG` | Enable scoped logging. Set to `*` for all, or comma-separated scopes like `Debate,Agent` |
| `OPENAI_API_KEY` | API key for OpenAI provider |
| `ANTHROPIC_API_KEY` | API key for Anthropic provider |
| `GOOGLE_API_KEY` | API key for Google provider |

**Example:**

```bash
# Enable all debug logging
DEBUG=* bun run apps/engine/src/cli.ts debate -c config.json

# Enable only agent logging
DEBUG=Agent bun run apps/engine/src/cli.ts debate -c config.json
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
