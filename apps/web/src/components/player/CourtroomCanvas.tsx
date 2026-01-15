"use client";

import { useEffect, useRef, useState } from "react";
import useMeasure from "react-use-measure";
import type { ValidatedDebateOutput } from "@/lib/player/schema";
import type { StepTiming } from "@/lib/player/types";

// Types for PixiJS (loaded dynamically)
type PixiApp = {
	stage: {
		addChild: (child: unknown) => void;
		scale: { x: number; y: number };
	};
	renderer: { resize: (width: number, height: number) => void };
	destroy: (removeView?: boolean) => void;
	ticker: {
		add: (fn: () => void) => void;
		remove: (fn: () => void) => void;
	};
};

type AnimatedSpriteRef = {
	name?: string;
	x: number;
	y: number;
	anchor: { set: (x: number, y?: number) => void };
	scale: { set: (x: number, y?: number) => void };
	tint: number;
	alpha: number;
	animationSpeed: number;
	textures: unknown[];
	play: () => void;
	gotoAndPlay: (frame: number) => void;
	gotoAndStop: (frame: number) => void;
	filters: unknown[];
};

type CourtroomCanvasProps = {
	currentStep: StepTiming | null;
	debate: ValidatedDebateOutput | null;
	backgroundIndex?: number;
};

// Number of different sprite/background variants
const AGENT_SPRITE_COUNT = 8;
const JUDGE_SPRITE_COUNT = 4;
export const COURTROOM_BG_COUNT = 4;

// Sprite info per agent (which spritesheet and its animations)
type AgentSpriteData = {
	idle: unknown[];
	speak: unknown[];
};

// Extract unique agents from debate rounds
function extractAgents(debate: ValidatedDebateOutput | null) {
	if (!debate?.agentDebate.rounds.length) return [];

	const agentSet = new Map<string, { agentId: string; index: number }>();
	for (const round of debate.agentDebate.rounds) {
		for (const response of round.responses) {
			if (!agentSet.has(response.agentId)) {
				agentSet.set(response.agentId, {
					agentId: response.agentId,
					index: agentSet.size,
				});
			}
		}
	}
	return Array.from(agentSet.values());
}

// Extract unique judges from judge rounds
function extractJudges(debate: ValidatedDebateOutput | null) {
	if (!debate?.judgePanel.rounds.length) return [];

	const judgeSet = new Map<string, { judgeId: string; index: number }>();
	for (const round of debate.judgePanel.rounds) {
		for (const evaluation of round.evaluations) {
			if (!judgeSet.has(evaluation.judgeId)) {
				judgeSet.set(evaluation.judgeId, {
					judgeId: evaluation.judgeId,
					index: judgeSet.size,
				});
			}
		}
	}
	return Array.from(judgeSet.values());
}

// Native resolution (8-bit style)
const NATIVE_WIDTH = 320;
const NATIVE_HEIGHT = 180;

// Minimum container size before initializing (prevents Playwright/headless issues)
const MIN_WIDTH = 200;
const MIN_HEIGHT = 100;

// Agent positions in native resolution - positioned at bottom with padding
const AGENT_Y = 170; // Near bottom (native height is 180, with 10px padding)
const getAgentPositions = (count: number) => {
	const positions: { x: number; y: number }[] = [];
	const padding = 24; // Side padding
	const startX = padding + 24;
	const endX = NATIVE_WIDTH - padding - 24;
	const spacing = count > 1 ? (endX - startX) / (count - 1) : 0;

	for (let i = 0; i < count; i++) {
		positions.push({
			x: count === 1 ? 160 : startX + i * spacing,
			y: AGENT_Y, // All lawyers on same Y position at bottom
		});
	}
	return positions;
};

// Judge positions
const getJudgePositions = (count: number) => {
	const positions: { x: number; y: number }[] = [];
	const startX = 100;
	const endX = 220;
	const spacing = count > 1 ? (endX - startX) / (count - 1) : 0;

	for (let i = 0; i < count; i++) {
		positions.push({
			x: count === 1 ? 160 : startX + i * spacing,
			y: 55,
		});
	}
	return positions;
};

export function CourtroomCanvas({
	currentStep,
	debate,
	backgroundIndex = 1,
}: CourtroomCanvasProps) {
	const [measureRef, bounds] = useMeasure();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const appRef = useRef<PixiApp | null>(null);
	const spritesRef = useRef<Map<string, AnimatedSpriteRef>>(new Map());
	// Store which sprite data each agent/judge uses
	const spriteDataRef = useRef<Map<string, AgentSpriteData>>(new Map());
	const [isLoaded, setIsLoaded] = useState(false);
	const [speakingId, setSpeakingId] = useState<string | null>(null);

	// Determine current speaker
	useEffect(() => {
		if (!currentStep) {
			setSpeakingId(null);
			return;
		}

		const step = currentStep.step;
		if (step.type === "AGENT_SPEAK" && "agentId" in step) {
			setSpeakingId(step.agentId);
		} else if (step.type === "JUDGE_EVALUATE" && "judgeId" in step) {
			setSpeakingId(step.judgeId);
		} else {
			setSpeakingId(null);
		}
	}, [currentStep]);

	// Initialize PixiJS with pixel-perfect settings
	useEffect(() => {
		// Wait for container to have valid dimensions (prevents headless browser issues)
		if (
			!canvasRef.current ||
			bounds.width < MIN_WIDTH ||
			bounds.height < MIN_HEIGHT
		)
			return;

		let mounted = true;

		const initPixi = async () => {
			try {
				// Dynamic import to avoid SSR issues
				const PIXI = await import("pixi.js");

				if (!mounted || !canvasRef.current) return;

				// Calculate scale to FIT the entire background in canvas (no cropping)
				const scaleX = bounds.width / NATIVE_WIDTH;
				const scaleY = bounds.height / NATIVE_HEIGHT;
				const scale = Math.min(scaleX, scaleY); // Use min to show full background

				// Application config for pixel-perfect rendering
				const appConfig = {
					view: canvasRef.current,
					width: bounds.width,
					height: bounds.height,
					backgroundColor: 0x1a1208,
					antialias: false, // CRITICAL: No smoothing for pixel art
					resolution: 1, // Don't use devicePixelRatio
					autoDensity: false,
				};

				let app: InstanceType<typeof PIXI.Application>;
				try {
					app = new PIXI.Application(appConfig);
				} catch (err) {
					// WebGL failed - try Canvas2D fallback
					console.warn(
						"WebGL initialization failed, falling back to Canvas2D renderer:",
						err instanceof Error ? err.message : err,
					);
					app = new PIXI.Application({
						...appConfig,
						forceCanvas: true,
					});
				}

				// Set default scale mode for all textures
				PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;

				appRef.current = app as unknown as PixiApp;

				// Create container for scaling - center both horizontally and vertically
				const container = new PIXI.Container();
				container.scale.set(scale);
				// Center the content in the canvas
				container.x = (bounds.width - NATIVE_WIDTH * scale) / 2;
				container.y = (bounds.height - NATIVE_HEIGHT * scale) / 2;
				app.stage.addChild(container);

				// Load background with NEAREST scaling
				const bgIndex = ((backgroundIndex - 1) % COURTROOM_BG_COUNT) + 1;
				const bgTexture = await PIXI.Assets.load(
					`/sprites/courtroom-bg-${bgIndex}.png`,
				);
				bgTexture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
				const bg = new PIXI.Sprite(bgTexture);
				container.addChild(bg);

				// Load all agent and judge sprite sheets
				const agentSheetPromises = Array.from(
					{ length: AGENT_SPRITE_COUNT },
					(_, i) =>
						fetch(`/sprites/agent-${i + 1}-spritesheet.json`).then((r) =>
							r.json(),
						),
				);
				const judgeSheetPromises = Array.from(
					{ length: JUDGE_SPRITE_COUNT },
					(_, i) =>
						fetch(`/sprites/judge-${i + 1}-spritesheet.json`).then((r) =>
							r.json(),
						),
				);

				const [agentSheets, judgeSheets] = await Promise.all([
					Promise.all(agentSheetPromises),
					Promise.all(judgeSheetPromises),
				]);

				// Load textures
				const agentTexturePromises = Array.from(
					{ length: AGENT_SPRITE_COUNT },
					(_, i) => PIXI.Assets.load(`/sprites/agent-${i + 1}-spritesheet.png`),
				);
				const judgeTexturePromises = Array.from(
					{ length: JUDGE_SPRITE_COUNT },
					(_, i) => PIXI.Assets.load(`/sprites/judge-${i + 1}-spritesheet.png`),
				);

				const [agentTextures, judgeTextures] = await Promise.all([
					Promise.all(agentTexturePromises),
					Promise.all(judgeTexturePromises),
				]);

				// Set NEAREST scaling for all textures
				for (const tex of agentTextures) {
					tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
				}
				for (const tex of judgeTextures) {
					tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
				}

				// Create and parse all spritesheets
				const agentSpritesheets = await Promise.all(
					agentTextures.map(async (tex, i) => {
						const sheet = new PIXI.Spritesheet(tex, agentSheets[i]);
						await sheet.parse();
						return sheet;
					}),
				);

				const judgeSpritesheets = await Promise.all(
					judgeTextures.map(async (tex, i) => {
						const sheet = new PIXI.Spritesheet(tex, judgeSheets[i]);
						await sheet.parse();
						return sheet;
					}),
				);

				// Add agents and judges if debate is loaded
				if (debate) {
					const agents = extractAgents(debate);
					const judges = extractJudges(debate);

					// Shuffle sprite indices to randomly assign to agents
					const spriteIndices = agents.map((_, i) => i % AGENT_SPRITE_COUNT);
					// Simple shuffle using debate topic as seed for consistency
					const seed = debate.session.topic.length;
					for (let i = spriteIndices.length - 1; i > 0; i--) {
						const j = (seed + i * 7) % (i + 1);
						[spriteIndices[i], spriteIndices[j]] = [
							spriteIndices[j],
							spriteIndices[i],
						];
					}

					// Position agents
					const agentPositions = getAgentPositions(agents.length);
					// Scale: sprite frames are 512px tall, we want ~55px in scene
					const agentScale = 55 / 512;

					for (const [i, agent] of agents.entries()) {
						const pos = agentPositions[i];
						const sheetIndex = spriteIndices[i];
						const sheet = agentSpritesheets[sheetIndex];

						// Store sprite data for this agent
						spriteDataRef.current.set(agent.agentId, {
							idle: sheet.animations.idle,
							speak: sheet.animations.speak,
						});

						// Create animated sprite for agent (static idle, animated when speaking)
						const sprite = new PIXI.AnimatedSprite(sheet.animations.idle);
						sprite.anchor.set(0.5, 1); // Bottom-center anchor
						sprite.scale.set(agentScale);
						sprite.x = pos.x;
						sprite.y = pos.y;
						sprite.animationSpeed = 0.12;
						sprite.name = agent.agentId;
						sprite.gotoAndStop(0); // Static idle - don't animate

						container.addChild(sprite);
						spritesRef.current.set(
							agent.agentId,
							sprite as unknown as AnimatedSpriteRef,
						);
					}

					// Position judges at the bench
					const judgePositions = getJudgePositions(judges.length);
					// Scale for judges (slightly smaller)
					const judgeScale = 45 / 512;

					// Shuffle judge sprite indices
					const judgeSpriteIndices = judges.map(
						(_, i) => i % JUDGE_SPRITE_COUNT,
					);
					// Use different seed offset for judges
					for (let i = judgeSpriteIndices.length - 1; i > 0; i--) {
						const j = (seed + 3 + i * 11) % (i + 1);
						[judgeSpriteIndices[i], judgeSpriteIndices[j]] = [
							judgeSpriteIndices[j],
							judgeSpriteIndices[i],
						];
					}

					for (const [i, judge] of judges.entries()) {
						const pos = judgePositions[i];
						const sheetIndex = judgeSpriteIndices[i];
						const sheet = judgeSpritesheets[sheetIndex];

						// Store sprite data for this judge
						spriteDataRef.current.set(judge.judgeId, {
							idle: sheet.animations.idle,
							speak: sheet.animations.speak,
						});

						// Create animated sprite for judge (static idle, animated when speaking)
						const sprite = new PIXI.AnimatedSprite(sheet.animations.idle);
						sprite.anchor.set(0.5, 1);
						sprite.scale.set(judgeScale);
						sprite.x = pos.x;
						sprite.y = pos.y;
						sprite.animationSpeed = 0.1;
						sprite.name = judge.judgeId;
						sprite.gotoAndStop(0); // Static idle - don't animate

						container.addChild(sprite);
						spritesRef.current.set(
							judge.judgeId,
							sprite as unknown as AnimatedSpriteRef,
						);
					}
				}

				setIsLoaded(true);
			} catch (error) {
				console.error("Failed to initialize PixiJS:", error);
			}
		};

		initPixi();

		return () => {
			mounted = false;
			spritesRef.current.clear();
			spriteDataRef.current.clear();
			if (appRef.current) {
				appRef.current.destroy(true);
				appRef.current = null;
			}
		};
	}, [bounds.width, bounds.height, debate, backgroundIndex]);

	// Handle speaking state changes - switch animations
	useEffect(() => {
		if (!isLoaded) return;

		// Update all sprites based on speaking state
		for (const [id, sprite] of spritesRef.current) {
			const isSpeaking = id === speakingId;
			const spriteData = spriteDataRef.current.get(id);

			if (!spriteData) continue;

			// Determine which animation to use
			const targetTextures = isSpeaking ? spriteData.speak : spriteData.idle;

			// Only switch if different animation
			if (sprite.textures !== targetTextures) {
				sprite.textures = targetTextures as unknown[];
				if (isSpeaking) {
					sprite.animationSpeed = 0.12;
					sprite.play(); // Animate when speaking
				} else {
					sprite.gotoAndStop(0); // Static when idle
				}
			}

			// Highlight speaking character
			sprite.alpha = isSpeaking ? 1 : 0.7;
		}
	}, [speakingId, isLoaded]);

	return (
		<div
			ref={measureRef}
			className="relative h-full w-full overflow-hidden bg-[#1a1208]"
		>
			<canvas
				ref={canvasRef}
				className="h-full w-full"
				style={{
					display: isLoaded ? "block" : "none",
					imageRendering: "pixelated", // CSS fallback for crisp pixels
				}}
			/>
			{!isLoaded && (
				<div className="absolute inset-0 flex items-center justify-center">
					<p className="font-mono text-[#c9a227] text-sm">
						Loading courtroom...
					</p>
				</div>
			)}
		</div>
	);
}
