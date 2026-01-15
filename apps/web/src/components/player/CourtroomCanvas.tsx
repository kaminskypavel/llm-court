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
	filters: unknown[];
};

type CourtroomCanvasProps = {
	currentStep: StepTiming | null;
	debate: ValidatedDebateOutput | null;
};

// Agent color tints (different colors for each agent)
const AGENT_TINTS = [
	0x4a7cc9, // Blue
	0xc94a4a, // Red
	0x4ac97c, // Green
	0x9b4ac9, // Purple
	0xc9984a, // Orange
	0x4ac9c9, // Cyan
];

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

// Agent positions in native resolution
const getAgentPositions = (count: number) => {
	const positions: { x: number; y: number }[] = [];
	const startX = 48;
	const endX = 272;
	const spacing = count > 1 ? (endX - startX) / (count - 1) : 0;

	for (let i = 0; i < count; i++) {
		positions.push({
			x: count === 1 ? 160 : startX + i * spacing,
			y: 130,
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

export function CourtroomCanvas({ currentStep, debate }: CourtroomCanvasProps) {
	const [measureRef, bounds] = useMeasure();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const appRef = useRef<PixiApp | null>(null);
	const spritesRef = useRef<Map<string, AnimatedSpriteRef>>(new Map());
	const sheetDataRef = useRef<{
		agentIdle: unknown[];
		agentSpeak: unknown[];
		judgeIdle: unknown[];
		judgeSpeak: unknown[];
	} | null>(null);
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
		if (!canvasRef.current || bounds.width === 0 || bounds.height === 0) return;

		let mounted = true;

		const initPixi = async () => {
			try {
				// Dynamic import to avoid SSR issues
				const PIXI = await import("pixi.js");

				if (!mounted || !canvasRef.current) return;

				// Calculate scale to fit while maintaining aspect ratio
				const scaleX = bounds.width / NATIVE_WIDTH;
				const scaleY = bounds.height / NATIVE_HEIGHT;
				const scale = Math.min(scaleX, scaleY);

				// PixiJS v7 with pixel-perfect settings
				const app = new PIXI.Application({
					view: canvasRef.current,
					width: bounds.width,
					height: bounds.height,
					backgroundColor: 0x1a1208,
					antialias: false, // CRITICAL: No smoothing for pixel art
					resolution: 1, // Don't use devicePixelRatio
					autoDensity: false,
				});

				// Set default scale mode for all textures
				PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;

				appRef.current = app as unknown as PixiApp;

				// Create container for scaling
				const container = new PIXI.Container();
				container.scale.set(scale);
				// Center the container
				container.x = (bounds.width - NATIVE_WIDTH * scale) / 2;
				container.y = (bounds.height - NATIVE_HEIGHT * scale) / 2;
				app.stage.addChild(container);

				// Load background with NEAREST scaling
				const bgTexture = await PIXI.Assets.load("/sprites/courtroom-bg.png");
				bgTexture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
				const bg = new PIXI.Sprite(bgTexture);
				container.addChild(bg);

				// Load sprite sheets
				const [agentSheet, judgeSheet] = await Promise.all([
					fetch("/sprites/agent-spritesheet.json").then((r) => r.json()),
					fetch("/sprites/judge-spritesheet.json").then((r) => r.json()),
				]);

				const [agentTexture, judgeTexture] = await Promise.all([
					PIXI.Assets.load("/sprites/agent-spritesheet.png"),
					PIXI.Assets.load("/sprites/judge-spritesheet.png"),
				]);

				// Set NEAREST scaling
				agentTexture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
				judgeTexture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

				// Create sprite sheet objects
				const agentSpritesheet = new PIXI.Spritesheet(agentTexture, agentSheet);
				const judgeSpritesheet = new PIXI.Spritesheet(judgeTexture, judgeSheet);

				await Promise.all([agentSpritesheet.parse(), judgeSpritesheet.parse()]);

				// Store animation textures
				sheetDataRef.current = {
					agentIdle: agentSpritesheet.animations.idle,
					agentSpeak: agentSpritesheet.animations.speak,
					judgeIdle: judgeSpritesheet.animations.idle,
					judgeSpeak: judgeSpritesheet.animations.speak,
				};

				// Add agents and judges if debate is loaded
				if (debate) {
					const agents = extractAgents(debate);
					const judges = extractJudges(debate);

					// Position agents
					const agentPositions = getAgentPositions(agents.length);
					for (const [i, agent] of agents.entries()) {
						const pos = agentPositions[i];

						// Create animated sprite for agent
						const sprite = new PIXI.AnimatedSprite(
							agentSpritesheet.animations.idle,
						);
						sprite.anchor.set(0.5, 1); // Bottom-center anchor
						sprite.x = pos.x;
						sprite.y = pos.y;
						sprite.animationSpeed = 0.08; // ~5 FPS for retro feel
						sprite.tint = AGENT_TINTS[i % AGENT_TINTS.length];
						sprite.name = agent.agentId;
						sprite.play();

						container.addChild(sprite);
						spritesRef.current.set(
							agent.agentId,
							sprite as unknown as AnimatedSpriteRef,
						);
					}

					// Position judges at the bench
					const judgePositions = getJudgePositions(judges.length);
					for (const [i, judge] of judges.entries()) {
						const pos = judgePositions[i];

						// Create animated sprite for judge
						const sprite = new PIXI.AnimatedSprite(
							judgeSpritesheet.animations.idle,
						);
						sprite.anchor.set(0.5, 1);
						sprite.x = pos.x;
						sprite.y = pos.y;
						sprite.animationSpeed = 0.06; // Slower for judges
						sprite.name = judge.judgeId;
						sprite.play();

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
			if (appRef.current) {
				appRef.current.destroy(true);
				appRef.current = null;
			}
		};
	}, [bounds.width, bounds.height, debate]);

	// Handle speaking state changes - switch animations
	useEffect(() => {
		if (!isLoaded || !sheetDataRef.current) return;

		const sheets = sheetDataRef.current;

		// Update all sprites based on speaking state
		for (const [id, sprite] of spritesRef.current) {
			const isSpeaking = id === speakingId;
			const isJudge = id.toLowerCase().includes("judge");

			// Determine which animation to use
			const idleTextures = isJudge ? sheets.judgeIdle : sheets.agentIdle;
			const speakTextures = isJudge ? sheets.judgeSpeak : sheets.agentSpeak;
			const targetTextures = isSpeaking ? speakTextures : idleTextures;

			// Only switch if different animation
			if (sprite.textures !== targetTextures) {
				sprite.textures = targetTextures as unknown[];
				sprite.animationSpeed = isSpeaking ? 0.15 : 0.08; // Faster when speaking
				sprite.gotoAndPlay(0);
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
