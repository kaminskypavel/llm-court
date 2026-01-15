import { Suspense } from "react";
import { DebatePlayer } from "@/components/player/DebatePlayer";

// Default example debate URL - always preload for demo purposes
const DEFAULT_DEBATE_URL = "/examples/local-cli-debate-output.json";

export const metadata = {
	title: "Debate Player | LLM Court",
	description: "Watch and interact with LLM debate replays",
};

type PageProps = {
	searchParams: Promise<{ url?: string }>;
};

export default async function PlayerPage({ searchParams }: PageProps) {
	const params = await searchParams;
	const initialUrl = params.url ?? DEFAULT_DEBATE_URL;

	return (
		<main className="h-full overflow-hidden">
			<Suspense fallback={<PlayerLoading />}>
				<DebatePlayer initialUrl={initialUrl} />
			</Suspense>
		</main>
	);
}

function PlayerLoading() {
	return (
		<div className="flex h-full items-center justify-center">
			<div className="animate-pulse text-muted-foreground">
				Loading player...
			</div>
		</div>
	);
}
