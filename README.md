<div align="center">

# LLM Court

### Where AI Models Battle It Out in the Courtroom of Ideas

*A retro-styled debate simulator that pits multiple AI models against each other while AI judges deliberate to reach consensus*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PixiJS](https://img.shields.io/badge/PixiJS-e72264?style=for-the-badge&logo=pixijs&logoColor=white)](https://pixijs.com/)

</div>

---

<div align="center">

![LLM Court - Desktop](docs/images/player-desktop.png)

*Watch Claude, GPT, Gemini, and Llama argue their cases in a pixel-art courtroom*

</div>

## The Concept

Ever wondered what would happen if you put the world's leading AI models in a courtroom and made them debate? **LLM Court** brings this to life with a Phoenix Wright-inspired pixel art aesthetic.

Each debate features:
- **AI Advocates** defending different positions on a topic
- **AI Judges** evaluating arguments and scoring each round
- **Consensus Building** as judges deliberate until they reach agreement

## Features

| Feature | Description |
|---------|-------------|
| **Multi-Model Debates** | Claude, GPT, Gemini, and Llama argue from different perspectives |
| **Judge Panel** | Multiple AI judges score arguments and determine verdicts |
| **8-Bit Courtroom** | Retro pixel art visualization with animated sprites |
| **Timeline Playback** | Scrub through debates with colored speaker markers |
| **Live Transcript** | Auto-scrolling transcript with color-coded speakers |
| **Responsive Design** | Full experience on desktop and mobile |

## Screenshots

<div align="center">
<table>
<tr>
<td align="center">
<img src="docs/images/player-desktop.png" width="600" alt="Desktop View"/>
<br/>
<em>Desktop Experience</em>
</td>
</tr>
<tr>
<td align="center">
<img src="docs/images/player-mobile.png" width="300" alt="Mobile View"/>
<br/>
<em>Mobile Experience</em>
</td>
</tr>
</table>
</div>

## Quick Start

```bash
# Install dependencies
bun install

# Start the development server
bun run dev

# Open http://localhost:3000
```

## Tech Stack

<table>
<tr>
<td><strong>Framework</strong></td>
<td>Next.js 15 with App Router</td>
</tr>
<tr>
<td><strong>Language</strong></td>
<td>TypeScript (strict mode)</td>
</tr>
<tr>
<td><strong>Rendering</strong></td>
<td>PixiJS for hardware-accelerated 2D graphics</td>
</tr>
<tr>
<td><strong>State</strong></td>
<td>XState for predictable playback control</td>
</tr>
<tr>
<td><strong>Styling</strong></td>
<td>TailwindCSS + shadcn/ui components</td>
</tr>
<tr>
<td><strong>Build</strong></td>
<td>Turborepo monorepo with Bun runtime</td>
</tr>
</table>

## Project Structure

```
llm-court/
├── apps/
│   └── web/                      # Next.js debate player
│       ├── src/
│       │   ├── components/player/  # React player components
│       │   └── lib/player/         # XState machines & types
│       └── public/sprites/         # 8-bit pixel art assets
├── packages/
│   └── shared/                   # Shared types & utilities
└── docs/
    └── images/                   # Screenshots & media
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Production build |
| `bun run lint` | Check for issues |
| `bun run lint:fix` | Auto-fix issues |

## How It Works

1. **Debate Setup** - Define a topic and assign AI models to advocate positions
2. **Rounds** - Each agent presents arguments in turn
3. **Evaluation** - Judges score each argument on logic, evidence, and persuasion
4. **Verdict** - Judges deliberate until consensus is reached
5. **Playback** - Watch the entire debate unfold in the courtroom visualization

---

<div align="center">

**Built with caffeine and curiosity**

*Let the AI games begin*

</div>
