"use client";

import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CollapsibleSidebarProps = {
	title: string;
	badge?: string | number;
	icon?: React.ReactNode;
	position: "right" | "bottom";
	defaultOpen?: boolean;
	children: React.ReactNode;
	className?: string;
	width?: string; // For right sidebar
	height?: string; // For bottom sidebar
};

export function CollapsibleSidebar({
	title,
	badge,
	icon,
	position,
	defaultOpen = true,
	children,
	className,
	width = "w-80",
	height = "h-48",
}: CollapsibleSidebarProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	if (position === "right") {
		return (
			<div
				className={cn(
					"flex shrink-0 transition-all duration-200",
					isOpen ? width : "w-10",
					className,
				)}
			>
				{/* Toggle button */}
				<Button
					variant="ghost"
					size="icon"
					className="h-full w-10 shrink-0 rounded-none border-l hover:bg-muted/50"
					onClick={() => setIsOpen(!isOpen)}
					title={isOpen ? `Collapse ${title}` : `Expand ${title}`}
				>
					<div className="flex flex-col items-center gap-1">
						{isOpen ? (
							<ChevronRight className="h-4 w-4" />
						) : (
							<ChevronLeft className="h-4 w-4" />
						)}
						{!isOpen && (
							<span className="writing-vertical-rl rotate-180 text-xs">
								{title}
								{badge !== undefined && ` (${badge})`}
							</span>
						)}
					</div>
				</Button>

				{/* Content */}
				{isOpen && (
					<div className="flex min-w-0 flex-1 flex-col overflow-hidden border-l">
						{/* Header */}
						<div className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-3 py-2">
							{icon}
							<span className="font-medium text-sm">{title}</span>
							{badge !== undefined && (
								<span className="text-muted-foreground text-xs">({badge})</span>
							)}
						</div>
						{/* Body */}
						<div className="flex-1 overflow-hidden">{children}</div>
					</div>
				)}
			</div>
		);
	}

	// Bottom position
	return (
		<div
			className={cn(
				"flex shrink-0 flex-col transition-all duration-200",
				isOpen ? height : "h-10",
				className,
			)}
		>
			{/* Toggle button / Header */}
			<Button
				variant="ghost"
				className="flex h-10 w-full shrink-0 items-center justify-between rounded-none border-t px-3 hover:bg-muted/50"
				onClick={() => setIsOpen(!isOpen)}
			>
				<div className="flex items-center gap-2">
					{icon}
					<span className="font-medium text-sm">{title}</span>
					{badge !== undefined && (
						<span className="text-muted-foreground text-xs">({badge})</span>
					)}
				</div>
				{isOpen ? (
					<ChevronDown className="h-4 w-4" />
				) : (
					<ChevronUp className="h-4 w-4" />
				)}
			</Button>

			{/* Content */}
			{isOpen && (
				<div className="flex-1 overflow-hidden border-t">{children}</div>
			)}
		</div>
	);
}
