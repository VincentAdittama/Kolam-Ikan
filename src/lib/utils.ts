import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a timestamp to a relative time string (e.g., "2h ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format a timestamp to ISO format for display
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Format a timestamp for entry display
 */
export function formatEntryTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Estimate token count for text (high-performance approximation)
 */
export function estimateTokens(text: string): number {
  // Remove code blocks and count separately (they compress better)
  const codeBlockPattern = /```[\s\S]*?```/g;
  const codeBlocks = text.match(codeBlockPattern) || [];
  const textWithoutCode = text.replace(codeBlockPattern, "");

  // Main text: 1 token ≈ 4 characters
  const textTokens = Math.ceil(textWithoutCode.length / 4);

  // Code: 1 token ≈ 3 characters (better compression)
  const codeTokens = Math.ceil(codeBlocks.join("").length / 3);

  return textTokens + codeTokens;
}

/**
 * Get token usage status based on percentage
 */
export function getTokenStatus(
  percentage: number
): "normal" | "warning" | "critical" | "exceeded" {
  if (percentage > 100) return "exceeded";
  if (percentage > 95) return "critical";
  if (percentage > 80) return "warning";
  return "normal";
}

/**
 * Format token count for display (e.g., "2,450")
 */
export function formatTokenCount(count: number): string {
  return count.toLocaleString();
}

/**
 * Generate a short unique ID
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Debounce function for auto-save
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
