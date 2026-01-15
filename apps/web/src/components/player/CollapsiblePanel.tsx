"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CollapsiblePanelProps = {
	title: string;
	badge?: string | number;
	icon?: React.ReactNode;
	defaultOpen?: boolean;
	children: React.ReactNode;
	className?: string;
	headerClassName?: string;
	contentClassName?: string;
};

export function CollapsiblePanel({
	title,
	badge,
	icon,
	defaultOpen = true,
	children,
	className,
	headerClassName,
	contentClassName,
}: CollapsiblePanelProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	return (
		<Card className={cn("flex flex-col overflow-hidden", className)}>
			{/* Header - always visible */}
			<Button
				variant="ghost"
				className={cn(
					"flex h-auto w-full items-center justify-between rounded-none border-b p-3 hover:bg-muted/50",
					!isOpen && "border-b-0",
					headerClassName,
				)}
				onClick={() => setIsOpen(!isOpen)}
			>
				<div className="flex items-center gap-2">
					{icon}
					<span className="font-semibold text-sm">{title}</span>
					{badge !== undefined && (
						<span className="text-muted-foreground text-xs">
							{typeof badge === "number" ? `(${badge})` : badge}
						</span>
					)}
				</div>
				{isOpen ? (
					<ChevronDown className="h-4 w-4 text-muted-foreground" />
				) : (
					<ChevronRight className="h-4 w-4 text-muted-foreground" />
				)}
			</Button>

			{/* Content - collapsible */}
			{isOpen && (
				<div className={cn("flex-1 overflow-hidden", contentClassName)}>
					{children}
				</div>
			)}
		</Card>
	);
}
