"use client";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

/**
 * Dynamically imported CourtroomCanvas with SSR disabled
 * PixiJS cannot be rendered on the server
 */
export const DynamicCourtroomCanvas = dynamic(
	() =>
		import("./CourtroomCanvas").then((mod) => ({
			default: mod.CourtroomCanvas,
		})),
	{
		ssr: false,
		loading: () => (
			<div className="flex h-full w-full items-center justify-center bg-muted/50">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		),
	},
);
