"use client";

/**
 * useMediaQuery - Hook for responsive breakpoint detection
 */

import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(false);

	useEffect(() => {
		// Check if we're on the server
		if (typeof window === "undefined") return;

		const mediaQuery = window.matchMedia(query);

		// Set initial value
		setMatches(mediaQuery.matches);

		// Handler for changes
		const handler = (e: MediaQueryListEvent) => {
			setMatches(e.matches);
		};

		// Modern API
		mediaQuery.addEventListener("change", handler);

		return () => {
			mediaQuery.removeEventListener("change", handler);
		};
	}, [query]);

	return matches;
}

/**
 * Responsive breakpoint hooks based on spec section 11.2
 */

// Mobile: < 768px
export function useIsMobile(): boolean {
	return useMediaQuery("(max-width: 767px)");
}

// Tablet: 768px - 1023px
export function useIsTablet(): boolean {
	return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

// Desktop: >= 1024px
export function useIsDesktop(): boolean {
	return useMediaQuery("(min-width: 1024px)");
}

/**
 * Get current breakpoint name
 */
export function useBreakpoint(): "mobile" | "tablet" | "desktop" {
	const isMobile = useIsMobile();
	const isTablet = useIsTablet();

	if (isMobile) return "mobile";
	if (isTablet) return "tablet";
	return "desktop";
}

/**
 * Detect reduced motion preference
 */
export function usePrefersReducedMotion(): boolean {
	return useMediaQuery("(prefers-reduced-motion: reduce)");
}
