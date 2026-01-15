"use client";

import { gsap } from "gsap";
import { useEffect, useRef, useState } from "react";
import useMeasure from "react-use-measure";
import type { ValidatedDebateOutput } from "@/lib/player/schema";
import type { StepTiming } from "@/lib/player/types";

// Types for PixiJS (loaded dynamically)
type PixiApp = {
	stage: {
		children: Array<{
			name?: string;
			scale: { x: number; y: number };
			alpha: number;
		}>;
		addChild: (child: unknown) => void;
	};
	renderer: { resize: (width: number, height: number) => void };
	destroy: (removeView?: boolean) => void;
};

type CourtroomCanvasProps = {
	currentStep: StepTiming | null;
	debate: ValidatedDebateOutput | null;
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

// Agent position configurations - spread agents across the stage
const getAgentPositions = (count: number) => {
	const positions: { x: number; y: number }[] = [];
	const startX = 0.15;
	const endX = 0.85;
	const spacing = count > 1 ? (endX - startX) / (count - 1) : 0;

	for (let i = 0; i < count; i++) {
		positions.push({
			x: count === 1 ? 0.5 : startX + i * spacing,
			y: 0.55,
		});
	}
	return positions;
};

// Judge position for the bench
const getJudgePositions = (count: number) => {
	const positions: { x: number; y: number }[] = [];
	const startX = 0.3;
	const endX = 0.7;
	const spacing = count > 1 ? (endX - startX) / (count - 1) : 0;

	for (let i = 0; i < count; i++) {
		positions.push({
			x: count === 1 ? 0.5 : startX + i * spacing,
			y: 0.22,
		});
	}
	return positions;
};

export function CourtroomCanvas({ currentStep, debate }: CourtroomCanvasProps) {
	const [measureRef, bounds] = useMeasure();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const appRef = useRef<PixiApp | null>(null);
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

	// Initialize PixiJS
	useEffect(() => {
		if (!canvasRef.current || bounds.width === 0 || bounds.height === 0) return;

		let mounted = true;

		const initPixi = async () => {
			try {
				// Dynamic import to avoid SSR issues
				const PIXI = await import("pixi.js");

				if (!mounted || !canvasRef.current) return;

				// PixiJS v7 uses constructor options
				const app = new PIXI.Application({
					view: canvasRef.current,
					width: bounds.width,
					height: bounds.height,
					backgroundColor: 0x1a120e,
					antialias: true,
					resolution: window.devicePixelRatio || 1,
					autoDensity: true,
				});

				appRef.current = app as unknown as PixiApp;

				// Load background
				const bgTexture = await PIXI.Assets.load("/sprites/courtroom-bg.svg");
				const bg = new PIXI.Sprite(bgTexture);
				bg.width = bounds.width;
				bg.height = bounds.height;
				app.stage.addChild(bg);

				// Add agents and judges if debate is loaded
				if (debate) {
					const agents = extractAgents(debate);
					const judges = extractJudges(debate);

					// Load textures
					const agentIdleTexture = await PIXI.Assets.load(
						"/sprites/agent-idle.svg",
					);
					const judgeIdleTexture = await PIXI.Assets.load(
						"/sprites/judge-idle.svg",
					);
					const podiumTexture = await PIXI.Assets.load("/sprites/podium.svg");

					// Position agents
					const agentPositions = getAgentPositions(agents.length);
					for (const [i, agent] of agents.entries()) {
						const pos = agentPositions[i];

						// Add podium first (behind agent)
						const podium = new PIXI.Sprite(podiumTexture);
						podium.anchor.set(0.5, 0);
						podium.x = pos.x * bounds.width;
						podium.y = pos.y * bounds.height + 35;
						podium.scale.set(0.5);
						app.stage.addChild(podium);

						// Add agent sprite
						const sprite = new PIXI.Sprite(agentIdleTexture);
						sprite.anchor.set(0.5);
						sprite.x = pos.x * bounds.width;
						sprite.y = pos.y * bounds.height;
						sprite.scale.set(0.7);
						sprite.name = agent.agentId;
						app.stage.addChild(sprite);
					}

					// Position judges at the bench
					const judgePositions = getJudgePositions(judges.length);
					for (const [i, judge] of judges.entries()) {
						const pos = judgePositions[i];
						const sprite = new PIXI.Sprite(judgeIdleTexture);
						sprite.anchor.set(0.5);
						sprite.x = pos.x * bounds.width;
						sprite.y = pos.y * bounds.height;
						sprite.scale.set(0.6);
						sprite.name = judge.judgeId;
						app.stage.addChild(sprite);
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
			if (appRef.current) {
				appRef.current.destroy(true);
				appRef.current = null;
			}
		};
	}, [bounds.width, bounds.height, debate]);

	// Handle resize
	useEffect(() => {
		if (appRef.current && bounds.width > 0 && bounds.height > 0) {
			appRef.current.renderer.resize(bounds.width, bounds.height);
		}
	}, [bounds.width, bounds.height]);

	// Animate speaking state
	useEffect(() => {
		if (!appRef.current || !isLoaded) return;

		const app = appRef.current;

		// Animate all sprites based on speaking state
		for (const child of app.stage.children) {
			if (!child.name) continue;

			const isSpeaking = child.name === speakingId;

			gsap.to(child.scale, {
				x: isSpeaking ? 0.85 : 0.7,
				y: isSpeaking ? 0.85 : 0.7,
				duration: 0.3,
				ease: "power2.out",
			});

			gsap.to(child, {
				alpha: isSpeaking ? 1 : 0.7,
				duration: 0.3,
				ease: "power2.out",
			});
		}
	}, [speakingId, isLoaded]);

	return (
		<div ref={measureRef} className="relative h-full w-full overflow-hidden">
			<canvas
				ref={canvasRef}
				className="h-full w-full"
				style={{ display: isLoaded ? "block" : "none" }}
			/>
			{!isLoaded && (
				<div className="absolute inset-0 flex items-center justify-center bg-muted/50">
					<p className="text-muted-foreground text-sm">Loading courtroom...</p>
				</div>
			)}
		</div>
	);
}
