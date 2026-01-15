"use client";

import { ExternalLink, FileJson, History, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	clearRecentDebates,
	getRecentDebates,
	removeFromRecent,
} from "@/lib/player/storage";
import type { RecentDebate } from "@/lib/player/types";

type RecentDebatesProps = {
	onSelect: (url: string) => void;
};

// Get display name for URL (handles relative paths)
function getUrlDisplayName(url: string): string {
	// Relative URL - show the filename
	if (url.startsWith("/")) {
		const parts = url.split("/");
		return parts[parts.length - 1] || url;
	}
	// Absolute URL - show hostname
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

export function RecentDebates({ onSelect }: RecentDebatesProps) {
	const [recents, setRecents] = useState<RecentDebate[]>([]);

	// Load recents on mount
	useEffect(() => {
		setRecents(getRecentDebates());
	}, []);

	const handleRemove = useCallback((id: string) => {
		removeFromRecent(id);
		setRecents(getRecentDebates());
	}, []);

	const handleClearAll = useCallback(() => {
		clearRecentDebates();
		setRecents([]);
	}, []);

	if (recents.length === 0) {
		return null;
	}

	return (
		<Card className="p-4">
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<History className="h-4 w-4 text-muted-foreground" />
					<h3 className="font-medium">Recent Debates</h3>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={handleClearAll}
					className="text-muted-foreground text-xs"
				>
					Clear all
				</Button>
			</div>

			<ul className="space-y-2">
				{recents.map((recent) => (
					<li
						key={recent.id}
						className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/50"
					>
						<div className="rounded bg-muted p-1.5">
							{recent.source === "url" ? (
								<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
							) : (
								<FileJson className="h-3.5 w-3.5 text-muted-foreground" />
							)}
						</div>

						<Button
							variant="ghost"
							className="h-auto flex-1 justify-start p-0 text-left hover:bg-transparent"
							onClick={() => {
								// For now, we can't reload from storage
								// In production, we'd store the URL or use IndexedDB for file data
								if (recent.source === "url") {
									onSelect(recent.sourceName);
								}
							}}
							disabled={recent.source === "file"}
						>
							<div className="flex flex-col">
								<span className="line-clamp-1 font-medium">{recent.topic}</span>
								<span className="text-muted-foreground text-xs">
									{recent.source === "url"
										? getUrlDisplayName(recent.sourceName)
										: recent.sourceName}
									{" · "}
									{formatRelativeTime(recent.loadedAt)}
								</span>
							</div>
						</Button>

						<Button
							variant="ghost"
							size="icon"
							onClick={() => handleRemove(recent.id)}
							className="h-8 w-8 shrink-0"
							aria-label="Remove from history"
						>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					</li>
				))}
			</ul>
		</Card>
	);
}

function formatRelativeTime(isoString: string): string {
	const date = new Date(isoString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString();
}
