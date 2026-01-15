/**
 * Pixel Art Sprite Generator
 *
 * Generates 8-bit style courtroom sprites:
 * - Courtroom background (320x180)
 * - Agent sprite sheet (32x32 per frame, 4 idle + 4 speaking)
 * - Judge sprite sheet (32x32 per frame, 4 idle + 4 speaking)
 * - Podium sprite (32x24)
 *
 * Run: bun run scripts/generate-sprites.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Output directory
const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = join(__dirname, "../public/sprites");

// Ensure directory exists
mkdirSync(SPRITES_DIR, { recursive: true });

// 8-bit color palette (warm courtroom tones)
const PALETTE = {
	// Background colors
	wallDark: "#3d2817",
	wallMid: "#5c3d2e",
	wallLight: "#8b6914",
	woodDark: "#2d1b0e",
	woodMid: "#4a3728",
	woodLight: "#6b4423",
	floor: "#1a1208",
	accent: "#c9a227",

	// Character colors
	skin: "#e8b796",
	skinShadow: "#c4956c",
	hair: "#2d1b0e",
	eyeWhite: "#ffffff",
	eyePupil: "#1a1208",
	mouth: "#8b4513",

	// Suit colors (for tinting)
	suitBlue: "#2c4a7c",
	suitRed: "#7c2c2c",
	suitGreen: "#2c7c4a",
	suitPurple: "#5c2c7c",

	// Judge colors
	robeBlack: "#1a1a1a",
	robeShadow: "#333333",
	collar: "#ffffff",
};

// Convert hex to RGB array
function hexToRgb(hex: string): [number, number, number] {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) return [0, 0, 0];
	return [
		Number.parseInt(result[1], 16),
		Number.parseInt(result[2], 16),
		Number.parseInt(result[3], 16),
	];
}

// Simple pixel art drawing on raw RGBA buffer
class PixelCanvas {
	width: number;
	height: number;
	data: Uint8ClampedArray;

	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.data = new Uint8ClampedArray(width * height * 4);
	}

	setPixel(x: number, y: number, hex: string, alpha = 255) {
		if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
		const [r, g, b] = hexToRgb(hex);
		const i = (y * this.width + x) * 4;
		this.data[i] = r;
		this.data[i + 1] = g;
		this.data[i + 2] = b;
		this.data[i + 3] = alpha;
	}

	fillRect(x: number, y: number, w: number, h: number, hex: string) {
		for (let dy = 0; dy < h; dy++) {
			for (let dx = 0; dx < w; dx++) {
				this.setPixel(x + dx, y + dy, hex);
			}
		}
	}

	// Draw horizontal line
	hLine(x: number, y: number, length: number, hex: string) {
		for (let i = 0; i < length; i++) {
			this.setPixel(x + i, y, hex);
		}
	}

	// Draw vertical line
	vLine(x: number, y: number, length: number, hex: string) {
		for (let i = 0; i < length; i++) {
			this.setPixel(x, y + i, hex);
		}
	}

	// Export as PNG using pure JavaScript (no canvas dependency)
	toPngBuffer(): Buffer {
		// Create PNG manually using zlib
		const { deflateSync } = require("node:zlib");

		// PNG signature
		const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

		// IHDR chunk
		const ihdr = Buffer.alloc(13);
		ihdr.writeUInt32BE(this.width, 0);
		ihdr.writeUInt32BE(this.height, 4);
		ihdr[8] = 8; // bit depth
		ihdr[9] = 6; // color type (RGBA)
		ihdr[10] = 0; // compression
		ihdr[11] = 0; // filter
		ihdr[12] = 0; // interlace

		// Create raw image data with filter bytes
		const rawData = Buffer.alloc(this.height * (1 + this.width * 4));
		for (let y = 0; y < this.height; y++) {
			rawData[y * (1 + this.width * 4)] = 0; // No filter
			for (let x = 0; x < this.width; x++) {
				const srcI = (y * this.width + x) * 4;
				const dstI = y * (1 + this.width * 4) + 1 + x * 4;
				rawData[dstI] = this.data[srcI];
				rawData[dstI + 1] = this.data[srcI + 1];
				rawData[dstI + 2] = this.data[srcI + 2];
				rawData[dstI + 3] = this.data[srcI + 3];
			}
		}

		// Compress with zlib
		const compressed = deflateSync(rawData);

		// Helper to create chunk
		const createChunk = (type: string, data: Buffer): Buffer => {
			const length = Buffer.alloc(4);
			length.writeUInt32BE(data.length, 0);
			const typeBuffer = Buffer.from(type);
			const crcData = Buffer.concat([typeBuffer, data]);

			// Calculate CRC32
			let crc = 0xffffffff;
			for (const byte of crcData) {
				crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
			}
			crc = (crc ^ 0xffffffff) >>> 0;

			const crcBuffer = Buffer.alloc(4);
			crcBuffer.writeUInt32BE(crc, 0);

			return Buffer.concat([length, typeBuffer, data, crcBuffer]);
		};

		// CRC32 table
		const crc32Table: number[] = [];
		for (let n = 0; n < 256; n++) {
			let c = n;
			for (let k = 0; k < 8; k++) {
				c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			}
			crc32Table[n] = c;
		}

		// Build chunks
		const ihdrChunk = createChunk("IHDR", ihdr);
		const idatChunk = createChunk("IDAT", compressed);
		const iendChunk = createChunk("IEND", Buffer.alloc(0));

		return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
	}
}

// Generate courtroom background (320x180)
function generateCourtroomBackground(): PixelCanvas {
	const canvas = new PixelCanvas(320, 180);

	// Fill with dark floor
	canvas.fillRect(0, 0, 320, 180, PALETTE.floor);

	// Back wall (upper portion)
	canvas.fillRect(0, 0, 320, 80, PALETTE.wallDark);

	// Wood paneling pattern on wall
	for (let x = 0; x < 320; x += 40) {
		canvas.vLine(x, 0, 80, PALETTE.wallMid);
		canvas.vLine(x + 20, 0, 80, PALETTE.wallLight);
	}

	// Horizontal trim
	canvas.fillRect(0, 75, 320, 5, PALETTE.woodMid);
	canvas.hLine(0, 74, 320, PALETTE.accent);

	// Judge's bench (elevated, center)
	const benchX = 100;
	const benchY = 30;
	const benchW = 120;
	const benchH = 50;

	// Bench body
	canvas.fillRect(benchX, benchY, benchW, benchH, PALETTE.woodDark);
	canvas.fillRect(
		benchX + 2,
		benchY + 2,
		benchW - 4,
		benchH - 4,
		PALETTE.woodMid,
	);

	// Bench top surface
	canvas.fillRect(benchX - 5, benchY - 5, benchW + 10, 8, PALETTE.woodLight);
	canvas.hLine(benchX - 5, benchY - 6, benchW + 10, PALETTE.accent);

	// Bench front panel detail
	canvas.fillRect(benchX + 10, benchY + 15, benchW - 20, 25, PALETTE.woodDark);
	canvas.hLine(benchX + 10, benchY + 14, benchW - 20, PALETTE.accent);

	// Floor area
	canvas.fillRect(0, 80, 320, 100, PALETTE.floor);

	// Floor wood planks
	for (let y = 85; y < 180; y += 15) {
		canvas.hLine(0, y, 320, PALETTE.woodDark);
		// Offset planks
		const offset = ((y - 85) / 15) % 2 === 0 ? 0 : 32;
		for (let x = offset; x < 320; x += 64) {
			canvas.vLine(x, y, 15, PALETTE.woodDark);
		}
	}

	// Podium positions (4 positions for agents)
	const podiumY = 110;
	const podiumPositions = [60, 130, 190, 260];

	for (const px of podiumPositions) {
		// Podium base
		canvas.fillRect(px - 15, podiumY, 30, 40, PALETTE.woodDark);
		canvas.fillRect(px - 13, podiumY + 2, 26, 36, PALETTE.woodMid);
		// Podium top
		canvas.fillRect(px - 18, podiumY - 3, 36, 5, PALETTE.woodLight);
		canvas.hLine(px - 18, podiumY - 4, 36, PALETTE.accent);
	}

	// Railing in front of judge
	canvas.fillRect(80, 78, 160, 3, PALETTE.woodLight);
	canvas.hLine(80, 77, 160, PALETTE.accent);

	return canvas;
}

// Generate a single character frame (32x32)
function generateCharacterFrame(
	isJudge: boolean,
	isSpeaking: boolean,
	frameIndex: number,
): PixelCanvas {
	const canvas = new PixelCanvas(32, 32);

	// Animation bob offset (subtle breathing)
	const bobOffset = frameIndex % 2 === 0 ? 0 : 1;

	// Body Y position
	const bodyY = 12 + bobOffset;

	if (isJudge) {
		// Judge robe (wider, black)
		canvas.fillRect(8, bodyY, 16, 18, PALETTE.robeBlack);
		canvas.fillRect(9, bodyY + 1, 14, 16, PALETTE.robeShadow);

		// White collar
		canvas.fillRect(12, bodyY, 8, 3, PALETTE.collar);
	} else {
		// Suit jacket
		canvas.fillRect(10, bodyY, 12, 16, PALETTE.suitBlue);
		canvas.fillRect(11, bodyY + 1, 10, 14, "#3d5a8c"); // Lighter shade

		// Tie
		canvas.fillRect(15, bodyY + 2, 2, 10, "#c9a227");

		// Shirt collar
		canvas.fillRect(13, bodyY, 6, 2, PALETTE.collar);
	}

	// Head
	const headY = 4 + bobOffset;
	canvas.fillRect(11, headY, 10, 10, PALETTE.skin);
	canvas.fillRect(12, headY + 1, 8, 8, PALETTE.skin);

	// Hair (top of head)
	canvas.fillRect(11, headY - 1, 10, 3, PALETTE.hair);
	canvas.fillRect(10, headY, 2, 4, PALETTE.hair); // Side hair
	canvas.fillRect(20, headY, 2, 4, PALETTE.hair); // Side hair

	// Eyes
	const eyeY = headY + 3;
	// Left eye
	canvas.setPixel(13, eyeY, PALETTE.eyeWhite);
	canvas.setPixel(14, eyeY, PALETTE.eyePupil);
	// Right eye
	canvas.setPixel(17, eyeY, PALETTE.eyeWhite);
	canvas.setPixel(18, eyeY, PALETTE.eyePupil);

	// Eyebrows
	canvas.hLine(13, eyeY - 1, 2, PALETTE.hair);
	canvas.hLine(17, eyeY - 1, 2, PALETTE.hair);

	// Mouth
	const mouthY = headY + 6;
	if (isSpeaking && frameIndex % 2 === 0) {
		// Open mouth
		canvas.fillRect(14, mouthY, 4, 2, PALETTE.mouth);
		canvas.setPixel(15, mouthY + 1, "#000000"); // Inside mouth
		canvas.setPixel(16, mouthY + 1, "#000000");
	} else {
		// Closed mouth (line)
		canvas.hLine(14, mouthY, 4, PALETTE.mouth);
	}

	// Shoulders/arms hint
	if (!isJudge) {
		canvas.fillRect(6, bodyY + 4, 4, 8, PALETTE.suitBlue);
		canvas.fillRect(22, bodyY + 4, 4, 8, PALETTE.suitBlue);
	}

	return canvas;
}

// Generate sprite sheet (multiple frames in a row)
function generateSpriteSheet(isJudge: boolean): {
	canvas: PixelCanvas;
	json: object;
} {
	const frameW = 32;
	const frameH = 32;
	const idleFrames = 4;
	const speakFrames = 4;
	const totalFrames = idleFrames + speakFrames;

	const canvas = new PixelCanvas(frameW * totalFrames, frameH);

	const frames: Record<
		string,
		{ frame: { x: number; y: number; w: number; h: number } }
	> = {};
	const prefix = isJudge ? "judge" : "agent";

	// Generate idle frames
	for (let i = 0; i < idleFrames; i++) {
		const frame = generateCharacterFrame(isJudge, false, i);
		// Copy frame to sheet
		for (let y = 0; y < frameH; y++) {
			for (let x = 0; x < frameW; x++) {
				const srcI = (y * frameW + x) * 4;
				const dstX = i * frameW + x;
				canvas.data[(y * canvas.width + dstX) * 4] = frame.data[srcI];
				canvas.data[(y * canvas.width + dstX) * 4 + 1] = frame.data[srcI + 1];
				canvas.data[(y * canvas.width + dstX) * 4 + 2] = frame.data[srcI + 2];
				canvas.data[(y * canvas.width + dstX) * 4 + 3] = frame.data[srcI + 3];
			}
		}
		frames[`${prefix}_idle_${i}`] = {
			frame: { x: i * frameW, y: 0, w: frameW, h: frameH },
		};
	}

	// Generate speaking frames
	for (let i = 0; i < speakFrames; i++) {
		const frame = generateCharacterFrame(isJudge, true, i);
		const sheetX = (idleFrames + i) * frameW;
		// Copy frame to sheet
		for (let y = 0; y < frameH; y++) {
			for (let x = 0; x < frameW; x++) {
				const srcI = (y * frameW + x) * 4;
				const dstX = sheetX + x;
				canvas.data[(y * canvas.width + dstX) * 4] = frame.data[srcI];
				canvas.data[(y * canvas.width + dstX) * 4 + 1] = frame.data[srcI + 1];
				canvas.data[(y * canvas.width + dstX) * 4 + 2] = frame.data[srcI + 2];
				canvas.data[(y * canvas.width + dstX) * 4 + 3] = frame.data[srcI + 3];
			}
		}
		frames[`${prefix}_speak_${i}`] = {
			frame: { x: sheetX, y: 0, w: frameW, h: frameH },
		};
	}

	const json = {
		frames,
		meta: {
			image: `${prefix}-spritesheet.png`,
			size: { w: canvas.width, h: canvas.height },
			scale: 1,
		},
		animations: {
			idle: Array.from({ length: idleFrames }, (_, i) => `${prefix}_idle_${i}`),
			speak: Array.from(
				{ length: speakFrames },
				(_, i) => `${prefix}_speak_${i}`,
			),
		},
	};

	return { canvas, json };
}

// Generate podium sprite
function generatePodium(): PixelCanvas {
	const canvas = new PixelCanvas(32, 24);

	// Podium body
	canvas.fillRect(4, 4, 24, 20, PALETTE.woodDark);
	canvas.fillRect(6, 6, 20, 16, PALETTE.woodMid);

	// Top surface
	canvas.fillRect(2, 0, 28, 5, PALETTE.woodLight);
	canvas.hLine(2, 0, 28, PALETTE.accent);

	// Front panel
	canvas.fillRect(8, 10, 16, 10, PALETTE.woodDark);

	return canvas;
}

// Main generation
console.log("🎨 Generating pixel art sprites...\n");

// Generate courtroom background
console.log("📍 Generating courtroom background...");
const bg = generateCourtroomBackground();
writeFileSync(join(SPRITES_DIR, "courtroom-bg.png"), bg.toPngBuffer());
console.log("   ✓ courtroom-bg.png (320x180)");

// Generate agent sprite sheet
console.log("📍 Generating agent sprite sheet...");
const agent = generateSpriteSheet(false);
writeFileSync(
	join(SPRITES_DIR, "agent-spritesheet.png"),
	agent.canvas.toPngBuffer(),
);
writeFileSync(
	join(SPRITES_DIR, "agent-spritesheet.json"),
	JSON.stringify(agent.json, null, "\t"),
);
console.log("   ✓ agent-spritesheet.png (256x32)");
console.log("   ✓ agent-spritesheet.json");

// Generate judge sprite sheet
console.log("📍 Generating judge sprite sheet...");
const judge = generateSpriteSheet(true);
writeFileSync(
	join(SPRITES_DIR, "judge-spritesheet.png"),
	judge.canvas.toPngBuffer(),
);
writeFileSync(
	join(SPRITES_DIR, "judge-spritesheet.json"),
	JSON.stringify(judge.json, null, "\t"),
);
console.log("   ✓ judge-spritesheet.png (256x32)");
console.log("   ✓ judge-spritesheet.json");

// Generate podium
console.log("📍 Generating podium...");
const podium = generatePodium();
writeFileSync(join(SPRITES_DIR, "podium.png"), podium.toPngBuffer());
console.log("   ✓ podium.png (32x24)");

console.log("\n✨ All sprites generated successfully!");
console.log(`   Output: ${SPRITES_DIR}`);
