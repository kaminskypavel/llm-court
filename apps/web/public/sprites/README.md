# Sprite Assets

AI-generated pixel art sprites for the LLM Court debate player.

## Sprite Inventory

| Type | Count | Files |
|------|-------|-------|
| Lawyers | 8 | `agent-{1-8}-spritesheet.png` |
| Judges | 4 | `judge-{1-4}-spritesheet.png` |

## File Format

Each sprite sheet is:
- **Size**: 1024x1024 pixels
- **Layout**: 4x2 grid (4 columns, 2 rows)
- **Frame size**: 256x512 pixels per frame
- **Format**: PNG with transparent background

### Frame Layout

```
Row 0 (y=0):    idle_0  idle_1  idle_2  idle_3
Row 1 (y=512):  speak_0 speak_1 speak_2 speak_3
```

## Generating New Sprites

### AI Image Generator Settings

- **Size**: 1024x1024
- **Background**: Transparent
- **Format**: PNG
- **Quality**: High

### Lawyer Prompt

```
Pixel art sprite sheet in a 4x2 grid layout (4 columns, 2 rows), 8 frames total. Professional male lawyer in navy business suit. Top row (frames 1-4): idle animation with subtle breathing and slight body sway. Bottom row (frames 5-8): speaking animation with open mouth and expressive hand gestures. Full body character centered in each frame cell. Clean pixel art style, limited warm color palette, completely isolated character with no background elements.
```

### Judge Prompt

```
Pixel art sprite sheet in a 4x2 grid layout (4 columns, 2 rows), 8 frames total. Stern judge in black robes with white collar. Top row (frames 1-4): idle animation with dignified posture and subtle movement. Bottom row (frames 5-8): speaking animation with authoritative gestures and gavel. Full body character centered in each frame cell. Clean pixel art style, limited dark color palette, completely isolated character with no background elements.
```

## Adding New Sprites

1. Generate the sprite using the prompts above
2. Save as `agent-{N}-spritesheet.png` or `judge-{N}-spritesheet.png`
3. Create matching JSON metadata (copy from existing and update filename):

```json
{
  "frames": {
    "agent_idle_0": { "frame": { "x": 0, "y": 0, "w": 256, "h": 512 } },
    "agent_idle_1": { "frame": { "x": 256, "y": 0, "w": 256, "h": 512 } },
    "agent_idle_2": { "frame": { "x": 512, "y": 0, "w": 256, "h": 512 } },
    "agent_idle_3": { "frame": { "x": 768, "y": 0, "w": 256, "h": 512 } },
    "agent_speak_0": { "frame": { "x": 0, "y": 512, "w": 256, "h": 512 } },
    "agent_speak_1": { "frame": { "x": 256, "y": 512, "w": 256, "h": 512 } },
    "agent_speak_2": { "frame": { "x": 512, "y": 512, "w": 256, "h": 512 } },
    "agent_speak_3": { "frame": { "x": 768, "y": 512, "w": 256, "h": 512 } }
  },
  "meta": {
    "image": "agent-N-spritesheet.png",
    "size": { "w": 1024, "h": 1024 },
    "scale": 1
  },
  "animations": {
    "idle": ["agent_idle_0", "agent_idle_1", "agent_idle_2", "agent_idle_3"],
    "speak": ["agent_speak_0", "agent_speak_1", "agent_speak_2", "agent_speak_3"]
  }
}
```

4. Update `AGENT_SPRITE_COUNT` or `JUDGE_SPRITE_COUNT` in `CourtroomCanvas.tsx`

## Updating Existing Sprites

1. Replace the PNG file with the same filename
2. Keep the JSON metadata unchanged (unless frame layout changed)
3. Clear browser cache or hard refresh to see changes

## Technical Notes

- Sprites are scaled to ~55px (agents) and ~45px (judges) in the 320x180 native resolution
- Random assignment uses debate topic as seed for consistency
- Animation speed: 0.08 (idle), 0.15 (speaking)
