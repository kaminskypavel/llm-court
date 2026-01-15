"use client";

import { FileJson, Link, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DebateDropZoneProps = {
	isLoading: boolean;
	onFileSelect: (file: File) => void;
	onUrlSubmit: (url: string) => void;
};

export function DebateDropZone({
	isLoading,
	onFileSelect,
	onUrlSubmit,
}: DebateDropZoneProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);

			const file = e.dataTransfer.files[0];
			if (
				file &&
				(file.type === "application/json" ||
					file.name.toLowerCase().endsWith(".json"))
			) {
				onFileSelect(file);
			}
		},
		[onFileSelect],
	);

	const handleFileInput = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				onFileSelect(file);
			}
		},
		[onFileSelect],
	);

	const handleUrlSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			if (urlInput.trim()) {
				onUrlSubmit(urlInput.trim());
			}
		},
		[urlInput, onUrlSubmit],
	);

	const handleBrowseClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	return (
		<Card
			className={cn(
				"flex flex-col items-center justify-center gap-6 border-2 border-dashed p-8 transition-colors",
				isDragging && "border-primary bg-primary/5",
				isLoading && "pointer-events-none opacity-50",
			)}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{/* File upload area */}
			<div className="flex flex-col items-center gap-4">
				<div className="rounded-full bg-muted p-4">
					<FileJson className="h-8 w-8 text-muted-foreground" />
				</div>
				<div className="text-center">
					<p className="font-medium">Drop a debate JSON file here</p>
					<p className="text-muted-foreground text-sm">
						or click to browse your files
					</p>
				</div>
				<input
					ref={fileInputRef}
					type="file"
					accept=".json,application/json"
					onChange={handleFileInput}
					className="hidden"
					disabled={isLoading}
				/>
				<Button
					variant="outline"
					onClick={handleBrowseClick}
					disabled={isLoading}
				>
					<Upload className="mr-2 h-4 w-4" />
					Choose File
				</Button>
			</div>

			{/* Divider */}
			<div className="flex w-full max-w-md items-center gap-4">
				<div className="h-px flex-1 bg-border" />
				<span className="text-muted-foreground text-sm">or</span>
				<div className="h-px flex-1 bg-border" />
			</div>

			{/* URL input */}
			<form onSubmit={handleUrlSubmit} className="flex w-full max-w-md gap-2">
				<div className="relative flex-1">
					<Link className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="url"
						placeholder="https://example.com/debate.json"
						value={urlInput}
						onChange={(e) => setUrlInput(e.target.value)}
						className="pl-10"
						disabled={isLoading}
					/>
				</div>
				<Button type="submit" disabled={!urlInput.trim() || isLoading}>
					Load URL
				</Button>
			</form>
		</Card>
	);
}
